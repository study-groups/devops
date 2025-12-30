#!/usr/bin/env bash
# Tetra Color Module - Legacy Compatibility Layer
#
# This is a thin compatibility layer for modules that still use TETRA_* constants.
# New code should use TDS directly via: source "$TETRA_SRC/bash/tds/tds.sh"

# Avoid reloading
[[ -n "${_COLOR_SH_LOADED:-}" ]] && return 0
_COLOR_SH_LOADED=1

# Core color functions (TDS depends on these)
COLOR_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$COLOR_DIR/color_core.sh"
source "$COLOR_DIR/color_palettes.sh"

# Legacy ANSI color constants (backward compatibility)
export TETRA_RED=$'\033[0;31m'
export TETRA_GREEN=$'\033[0;32m'
export TETRA_YELLOW=$'\033[1;33m'
export TETRA_BLUE=$'\033[0;34m'
export TETRA_CYAN=$'\033[0;36m'
export TETRA_MAGENTA=$'\033[0;35m'
export TETRA_WHITE=$'\033[1;37m'
export TETRA_GRAY=$'\033[0;90m'
export TETRA_NC=$'\033[0m'

# Legacy console functions
tetra_console_log()     { echo -e "${TETRA_BLUE}$1${TETRA_NC}"; }
tetra_console_warn()    { echo -e "${TETRA_YELLOW}$1${TETRA_NC}"; }
tetra_console_error()   { echo -e "${TETRA_RED}$1${TETRA_NC}"; }
tetra_console_success() { echo -e "${TETRA_GREEN}$1${TETRA_NC}"; }
tetra_console_info()    { echo -e "${TETRA_CYAN}$1${TETRA_NC}"; }
tetra_console_debug()   { echo -e "${TETRA_GRAY}$1${TETRA_NC}"; }

# Legacy status colorizer
tetra_status_color() {
    local status="$1"
    case "$status" in
        online|running|active|up|FREE)
            echo -e "${TETRA_GREEN}${status}${TETRA_NC}" ;;
        stopped|down|inactive|offline)
            echo -e "${TETRA_GRAY}${status}${TETRA_NC}" ;;
        error|failed|USED)
            echo -e "${TETRA_RED}${status}${TETRA_NC}" ;;
        warning|pending)
            echo -e "${TETRA_YELLOW}${status}${TETRA_NC}" ;;
        *)
            echo "$status" ;;
    esac
}

export -f tetra_console_log tetra_console_warn tetra_console_error
export -f tetra_console_success tetra_console_info tetra_console_debug
export -f tetra_status_color
