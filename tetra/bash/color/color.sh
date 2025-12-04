#!/usr/bin/env bash

# Tetra Color Module - Entry Point
# Loads complete color system

# Get directory of this script
COLOR_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load color logging wrapper (provides color_log_* functions)
source "$COLOR_DIR/color_log.sh" 2>/dev/null || true

# Source color system components
source "$COLOR_DIR/color_core.sh"
source "$COLOR_DIR/color_palettes.sh"
source "$COLOR_DIR/color_themes.sh"
source "$COLOR_DIR/color_elements.sh" 2>/dev/null || true

# Enable color by default
COLOR_ENABLED=1

# Legacy color codes (backward compatibility)
export TETRA_RED='\033[0;31m'
export TETRA_GREEN='\033[0;32m'
export TETRA_YELLOW='\033[1;33m'
export TETRA_BLUE='\033[0;34m'
export TETRA_CYAN='\033[0;36m'
export TETRA_MAGENTA='\033[0;35m'
export TETRA_WHITE='\033[1;37m'
export TETRA_GRAY='\033[0;90m'
export TETRA_NC='\033[0m'  # No Color

# Console output functions (renamed to avoid conflict with unified logging)
tetra_console_log() { echo -e "${TETRA_BLUE}$1${TETRA_NC}"; }
tetra_console_warn() { echo -e "${TETRA_YELLOW}$1${TETRA_NC}"; }
tetra_console_error() { echo -e "${TETRA_RED}$1${TETRA_NC}"; }
tetra_console_success() { echo -e "${TETRA_GREEN}$1${TETRA_NC}"; }
tetra_console_info() { echo -e "${TETRA_CYAN}$1${TETRA_NC}"; }
tetra_console_debug() { echo -e "${TETRA_GRAY}$1${TETRA_NC}"; }

# Note: Legacy tetra_log/warn/error/success/info functions removed
# Use tetra_console_* for console output or tetra_log_* for unified logging

# Colorize specific status values
tetra_status_color() {
    local status="$1"
    case "$status" in
        online|running|active|up|FREE)
            echo -e "${TETRA_GREEN}${status}${TETRA_NC}"
            ;;
        stopped|down|inactive|offline)
            echo -e "${TETRA_GRAY}${status}${TETRA_NC}"
            ;;
        error|failed|USED)
            echo -e "${TETRA_RED}${status}${TETRA_NC}"
            ;;
        warning|pending)
            echo -e "${TETRA_YELLOW}${status}${TETRA_NC}"
            ;;
        *)
            echo "$status"
            ;;
    esac
}

# Module initialization
tetra_color_module_init() {
    return 0
}
