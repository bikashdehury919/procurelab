#!/usr/bin/env bash
# Starts ProcureLab from the repository root (the app lives in the root, tests in e2e/)
# and waits until /api/health answers. Used by CI; works locally on macOS/Linux/Git Bash too.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
npm ci --no-audit --no-fund
nohup npm start > "$ROOT/e2e/app.log" 2>&1 &
for i in $(seq 1 40); do
  if curl -sf http://localhost:3000/api/health > /dev/null; then echo "ProcureLab is up"; exit 0; fi
  sleep 1
done
echo "ProcureLab did not start:"; cat "$ROOT/e2e/app.log"; exit 1