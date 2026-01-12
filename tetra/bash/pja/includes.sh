#!/usr/bin/env bash
# pja/includes.sh - Pixeljam Arcade SDK module exports
#
# Provides:
#   PJA_SRC      - Source directory for this module
#   PJA_DIR      - Runtime data directory
#   PJA_SDK_PATH - Path to the unified SDK source
#   PJA_SDK_DIST - Path to built IIFE bundle
#
# Usage:
#   source "$TETRA_SRC/bash/pja/includes.sh"
#   # Use $PJA_SDK_PATH in gamepak/cabinet for SDK injection

# Require bash 5.2+
[[ "${BASH_VERSINFO[0]}" -lt 5 || ("${BASH_VERSINFO[0]}" -eq 5 && "${BASH_VERSINFO[1]}" -lt 2) ]] && {
    echo "[pja] ERROR: Requires bash 5.2+, got ${BASH_VERSION}" >&2
    return 1
}

# Module paths
PJA_SRC="${TETRA_SRC:?}/bash/pja"
PJA_DIR="${TETRA_DIR:?}/pja"

# SDK paths
PJA_SDK_PATH="${PJA_SRC}/sdk/pja-sdk.js"
PJA_SDK_DIST="${PJA_SRC}/dist/pja-sdk.iife.js"

# Ensure runtime directory exists
[[ -d "$PJA_DIR" ]] || mkdir -p "$PJA_DIR"

# Export for subshells
export PJA_SRC PJA_DIR PJA_SDK_PATH PJA_SDK_DIST
