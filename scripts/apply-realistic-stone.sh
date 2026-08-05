#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

exec blender \
  --background \
  --factory-startup \
  --python "$ROOT/scripts/apply-realistic-stone.py"
