#!/usr/bin/env bash

# TUI Buffer Management - Proper addressing scheme for TUI elements
# Uses coordinate-based addressing instead of sequential rendering

# Screen buffer (associative array keyed by row:col)
declare -gA TUI_SCREEN_BUFFER
declare -gA TUI_PREV_BUFFER

# Screen dimensions
declare -g TUI_ROWS=24
declare -g TUI_COLS=80

# Double buffering support
declare -gA TUI_BACK_BUFFER
declare -g TUI_VSYNC_ENABLED=true

# Initialize buffer system
tui_buffer_init() {
    TUI_ROWS=${TUI_HEIGHT:-24}
    TUI_COLS=${TUI_WIDTH:-80}

    # Clear buffers
    TUI_SCREEN_BUFFER=()
    TUI_PREV_BUFFER=()
    TUI_BACK_BUFFER=()
}

# Set content at specific row/col
tui_buffer_set() {
    local row=$1
    local col=$2
    local content="$3"

    TUI_SCREEN_BUFFER["$row:$col"]="$content"
}

# Set full line at row
tui_buffer_set_line() {
    local row=$1
    local content="$2"

    TUI_SCREEN_BUFFER["$row:0"]="$content"
}

# Get content at row/col
tui_buffer_get() {
    local row=$1
    local col=$2

    echo "${TUI_SCREEN_BUFFER["$row:$col"]:-}"
}

# Clear buffer
tui_buffer_clear() {
    TUI_SCREEN_BUFFER=()
}

# Render only changed lines (differential update)
tui_buffer_render_diff() {
    local changed=false

    # Compare with previous buffer and update only changed lines
    for key in "${!TUI_SCREEN_BUFFER[@]}"; do
        if [[ "${TUI_SCREEN_BUFFER[$key]}" != "${TUI_PREV_BUFFER[$key]}" ]]; then
            local row="${key%%:*}"
            local col="${key##*:}"
            local content="${TUI_SCREEN_BUFFER[$key]}"

            # Position cursor, clear line, and write
            printf '\033[%d;%dH\033[K%s' $((row + 1)) $((col + 1)) "$content"
            changed=true
        fi
    done

    # Check for deleted lines (in prev but not in current)
    for key in "${!TUI_PREV_BUFFER[@]}"; do
        if [[ -z "${TUI_SCREEN_BUFFER[$key]}" ]]; then
            local row="${key%%:*}"
            local col="${key##*:}"
            # Clear the line that was removed
            printf '\033[%d;%dH\033[K' $((row + 1)) $((col + 1))
            changed=true
        fi
    done

    # Copy current to previous
    TUI_PREV_BUFFER=()
    for key in "${!TUI_SCREEN_BUFFER[@]}"; do
        TUI_PREV_BUFFER[$key]="${TUI_SCREEN_BUFFER[$key]}"
    done

    $changed && return 0 || return 1
}

# Force full render
tui_buffer_render_full() {
    # Clear screen
    printf '\033[H\033[2J'

    # Render all buffer contents
    for key in "${!TUI_SCREEN_BUFFER[@]}"; do
        local row="${key%%:*}"
        local col="${key##*:}"
        local content="${TUI_SCREEN_BUFFER[$key]}"

        printf '\033[%d;%dH%s' $((row + 1)) $((col + 1)) "$content"
    done

    # Copy to previous
    for key in "${!TUI_SCREEN_BUFFER[@]}"; do
        TUI_PREV_BUFFER[$key]="${TUI_SCREEN_BUFFER[$key]}"
    done
}

# Define screen regions (logical addressing)
declare -g TUI_REGION_HEADER_START=0
declare -g TUI_REGION_HEADER_END=6
declare -g TUI_REGION_SEP_ROW=7
declare -g TUI_REGION_CONTENT_START=8
declare -g TUI_REGION_FOOTER_START=20

