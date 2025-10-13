#!/usr/bin/env bash

# Tetra Color Module
# Provides consistent color formatting across all tetra modules

# Color codes
export TETRA_RED='\033[0;31m'
export TETRA_GREEN='\033[0;32m'
export TETRA_YELLOW='\033[1;33m'
export TETRA_BLUE='\033[0;34m'
export TETRA_CYAN='\033[0;36m'
export TETRA_MAGENTA='\033[0;35m'
export TETRA_WHITE='\033[1;37m'
export TETRA_GRAY='\033[0;90m'
export TETRA_NC='\033[0m'  # No Color

# Helper functions for common log patterns
tetra_log() { echo -e "${TETRA_BLUE}$1${TETRA_NC}"; }
tetra_warn() { echo -e "${TETRA_YELLOW}$1${TETRA_NC}"; }
tetra_error() { echo -e "${TETRA_RED}$1${TETRA_NC}"; }
tetra_success() { echo -e "${TETRA_GREEN}$1${TETRA_NC}"; }
tetra_info() { echo -e "${TETRA_CYAN}$1${TETRA_NC}"; }

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
