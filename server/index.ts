import { Database } from "bun:sqlite";
import { chmodSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";

const port = Number(process.env.OMP_CONTROL_PORT ?? 48767);
const dbPath = resolve(process.env.OMP_CONTROL_DB_PATH ?? "./data/omp-control.sqlite");
mkdirSync(dirname(dbPath), { recursive: true });
process.umask(0o077);
const db = new Database(dbPath, { create: true });
db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
try {
  chmodSync(dirname(dbPath), 0o700);
  chmodSync(dbPath, 0o600);
  chmodSync(dbPath + "-wal", 0o600);
  chmodSync(dbPath + "-shm", 0o600);
} catch {}
db.exec("CREATE TABLE IF NOT EXISTS instances (id TEXT PRIMARY KEY, name TEXT NOT NULL, base_url TEXT NOT NULL, credential TEXT, status TEXT NOT NULL DEFAULT 'unknown', version TEXT, last_seen_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)");

type Row = { id: string; name: string; base_url: string; status: string; version: string | null; last_seen_at: string | null; created_at: string; updated_at: string };
const publicInstance = (r: Row) => ({ id: r.id, name: r.name, baseUrl: r.base_url, status: r.status, ...(r.version ? { version: r.version } : {}), ...(r.last_seen_at ? { lastSeenAt: r.last_seen_at } : {}), createdAt: r.created_at, updatedAt: r.updated_at });
const getRow = db.query("SELECT id,name,base_url,status,version,last_seen_at,created_at,updated_at FROM instances WHERE id = ?");
const listRows = db.query("SELECT id,name,base_url,status,version,last_seen_at,created_at,updated_at FROM instances ORDER BY created_at DESC");
const send = (data: unknown, status = 200) => Response.json(data, { status, headers: { "cache-control": "no-store" } });
const fail = (code: string, message: string, status = 400) => send({ error: { code, message } }, status);
const readJson = async (req: Request) => {
  try { return await req.json() as Record<string, unknown>; } catch { throw new Error("Request body must be valid JSON"); }
};
function validateBaseUrl(value: unknown): URL {
  if (typeof value !== "string" || !value.trim()) throw new Error("baseUrl is required");
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("baseUrl must be a valid URL"); }
  if (!["https:", "http:"].includes(url.protocol)) throw new Error("Only HTTP and HTTPS URLs are supported");
  if (url.username || url.password || url.search || url.hash) throw new Error("URL must not include credentials, query, or fragment");
  const local = ["localhost", "127.0.0.1", "[::1]", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !local) throw new Error("HTTPS is required except for loopback development instances");
  if (url.port && (!/^\d+$/.test(url.port) || Number(url.port) < 1 || Number(url.port) > 65535)) throw new Error("Invalid port");
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url;
}
function safeName(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("name is required");
  const name = value.trim();
  if (name.length > 80) throw new Error("name must be 80 characters or fewer");
  return name;
}
async function checkHealth(id: string) {
  const row = db.query("SELECT id,base_url,credential FROM instances WHERE id = ?").get(id) as { id: string; base_url: string; credential: string | null } | null;
  if (!row) return fail("NOT_FOUND", "Instance not found", 404);
  const checkedAt = new Date().toISOString(), started = performance.now();
  try {
    const url = validateBaseUrl(row.base_url);
    url.pathname = (url.pathname + "/api/dashboard").replace(/\/+/g, "/");
    const headers = new Headers({ accept: "application/json" });
    if (row.credential) headers.set("authorization", "Bearer " + row.credential);
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(4000), redirect: "error" });
    if (!response.ok) throw new Error("Runtime returned HTTP " + response.status);
    db.query("UPDATE instances SET status='online', last_seen_at=?, updated_at=? WHERE id=?").run(checkedAt, checkedAt, id);
    return send({ status: "online", checkedAt, latencyMs: Math.round(performance.now() - started) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Health check failed";
    db.query("UPDATE instances SET status='offline', updated_at=? WHERE id=?").run(checkedAt, id);
    return send({ status: "offline", checkedAt, latencyMs: Math.round(performance.now() - started), error: message });
  }
}

