#!/usr/bin/env bash
# Temporary debug script to find boot errors
# Usage: source this instead of bootloader.sh to see detailed errors

export TETRA_SRC=/Users/mricos/src/devops/tetra
export TETRA_DIR=/Users/mricos/tetra

echo "=== TETRA BOOT DEBUG ===" >&2
echo "TETRA_SRC=$TETRA_SRC" >&2
echo "TETRA_DIR=$TETRA_DIR" >&2

BOOT_DIR="$TETRA_SRC/bash/boot"
echo "Sourcing boot_core.sh..." >&2
set -x
source "$BOOT_DIR/boot_core.sh"
set +x
echo "boot_core.sh loaded successfully" >&2

echo "=== END BOOT DEBUG ===" >&2
