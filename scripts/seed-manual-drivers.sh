#!/usr/bin/env bash
# Sets Redis manual-override flags for driver-001 to driver-004
# Usage: ./scripts/seed-manual-drivers.sh [set|clear]
set -euo pipefail

REDIS_CLI="${REDIS_CLI:-redis-cli}"
ACTION="${1:-set}"

DRIVERS=("driver-001" "driver-002" "driver-003" "driver-004")

if [[ "$ACTION" == "set" ]]; then
  for d in "${DRIVERS[@]}"; do
    $REDIS_CLI SET "driver:manual:$d" 1
    echo "  ✓ Manual override SET for $d"
  done
elif [[ "$ACTION" == "clear" ]]; then
  for d in "${DRIVERS[@]}"; do
    $REDIS_CLI DEL "driver:manual:$d"
    echo "  ✓ Manual override CLEARED for $d"
  done
else
  echo "Usage: $0 [set|clear]"
  exit 1
fi
