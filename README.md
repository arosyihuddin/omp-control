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

The development command starts one Bun-backed SvelteKit server on port `5173`. The control API, UI, runtime proxy, SSE, and terminal WebSocket upgrade are handled by the same server; there is no separate API listener or `scripts/dev.sh`. Runtime API and WebSocket requests are routed through the selected instance, so the browser does not need a direct runtime URL or an `OMP_MCP_BACKEND` setting.

### 🗃️ Instance registry

The registry API uses Bun SQLite and stores its database at `./data/omp-control.sqlite` by default. It implements instance list/register/get/update/remove, health checks, and an allowlisted per-instance runtime proxy for dashboard REST and SSE calls. The dashboard has an active-instance selector; the choice is saved in browser local storage. Credentials are stored server-side and excluded from instance responses.

### 🔐 Authentication and security

Authentication is enabled by default. On first launch, create the administrator account through the setup page; usernames must be 3–64 characters and passwords at least 12 characters. The first account can only be created once. Login sessions use random opaque tokens stored as SHA-256 hashes in SQLite and an HttpOnly, SameSite=Strict cookie. The API sets the cookie's Secure attribute automatically based on the browser request's Origin scheme (HTTPS gets Secure; HTTP local development does not), with the request URL as fallback. All control API and runtime proxy endpoints require an authenticated session; `/healthz` remains public. The standalone Bun adapter listens on `0.0.0.0:3000` by default (`HTTP_HOST` and `HTTP_PORT` can override this). When running behind a reverse proxy or Cloudflare Tunnel, prefer `HTTP_HOST=127.0.0.1`; do not expose the service publicly without HTTPS and appropriate network controls.

## ☁️ Cloudflare Workers deployment

OMP Control supports two deployment modes:

- **Bun / self-hosted:** builds a standalone SvelteKit server with the Bun adapter, local SQLite database, and local `cloudflared` tunnel controls. Run `bun run build` and then `bun run start`; the UI and control API share one listener.
- **Cloudflare Workers:** serves the Vite-built frontend and runs the control API in `cloudflare/worker.ts`; persistent registry and auth data live in Cloudflare D1.

### First-time setup

1. Install dependencies and authenticate Wrangler:

   ~~~bash
   bun install
   bunx wrangler login
   ~~~

2. Run the setup command. It reuses the existing omp-control D1 database, or creates it if it does not exist and the config still has the placeholder ID. It then applies remote migrations:

   ~~~bash
   bun run cf:setup
   ~~~

3. Build the Cloudflare target and apply remote D1 migrations:

   ~~~bash
   bun run cf:build && bun run cf:migrate:remote
   ~~~

4. Deploy the Worker while preserving the environment variables already configured in Cloudflare:

   ~~~bash
   npx wrangler deploy --keep-vars
   ~~~

The setup script will not overwrite a configured database ID or silently create a replacement database if the configured database is missing from the authenticated Cloudflare account. Check the Wrangler account/profile if validation fails.

After deployment, open the Worker URL and create the first administrator account in the setup screen.

For local Worker emulation, run `bun run cf:migrate:local` once, then `bun run cf:dev`. The `cf:dev` script builds the static Cloudflare target automatically; `cf:build` builds it explicitly, while the normal `build` script creates the standalone Bun server instead.

**Cloudflare-mode differences:** OMP instances must be reachable from Cloudflare over HTTPS. The browser terminal WebSocket proxy is intended for instances without bearer credentials; authenticated WebSocket proxying remains unsupported. The local `cloudflared` process manager cannot run inside Workers, so tunnel creation and process controls are disabled in this mode and must be managed separately. The self-hosted Bun mode is unchanged.

## 🏗️ Architecture

- OMP-MCP: per-instance runtime and instance-local APIs.
- OMP Control: dashboard, instance registry, health/status aggregation, authentication, and controlled proxy to selected instances.
- Browser clients must never provide arbitrary upstream URLs. Instance endpoints and credentials must be validated and stored server-side to avoid SSRF and credential exposure.

## 🔌 API overview

The Tools page reads `GET /api/tools` from the selected OMP-MCP runtime through the instance runtime proxy. OMP-Control does not maintain a separate tool catalog: native tools are discovered by OMP-MCP, while OMP-MCP supplies metadata, exposure state, and effective permissions. Permission and exposure changes are sent back to that same runtime. Custom rules are stored and evaluated by OMP-MCP before tool execution.

Registry endpoints:

- GET /control/v1/instances
- POST /control/v1/instances with name, baseUrl, and required write-only Bearer credential; the runtime connection is tested before persistence.
- GET, PATCH, or DELETE /control/v1/instances/:id
- POST /control/v1/instances/:id/health-check
- GET /healthz

Base URLs must be HTTP(S), must not contain embedded credentials/query/fragment, and must use HTTPS except for loopback development instances. Health checks use a 4-second timeout and do not follow redirects. Terminal WebSocket forwarding works for instances without a bearer credential; authenticated WebSocket proxying remains pending.

## 📦 Releases

Releases use Semantic Versioning and annotated Git tags. The `release` target validates the source, checks Svelte and TypeScript, builds the Cloudflare Worker target, updates `package.json`, creates a `vX.Y.Z` tag, and pushes the release commit and tag to `origin`.

```bash
make release VERSION=0.2.0
```

Run releases from a clean `main` branch. Use PATCH for backward-compatible fixes, MINOR for backward-compatible features, and MAJOR for breaking changes.

## Documentation

- `DESIGN.md` — visual principles, design tokens, component styling, and UI interaction conventions.
- `ARCHITECTURE.md` — control-plane/runtime boundaries, deployment modes, API flow, and security invariants.
- `CONTRIBUTING.md` — local development, validation, UI conventions, and contribution checklist.
- `docs/API_CONTRACT.md` — control-plane API contract and runtime proxy constraints.

## Related project

- **OMP-MCP** — runtime server that provides agent sessions, native MCP tools, and runtime control APIs.
