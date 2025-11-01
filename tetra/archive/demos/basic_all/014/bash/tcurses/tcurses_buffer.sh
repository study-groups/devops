#!/usr/bin/env bash

# TCurses Double Buffer Module
# Efficient screen rendering with differential updates

# Buffer storage (associative arrays for line-based storage)
declare -gA _TCURSES_FRONT_BUFFER=()
declare -gA _TCURSES_BACK_BUFFER=()
_TCURSES_BUFFER_HEIGHT=0
_TCURSES_BUFFER_WIDTH=0

# Initialize double buffer system
# Usage: tcurses_buffer_init [HEIGHT] [WIDTH]
tcurses_buffer_init() {
    local height="${1:-$(tcurses_screen_height)}"
    local width="${2:-$(tcurses_screen_width)}"

    _TCURSES_BUFFER_HEIGHT="$height"
    _TCURSES_BUFFER_WIDTH="$width"

    # Clear both buffers
    _TCURSES_FRONT_BUFFER=()
    _TCURSES_BACK_BUFFER=()
}

# Clear back buffer
# Usage: tcurses_buffer_clear
tcurses_buffer_clear() {
    _TCURSES_BACK_BUFFER=()
}

# Write a line to back buffer
# Usage: tcurses_buffer_write_line LINE_NUM TEXT
tcurses_buffer_write_line() {
    local line_num="$1"
    local text="$2"

    # Truncate or pad to buffer width if needed
    # (Optional - for now we just store the text as-is)
    _TCURSES_BACK_BUFFER["$line_num"]="$text"
}

# Write text at specific position in back buffer
# Usage: tcurses_buffer_write_at LINE COL TEXT
tcurses_buffer_write_at() {
    local line="$1"
    local col="$2"
    local text="$3"

    # Get existing line or create empty one
    local existing="${_TCURSES_BACK_BUFFER[$line]:-}"

    # Pad line to column position if needed
    while [[ ${#existing} -lt $((col - 1)) ]]; do
        existing+=" "
    done

    # Insert text at position
    local before="${existing:0:$((col - 1))}"
    local after="${existing:$((col - 1 + ${#text}))}"
    _TCURSES_BACK_BUFFER["$line"]="${before}${text}${after}"
}

# Render full screen (back buffer -> screen, update front buffer)
# Usage: tcurses_buffer_render_full
tcurses_buffer_render_full() {
    # Move to top-left
    tcurses_screen_move_cursor 1 1

    # Render all lines
    for ((i = 0; i < _TCURSES_BUFFER_HEIGHT; i++)); do
        local line="${_TCURSES_BACK_BUFFER[$i]:-}"
        tcurses_screen_move_cursor $((i + 1)) 1
        # Clear line and write content
        printf '\033[K%s' "$line"
    done

    # Copy back buffer to front buffer
    for key in "${!_TCURSES_BACK_BUFFER[@]}"; do
        _TCURSES_FRONT_BUFFER["$key"]="${_TCURSES_BACK_BUFFER[$key]}"
    done
}

# Render differential (only changed lines)
# Usage: tcurses_buffer_render_diff
tcurses_buffer_render_diff() {
    local changes=0

    # Check each line in back buffer
    for key in "${!_TCURSES_BACK_BUFFER[@]}"; do
        local back_line="${_TCURSES_BACK_BUFFER[$key]}"
        local front_line="${_TCURSES_FRONT_BUFFER[$key]:-}"

        # Only render if changed
        if [[ "$back_line" != "$front_line" ]]; then
            local line_num=$((key + 1))
            tcurses_screen_move_cursor "$line_num" 1
            printf '\033[K%s' "$back_line"
            _TCURSES_FRONT_BUFFER["$key"]="$back_line"
            ((changes++))
        fi
    done

    # Check for deleted lines (in front but not in back)
    for key in "${!_TCURSES_FRONT_BUFFER[@]}"; do
        if [[ -z "${_TCURSES_BACK_BUFFER[$key]:-}" ]]; then
            local line_num=$((key + 1))
            tcurses_screen_move_cursor "$line_num" 1
            printf '\033[K'  # Clear line
            unset "_TCURSES_FRONT_BUFFER[$key]"
            ((changes++))
        fi
    done

    return "$changes"
}

# Render with vsync (differential update, optimal for animations)
# Usage: tcurses_buffer_render_vsync
tcurses_buffer_render_vsync() {
    # Hide cursor during update
    tcurses_screen_save_cursor
    tcurses_screen_hide_cursor

    # Render changes
    tcurses_buffer_render_diff

    # Restore cursor
    tcurses_screen_restore_cursor
}

# Get a line from back buffer
# Usage: tcurses_buffer_get_line LINE_NUM
tcurses_buffer_get_line() {
    local line_num="$1"
    echo "${_TCURSES_BACK_BUFFER[$line_num]:-}"
}

# Get buffer dimensions
# Usage: tcurses_buffer_get_size
# Output: "HEIGHT WIDTH"
tcurses_buffer_get_size() {
    echo "$_TCURSES_BUFFER_HEIGHT $_TCURSES_BUFFER_WIDTH"
}

# Swap buffers (advanced: for triple buffering)
# Usage: tcurses_buffer_swap
tcurses_buffer_swap() {
    local -A temp=()

    # Copy front to temp
    for key in "${!_TCURSES_FRONT_BUFFER[@]}"; do
        temp["$key"]="${_TCURSES_FRONT_BUFFER[$key]}"
    done

    # Copy back to front
    _TCURSES_FRONT_BUFFER=()
    for key in "${!_TCURSES_BACK_BUFFER[@]}"; do
        _TCURSES_FRONT_BUFFER["$key"]="${_TCURSES_BACK_BUFFER[$key]}"
    done

    # Copy temp to back
    _TCURSES_BACK_BUFFER=()
    for key in "${!temp[@]}"; do
        _TCURSES_BACK_BUFFER["$key"]="${temp[$key]}"
    done
}

# Debug: Dump buffer contents
# Usage: tcurses_buffer_debug [BUFFER_NAME]
tcurses_buffer_debug() {
    local buffer="${1:-back}"

    case "$buffer" in
        front)
            echo "=== Front Buffer ==="
            for key in $(printf '%s\n' "${!_TCURSES_FRONT_BUFFER[@]}" | sort -n); do
                echo "[$key] ${_TCURSES_FRONT_BUFFER[$key]}"
            done
            ;;
        back)
            echo "=== Back Buffer ==="
            for key in $(printf '%s\n' "${!_TCURSES_BACK_BUFFER[@]}" | sort -n); do
                echo "[$key] ${_TCURSES_BACK_BUFFER[$key]}"
            done
            ;;
        *)
            echo "Unknown buffer: $buffer" >&2
            return 1
            ;;
    esac
}

# Copy a rectangular region from back buffer to position
# Usage: tcurses_buffer_blit SRC_LINE SRC_COL WIDTH HEIGHT DST_LINE DST_COL
# (Advanced feature for sprite-like operations)
tcurses_buffer_blit() {
    local src_line="$1"
    local src_col="$2"
    local width="$3"
    local height="$4"
    local dst_line="$5"
    local dst_col="$6"

    for ((i = 0; i < height; i++)); do
        local src_line_num=$((src_line + i))
        local dst_line_num=$((dst_line + i))
        local src_text="${_TCURSES_BACK_BUFFER[$src_line_num]:-}"

        # Extract region
        local region="${src_text:$((src_col - 1)):$width}"

        # Write to destination
        tcurses_buffer_write_at "$dst_line_num" "$dst_col" "$region"
    done
}
