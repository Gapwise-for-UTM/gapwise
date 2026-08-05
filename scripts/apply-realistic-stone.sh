#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CACHE_ROOT="${XDG_CACHE_HOME:-$HOME/.cache}"
VENV="$CACHE_ROOT/gapwise-stone-pbr-venv"

mkdir -p "$CACHE_ROOT"

if [ ! -x "$VENV/bin/python" ]; then
  python3 -m venv "$VENV"
fi

if ! "$VENV/bin/python" -c 'import numpy; import PIL' 2>/dev/null; then
  "$VENV/bin/pip" install --disable-pip-version-check --upgrade pip
  "$VENV/bin/pip" install --disable-pip-version-check numpy pillow
fi

exec "$VENV/bin/python" "$ROOT/scripts/apply-realistic-stone.py"
