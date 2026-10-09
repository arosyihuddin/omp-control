# OMP Control

Independent dashboard and future multi-instance control plane for OMP-MCP.

## Current status

This repository starts from the existing Svelte dashboard, copied out of the OMP-MCP repository so the runtime repository remains operational while the UI is separated. The original dashboard remains in omp-mcp/dashboard until the standalone build and API routing are verified.

## Development

Requirements: Bun.

    cp .env.example .env
    bun install
    bun run dev

The development command starts the control API and Vite UI together. Vite proxies /api and WebSocket requests to OMP_MCP_BACKEND (default http://127.0.0.1:48766) for the existing single-instance dashboard while migration is in progress. It proxies /control to the registry API (default http://127.0.0.1:48767).

The registry API uses Bun SQLite and stores its database at ./data/omp-control.sqlite by default. It implements instance list/register/get/update/remove, health checks, and an allowlisted per-instance runtime proxy for dashboard REST and SSE calls. The dashboard has an active-instance selector; the choice is saved in browser local storage. Credentials are stored server-side and excluded from instance responses. The API binds to loopback by default and does not yet implement authentication; do not expose it publicly.

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

Base URLs must be HTTP(S), must not contain embedded credentials/query/fragment, and must use HTTPS except for loopback development instances. Health checks use a 4-second timeout and do not follow redirects. Authentication is not implemented yet. Terminal WebSocket forwarding works for instances without a bearer credential; authenticated WebSocket proxying remains pending.

See docs/API_CONTRACT.md for the API model and rollout plan.
