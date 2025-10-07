#!/usr/bin/env sh
set -eu

# Ensure we run from the repo root, then start the FastAPI server on $PORT
cd "$(dirname "$0")/server"

PYTHON_BIN="${PYTHON_BIN:-python3}"

if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  echo "Python not found. Set PYTHON_BIN to your Python executable." >&2
  exit 1
fi

# Create a lightweight venv (idempotent)
if [ ! -d ".venv" ]; then
  "$PYTHON_BIN" -m venv .venv
fi
. .venv/bin/activate

pip install --upgrade pip setuptools wheel
pip install --no-cache-dir -r requirements.txt

exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"


