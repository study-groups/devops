#!/usr/bin/env bash

# Boot Prompt - Interactive shell setup

# --- Interactive-Only Setup ---
if [[ "$-" == *i* ]]; then
    PROMPT_COMMAND="tetra_prompt"
    ttr=${TETRA_REMOTE_USER:-}@${TETRA_REMOTE:-}:${TETRA_REMOTE_DIR:-}

    if [[ -z "${TETRA_SILENT_STARTUP:-}" ]]; then
        tetra_status
    fi
fi
