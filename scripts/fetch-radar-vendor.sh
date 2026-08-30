#!/usr/bin/env bash
set -euo pipefail

# Only d3 is vendored now — the radar plot and legend are our own rendering
# code (static/js/radar-loader.js), not zalando/tech-radar's radar.js.
D3_VERSION="7.9.0"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="${REPO_ROOT}/static/js/vendor"

mkdir -p "${DEST}"
curl -fsSL "https://cdn.jsdelivr.net/npm/d3@${D3_VERSION}/dist/d3.min.js" -o "${DEST}/d3.min.js"

echo "Vendored d3.min.js (v${D3_VERSION}) into ${DEST}"
