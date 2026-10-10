# OMP Control

Independent dashboard and future multi-instance control plane for OMP-MCP.

## Current status

This repository starts from the existing Svelte dashboard, copied out of the OMP-MCP repository so the runtime repository remains operational while the UI is separated. The original dashboard remains in omp-mcp/dashboard until the standalone build and API routing are verified.

## Development

Requirements: Bun.

    cp .env.example .env
    bun install
    bun run dev

The development command starts the control API and Vite UI together. Vite proxies /control to the bundled control API at http://127.0.0.1:48767. Runtime API and WebSocket requests are routed through the selected instance using the control API, so no OMP_MCP_BACKEND environment variable or direct runtime proxy is needed.

The registry API uses Bun SQLite and stores its database at ./data/omp-control.sqlite by default. It implements instance list/register/get/update/remove, health checks, and an allowlisted per-instance runtime proxy for dashboard REST and SSE calls. The dashboard has an active-instance selector; the choice is saved in browser local storage. Credentials are stored server-side and excluded from instance responses.

Authentication is enabled by default. On first launch, create the administrator account through the setup page; usernames must be 3–64 characters and passwords at least 12 characters. The first account can only be created once. Login sessions use random opaque tokens stored as SHA-256 hashes in SQLite and an HttpOnly, SameSite=Strict cookie. The API sets the cookie's Secure attribute automatically based on the browser request's Origin scheme (HTTPS gets Secure; HTTP local development does not), with the request URL as fallback. All control API and runtime proxy endpoints require an authenticated session; /healthz remains public. The API binds to loopback by default; do not expose it publicly without HTTPS and appropriate network controls.

## Architecture

- OMP-MCP: per-instance runtime and instance-local APIs.
- OMP Control: dashboard, instance registry, health/status aggregation, and eventually a controlled proxy to selected instances.
- Browser clients must never provide arbitrary upstream URLs. Instance endpoints and credentials must be validated and stored server-side to avoid SSRF and credential exposure.

Registry API:

- GET /control/v1/instances
- POST /control/v1/instances with name, baseUrl, and optional write-only credential
- GET, PATCH, or DELETE /control/v1/instances/:id
- POST /control/v1/instances/:id/health-check
- GET /healthz

Base URLs must be HTTP(S), must not contain embedded credentials/query/fragment, and must use HTTPS except for loopback development instances. Health checks use a 4-second timeout and do not follow redirects. Terminal WebSocket forwarding works for instances without a bearer credential; authenticated WebSocket proxying remains pending.

See docs/API_CONTRACT.md for the API model and rollout plan.
