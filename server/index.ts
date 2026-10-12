import { Database } from "bun:sqlite";
import { chmodSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createHash } from "node:crypto";
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
db.exec("CREATE TABLE IF NOT EXISTS auth_users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL)");
db.exec("CREATE TABLE IF NOT EXISTS auth_sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL)");
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
    "/api/omp/config": ["GET", "PUT"],
    "/api/omp/config/reset": ["POST"],
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
  if (path === "/api/sessions") return method === "POST";
  if (new RegExp("^/api/sessions/[^/]+/(interrupt|dispose|resume)$").test(path)) return method === "POST";
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


type TunnelStatus = "starting" | "active" | "stopping" | "stopped" | "error";
type TunnelRecord = {
  id: string;
  targetUrl: string;
  status: TunnelStatus;
  publicUrl: string | null;
  createdAt: string;
  logs: string[];
  error: string | null;
  process: ReturnType<typeof Bun.spawn> | null;
};
const tunnels = new Map<string, TunnelRecord>();
const tunnelEventClients = new Set<ReadableStreamDefaultController<Uint8Array>>();
const tunnelEncoder = new TextEncoder();
const publicTunnel = (t: TunnelRecord) => ({
  id: t.id, targetUrl: t.targetUrl, status: t.status, publicUrl: t.publicUrl,
  createdAt: t.createdAt, logs: t.logs.slice(-100), error: t.error,
});
function tunnelSnapshot() {
  return [...tunnels.values()].map(publicTunnel).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
function publishTunnelSnapshot() {
  const event = tunnelEncoder.encode(`event: tunnels\ndata: ${JSON.stringify({ tunnels: tunnelSnapshot() })}\n\n`);
  for (const client of tunnelEventClients) {
    try { client.enqueue(event); } catch { tunnelEventClients.delete(client); }
  }
}
function tunnelEventsResponse() {
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller;
      tunnelEventClients.add(controller);
      controller.enqueue(tunnelEncoder.encode(`event: tunnels\ndata: ${JSON.stringify({ tunnels: tunnelSnapshot() })}\n\n`));
      heartbeat = setInterval(() => {
        try { controller.enqueue(tunnelEncoder.encode(': keep-alive\n\n')); }
        catch { if (controllerRef) tunnelEventClients.delete(controllerRef); if (heartbeat) clearInterval(heartbeat); }
      }, 20000);
    },
    cancel() {
      if (controllerRef) tunnelEventClients.delete(controllerRef);
      if (heartbeat) clearInterval(heartbeat);
    },
  });
  return new Response(stream, { headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache, no-store, must-revalidate', connection: 'keep-alive', 'x-accel-buffering': 'no' } });
}
function validateTunnelTarget(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("Service URL is required");
  let target: URL;
  try { target = new URL(value.trim()); } catch { throw new Error("Enter a valid service URL, such as http://127.0.0.1:5173"); }
  if (target.protocol !== "http:" && target.protocol !== "https:") throw new Error("Only HTTP and HTTPS service URLs are supported");
  if (target.username || target.password || target.search || target.hash) throw new Error("Service URL must not include credentials, query, or fragment");
  if (!["localhost", "127.0.0.1", "[::1]", "::1"].includes(target.hostname)) throw new Error("Quick Tunnel can only expose a service on localhost or a loopback address");
  if (target.port && (!/^\d+$/.test(target.port) || Number(target.port) < 1 || Number(target.port) > 65535)) throw new Error("Invalid service port");
  return target.toString().replace(/\/$/, "");
}
function appendTunnelLog(t: TunnelRecord, text: string) {
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    t.logs.push(line);
    if (t.logs.length > 100) t.logs.splice(0, t.logs.length - 100);
    const match = line.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
    if (match && t.status === "starting") {
      t.publicUrl = match[0];
      t.status = "active";
    }
  }
  publishTunnelSnapshot();
}
async function readTunnelOutput(t: TunnelRecord, stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      const lines = pending.split(/\r?\n/);
      pending = lines.pop() ?? "";
      appendTunnelLog(t, lines.join("\n"));
    }
    pending += decoder.decode();
    appendTunnelLog(t, pending);
  } catch (error) {
    if (t.status !== "stopping" && t.status !== "stopped") {
      t.logs.push("Output stream closed: " + (error instanceof Error ? error.message : "unknown error"));
    }
  } finally {
    reader.releaseLock();
  }
}
async function startQuickTunnel(targetUrl: string): Promise<TunnelRecord> {
  const id = randomUUID();
  const record: TunnelRecord = {
    id, targetUrl, status: "starting", publicUrl: null, createdAt: new Date().toISOString(),
    logs: [], error: null, process: null,
  };
  let child: ReturnType<typeof Bun.spawn>;
  try {
    child = Bun.spawn(["cloudflared", "tunnel", "--no-autoupdate", "--url", targetUrl], {
      stdout: "pipe", stderr: "pipe",
    });
  } catch {
    throw new Error("Unable to start cloudflared. Install cloudflared and ensure it is available in PATH.");
  }
  record.process = child;
  tunnels.set(id, record);
  publishTunnelSnapshot();
  void readTunnelOutput(record, child.stdout);
  void readTunnelOutput(record, child.stderr);
  void child.exited.then((code) => {
    if (record.status === "stopping") record.status = "stopped";
    else if (code === 0 && record.status !== "error") record.status = "stopped";
    else if (record.status !== "stopped") {
      record.status = "error";
      record.error = code === 0 ? "Tunnel process exited" : "cloudflared exited with code " + code;
      record.logs.push(record.error);
    }
    record.process = null;
    publishTunnelSnapshot();
  }).catch((error) => {
    record.status = "error";
    record.error = error instanceof Error ? error.message : "Tunnel process failed";
    record.process = null;
    publishTunnelSnapshot();
  });
  return record;
}
async function stopTunnel(record: TunnelRecord): Promise<void> {
  const child = record.process;
  if (!child || record.status === "stopped" || record.status === "error") return;
  record.status = "stopping";
  publishTunnelSnapshot();

  const waitForExit = (timeoutMs: number) => Promise.race([
    child.exited.then(() => true),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeoutMs)),
  ]);

  try { child.kill("SIGTERM"); } catch {}
  let exited = await waitForExit(2500);
  if (!exited) {
    try { child.kill("SIGKILL"); } catch {}
    exited = await waitForExit(2500);
  }

  if (exited) {
    record.status = "stopped";
    record.process = null;
  } else {
    record.status = "error";
    record.error = "cloudflared did not exit after SIGTERM and SIGKILL";
    record.logs.push(record.error);
  }
  publishTunnelSnapshot();
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


      if (url.pathname === "/control/v1/tunnels/status" && req.method === "GET") {
        const executable = Bun.which("cloudflared");
        if (!executable) return send({ installed: false, path: null, version: null });
        let version: string | null = null;
        try {
          const result = Bun.spawnSync([executable, "--version"], { stdout: "pipe", stderr: "pipe", timeout: 3000 });
          const output = new TextDecoder().decode(result.stdout).trim() || new TextDecoder().decode(result.stderr).trim();
          if (result.exitCode === 0 && output) version = output.split("\n")[0];
        } catch {}
        return send({ installed: true, path: executable, version });
      }
      if (url.pathname === "/control/v1/tunnels/events" && req.method === "GET") return tunnelEventsResponse();
      if (url.pathname === "/control/v1/tunnels" && req.method === "GET") {
        return send({ tunnels: tunnelSnapshot() });
      }
      if (url.pathname === "/control/v1/tunnels" && req.method === "POST") {
        const body = await readJson(req);
        const targetUrl = validateTunnelTarget(body.targetUrl);
        try {
          const tunnel = await startQuickTunnel(targetUrl);
          return send({ tunnel: publicTunnel(tunnel) }, 201);
        } catch (error) {
          return fail("CLOUDFLARED_UNAVAILABLE", error instanceof Error ? error.message : "Unable to start cloudflared", 503);
        }
      }
      const tunnelMatch = url.pathname.match(/^\/control\/v1\/tunnels\/([^/]+)\/(stop)$/);
      if (tunnelMatch && req.method === "POST") {
        const tunnel = tunnels.get(decodeURIComponent(tunnelMatch[1]));
        if (!tunnel) return fail("NOT_FOUND", "Tunnel not found", 404);
        await stopTunnel(tunnel);
        return send({ tunnel: publicTunnel(tunnel) });
      }

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
