#!/usr/bin/env bash

# TCurses Log Footer Module
# 4-line scrolling log display at bottom of screen

# Log state
declare -a _TCURSES_LOG_LINES=()
_TCURSES_LOG_MAX_LINES=4
_TCURSES_LOG_FORMAT="module:action"

# Initialize log footer
log_footer_init() {
    _TCURSES_LOG_LINES=()
}

# Add a log entry (module:action format with optional color)
# Usage: log_footer_add MODULE ACTION [DETAILS]
log_footer_add() {
    local module="$1"
    local action="$2"
    local details="${3:-}"

    local timestamp=$(date +%H:%M:%S)
    local entry="[$timestamp] "

    # Colorize module:action if colors enabled
    if [[ ${COLOR_ENABLED:-0} -eq 1 ]]; then
        # Module in cyan
        entry+="$(text_color "7DCFFF")${module}$(reset_color):"
        # Action color based on type
        case "$action" in
            ok|success)
                entry+="$(text_color "9ECE6A")${action}$(reset_color)"
                ;;
            error|fail)
                entry+="$(text_color "F7768E")${action}$(reset_color)"
                ;;
            change|exec|insert)
                entry+="$(text_color "BB9AF7")${action}$(reset_color)"
                ;;
            *)
                entry+="$(text_color "7AA2F7")${action}$(reset_color)"
                ;;
        esac
    else
        entry+="${module}:${action}"
    fi

    if [[ -n "$details" ]]; then
        entry+=" | $details"
    fi

    # Add to array
    _TCURSES_LOG_LINES+=("$entry")

    # Keep only last N lines
    if [[ ${#_TCURSES_LOG_LINES[@]} -gt $_TCURSES_LOG_MAX_LINES ]]; then
        _TCURSES_LOG_LINES=("${_TCURSES_LOG_LINES[@]: -$_TCURSES_LOG_MAX_LINES}")
    fi
}

# Render log footer at specified row
# Usage: log_footer_render START_ROW WIDTH
log_footer_render() {
    local start_row="$1"
    local width="$2"

    # Header
    tcurses_buffer_write_line $start_row "$(printf '─%.0s' $(seq 1 $width))"

    # Log lines (pad to 4 lines)
    local line_num=1
    for entry in "${_TCURSES_LOG_LINES[@]}"; do
        # Truncate if too long
        if [[ ${#entry} -gt $((width - 2)) ]]; then
            entry="${entry:0:$((width - 5))}..."
        fi
        tcurses_buffer_write_line $((start_row + line_num)) "  $entry"
        ((line_num++))
    done

    # Pad empty lines
    while [[ $line_num -le $_TCURSES_LOG_MAX_LINES ]]; do
        tcurses_buffer_write_line $((start_row + line_num)) ""
        ((line_num++))
    done
}

# Get log footer height (including separator)
log_footer_height() {
    echo $((_TCURSES_LOG_MAX_LINES + 1))
}

# Clear log
log_footer_clear() {
    _TCURSES_LOG_LINES=()
}

# Export functions
export -f log_footer_init
export -f log_footer_add
export -f log_footer_render
export -f log_footer_height
export -f log_footer_clear
