#!/usr/bin/env bash

# Boot Prompt - Interactive shell setup

# --- Interactive-Only Setup ---
if [[ "$-" == *i* ]]; then
    # Ensure prompt.sh is loaded (safe to source multiple times)
    if [[ -f "$TETRA_SRC/bash/prompt/prompt.sh" ]]; then
        source "$TETRA_SRC/bash/prompt/prompt.sh"
    fi

    # Only set PROMPT_COMMAND if tetra_prompt function exists
    if declare -f tetra_prompt >/dev/null 2>&1; then
        PROMPT_COMMAND="tetra_prompt"
    fi

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
