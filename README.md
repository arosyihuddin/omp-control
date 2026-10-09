# OMP Control

Independent dashboard and future multi-instance control plane for OMP-MCP.

## Current status

This repository starts from the existing Svelte dashboard, copied out of the OMP-MCP repository so the runtime repository remains operational while the UI is separated. The original dashboard remains in omp-mcp/dashboard until the standalone build and API routing are verified.

## Development

Requirements: Bun.

    cp .env.example .env
    bun install
    bun run dev

The Vite dev server proxies /api and WebSocket requests to OMP_MCP_BACKEND (default http://127.0.0.1:48765). This currently targets one OMP-MCP instance. Multi-instance selection will be added through the control-plane API, not by allowing the browser to submit arbitrary target URLs.

## Architecture

- OMP-MCP: per-instance runtime and instance-local APIs.
- OMP Control: dashboard, instance registry, health/status aggregation, and eventually a controlled proxy to selected instances.
- Browser clients must never provide arbitrary upstream URLs. Instance endpoints and credentials must be validated and stored server-side to avoid SSRF and credential exposure.

See docs/API_CONTRACT.md for the proposed control-plane endpoints and instance model.
