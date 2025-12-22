#!/usr/bin/env bash

# Boot Prompt - Interactive shell setup

# --- Interactive-Only Setup ---
if [[ "$-" == *i* ]]; then
    # Load TPS (Tetra Prompt System)
    if [[ -f "$TETRA_SRC/bash/tps/includes.sh" ]]; then
        source "$TETRA_SRC/bash/tps/includes.sh"
    fi
    # PROMPT_COMMAND is set by tps/includes.sh with proper chaining

    # Set tetra_remote with safe defaults (handles set -u)
    export TETRA_REMOTE_USER="${TETRA_REMOTE_USER:-}"
    export TETRA_REMOTE="${TETRA_REMOTE:-}"
    export TETRA_REMOTE_DIR="${TETRA_REMOTE_DIR:-}"
    ttr="${TETRA_REMOTE_USER}@${TETRA_REMOTE}:${TETRA_REMOTE_DIR}"

    if [[ -z "${TETRA_SILENT_STARTUP:-}" ]]; then
        if declare -f tetra_status >/dev/null 2>&1; then
            tetra_status
        fi
    fi
fi
