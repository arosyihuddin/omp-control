import { Database } from "bun:sqlite";
import { chmodSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createHash } from "node:crypto";
import { randomUUID } from "node:crypto";

function initializeDatabase(): Database {
  const dbPath = resolve(process.env.OMP_CONTROL_DB_PATH ?? "./data/omp-control.sqlite");
  mkdirSync(dirname(dbPath), { recursive: true });
  const previousUmask = process.umask(0o077);
  let database: Database;
  try {
    database = new Database(dbPath, { create: true });
  } finally {
    process.umask(previousUmask);
  }
  database.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  try {
    chmodSync(dirname(dbPath), 0o700);
    chmodSync(dbPath, 0o600);
    chmodSync(dbPath + "-wal", 0o600);
    chmodSync(dbPath + "-shm", 0o600);
  } catch {}
  database.exec("CREATE TABLE IF NOT EXISTS instances (id TEXT PRIMARY KEY, name TEXT NOT NULL, base_url TEXT NOT NULL, credential TEXT, status TEXT NOT NULL DEFAULT 'unknown', version TEXT, last_seen_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)");
  database.exec("CREATE TABLE IF NOT EXISTS auth_users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL)");
  database.exec("CREATE TABLE IF NOT EXISTS auth_sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL)");
  return database;
}
let database: Database | undefined;
const db = new Proxy({} as Database, {
  get(_target, property) {
    database ??= initializeDatabase();
    const value = Reflect.get(database, property, database);
    return typeof value === "function" ? value.bind(database) : value;
  },
});
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const cookieName = "omp_control_session";
function requestUsesHttps(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (origin) {
    try { return new URL(origin).protocol === "https:"; } catch {}
  }
  return new URL(req.url).protocol === "https:";
}
function sessionToken(req: Request): string | null {
  const cookie = req.headers.get("cookie") ?? "";
  const part = cookie.split(";").map((v) => v.trim()).find((v) => v.startsWith(cookieName + "="));
  return part ? decodeURIComponent(part.slice(cookieName.length + 1)) : null;
}
function authenticated(req: Request): boolean {
  const token = sessionToken(req);
  if (!token) return false;
  const row = db.query("SELECT token_hash FROM auth_sessions WHERE token_hash = ? AND expires_at > ?").get(hashToken(token), Date.now()) as { token_hash: string } | null;
  return !!row;
}
function sessionCookie(token: string, maxAge: number, secure: boolean) {
  return cookieName + "=" + encodeURIComponent(token) + "; Path=/control; HttpOnly; SameSite=Strict; Max-Age=" + maxAge + (secure ? "; Secure" : "");
}
function authSend(data: unknown, cookie: string, status = 200) {
  return Response.json(data, { status, headers: { "cache-control": "no-store", "set-cookie": cookie } });
}

