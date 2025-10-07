#!/usr/bin/env sh
set -eu

# Ensure we run from the repo root, then start the FastAPI server on $PORT
# Move to repo root so we can import as `server.app.main`
cd "$(dirname "$0")"

PYTHON_BIN="${PYTHON_BIN:-}"
if [ -z "$PYTHON_BIN" ]; then
  if command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN=python3
  elif command -v python >/dev/null 2>&1; then
    PYTHON_BIN=python
  else
    echo "Python not found. Set PYTHON_BIN to your Python executable." >&2
    exit 1
  fi
fi

# Prefer the venv created by Railpack during build, fall back to local
if [ -d "/app/.venv" ]; then
  . /app/.venv/bin/activate
else
  if [ ! -d ".venv" ]; then
    "$PYTHON_BIN" -m venv .venv
    . .venv/bin/activate
    pip install --upgrade pip setuptools wheel
    pip install --no-cache-dir -r requirements.txt
  else
    . .venv/bin/activate
  fi
fi

# Ensure local server package is importable when invoking module entrypoint
export PYTHONPATH="${PWD}:${PYTHONPATH:-}"

# Use the venv's python to run uvicorn; set app-dir to server so `app.*` resolves
exec python -m uvicorn app.main:app --app-dir server --host 0.0.0.0 --port "${PORT:-8000}"