function runtimeRouteAllowed(path: string, method: string): boolean {
  const exact: Record<string, string[]> = {
    "/api/dashboard": ["GET"],
    "/api/events": ["GET"],
    "/api/terminals": ["GET", "POST"],
    "/api/tools": ["GET"],
    "/api/logs": ["GET"],
    "/api/approvals": ["GET"],
    "/api/approvals/clear": ["POST"],
    "/api/profile": ["GET", "PUT"],
    "/api/workspace": ["GET", "DELETE"],
    "/api/workspace/state": ["GET"],
    "/api/workspace/pins": ["POST", "DELETE"],
    "/api/workspace/pins/order": ["PUT"],
    "/api/workspace/favorites": ["POST", "DELETE"],
    "/api/workspace/recents": ["POST", "DELETE"],
    "/api/workspace/prefs": ["PUT"],
    "/api/workspace/editor-session": ["GET", "PUT"],
    "/api/workspace/file": ["GET", "PUT"],
    "/api/workspace/preview": ["GET"],
    "/api/workspace/download": ["GET"],
    "/api/workspace/stat": ["GET"],
    "/api/workspace/create": ["POST"],
    "/api/workspace/rename": ["POST"],
    "/api/workspace/duplicate": ["POST"],
    "/api/workspace/move": ["POST"],
  };
  if (exact[path]?.includes(method)) return true;
  if (new RegExp("^/api/terminals/[^/]+$").test(path)) return method === "DELETE";
  if (new RegExp("^/api/tools/[^/]+$").test(path)) return method === "PATCH";
  if (new RegExp("^/api/approvals/[^/]+/(approve|approve-session|deny)$").test(path)) return method === "POST";
  if (new RegExp("^/api/sessions/[^/]+/(interrupt|dispose)$").test(path)) return method === "POST";
  return false;
}

async function proxyRuntime(req: Request, instanceId: string, path: string, incoming: URL) {
  const row = db.query("SELECT base_url,credential FROM instances WHERE id = ?").get(instanceId) as { base_url: string; credential: string | null } | null;
  if (!row) return fail("NOT_FOUND", "Instance not found", 404);
  if (!path.startsWith("/api/") || path.includes("\\") || /%2f|%5c/i.test(path) || path.split("/").includes(".."))
    return fail("INVALID_RUNTIME_PATH", "Invalid runtime path", 400);
  if (!runtimeRouteAllowed(path, req.method)) return fail("RUNTIME_ROUTE_NOT_ALLOWED", "This runtime route or method is not allowed", 403);
  try {
    const target = validateBaseUrl(row.base_url);
    target.pathname = (target.pathname + path).replace(/\/+/g, "/");
    target.search = incoming.search;
    const headers = new Headers();
    for (const key of ["accept", "content-type", "range", "if-none-match", "if-modified-since"]) {
      const value = req.headers.get(key);
      if (value) headers.set(key, value);
    }
    if (row.credential) headers.set("authorization", "Bearer " + row.credential);
    const init: RequestInit = { method: req.method, headers, redirect: "error" };
    if (req.method !== "GET" && req.method !== "HEAD") init.body = await req.arrayBuffer();
    if (path !== "/api/events") init.signal = AbortSignal.timeout(15000);
    const upstream = await fetch(target, init);
    const responseHeaders = new Headers();
    for (const key of ["content-type", "cache-control", "content-disposition", "etag", "last-modified", "accept-ranges", "content-range"]) {
      const value = upstream.headers.get(key);
      if (value) responseHeaders.set(key, value);
    }
    if (path === "/api/events") {
      responseHeaders.set("content-type", "text/event-stream; charset=utf-8");
      responseHeaders.set("cache-control", "no-cache, no-store, must-revalidate");
      responseHeaders.set("connection", "keep-alive");
      responseHeaders.set("x-accel-buffering", "no");
    }
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Runtime request failed";
    return fail("RUNTIME_UNAVAILABLE", message, 502);
  }
}


function upgradeRuntimeSocket(req: Request, server: any, instanceId: string, path: string, incoming: URL) {
  const row = db.query("SELECT base_url,credential FROM instances WHERE id = ?").get(instanceId) as { base_url: string; credential: string | null } | null;
  if (!row) return fail("NOT_FOUND", "Instance not found", 404);
  if (path !== "/api/terminal/socket" || row.credential) {
    return fail("RUNTIME_WEBSOCKET_UNSUPPORTED", row.credential ? "Terminal WebSocket proxy does not support bearer credentials yet" : "WebSocket route is not allowed", 501);
  }
  try {
    const target = validateBaseUrl(row.base_url);
    target.protocol = target.protocol === "https:" ? "wss:" : "ws:";
    target.pathname = (target.pathname + path).replace(/\/+/g, "/");
    target.search = incoming.search;
    const upstream = new WebSocket(target.toString());
    const data = { upstream, pending: [] as Array<string | ArrayBuffer | Blob>, pendingClient: [] as Array<string | ArrayBuffer | Blob>, clientReady: false };
    upstream.addEventListener("open", () => {
      for (const message of data.pendingClient) upstream.send(message);
      data.pendingClient.length = 0;
    });
    upstream.addEventListener("message", (event) => {
      const client = data as typeof data & { client?: any };
      if (client.clientReady && client.client?.readyState === 1) client.client.send(event.data);
      else data.pending.push(event.data);
    });
    upstream.addEventListener("close", () => {
      const client = data as typeof data & { client?: any };
      if (client.clientReady && client.client?.readyState === 1) client.client.close();
    });
    if (!server.upgrade(req, { data })) {
      upstream.close();
      return fail("WEBSOCKET_UPGRADE_FAILED", "Unable to upgrade terminal connection", 400);
    }
    return undefined;
  } catch (error) {
    return fail("RUNTIME_UNAVAILABLE", error instanceof Error ? error.message : "Unable to connect terminal", 502);
  }
}

