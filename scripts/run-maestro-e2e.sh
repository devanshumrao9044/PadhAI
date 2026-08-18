#!/usr/bin/env bash
set -euo pipefail

if ! command -v maestro >/dev/null 2>&1; then
  echo "Maestro CLI is required. Install it from https://maestro.mobile.dev/getting-started/installing-maestro" >&2
  exit 127
fi

: "${PADHAI_E2E_EMAIL:?Set PADHAI_E2E_EMAIL to the disposable confirmed E2E account email}"
: "${PADHAI_E2E_PASSWORD:?Set PADHAI_E2E_PASSWORD in the CI secret store or shell environment}"
PADHAI_E2E_EXPECTED_RANK="${PADHAI_E2E_EXPECTED_RANK:-1}"

# Maestro exposes MAESTRO_* environment variables inside the flow. Keeping the
# values out of the command line avoids showing credentials in process listings.
export MAESTRO_PADHAI_E2E_EMAIL="$PADHAI_E2E_EMAIL"
export MAESTRO_PADHAI_E2E_PASSWORD="$PADHAI_E2E_PASSWORD"
export MAESTRO_PADHAI_E2E_EXPECTED_RANK="$PADHAI_E2E_EXPECTED_RANK"

exec maestro test .maestro/leaderboard-rank-transition.yaml
