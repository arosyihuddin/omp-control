# 🎛️ OMP Control

![Frontend](https://img.shields.io/badge/frontend-Svelte-FF3E00?logo=svelte&logoColor=white) ![Build](https://img.shields.io/badge/build-Vite-646CFF?logo=vite&logoColor=white) ![Runtime](https://img.shields.io/badge/API-Bun-000000?logo=bun&logoColor=white) ![Status](https://img.shields.io/badge/status-active-238636)

> 🖥️ A standalone dashboard and control plane for managing multiple OMP-MCP runtime instances.

## 🧭 Project status

The dashboard is maintained independently from the OMP-MCP runtime. It provides the UI, instance registry, authentication, health checks, and an allowlisted proxy that routes dashboard API and WebSocket traffic to the selected runtime instance.

## 🚀 Development

Requirements: Bun.

    cp .env.example .env
    bun install
    bun run dev

The development command starts the control API and Vite UI together. Vite proxies `/control` to the control API at `http://127.0.0.1:48767`. Runtime API and WebSocket requests are routed through the selected instance; the browser does not need a direct runtime URL or an `OMP_MCP_BACKEND` setting.

### 🗃️ Instance registry

The registry API uses Bun SQLite and stores its database at `./data/omp-control.sqlite` by default. It implements instance list/register/get/update/remove, health checks, and an allowlisted per-instance runtime proxy for dashboard REST and SSE calls. The dashboard has an active-instance selector; the choice is saved in browser local storage. Credentials are stored server-side and excluded from instance responses.

### 🔐 Authentication and security

Authentication is enabled by default. On first launch, create the administrator account through the setup page; usernames must be 3–64 characters and passwords at least 12 characters. The first account can only be created once. Login sessions use random opaque tokens stored as SHA-256 hashes in SQLite and an HttpOnly, SameSite=Strict cookie. The API sets the cookie's Secure attribute automatically based on the browser request's Origin scheme (HTTPS gets Secure; HTTP local development does not), with the request URL as fallback. All control API and runtime proxy endpoints require an authenticated session; `/healthz` remains public. The API binds to loopback by default; do not expose it publicly without HTTPS and appropriate network controls.

## ☁️ Cloudflare Workers deployment

OMP Control supports two deployment modes:

- **Bun / self-hosted:** keeps the existing `server/index.ts`, local SQLite database, and local `cloudflared` tunnel controls.
- **Cloudflare Workers:** serves the Vite-built frontend and runs the control API in `cloudflare/worker.ts`; persistent registry and auth data live in Cloudflare D1.

### First-time setup

1. Create a D1 database named `omp-control` in your Cloudflare account.
2. Replace the placeholder `database_id` in `wrangler.jsonc` with the ID returned by Cloudflare.
3. Install dependencies and authenticate Wrangler:

   ```bash
   bun install
   bunx wrangler login
   ```

4. Apply the schema and deploy:

   ```bash
   bun run cf:migrate:remote
   bun run cf:deploy
   ```

5. Open the deployed URL and create the first administrator account in the setup screen.

For local Worker emulation, run `bun run cf:migrate:local` once, then `bun run cf:dev`.

**Cloudflare-mode differences:** OMP instances must be reachable from Cloudflare over HTTPS. The browser terminal WebSocket proxy is intended for instances without bearer credentials; authenticated WebSocket proxying remains unsupported. The local `cloudflared` process manager cannot run inside Workers, so tunnel creation and process controls are disabled in this mode and must be managed separately. The self-hosted Bun mode is unchanged.

## 🏗️ Architecture

- OMP-MCP: per-instance runtime and instance-local APIs.
- OMP Control: dashboard, instance registry, health/status aggregation, authentication, and controlled proxy to selected instances.
- Browser clients must never provide arbitrary upstream URLs. Instance endpoints and credentials must be validated and stored server-side to avoid SSRF and credential exposure.

## 🔌 API overview

Registry endpoints:

- GET /control/v1/instances
- POST /control/v1/instances with name, baseUrl, and optional write-only credential
- GET, PATCH, or DELETE /control/v1/instances/:id
- POST /control/v1/instances/:id/health-check
- GET /healthz

Base URLs must be HTTP(S), must not contain embedded credentials/query/fragment, and must use HTTPS except for loopback development instances. Health checks use a 4-second timeout and do not follow redirects. Terminal WebSocket forwarding works for instances without a bearer credential; authenticated WebSocket proxying remains pending.

## 📚 Documentation

- `docs/API_CONTRACT.md` — API model and rollout plan.

## 🧩 Related project

- **OMP-MCP** — runtime server that provides agent sessions and native MCP tools.
