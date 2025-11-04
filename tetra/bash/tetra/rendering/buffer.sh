#!/usr/bin/env bash
# Tetra TUI Buffer System
# Differential rendering for flicker-free updates (from 014)

# Screen buffer - stores rendered lines for differential updates
declare -gA TUI_SCREEN_BUFFER=()
declare -gA TUI_SCREEN_BUFFER_PREV=()

# Buffer regions
declare -g TUI_REGION_HEADER_START=0
declare -g TUI_REGION_HEADER_END=0
declare -g TUI_REGION_SEPARATOR=0
declare -g TUI_REGION_COMMAND=0
declare -g TUI_REGION_CONTENT_START=0
declare -g TUI_REGION_CONTENT_END=0
declare -g TUI_REGION_FOOTER_START=0
declare -g TUI_REGION_FOOTER_END=0

# Initialize buffer system
tui_buffer_init() {
    TUI_SCREEN_BUFFER=()
    TUI_SCREEN_BUFFER_PREV=()
}

# Update region boundaries based on current layout
tui_region_update() {
    local line=0

    # Header region
    TUI_REGION_HEADER_START=$line
    line=$((line + HEADER_LINES))
    TUI_REGION_HEADER_END=$((line - 1))

    # Separator
    TUI_REGION_SEPARATOR=$line
    line=$((line + SEPARATOR_LINES))

    # Command line (if active)
    if [[ "${CONTENT_MODEL[command_mode]}" == "true" ]]; then
        TUI_REGION_COMMAND=$line
        line=$((line + COMMAND_LINES))
    else
        TUI_REGION_COMMAND=-1
    fi

    # Content region
    TUI_REGION_CONTENT_START=$line
    line=$((line + CONTENT_VIEWPORT_HEIGHT))
    TUI_REGION_CONTENT_END=$((line - 1))

    # Footer region
    TUI_REGION_FOOTER_START=$line
    line=$((line + FOOTER_LINES))
    TUI_REGION_FOOTER_END=$((line - 1))
}

# Write line to buffer (region-specific)
tui_write_line() {
    local line_num=$1
    local content="$2"

    TUI_SCREEN_BUFFER[$line_num]="$content"
}

# Write to header region
tui_write_header() {
    local offset=$1
    local content="$2"
    local line_num=$((TUI_REGION_HEADER_START + offset))

    tui_write_line "$line_num" "$content"
}

# Write separator
tui_write_separator() {
    local content="$1"
    tui_write_line "$TUI_REGION_SEPARATOR" "$content"
}

# Write command line
tui_write_command() {
    local content="$1"
    if [[ $TUI_REGION_COMMAND -ge 0 ]]; then
        tui_write_line "$TUI_REGION_COMMAND" "$content"
    fi
}

# Write to content region
tui_write_content() {
    local offset=$1
    local content="$2"
    local line_num=$((TUI_REGION_CONTENT_START + offset))

    if [[ $line_num -le $TUI_REGION_CONTENT_END ]]; then
        tui_write_line "$line_num" "$content"
    fi
}

# Write to footer region
tui_write_footer() {
    local offset=$1
    local content="$2"
    local line_num=$((TUI_REGION_FOOTER_START + offset))

    if [[ $line_num -le $TUI_REGION_FOOTER_END ]]; then
        tui_write_line "$line_num" "$content"
    fi
}

# Clear buffer
tui_buffer_clear() {
    TUI_SCREEN_BUFFER=()
}

# Render full screen (used on first render or resize)
tui_buffer_render_full() {
    tput cup 0 0
    tput ed

    # Render all lines in buffer
    local max_line=0
    for line_num in "${!TUI_SCREEN_BUFFER[@]}"; do
        [[ $line_num -gt $max_line ]] && max_line=$line_num
    done

    for ((i=0; i<=max_line; i++)); do
        local content="${TUI_SCREEN_BUFFER[$i]:-}"
        echo -e "$content"
        tput el  # Clear to end of line
    done

    # Copy current buffer to previous for next diff
    for key in "${!TUI_SCREEN_BUFFER[@]}"; do
        TUI_SCREEN_BUFFER_PREV[$key]="${TUI_SCREEN_BUFFER[$key]}"
    done
}

# Render differential updates (only changed lines)
tui_buffer_render_diff() {
    for line_num in "${!TUI_SCREEN_BUFFER[@]}"; do
        local current="${TUI_SCREEN_BUFFER[$line_num]}"
        local previous="${TUI_SCREEN_BUFFER_PREV[$line_num]:-}"

        # Only update if line changed
        if [[ "$current" != "$previous" ]]; then
            tput cup "$line_num" 0
            echo -ne "$current"
            tput el  # Clear to end of line
            TUI_SCREEN_BUFFER_PREV[$line_num]="$current"
        fi
    done
}

# Render single line update (for animations)
tui_buffer_render_line() {
    local line_num=$1
    local content="${TUI_SCREEN_BUFFER[$line_num]}"

    tput cup "$line_num" 0
    echo -ne "$content"
    tput el
    TUI_SCREEN_BUFFER_PREV[$line_num]="$content"
}

# Vsync rendering - update separator with minimal flicker
tui_buffer_render_vsync() {
    # Update only the separator line
    tui_buffer_render_line "$TUI_REGION_SEPARATOR"
}

# Export functions
export -f tui_buffer_init
export -f tui_region_update
export -f tui_write_line
export -f tui_write_header
export -f tui_write_separator
export -f tui_write_command
export -f tui_write_content
export -f tui_write_footer
export -f tui_buffer_clear
export -f tui_buffer_render_full
export -f tui_buffer_render_diff
export -f tui_buffer_render_line
export -f tui_buffer_render_vsync
