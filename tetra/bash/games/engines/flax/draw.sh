#!/usr/bin/env bash

# Flax Engine - Drawing Primitives
# High-level drawing functions built on buffer operations

# =============================================================================
# TEXT DRAWING
# =============================================================================

# Draw single character at position
# Usage: flax_draw_char row col char [color]
flax_draw_char() {
    local row="$1" col="$2" char="$3" color="${4:-}"

    flax_goto "$row" "$col"
    [[ -n "$color" ]] && flax_color "$color"
    flax_add "$char"
    [[ -n "$color" ]] && flax_reset
}

# Draw text at position
# Usage: flax_draw_text row col text [color]
flax_draw_text() {
    local row="$1" col="$2" text="$3" color="${4:-}"

    flax_goto "$row" "$col"
    [[ -n "$color" ]] && flax_color "$color"
    flax_add "$text"
    [[ -n "$color" ]] && flax_reset
}

# Draw centered text
# Usage: flax_draw_centered row text [color] [width]
flax_draw_centered() {
    local row="$1" text="$2" color="${3:-}" width="${4:-80}"
    local len=${#text}
    local col=$(( (width - len) / 2 + 1 ))

    flax_draw_text "$row" "$col" "$text" "$color"
}

# =============================================================================
# LINE DRAWING
# =============================================================================

# Draw horizontal line
# Usage: flax_draw_hline row col length [char] [color]
flax_draw_hline() {
    local row="$1" col="$2" length="$3"
    local char="${4:-─}" color="${5:-}"

    flax_goto "$row" "$col"
    [[ -n "$color" ]] && flax_color "$color"

    local i
    for ((i=0; i<length; i++)); do
        flax_add "$char"
    done

    [[ -n "$color" ]] && flax_reset
}

# Draw vertical line
# Usage: flax_draw_vline row col length [char] [color]
flax_draw_vline() {
    local row="$1" col="$2" length="$3"
    local char="${4:-│}" color="${5:-}"

    [[ -n "$color" ]] && flax_color "$color"

    local i
    for ((i=0; i<length; i++)); do
        flax_goto "$((row + i))" "$col"
        flax_add "$char"
    done

    [[ -n "$color" ]] && flax_reset
}

# =============================================================================
# BOX DRAWING
# =============================================================================

# Box characters (Unicode)
declare -gA FLAX_BOX=(
    [tl]="┌" [tr]="┐" [bl]="└" [br]="┘"
    [h]="─" [v]="│"
    [ltee]="├" [rtee]="┤" [ttee]="┬" [btee]="┴"
    [cross]="┼"
)

# Draw rectangle outline
# Usage: flax_draw_rect row col width height [color]
flax_draw_rect() {
    local row="$1" col="$2" width="$3" height="$4" color="${5:-}"

    [[ -n "$color" ]] && flax_color "$color"

    # Top border
    flax_goto "$row" "$col"
    flax_add "${FLAX_BOX[tl]}"
    local i
    for ((i=0; i<width-2; i++)); do
        flax_add "${FLAX_BOX[h]}"
    done
    flax_add "${FLAX_BOX[tr]}"

    # Side borders
    for ((i=1; i<height-1; i++)); do
        flax_goto "$((row + i))" "$col"
        flax_add "${FLAX_BOX[v]}"
        flax_goto "$((row + i))" "$((col + width - 1))"
        flax_add "${FLAX_BOX[v]}"
    done

    # Bottom border
    flax_goto "$((row + height - 1))" "$col"
    flax_add "${FLAX_BOX[bl]}"
    for ((i=0; i<width-2; i++)); do
        flax_add "${FLAX_BOX[h]}"
    done
    flax_add "${FLAX_BOX[br]}"

    [[ -n "$color" ]] && flax_reset
}

# Draw filled rectangle
# Usage: flax_draw_filled_rect row col width height [char] [color]
flax_draw_filled_rect() {
    local row="$1" col="$2" width="$3" height="$4"
    local char="${5:- }" color="${6:-}"

    [[ -n "$color" ]] && flax_color "$color"

    local r c
    for ((r=0; r<height; r++)); do
        flax_goto "$((row + r))" "$col"
        for ((c=0; c<width; c++)); do
            flax_add "$char"
        done
    done

    [[ -n "$color" ]] && flax_reset
}

# =============================================================================
# PROGRESS/BAR DRAWING
# =============================================================================

# Draw progress bar
# Usage: flax_draw_progress row col width value max [color]
flax_draw_progress() {
    local row="$1" col="$2" width="$3" value="$4" max="$5" color="${6:-}"

    local filled=$(( (value * (width - 2)) / max ))
    local empty=$(( width - 2 - filled ))

    flax_goto "$row" "$col"
    [[ -n "$color" ]] && flax_color "$color"

    flax_add "["
    local i
    for ((i=0; i<filled; i++)); do flax_add "█"; done
    for ((i=0; i<empty; i++)); do flax_add "░"; done
    flax_add "]"

    [[ -n "$color" ]] && flax_reset
}

# =============================================================================
# SPRITE DRAWING
# =============================================================================

# Draw multi-line sprite from array
# Usage: flax_draw_sprite row col sprite_array_name [color]
flax_draw_sprite() {
    local row="$1" col="$2"
    local -n sprite="$3"
    local color="${4:-}"

    [[ -n "$color" ]] && flax_color "$color"

    local i line
    for i in "${!sprite[@]}"; do
        flax_goto "$((row + i))" "$col"
        flax_add "${sprite[$i]}"
    done

    [[ -n "$color" ]] && flax_reset
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f flax_draw_char flax_draw_text flax_draw_centered
export -f flax_draw_hline flax_draw_vline
export -f flax_draw_rect flax_draw_filled_rect
export -f flax_draw_progress
export -f flax_draw_sprite
