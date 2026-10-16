# OMP Control — Architecture

## Purpose and boundaries

OMP Control is the standalone dashboard and control plane for managing multiple OMP-MCP runtime instances. It owns the browser UI, administrator authentication, instance registry, health checks, active-instance selection, and a constrained proxy to the selected runtime.

OMP-MCP remains the source of truth for runtime tools, exposure settings, execution permissions, custom permission rules, approvals, sessions, and host-local operations. Do not duplicate runtime-owned state in OMP Control.

## High-level request flow

```text
Browser
  ├─ Svelte 5 UI (src/)
  └─ same-origin requests
       └─ OMP Control Bun server
            ├─ Control API: auth + instance registry
            └─ allowlisted runtime proxy
                 └─ selected OMP-MCP instance
                      ├─ MCP server and native OMP tools
                      ├─ runtime/control APIs
                      ├─ SSE events
                      ├─ terminal WebSocket
                      └─ host operations (including cloudflared)
```

The browser must not choose an arbitrary upstream URL or receive stored instance credentials.

## Main modules

- `src/App.svelte`, `src/routes/`, `src/pages/`: app shell, routing, and page-level UI.
- `src/features/`: focused UI workflows such as approvals, logs, terminal, tools, and workspace/editor.
- `src/lib/api/`: same-origin API clients, runtime event handling, and active-instance URL helpers.
- `src/lib/data/`: static, UI-owned metadata such as tool category labels/descriptions and filter/select options. This is not the source of truth for the runtime tool catalog or permissions.
- `src/lib/types/`: shared TypeScript domain and API types.
- `src/lib/stores/`: shared reactive state for dashboard data, instances, profile, theme, and UI.
- `src/lib/styles/`: global styling and semantic design tokens.
- `server/index.ts`: self-hosted Bun server, SQLite persistence, authentication, instance registry, request allowlisting, runtime proxy, SSE forwarding, and WebSocket proxying.
- `docs/API_CONTRACT.md`: control-plane API contract.

## Runtime and deployment modes

### Self-hosted Bun

The standalone SvelteKit/Bun server serves the UI and API from one listener. Instance registry and administrator/session data are stored in Bun SQLite; the default database path is `./data/omp-control.sqlite`, configurable through `OMP_CONTROL_DB_PATH`.


## State ownership

| State or capability | Owner |
| --- | --- |
| Instance names, URLs, credentials, registry health metadata | OMP Control |
| Administrator accounts and browser sessions | OMP Control |
| Active instance selection | Browser preference |
| Runtime tool catalog and native tool discovery | OMP-MCP |
| Tool exposure and effective permission policy | OMP-MCP |
| Custom tool rules and approval decisions | OMP-MCP |
| Runtime logs, terminals, tunnel processes, workspace operations | OMP-MCP |

Instance credentials are server-side secrets. They must not be included in registry list/detail responses, browser storage, or logs.

## API and event flow

- The browser calls OMP Control using same-origin routes.
- Control-plane registry/auth routes use the `/control/v1` prefix.
- Runtime API requests are forwarded only through explicit path-and-method allowlists.
- The Tools UI obtains its catalog from the selected OMP-MCP instance; permission/exposure changes are sent to that runtime.
- Long-lived runtime event streams (SSE) are forwarded without the normal short request timeout.
- Terminal WebSocket forwarding is handled by the self-hosted server.

## Security invariants

1. Never expose a generic, unrestricted reverse proxy.
2. Never trust an upstream URL supplied by a browser request; resolve it from the registered instance record.
3. Validate instance URLs and reject embedded credentials, unsupported schemes, query strings, and fragments.
4. Never return or log stored instance credentials.
5. Require authentication for protected control and runtime-proxy routes; keep only documented bootstrap/health endpoints public.
6. Keep the request method/path allowlists enforced by `server/index.ts`.
7. Do not imply that UI-side hiding is enforcement. Runtime tool permissions must be enforced by OMP-MCP.

When adding a feature, identify whether it belongs to the control plane or runtime first. If it changes runtime behavior or tool policy, implement the authoritative behavior in OMP-MCP and expose it through the runtime API. Update `docs/API_CONTRACT.md` and the README as appropriate.
