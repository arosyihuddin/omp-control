#!/usr/bin/env bash
set -euo pipefail
bun run server/index.ts &
api_pid=$!
trap 'kill "$api_pid" 2>/dev/null || true' EXIT INT TERM
bunx vite --host 127.0.0.1
