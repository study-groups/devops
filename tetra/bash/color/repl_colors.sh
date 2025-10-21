#!/usr/bin/env bash
# REPL Color System - Simple direct color assignments for REPL prompts
# No associative arrays, no complex tokens, just simple variables that export properly

# Source core color functions
COLOR_SRC="${COLOR_SRC:-$(dirname "${BASH_SOURCE[0]}")}"
source "$COLOR_SRC/color_core.sh"

# REPL Environment Colors (Local -> Dev -> Staging -> Production)
REPL_ENV_LOCAL="00AA00"          # Bright green
REPL_ENV_DEV="22DD22"            # Light green
REPL_ENV_STAGING="44AA44"        # Yellow-green
REPL_ENV_PRODUCTION="66FF66"     # Caution green

# REPL Mode Colors (Inspect -> Transfer -> Execute)
REPL_MODE_INSPECT="0088FF"       # Bright blue
REPL_MODE_TRANSFER="0044AA"      # Medium blue
REPL_MODE_EXECUTE="4400AA"       # Dark blue

# REPL Action/Command Colors
REPL_ACTION_ACTIVE="FFAA00"      # Orange
REPL_ACTION_NONE="4488AA"        # Muted gray

# REPL Prompt Structure Colors
REPL_BRACKET="88AAFF"            # Muted blue
REPL_SEPARATOR="88FF00"          # Subtle gray
REPL_ARROW="FFAA00"              # Orange

# REPL Context Colors
REPL_ORG_ACTIVE="6688AA"         # Bright text
REPL_ORG_INACTIVE="4488AA"       # Muted text

# Feedback colors
REPL_FEEDBACK_ENV="22DD22"       # Bright green
REPL_FEEDBACK_MODE="0088FF"      # Bright blue
REPL_FEEDBACK_ACTION="FFAA00"    # Orange

# Helper: Get environment color by index
repl_env_color() {
    local idx="${1:-0}"
    case "$idx" in
        0) echo "$REPL_ENV_LOCAL" ;;
        1) echo "$REPL_ENV_DEV" ;;
        2) echo "$REPL_ENV_STAGING" ;;
        3) echo "$REPL_ENV_PRODUCTION" ;;
        *) echo "$REPL_ENV_LOCAL" ;;
    esac
}

# Helper: Get mode color by index
repl_mode_color() {
    local idx="${1:-0}"
    case "$idx" in
        0) echo "$REPL_MODE_INSPECT" ;;
        1) echo "$REPL_MODE_TRANSFER" ;;
        2) echo "$REPL_MODE_EXECUTE" ;;
        *) echo "$REPL_MODE_INSPECT" ;;
    esac
}

# Simple prompt builder for org REPL
# Args: org, env, env_idx, mode, mode_idx, action
# Outputs: formatted prompt to stdout
repl_build_org_prompt() {
    local org="$1"
    local env="$2"
    local env_idx="$3"
    local mode="$4"
    local mode_idx="$5"
    local action="$6"

    # Opening bracket
    text_color "$REPL_BRACKET"
    printf '['
    reset_color

    # Org
    if [[ -z "$org" || "$org" == "none" ]]; then
        text_color "$REPL_ORG_INACTIVE"
        printf 'none'
    else
        text_color "$REPL_ORG_ACTIVE"
        printf '%s' "$org"
    fi
    reset_color

    # Separator
    text_color "$REPL_SEPARATOR"
    printf ' x '
    reset_color

    # Environment
    text_color "$(repl_env_color "$env_idx")"
    printf '%s' "$env"
    reset_color

    # Separator
    text_color "$REPL_SEPARATOR"
    printf ' x '
    reset_color

    # Mode
    text_color "$(repl_mode_color "$mode_idx")"
    printf '%s' "$mode"
    reset_color

    # Closing bracket
    text_color "$REPL_BRACKET"
    printf '] '
    reset_color

    # Action
    if [[ -z "$action" || "$action" == "none" ]]; then
        text_color "$REPL_ACTION_NONE"
        printf 'none'
    else
        text_color "$REPL_ACTION_ACTIVE"
        printf '%s' "$action"
    fi
    reset_color

    # Prompt arrow
    text_color "$REPL_ARROW"
    printf '> '
    reset_color
}

# Feedback messages for navigation
repl_feedback_env() {
    text_color "$REPL_FEEDBACK_ENV"
    printf '→ Environment: %s\n' "$1"
    reset_color
}

repl_feedback_mode() {
    text_color "$REPL_FEEDBACK_MODE"
    printf '→ Mode: %s\n' "$1"
    reset_color
}

repl_feedback_action() {
    text_color "$REPL_FEEDBACK_ACTION"
    printf '→ Action: %s\n' "$1"
    reset_color
}
