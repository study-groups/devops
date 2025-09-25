#!/usr/bin/env bash

# TUI Colors - Demo Environment Color Definitions
# Provides color schemes for demo environments and UI elements

# Demo Environment Colors (3 environments)
declare -gA DEMO_ENV_COLORS=(
    ["DEMO"]="cyan"       # Tutorial - educational, friendly
    ["LOCAL"]="green"     # Development - consistent with main system
    ["REMOTE"]="magenta"  # Remote operations - distinctive
)

# Full System Environment Colors (5 environments for reference)
declare -gA ENV_COLORS=(
    ["TETRA"]="blue"      # Central coordination - calm, authoritative
    ["LOCAL"]="green"     # Development - growth, safe
    ["DEV"]="yellow"      # Testing - attention, caution
    ["STAGING"]="orange"  # Pre-production - warning, preparation
    ["PROD"]="red"        # Production - critical, careful
)

# UI Element Colors
declare -gA UI_COLORS=(
    ["current_selection"]="bold_white"      # [CURRENT] items
    ["other_options"]="dim_white"           # non-current items
    ["separator"]="dim_white"               # | and : characters
    ["position"]="dim_yellow"               # (1/3) indicators
    ["hostname"]="bold_white"               # hostname display
    ["status_ok"]="green"                   # Success messages
    ["status_error"]="red"                  # Error messages
    ["status_warning"]="yellow"             # Warning messages
    ["status_info"]="cyan"                  # Information messages
)

# ANSI Color Codes
declare -gA ANSI_COLORS=(
    # Foreground colors
    ["black"]="30"
    ["red"]="31"
    ["green"]="32"
    ["yellow"]="33"
    ["blue"]="34"
    ["magenta"]="35"
    ["cyan"]="36"
    ["white"]="37"

    # Background colors
    ["bg_black"]="40"
    ["bg_red"]="41"
    ["bg_green"]="42"
    ["bg_yellow"]="43"
    ["bg_blue"]="44"
    ["bg_magenta"]="45"
    ["bg_cyan"]="46"
    ["bg_white"]="47"

    # Styles
    ["bold"]="1"
    ["dim"]="2"
    ["italic"]="3"
    ["underline"]="4"
    ["blink"]="5"
    ["reverse"]="7"
    ["strikethrough"]="9"

    # Reset
    ["reset"]="0"
)

# Color application functions
colorize() {
    local color_name="$1"
    local text="$2"
    local color_code=""

    case "$color_name" in
        "bold_white")   color_code="\033[1;37m" ;;
        "dim_white")    color_code="\033[2;37m" ;;
        "dim_yellow")   color_code="\033[2;33m" ;;
        "red")          color_code="\033[31m" ;;
        "green")        color_code="\033[32m" ;;
        "yellow")       color_code="\033[33m" ;;
        "blue")         color_code="\033[34m" ;;
        "magenta")      color_code="\033[35m" ;;
        "cyan")         color_code="\033[36m" ;;
        *)              color_code="\033[0m" ;;
    esac

    echo -e "${color_code}${text}\033[0m"
}

# Environment-specific colorization
colorize_env() {
    local env="$1"
    local text="$2"
    local color="${DEMO_ENV_COLORS[$env]:-white}"

    colorize "$color" "$text"
}

# Current selection highlighting
highlight_current() {
    local text="$1"
    local is_current="$2"

    if [[ "$is_current" == "true" ]]; then
        colorize "bold_white" "[$text]"
    else
        colorize "dim_white" "$text"
    fi
}

# Status message colorization
status_message() {
    local type="$1"  # ok, error, warning, info
    local message="$2"

    case "$type" in
        "ok")      colorize "green" "✓ $message" ;;
        "error")   colorize "red" "✗ $message" ;;
        "warning") colorize "yellow" "⚠ $message" ;;
        "info")    colorize "cyan" "ℹ $message" ;;
        *)         echo "$message" ;;
    esac
}

# Theme support (for future extension)
set_theme() {
    local theme_name="$1"

    case "$theme_name" in
        "dark")
            # Dark theme adjustments
            UI_COLORS["current_selection"]="bold_white"
            UI_COLORS["other_options"]="dim_white"
            ;;
        "light")
            # Light theme adjustments
            UI_COLORS["current_selection"]="bold_black"
            UI_COLORS["other_options"]="dim_black"
            ;;
        "high_contrast")
            # High contrast for accessibility
            UI_COLORS["current_selection"]="bold_white"
            UI_COLORS["other_options"]="white"
            ;;
    esac
}

# Initialize default theme
set_theme "dark"