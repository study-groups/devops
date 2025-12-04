#!/usr/bin/env bash

# Tetra Color Constants
# Centralized ANSI color definitions for consistent styling across modules
#
# Usage:
#   source "$TETRA_SRC/bash/utils/color_constants.sh"
#   echo -e "${TC_TITLE}My Title${TC_RESET}"
#
# Or load shorthand into local scope:
#   tetra_load_colors
#   echo -e "${C_TITLE}My Title${C_NC}"

# =============================================================================
# Core ANSI Color Codes (TC_ prefix = Tetra Color)
# =============================================================================

# Reset
declare -g TC_RESET='\033[0m'
declare -g TC_NC='\033[0m'  # Alias for No Color

# Standard colors
declare -g TC_BLACK='\033[0;30m'
declare -g TC_RED='\033[0;31m'
declare -g TC_GREEN='\033[0;32m'
declare -g TC_YELLOW='\033[0;33m'
declare -g TC_BLUE='\033[0;34m'
declare -g TC_MAGENTA='\033[0;35m'
declare -g TC_CYAN='\033[0;36m'
declare -g TC_WHITE='\033[0;37m'
declare -g TC_GRAY='\033[0;90m'

# Bright/Bold colors
declare -g TC_BRIGHT_BLACK='\033[1;30m'
declare -g TC_BRIGHT_RED='\033[1;31m'
declare -g TC_BRIGHT_GREEN='\033[1;32m'
declare -g TC_BRIGHT_YELLOW='\033[1;33m'
declare -g TC_BRIGHT_BLUE='\033[1;34m'
declare -g TC_BRIGHT_MAGENTA='\033[1;35m'
declare -g TC_BRIGHT_CYAN='\033[1;36m'
declare -g TC_BRIGHT_WHITE='\033[1;37m'

# Dim colors
declare -g TC_DIM_GRAY='\033[2;37m'
declare -g TC_DIM_CYAN='\033[2;36m'
declare -g TC_DIM_WHITE='\033[2;37m'

# =============================================================================
# Semantic Colors (for consistent meaning across modules)
# =============================================================================

# UI elements
declare -g TC_TITLE='\033[1;36m'      # Bright cyan - titles, headers
declare -g TC_CATEGORY='\033[1;34m'   # Bright blue - categories, sections
declare -g TC_COMMAND='\033[0;36m'    # Cyan - command names
declare -g TC_COMMAND_DIM='\033[2;36m' # Dim cyan - subcommands
declare -g TC_LABEL='\033[0;90m'      # Gray - labels, metadata
declare -g TC_LABEL_DIM='\033[2;37m'  # Dim gray - secondary labels

# Status indicators
declare -g TC_SUCCESS='\033[0;32m'    # Green - success, active, online
declare -g TC_ERROR='\033[0;31m'      # Red - errors, failures
declare -g TC_WARNING='\033[1;33m'    # Yellow - warnings, pending
declare -g TC_INFO='\033[0;36m'       # Cyan - information
declare -g TC_DEBUG='\033[0;90m'      # Gray - debug output
declare -g TC_MUTED='\033[0;90m'      # Gray - disabled, inactive

# Prompt colors
declare -g TC_PROMPT='\033[1;32m'     # Bright green - prompt marker
declare -g TC_INPUT='\033[0;37m'      # White - user input
declare -g TC_HINT='\033[0;90m'       # Gray - hints, placeholders

# =============================================================================
# Shorthand Loader (for local scope in functions)
# =============================================================================

# Load shorthand color variables into current scope
# Usage: tetra_load_colors (at start of function)
tetra_load_colors() {
    # These become local if called inside a function
    C_NC="$TC_NC"
    C_RESET="$TC_RESET"

    # UI colors
    C_TITLE="$TC_TITLE"
    C_CAT="$TC_CATEGORY"
    C_CMD="$TC_CMD"
    C_CMD_DIM="$TC_COMMAND_DIM"
    C_GRAY="$TC_GRAY"
    C_GRAY_DIM="$TC_DIM_GRAY"

    # Status colors
    C_SUCCESS="$TC_SUCCESS"
    C_ERROR="$TC_ERROR"
    C_WARN="$TC_WARNING"
    C_INFO="$TC_INFO"
    C_DEBUG="$TC_DEBUG"
}

# =============================================================================
# Helper Functions
# =============================================================================

# Print colored text
# Args: $1 = color variable name (without TC_ prefix), $2 = text
tc_print() {
    local color_var="TC_${1^^}"
    local text="$2"
    echo -e "${!color_var}${text}${TC_RESET}"
}

# Print colored text without newline
tc_print_n() {
    local color_var="TC_${1^^}"
    local text="$2"
    echo -en "${!color_var}${text}${TC_RESET}"
}

# Colorize status value
tc_status() {
    local status="$1"
    case "$status" in
        online|running|active|up|success|ok|FREE|enabled)
            echo -e "${TC_SUCCESS}${status}${TC_RESET}"
            ;;
        stopped|down|inactive|offline|disabled)
            echo -e "${TC_MUTED}${status}${TC_RESET}"
            ;;
        error|failed|USED|critical)
            echo -e "${TC_ERROR}${status}${TC_RESET}"
            ;;
        warning|pending|starting|stopping)
            echo -e "${TC_WARNING}${status}${TC_RESET}"
            ;;
        *)
            echo "$status"
            ;;
    esac
}

# Export all TC_ variables
export TC_RESET TC_NC
export TC_BLACK TC_RED TC_GREEN TC_YELLOW TC_BLUE TC_MAGENTA TC_CYAN TC_WHITE TC_GRAY
export TC_BRIGHT_BLACK TC_BRIGHT_RED TC_BRIGHT_GREEN TC_BRIGHT_YELLOW
export TC_BRIGHT_BLUE TC_BRIGHT_MAGENTA TC_BRIGHT_CYAN TC_BRIGHT_WHITE
export TC_DIM_GRAY TC_DIM_CYAN TC_DIM_WHITE
export TC_TITLE TC_CATEGORY TC_COMMAND TC_COMMAND_DIM TC_LABEL TC_LABEL_DIM
export TC_SUCCESS TC_ERROR TC_WARNING TC_INFO TC_DEBUG TC_MUTED
export TC_PROMPT TC_INPUT TC_HINT
