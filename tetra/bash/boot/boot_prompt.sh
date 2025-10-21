#!/usr/bin/env bash

# Boot Prompt - Interactive shell setup

# --- Interactive-Only Setup ---
if [[ "$-" == *i* ]]; then
    PROMPT_COMMAND="tetra_prompt"

    # Set tetra_remote with safe defaults (handles set -u)
    export TETRA_REMOTE_USER="${TETRA_REMOTE_USER:-}"
    export TETRA_REMOTE="${TETRA_REMOTE:-}"
    export TETRA_REMOTE_DIR="${TETRA_REMOTE_DIR:-}"
    ttr="${TETRA_REMOTE_USER}@${TETRA_REMOTE}:${TETRA_REMOTE_DIR}"

    if [[ -z "${TETRA_SILENT_STARTUP:-}" ]]; then
        tetra_status
    fi
fi
