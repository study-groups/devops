#!/usr/bin/env bash

# Game Drawing Primitives
# High-level drawing functions using screen buffer

# Draw a single character at position
# Args: x, y, char, color
game_draw_char() {
    local x="$1"
    local y="$2"
    local char="$3"
    local color="${4:-}"

    game_screen_set_cell "$x" "$y" "$char" "$color"
}

# Draw a string at position
# Args: x, y, text, color
game_draw_text() {
    local x="$1"
    local y="$2"
    local text="$3"
    local color="${4:-}"

    local len="${#text}"
    for ((i=0; i<len; i++)); do
        local char="${text:$i:1}"
        game_screen_set_cell "$((x + i))" "$y" "$char" "$color"
    done
}

# Draw a horizontal line
# Args: x1, y, x2, char, color
game_draw_hline() {
    local x1="$1"
    local y="$2"
    local x2="$3"
    local char="${4:-─}"
    local color="${5:-}"

    [[ $x1 -gt $x2 ]] && { local tmp=$x1; x1=$x2; x2=$tmp; }

    for ((x=x1; x<=x2; x++)); do
        game_screen_set_cell "$x" "$y" "$char" "$color"
    done
}

# Draw a vertical line
# Args: x, y1, y2, char, color
game_draw_vline() {
    local x="$1"
    local y1="$2"
    local y2="$3"
    local char="${4:-│}"
    local color="${5:-}"

    [[ $y1 -gt $y2 ]] && { local tmp=$y1; y1=$y2; y2=$tmp; }

    for ((y=y1; y<=y2; y++)); do
        game_screen_set_cell "$x" "$y" "$char" "$color"
    done
}

# Draw a rectangle outline
# Args: x, y, width, height, color
game_draw_rect() {
    local x="$1"
    local y="$2"
    local width="$3"
    local height="$4"
    local color="${5:-}"

    # Top and bottom
    game_draw_hline "$x" "$y" "$((x + width - 1))" "─" "$color"
    game_draw_hline "$x" "$((y + height - 1))" "$((x + width - 1))" "─" "$color"

    # Sides
    game_draw_vline "$x" "$y" "$((y + height - 1))" "│" "$color"
    game_draw_vline "$((x + width - 1))" "$y" "$((y + height - 1))" "│" "$color"

    # Corners
    game_screen_set_cell "$x" "$y" "┌" "$color"
    game_screen_set_cell "$((x + width - 1))" "$y" "┐" "$color"
    game_screen_set_cell "$x" "$((y + height - 1))" "└" "$color"
    game_screen_set_cell "$((x + width - 1))" "$((y + height - 1))" "┘" "$color"
}

# Draw a filled rectangle
# Args: x, y, width, height, char, color
game_draw_filled_rect() {
    local x="$1"
    local y="$2"
    local width="$3"
    local height="$4"
    local char="${5:- }"
    local color="${6:-}"

    for ((dy=0; dy<height; dy++)); do
        for ((dx=0; dx<width; dx++)); do
            game_screen_set_cell "$((x + dx))" "$((y + dy))" "$char" "$color"
        done
    done
}

# Draw a circle (using Bresenham's algorithm)
# Args: cx, cy, radius, char, color
game_draw_circle() {
    local cx="$1"
    local cy="$2"
    local radius="$3"
    local char="${4:-○}"
    local color="${5:-}"

    local x=0
    local y=$radius
    local d=$((3 - 2 * radius))

    while [[ $x -le $y ]]; do
        # Draw 8 octants
        game_screen_set_cell "$((cx + x))" "$((cy + y))" "$char" "$color"
        game_screen_set_cell "$((cx - x))" "$((cy + y))" "$char" "$color"
        game_screen_set_cell "$((cx + x))" "$((cy - y))" "$char" "$color"
        game_screen_set_cell "$((cx - x))" "$((cy - y))" "$char" "$color"
        game_screen_set_cell "$((cx + y))" "$((cy + x))" "$char" "$color"
        game_screen_set_cell "$((cx - y))" "$((cy + x))" "$char" "$color"
        game_screen_set_cell "$((cx + y))" "$((cy - x))" "$char" "$color"
        game_screen_set_cell "$((cx - y))" "$((cy - x))" "$char" "$color"

        if [[ $d -lt 0 ]]; then
            d=$((d + 4 * x + 6))
        else
            d=$((d + 4 * (x - y) + 10))
            y=$((y - 1))
        fi
        x=$((x + 1))
    done
}

# Draw a line (using Bresenham's algorithm)
# Args: x1, y1, x2, y2, char, color
game_draw_line() {
    local x1="$1"
    local y1="$2"
    local x2="$3"
    local y2="$4"
    local char="${5:-*}"
    local color="${6:-}"

    local dx=$((x2 - x1))
    local dy=$((y2 - y1))

    # Absolute values
    [[ $dx -lt 0 ]] && dx=$((-dx))
    [[ $dy -lt 0 ]] && dy=$((-dy))

    local sx=$([[ $x1 -lt $x2 ]] && echo 1 || echo -1)
    local sy=$([[ $y1 -lt $y2 ]] && echo 1 || echo -1)

    local err=$((dx - dy))

    while true; do
        game_screen_set_cell "$x1" "$y1" "$char" "$color"

        [[ $x1 -eq $x2 && $y1 -eq $y2 ]] && break

        local e2=$((2 * err))

        if [[ $e2 -gt -$dy ]]; then
            err=$((err - dy))
            x1=$((x1 + sx))
        fi

        if [[ $e2 -lt $dx ]]; then
            err=$((err + dx))
            y1=$((y1 + sy))
        fi
    done
}

# Draw centered text
# Args: y, text, color
game_draw_text_centered() {
    local y="$1"
    local text="$2"
    local color="${3:-}"

    local text_len="${#text}"
    local x=$(( (GAME_SCREEN_WIDTH - text_len) / 2 ))

    game_draw_text "$x" "$y" "$text" "$color"
}

# Export drawing functions
export -f game_draw_char
export -f game_draw_text
export -f game_draw_hline
export -f game_draw_vline
export -f game_draw_rect
export -f game_draw_filled_rect
export -f game_draw_circle
export -f game_draw_line
export -f game_draw_text_centered
