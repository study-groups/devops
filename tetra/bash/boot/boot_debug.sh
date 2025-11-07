#!/usr/bin/env bash
# Temporary debug script to find boot errors
# Usage: source this instead of bootloader.sh to see detailed errors

set -euo pipefail

# Auto-detect TETRA_SRC if not set (relative to this script)
: "${TETRA_SRC:=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
: "${TETRA_DIR:=$HOME/tetra}"
export TETRA_SRC TETRA_DIR

echo "=== TETRA BOOT DEBUG ===" >&2
echo "TETRA_SRC=$TETRA_SRC" >&2
echo "TETRA_DIR=$TETRA_DIR" >&2

# Validate paths exist
if [[ ! -d "$TETRA_SRC" ]]; then
    echo "ERROR: TETRA_SRC directory does not exist: $TETRA_SRC" >&2
    return 1
fi

BOOT_DIR="$TETRA_SRC/bash/boot"
if [[ ! -f "$BOOT_DIR/boot_core.sh" ]]; then
    echo "ERROR: boot_core.sh not found in: $BOOT_DIR" >&2
    return 1
fi

echo "Sourcing boot_core.sh..." >&2
set -x
source "$BOOT_DIR/boot_core.sh"
set +x
echo "boot_core.sh loaded successfully" >&2

echo "=== END BOOT DEBUG ===" >&2