const server = Bun.serve({
  hostname: process.env.OMP_CONTROL_HOST ?? "127.0.0.1",
  port,
  websocket: {
    open(ws) {
      const data = ws.data as { upstream: WebSocket; pending: Array<string | ArrayBuffer | Blob>; clientReady: boolean; client?: any };
      data.client = ws;
      data.clientReady = true;
      for (const message of data.pending) ws.send(message);
      data.pending.length = 0;
      data.upstream.addEventListener("close", () => { try { ws.close(); } catch {} });
    },
    message(ws, message) {
      const data = ws.data as { upstream: WebSocket; pendingClient: Array<string | ArrayBuffer | Blob> };
      if (data.upstream.readyState === WebSocket.OPEN) data.upstream.send(message);
      else data.pendingClient.push(message as string | ArrayBuffer | Blob);
    },
    close(ws) {
      const data = ws.data as { upstream: WebSocket };
      try { data.upstream.close(); } catch {}
    },
  },
  async fetch(req, server) {
    const url = new URL(req.url);
    if (url.pathname === "/healthz") return send({ status: "ok", service: "omp-control" });
    if (!url.pathname.startsWith("/control/v1/")) return fail("NOT_FOUND", "Route not found", 404);
    try {
      const runtimeMatch = url.pathname.match(/^\/control\/v1\/instances\/([^/]+)\/runtime(\/.*)$/);
      if (runtimeMatch && runtimeMatch[2] === "/api/terminal/socket" && req.headers.get("upgrade")?.toLowerCase() === "websocket") {
        return upgradeRuntimeSocket(req, server, decodeURIComponent(runtimeMatch[1]), runtimeMatch[2], url) as Response;
      }
      if (runtimeMatch) return await proxyRuntime(req, decodeURIComponent(runtimeMatch[1]), runtimeMatch[2], url);
      if (url.pathname === "/control/v1/instances" && req.method === "GET") return send({ instances: (listRows.all() as Row[]).map(publicInstance) });
      if (url.pathname === "/control/v1/instances" && req.method === "POST") {
        const body = await readJson(req), name = safeName(body.name);
        const baseUrl = validateBaseUrl(body.baseUrl).toString().replace(/\/$/, "");
        const credential = typeof body.credential === "string" && body.credential.trim() ? body.credential.trim() : null;
        if (credential && credential.length > 4096) throw new Error("credential is too long");
        const now = new Date().toISOString(), id = randomUUID();
        db.query("INSERT INTO instances (id,name,base_url,credential,status,created_at,updated_at) VALUES (?,?,?,?,'unknown',?,?)").run(id, name, baseUrl, credential, now, now);
        return send({ instance: publicInstance(getRow.get(id) as Row) }, 201);
      }
      const match = url.pathname.match(/^\/control\/v1\/instances\/([^/]+)(?:\/(health-check))?$/);
      if (match) {
        const id = decodeURIComponent(match[1]);
        if (match[2] === "health-check" && req.method === "POST") return await checkHealth(id);
        if (!match[2] && req.method === "GET") {
          const row = getRow.get(id) as Row | null;
          return row ? send({ instance: publicInstance(row) }) : fail("NOT_FOUND", "Instance not found", 404);
        }
        if (!match[2] && req.method === "PATCH") {
          const old = db.query("SELECT * FROM instances WHERE id = ?").get(id) as { name: string; base_url: string; credential: string | null } | null;
          if (!old) return fail("NOT_FOUND", "Instance not found", 404);
          const body = await readJson(req), name = body.name === undefined ? old.name : safeName(body.name);
          const baseUrl = body.baseUrl === undefined ? old.base_url : validateBaseUrl(body.baseUrl).toString().replace(/\/$/, "");
          const credential = body.credential === undefined ? old.credential : (typeof body.credential === "string" && body.credential.trim() ? body.credential.trim() : null);
          const now = new Date().toISOString();
          db.query("UPDATE instances SET name=?,base_url=?,credential=?,status='unknown',version=NULL,updated_at=? WHERE id=?").run(name, baseUrl, credential, now, id);
          return send({ instance: publicInstance(getRow.get(id) as Row) });
        }
        if (!match[2] && req.method === "DELETE") {
          const result = db.query("DELETE FROM instances WHERE id = ?").run(id);
          return result.changes ? new Response(null, { status: 204 }) : fail("NOT_FOUND", "Instance not found", 404);
        }
      }
      return fail("METHOD_NOT_ALLOWED", "Unsupported route or method", 405);
    } catch (e) { return fail("INVALID_REQUEST", e instanceof Error ? e.message : "Request failed", 400); }
  },
});
console.log("omp-control API listening on http://" + server.hostname + ":" + server.port);
