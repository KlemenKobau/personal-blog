#!/usr/bin/env bash
set -euo pipefail

# zalando/tech-radar has no release tags (checked via `git ls-remote --tags`),
# so pin by commit SHA. Bump this deliberately — never track a moving branch.
TECH_RADAR_REF="ebcbce3a7281c02ff182e58dc6781b1c9c22613f"
D3_VERSION="7.9.0"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="${REPO_ROOT}/static/js/vendor"
CLONE_DIR="$(mktemp -d)"
trap 'rm -rf "${CLONE_DIR}"' EXIT

git clone https://github.com/zalando/tech-radar.git "${CLONE_DIR}"
git -C "${CLONE_DIR}" checkout "${TECH_RADAR_REF}"

mkdir -p "${DEST}"
cp "${CLONE_DIR}/docs/radar.js" "${DEST}/radar.js"
curl -fsSL "https://cdn.jsdelivr.net/npm/d3@${D3_VERSION}/dist/d3.min.js" -o "${DEST}/d3.min.js"

echo "Vendored radar.js (zalando/tech-radar@${TECH_RADAR_REF}) and d3.min.js (v${D3_VERSION}) into ${DEST}"
