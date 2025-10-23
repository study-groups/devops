#!/usr/bin/env bash

# Game Screen Buffer System
# Double-buffering and screen management

# Screen state (declared globally in game.sh)
# GAME_SCREEN_WIDTH - screen width in characters
# GAME_SCREEN_HEIGHT - screen height in characters
# GAME_SCREEN_CELLS - "x:y" -> "char|color"
GAME_SCREEN_BUFFER=""

# Initialize screen
game_screen_init() {
    local width="${1:-80}"
    local height="${2:-24}"

    GAME_SCREEN_WIDTH="$width"
    GAME_SCREEN_HEIGHT="$height"

    # Clear terminal
    tput clear 2>/dev/null || printf '\033[2J'
    tput civis 2>/dev/null || printf '\033[?25l'  # Hide cursor
}

# Clear screen buffer
game_screen_clear() {
    GAME_SCREEN_CELLS=()
}

# Set cell in buffer
# Args: x, y, char, color_code
game_screen_set_cell() {
    local x="$1"
    local y="$2"
    local char="$3"
    local color="${4:-}"

    # Bounds check
    [[ $x -lt 0 || $x -ge $GAME_SCREEN_WIDTH ]] && return
    [[ $y -lt 0 || $y -ge $GAME_SCREEN_HEIGHT ]] && return

    GAME_SCREEN_CELLS["$x:$y"]="${char}|${color}"
}

# Get cell from buffer
# Args: x, y
# Returns: "char|color"
game_screen_get_cell() {
    local x="$1"
    local y="$2"
    echo "${GAME_SCREEN_CELLS[$x:$y]}"
}

# Flush buffer to screen
game_screen_flush() {
    local output=""

    # Build output string
    for ((y=0; y<GAME_SCREEN_HEIGHT; y++)); do
        for ((x=0; x<GAME_SCREEN_WIDTH; x++)); do
            local cell="${GAME_SCREEN_CELLS[$x:$y]}"

            if [[ -n "$cell" ]]; then
                local char="${cell%%|*}"
                local color="${cell##*|}"

                # Position cursor (ANSI uses 1-based coordinates)
                output+="\033[$((y+1));$((x+1))H"
                [[ -n "$color" && "$color" != "$char" ]] && output+="$color"
                output+="$char"
                [[ -n "$color" && "$color" != "$char" ]] && output+="\033[0m"
            fi
        done
    done

    # Write to screen
    printf "%b" "$output"
}

# Clear entire screen immediately
game_screen_clear_screen() {
    tput clear 2>/dev/null || printf '\033[2J\033[H'
}

# Move cursor to position
# Args: x, y
game_screen_move_cursor() {
    local x="$1"
    local y="$2"
    tput cup "$y" "$x" 2>/dev/null || printf '\033[%d;%dH' "$y" "$x"
}

# Show cursor
game_screen_show_cursor() {
    tput cnorm 2>/dev/null || printf '\033[?25h'
}

# Hide cursor
game_screen_hide_cursor() {
    tput civis 2>/dev/null || printf '\033[?25l'
}

# Get terminal size
# Returns: "width height"
game_screen_get_size() {
    local width height
    if command -v tput >/dev/null 2>&1; then
        width=$(tput cols)
        height=$(tput lines)
    else
        width=80
        height=24
    fi
    echo "$width $height"
}

# Auto-detect and set screen size
game_screen_auto_size() {
    local size=$(game_screen_get_size)
    GAME_SCREEN_WIDTH="${size%% *}"
    GAME_SCREEN_HEIGHT="${size##* }"
}

# Draw border around screen
game_screen_draw_border() {
    local color="${1:-}"

    # Top border
    for ((x=0; x<GAME_SCREEN_WIDTH; x++)); do
        game_screen_set_cell "$x" "0" "─" "$color"
    done

    # Bottom border
    for ((x=0; x<GAME_SCREEN_WIDTH; x++)); do
        game_screen_set_cell "$x" "$((GAME_SCREEN_HEIGHT-1))" "─" "$color"
    done

    # Side borders
    for ((y=1; y<GAME_SCREEN_HEIGHT-1; y++)); do
        game_screen_set_cell "0" "$y" "│" "$color"
        game_screen_set_cell "$((GAME_SCREEN_WIDTH-1))" "$y" "│" "$color"
    done

    # Corners
    game_screen_set_cell "0" "0" "┌" "$color"
    game_screen_set_cell "$((GAME_SCREEN_WIDTH-1))" "0" "┐" "$color"
    game_screen_set_cell "0" "$((GAME_SCREEN_HEIGHT-1))" "└" "$color"
    game_screen_set_cell "$((GAME_SCREEN_WIDTH-1))" "$((GAME_SCREEN_HEIGHT-1))" "┘" "$color"
}

# Cleanup screen
game_screen_cleanup() {
    game_screen_show_cursor
    tput clear 2>/dev/null || printf '\033[2J\033[H'
}

# Export screen functions
export -f game_screen_init
export -f game_screen_clear
export -f game_screen_set_cell
export -f game_screen_get_cell
export -f game_screen_flush
export -f game_screen_clear_screen
export -f game_screen_move_cursor
export -f game_screen_show_cursor
export -f game_screen_hide_cursor
export -f game_screen_get_size
export -f game_screen_auto_size
export -f game_screen_draw_border
export -f game_screen_cleanup
