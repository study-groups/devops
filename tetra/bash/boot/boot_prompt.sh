#!/usr/bin/env bash

# Boot Prompt - Interactive shell setup

# --- Interactive-Only Setup ---
if [[ "$-" == *i* ]]; then
    # Load TPS (Tetra Prompt System) - the modern prompt module
    # Falls back to legacy prompt.sh if tps not available
    if [[ -f "$TETRA_SRC/bash/tps/includes.sh" ]]; then
        source "$TETRA_SRC/bash/tps/includes.sh"
    elif [[ -f "$TETRA_SRC/bash/prompt/prompt.sh" ]]; then
        source "$TETRA_SRC/bash/prompt/prompt.sh"
    fi

    # Set PROMPT_COMMAND (tps_prompt preferred, tetra_prompt fallback)
    if declare -f tps_prompt >/dev/null 2>&1; then
        PROMPT_COMMAND="tps_prompt"
    elif declare -f tetra_prompt >/dev/null 2>&1; then
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
