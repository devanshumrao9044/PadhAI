#!/usr/bin/env bash
set -euo pipefail

if ! command -v maestro >/dev/null 2>&1; then
  echo "Maestro CLI is required. Install it from https://maestro.mobile.dev/getting-started/installing-maestro" >&2
  exit 127
fi

: "${PADHAI_E2E_EMAIL:?Set PADHAI_E2E_EMAIL to the disposable confirmed E2E account email}"
: "${PADHAI_E2E_PASSWORD:?Set PADHAI_E2E_PASSWORD in the CI secret store or shell environment}"
PADHAI_E2E_EXPECTED_RANK="${PADHAI_E2E_EXPECTED_RANK:-1}"

exec maestro test \
  -e "PADHAI_E2E_EMAIL=${PADHAI_E2E_EMAIL}" \
  -e "PADHAI_E2E_PASSWORD=${PADHAI_E2E_PASSWORD}" \
  -e "PADHAI_E2E_EXPECTED_RANK=${PADHAI_E2E_EXPECTED_RANK}" \
  .maestro/leaderboard-rank-transition.yaml
