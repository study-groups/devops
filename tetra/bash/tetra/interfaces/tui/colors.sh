#!/usr/bin/env bash
# Tetra TUI - Color Helpers
# Semantic color shortcuts and file info formatting

# Semantic color shortcuts
_c_title() { printf "\033[1;36m"; }      # bright cyan
_c_label() { printf "\033[1;34m"; }      # bright blue
_c_value() { printf "\033[37m"; }        # white
_c_dim() { printf "\033[90m"; }          # dim gray
_c_success() { printf "\033[32m"; }      # green
_c_warn() { printf "\033[33m"; }         # yellow
_c_error() { printf "\033[31m"; }        # red
_c_accent() { printf "\033[35m"; }       # magenta
_c_info() { printf "\033[34m"; }         # blue
_c_highlight() { printf "\033[1;33m"; }  # bright yellow
_c_reset() { printf "\033[0m"; }

# Get file info: lines and age with colors
_tui_file_info() {
    local file="$1"
    local name=$(basename "$file")
    local lines=0
    local age_str=""
    local age_color=""

    # Count lines
    [[ -f "$file" ]] && lines=$(wc -l < "$file" 2>/dev/null | tr -d ' ')

    # Calculate age
    if [[ -f "$file" ]]; then
        local mod_time=$(stat -f %m "$file" 2>/dev/null || stat -c %Y "$file" 2>/dev/null)
        local now=$(date +%s)
        local age_secs=$((now - mod_time))
        local age_days=$((age_secs / 86400))
        local age_hours=$((age_secs / 3600))

        if [[ $age_days -gt 30 ]]; then
            age_str="${age_days}d"
            age_color="\033[90m"  # dim gray - old
        elif [[ $age_days -gt 7 ]]; then
            age_str="${age_days}d"
            age_color="\033[33m"  # yellow - recent
        elif [[ $age_days -gt 0 ]]; then
            age_str="${age_days}d"
            age_color="\033[32m"  # green - this week
        elif [[ $age_hours -gt 0 ]]; then
            age_str="${age_hours}h"
            age_color="\033[36m"  # cyan - today
        else
            age_str="now"
            age_color="\033[1;36m"  # bright cyan - just now
        fi
    fi

    # Color for line count
    local lines_color="\033[90m"
    [[ $lines -gt 200 ]] && lines_color="\033[33m"
    [[ $lines -gt 500 ]] && lines_color="\033[35m"

    # Format: filename (lines) age
    printf "  \033[37m%-24s\033[0m ${lines_color}%4d\033[0m  ${age_color}%4s\033[0m" "$name" "$lines" "$age_str"
}