# Update region bounds based on header size
tui_region_update() {
    local header_lines=$(header_get_lines)
    local repl_lines=0
    [[ "$HEADER_REPL_ACTIVE" == "true" ]] && repl_lines=1

    TUI_REGION_HEADER_END=$((header_lines - 1))
    TUI_REGION_SEP_ROW=$((header_lines + repl_lines))
    TUI_REGION_CONTENT_START=$((TUI_REGION_SEP_ROW + 1))
    TUI_REGION_FOOTER_START=$((TUI_ROWS - 5))
}

# Write to header region
tui_write_header() {
    local line_num=$1
    local content="$2"

    [[ $line_num -gt $TUI_REGION_HEADER_END ]] && return 1

    tui_buffer_set_line $((TUI_REGION_HEADER_START + line_num)) "$content"
}

# Write to separator
tui_write_separator() {
    local content="$1"
    tui_buffer_set_line "$TUI_REGION_SEP_ROW" "$content"
}

# Write to content region
tui_write_content() {
    local line_num=$1
    local content="$2"

    local actual_row=$((TUI_REGION_CONTENT_START + line_num))
    [[ $actual_row -ge $TUI_REGION_FOOTER_START ]] && return 1

    tui_buffer_set_line "$actual_row" "$content"
}

# Write to footer region
tui_write_footer() {
    local line_num=$1
    local content="$2"

    local actual_row=$((TUI_REGION_FOOTER_START + line_num))
    [[ $actual_row -ge $TUI_ROWS ]] && return 1

    tui_buffer_set_line "$actual_row" "$content"
}

# Double buffering functions for flicker-free animation

# Atomic buffer swap (flicker-free)
tui_buffer_swap() {
    # Copy back buffer to screen buffer atomically
    for key in "${!TUI_BACK_BUFFER[@]}"; do
        TUI_SCREEN_BUFFER[$key]="${TUI_BACK_BUFFER[$key]}"
    done
    TUI_BACK_BUFFER=()
}

# Write to back buffer instead of screen buffer
tui_buffer_set_back() {
    local row=$1
    local col=$2
    local content="$3"
    TUI_BACK_BUFFER["$row:$col"]="$content"
}

# Set full line in back buffer
tui_buffer_set_line_back() {
    local row=$1
    local content="$2"
    TUI_BACK_BUFFER["$row:0"]="$content"
}

# Render with vsync (flicker-free, batched output)
tui_buffer_render_vsync() {
    local changed=false

    # Build output in memory first to minimize terminal writes
    local output_buffer=""

    # Compare and prepare ANSI sequences
    for key in "${!TUI_SCREEN_BUFFER[@]}"; do
        if [[ "${TUI_SCREEN_BUFFER[$key]}" != "${TUI_PREV_BUFFER[$key]}" ]]; then
            local row="${key%%:*}"
            local col="${key##*:}"
            local content="${TUI_SCREEN_BUFFER[$key]}"

            # Accumulate in buffer (single string reduces flicker)
            output_buffer+=$(printf '\033[%d;%dH\033[K%s' $((row + 1)) $((col + 1)) "$content")
            changed=true
        fi
    done

    # Check for deleted lines (in prev but not in current)
    for key in "${!TUI_PREV_BUFFER[@]}"; do
        if [[ -z "${TUI_SCREEN_BUFFER[$key]}" ]]; then
            local row="${key%%:*}"
            local col="${key##*:}"
            # Clear the line that was removed
            output_buffer+=$(printf '\033[%d;%dH\033[K' $((row + 1)) $((col + 1)))
            changed=true
        fi
    done

    # Write all at once (single write = less flicker)
    [[ -n "$output_buffer" ]] && printf "%s" "$output_buffer"

    # Copy current to previous
    TUI_PREV_BUFFER=()
    for key in "${!TUI_SCREEN_BUFFER[@]}"; do
        TUI_PREV_BUFFER[$key]="${TUI_SCREEN_BUFFER[$key]}"
    done

    $changed && return 0 || return 1
}