type Row = { id: string; name: string; base_url: string; status: string; version: string | null; last_seen_at: string | null; created_at: string; updated_at: string };
const publicInstance = (r: Row) => ({ id: r.id, name: r.name, baseUrl: r.base_url, status: r.status, ...(r.version ? { version: r.version } : {}), ...(r.last_seen_at ? { lastSeenAt: r.last_seen_at } : {}), createdAt: r.created_at, updatedAt: r.updated_at });
const getRow = (id: string) => db.query("SELECT id,name,base_url,status,version,last_seen_at,created_at,updated_at FROM instances WHERE id = ?").get(id);
const listRows = () => db.query("SELECT id,name,base_url,status,version,last_seen_at,created_at,updated_at FROM instances ORDER BY created_at DESC").all();
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
    "/api/tunnels": ["GET", "POST"],
    "/api/tunnels/status": ["GET"],
    "/api/tunnels/events": ["GET"],
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
    "/api/workspace/git-status": ["GET"],
    "/api/workspace/git-diff": ["GET"],
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
  if (new RegExp("^/api/tunnels/[^/]+$").test(path)) return method === "GET";
  if (new RegExp("^/api/tunnels/[^/]+/logs$").test(path)) return method === "GET";
  if (new RegExp("^/api/tunnels/[^/]+/stop$").test(path)) return method === "POST" || method === "DELETE";
  if (new RegExp("^/api/tools/sections/(read_only|edit_delete|other)/permission$").test(path)) return method === "PATCH";
  if (new RegExp("^/api/tools/sections/(read_only|edit_delete|other)/permission$").test(path)) return method === "PATCH";
  if (new RegExp("^/api/tools/[^/]+$").test(path)) return method === "PATCH";
  if (new RegExp("^/api/approvals/[^/]+/(approve|approve-session|deny)$").test(path)) return method === "POST";
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
    if (path !== "/api/events" && path !== "/api/tunnels/events") init.signal = AbortSignal.timeout(15000);
    const upstream = await fetch(target, init);
    const responseHeaders = new Headers();
    for (const key of ["content-type", "cache-control", "content-disposition", "etag", "last-modified", "accept-ranges", "content-range"]) {
      const value = upstream.headers.get(key);
      if (value) responseHeaders.set(key, value);
    }
    if (path === "/api/events" || path === "/api/tunnels/events") {
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


async function upgradeRuntimeSocket(req: Request, platform: any, instanceId: string, path: string, incoming: URL): Promise<Response> {
  const row = db.query("SELECT base_url,credential FROM instances WHERE id = ?").get(instanceId) as { base_url: string; credential: string | null } | null;
  if (!row) return fail("NOT_FOUND", "Instance not found", 404);
  if (path !== "/api/terminal/socket") {
    return fail("RUNTIME_WEBSOCKET_UNSUPPORTED", "WebSocket route is not allowed", 501);
  }
  let upstream: WebSocket | undefined;
  try {
    const target = validateBaseUrl(row.base_url);
    target.protocol = target.protocol === "https:" ? "wss:" : "ws:";
    target.pathname = (target.pathname + path).replace(/\/+/g, "/");
    target.search = incoming.search;
    const BunWebSocket = WebSocket as unknown as new (
      url: string,
      options?: { headers?: Record<string, string> },
    ) => WebSocket;
    upstream = new BunWebSocket(
      target.toString(),
      row.credential ? { headers: { Authorization: `Bearer ${row.credential}` } } : undefined,
    );
    const data: any = {
      upstream,
      pending: [] as Array<string | ArrayBuffer | Blob>,
      pendingClient: [] as Array<string | ArrayBuffer | Blob>,
      clientReady: false,
      open(ws: any) {
        const state = ws.data as typeof data;
        state.client = ws;
        state.clientReady = true;
        for (const message of state.pending) ws.send(message);
        state.pending.length = 0;
      },
      message(ws: any, message: string | Buffer) {
        const state = ws.data as typeof data;
        if (state.upstream.readyState === WebSocket.OPEN) state.upstream.send(message);
        else state.pendingClient.push(message as string | ArrayBuffer | Blob);
      },
      close(ws: any) { try { (ws.data as typeof data).upstream.close(); } catch {} },
    };
    upstream.addEventListener("open", () => {
      for (const message of data.pendingClient) upstream?.send(message);
      data.pendingClient.length = 0;
    });
    upstream.addEventListener("message", (event) => {
      if (data.clientReady && data.client?.readyState === 1) data.client.send(event.data);
      else data.pending.push(event.data);
    });
    upstream.addEventListener("close", () => {
      if (data.clientReady && data.client?.readyState === 1) data.client.close();
    });
    upstream.addEventListener("error", () => {
      if (data.clientReady && data.client?.readyState === 1) {
        try { data.client.send(JSON.stringify({ type: "error", message: "Runtime WebSocket connection failed" })); } catch {}
        try { data.client.close(1011, "Runtime WebSocket connection failed"); } catch {}
      }
    });
    await new Promise<void>((resolve, reject) => {
      if (upstream?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }
      const timer = setTimeout(() => reject(new Error("Timed out connecting to runtime terminal")), 5000);
      upstream?.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
      upstream?.addEventListener("error", () => { clearTimeout(timer); reject(new Error("Runtime WebSocket connection failed")); }, { once: true });
    });
    const upgraded = Boolean(platform?.upgrade && platform.upgrade(data));
    if (!upgraded) {
      console.error("[terminal-ws] browser upgrade failed", { instanceId, hasPlatform: Boolean(platform), hasUpgrade: typeof platform?.upgrade === "function" });
      upstream.close();
      return fail("WEBSOCKET_UPGRADE_FAILED", "Unable to upgrade terminal connection", 400);
    }
    return new Response(null);
  } catch (error) {
    console.error("[terminal-ws] connection failed", { instanceId, error: error instanceof Error ? error.message : String(error) });
    try { upstream?.close(); } catch {}
    return fail("RUNTIME_UNAVAILABLE", error instanceof Error ? error.message : "Unable to connect terminal", 502);
  }
}


export async function handleControlRequest(req: Request, server?: any): Promise<Response> {
  const url = new URL(req.url);
  if (url.pathname === "/healthz") return send({ status: "ok", service: "omp-control" });
  if (!url.pathname.startsWith("/control/v1/")) return fail("NOT_FOUND", "Route not found", 404);
  try {
    if (url.pathname === "/control/v1/auth/status" && req.method === "GET") {
      const configured = (db.query("SELECT COUNT(*) AS count FROM auth_users").get() as { count: number }).count > 0;
      return send({ configured, authenticated: authenticated(req) });
    }
    if (url.pathname === "/control/v1/auth/setup" && req.method === "POST") {
      if ((db.query("SELECT COUNT(*) AS count FROM auth_users").get() as { count: number }).count > 0) return fail("ALREADY_CONFIGURED", "An account has already been created", 409);
      const body = await readJson(req);
      const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
      const password = typeof body.password === "string" ? body.password : "";
      if (!/^[a-z0-9._-]{3,64}$/.test(username)) return fail("INVALID_USERNAME", "Username must be 3–64 characters and use letters, numbers, dots, underscores, or hyphens");
      if (password.length < 12 || password.length > 1024) return fail("INVALID_PASSWORD", "Password must be between 12 and 1024 characters");
      const id = randomUUID();
      db.query("INSERT INTO auth_users (id,username,password_hash,created_at) VALUES (?,?,?,?)").run(id, username, await Bun.password.hash(password), new Date().toISOString());
      const token = randomUUID() + randomUUID();
      db.query("INSERT INTO auth_sessions (token_hash,user_id,expires_at) VALUES (?,?,?)").run(hashToken(token), id, Date.now() + 30 * 24 * 60 * 60 * 1000);
      return authSend({ authenticated: true, username }, sessionCookie(token, 30 * 24 * 60 * 60, requestUsesHttps(req)), 201);
    }
    if (url.pathname === "/control/v1/auth/login" && req.method === "POST") {
      const body = await readJson(req);
      const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
      const password = typeof body.password === "string" ? body.password : "";
      const user = db.query("SELECT id,username,password_hash FROM auth_users WHERE username = ?").get(username) as { id: string; username: string; password_hash: string } | null;
      if (!user || !(await Bun.password.verify(password, user.password_hash))) return fail("INVALID_CREDENTIALS", "Username or password is incorrect", 401);
      const token = randomUUID() + randomUUID();
      db.query("INSERT INTO auth_sessions (token_hash,user_id,expires_at) VALUES (?,?,?)").run(hashToken(token), user.id, Date.now() + 30 * 24 * 60 * 60 * 1000);
      return authSend({ authenticated: true, username: user.username }, sessionCookie(token, 30 * 24 * 60 * 60, requestUsesHttps(req)));
    }
    if (url.pathname === "/control/v1/auth/logout" && req.method === "POST") {
      const token = sessionToken(req);
      if (token) db.query("DELETE FROM auth_sessions WHERE token_hash = ?").run(hashToken(token));
      return authSend({ authenticated: false }, sessionCookie("", 0, requestUsesHttps(req)));
    }
    if (!url.pathname.startsWith("/control/v1/auth/") && !authenticated(req)) return fail("UNAUTHENTICATED", "Please log in to continue", 401);


    const runtimeMatch = url.pathname.match(/^\/control\/v1\/instances\/([^/]+)\/runtime(\/.*)$/);
    if (runtimeMatch && runtimeMatch[2] === "/api/terminal/socket" && req.headers.get("upgrade")?.toLowerCase() === "websocket") {
      return await upgradeRuntimeSocket(req, server, decodeURIComponent(runtimeMatch[1]), runtimeMatch[2], url);
    }
    if (runtimeMatch) return await proxyRuntime(req, decodeURIComponent(runtimeMatch[1]), runtimeMatch[2], url);
    if (url.pathname === "/control/v1/instances" && req.method === "GET") return send({ instances: (listRows() as Row[]).map(publicInstance) });
    if (url.pathname === "/control/v1/instances" && req.method === "POST") {
      const body = await readJson(req), name = safeName(body.name);
      const baseUrl = validateBaseUrl(body.baseUrl).toString().replace(/\/$/, "");
      const credential = typeof body.credential === "string" && body.credential.trim() ? body.credential.trim() : null;
      if (credential && credential.length > 4096) throw new Error("credential is too long");
      const now = new Date().toISOString(), id = randomUUID();
      db.query("INSERT INTO instances (id,name,base_url,credential,status,created_at,updated_at) VALUES (?,?,?,?,'unknown',?,?)").run(id, name, baseUrl, credential, now, now);
      return send({ instance: publicInstance(getRow(id) as Row) }, 201);
    }
    const match = url.pathname.match(/^\/control\/v1\/instances\/([^/]+)(?:\/(health-check))?$/);
    if (match) {
      const id = decodeURIComponent(match[1]);
      if (match[2] === "health-check" && req.method === "POST") return await checkHealth(id);
      if (!match[2] && req.method === "GET") {
        const row = getRow(id) as Row | null;
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
        return send({ instance: publicInstance(getRow(id) as Row) });
      }
      if (!match[2] && req.method === "DELETE") {
        const result = db.query("DELETE FROM instances WHERE id = ?").run(id);
        return result.changes ? new Response(null, { status: 204 }) : fail("NOT_FOUND", "Instance not found", 404);
      }
    }
    return fail("METHOD_NOT_ALLOWED", "Unsupported route or method", 405);
  } catch (e) { return fail("INVALID_REQUEST", e instanceof Error ? e.message : "Request failed", 400); }
}
