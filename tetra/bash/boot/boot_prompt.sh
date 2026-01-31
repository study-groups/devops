#!/usr/bin/env bash

# Boot Prompt - Interactive shell setup

# --- Auto-select TPS style based on invoke mode ---
# User can override via TPS_STYLE in start-tetra.sh or env
if [[ -z "${TPS_STYLE:-}" ]]; then
    case "${TETRA_INVOKE_MODE:-interactive}" in
        ssh)    TPS_STYLE="compact" ;;
        agent)  TPS_STYLE="tiny" ;;
        cron)   TPS_STYLE="tiny" ;;
        *)      TPS_STYLE="default" ;;
    esac
    export TPS_STYLE
fi

# --- Auto-populate TETRA_REMOTE_* from SSH vars ---
if [[ "${TETRA_INVOKE_MODE:-}" == "ssh" ]]; then
    if [[ -z "${TETRA_REMOTE_USER:-}" ]]; then
        export TETRA_REMOTE_USER="${USER:-}"
    fi
    if [[ -z "${TETRA_REMOTE:-}" && -n "${SSH_CONNECTION:-}" ]]; then
        # SSH_CONNECTION format: client_ip client_port server_ip server_port
        export TETRA_REMOTE="${SSH_CONNECTION%% *}"
    fi
    if [[ -z "${TETRA_REMOTE_DIR:-}" ]]; then
        export TETRA_REMOTE_DIR="${PWD:-}"
    fi
fi

# --- Interactive-Only Setup ---
if [[ "$-" == *i* ]]; then
    # Load TPS (Tetra Prompt System)
    if [[ -f "$TETRA_SRC/bash/tps/includes.sh" ]]; then
        source "$TETRA_SRC/bash/tps/includes.sh"
    fi
    # PROMPT_COMMAND is set by tps/includes.sh with proper chaining

    # Register invoke-mode segment (priority 5 = renders leftmost)
    if declare -f tps_register_segment &>/dev/null && declare -f _tps_invoke_segment &>/dev/null; then
        tps_register_segment info 5 invoke _tps_invoke_segment
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
