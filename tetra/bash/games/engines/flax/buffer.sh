#!/usr/bin/env bash

# Flax Engine - Buffer Module
# Direct string accumulation for fast terminal rendering
#
# The "dumb and fast" approach: accumulate all output into a single
# string buffer, then flush it all at once with printf '%b'.

# Buffer state
declare -g FLAX_BUFFER=""

# Screen offset for centering (optional)
declare -g FLAX_OFFSET_X=0
declare -g FLAX_OFFSET_Y=0

# =============================================================================
# CORE BUFFER OPERATIONS
# =============================================================================

# Clear the buffer (start fresh frame)
flax_clear() {
    FLAX_BUFFER=""
}

# Add raw content to buffer
flax_add() {
    FLAX_BUFFER+="$*"
}

# Add newline
flax_newline() {
    FLAX_BUFFER+=$'\n'
}

# Flush buffer to terminal (single atomic output)
# Adds frame marker for bridge synchronization
flax_flush() {
    printf '%b\x1b_FRAME\x1b\\' "$FLAX_BUFFER"
}

# =============================================================================
# CURSOR POSITIONING
# =============================================================================

# Move cursor to row, col (1-based, applies offset)
flax_goto() {
    local row=$((FLAX_OFFSET_Y + $1))
    local col=$((FLAX_OFFSET_X + $2))
    FLAX_BUFFER+=$'\033['"${row};${col}H"
}

# Move cursor to row, col (raw, no offset)
flax_goto_raw() {
    FLAX_BUFFER+=$'\033['"$1;$2H"
}

# Move cursor relative
flax_move_up() { FLAX_BUFFER+=$'\033['"${1:-1}A"; }
flax_move_down() { FLAX_BUFFER+=$'\033['"${1:-1}B"; }
flax_move_right() { FLAX_BUFFER+=$'\033['"${1:-1}C"; }
flax_move_left() { FLAX_BUFFER+=$'\033['"${1:-1}D"; }

# Home cursor
flax_home() {
    FLAX_BUFFER+=$'\033[H'
}

# =============================================================================
# COLORS (256-color mode)
# =============================================================================

# Set foreground color (256 palette)
flax_color() {
    FLAX_BUFFER+=$'\033[38;5;'"$1"'m'
}

# Set background color (256 palette)
flax_bg() {
    FLAX_BUFFER+=$'\033[48;5;'"$1"'m'
}

# Set foreground color (RGB true color)
flax_rgb() {
    FLAX_BUFFER+=$'\033[38;2;'"$1;$2;$3"'m'
}

# Set background color (RGB true color)
flax_bg_rgb() {
    FLAX_BUFFER+=$'\033[48;2;'"$1;$2;$3"'m'
}

# Reset colors/attributes
flax_reset() {
    FLAX_BUFFER+=$'\033[0m'
}

# =============================================================================
# TEXT ATTRIBUTES
# =============================================================================

flax_bold() { FLAX_BUFFER+=$'\033[1m'; }
flax_dim() { FLAX_BUFFER+=$'\033[2m'; }
flax_italic() { FLAX_BUFFER+=$'\033[3m'; }
flax_underline() { FLAX_BUFFER+=$'\033[4m'; }
flax_blink() { FLAX_BUFFER+=$'\033[5m'; }
flax_reverse() { FLAX_BUFFER+=$'\033[7m'; }

# =============================================================================
# SCREEN CONTROL
# =============================================================================

# Hide cursor
flax_cursor_hide() {
    FLAX_BUFFER+=$'\033[?25l'
}

# Show cursor
flax_cursor_show() {
    FLAX_BUFFER+=$'\033[?25h'
}

# Clear entire screen
flax_screen_clear() {
    FLAX_BUFFER+=$'\033[2J'
}

# Clear from cursor to end of line
flax_clear_line() {
    FLAX_BUFFER+=$'\033[K'
}

# Clear from cursor to end of screen
flax_clear_down() {
    FLAX_BUFFER+=$'\033[J'
}

# Enter alternate screen buffer
flax_alt_screen() {
    FLAX_BUFFER+=$'\033[?1049h'
}

# Exit alternate screen buffer
flax_main_screen() {
    FLAX_BUFFER+=$'\033[?1049l'
}

# =============================================================================
# OFFSET HELPERS
# =============================================================================

# Set centering offset
flax_set_offset() {
    FLAX_OFFSET_X="$1"
    FLAX_OFFSET_Y="$2"
}

# Calculate centering offset for given dimensions
flax_center() {
    local width="$1"
    local height="$2"
    local term_cols term_lines

    # Get terminal size
    read -r term_lines term_cols < <(stty size 2>/dev/null || echo "24 80")

    FLAX_OFFSET_X=$(( (term_cols - width) / 2 ))
    FLAX_OFFSET_Y=$(( (term_lines - height) / 2 ))

    # Clamp to positive values
    ((FLAX_OFFSET_X < 0)) && FLAX_OFFSET_X=0
    ((FLAX_OFFSET_Y < 0)) && FLAX_OFFSET_Y=0
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f flax_clear flax_add flax_newline flax_flush
export -f flax_goto flax_goto_raw flax_home
export -f flax_move_up flax_move_down flax_move_right flax_move_left
export -f flax_color flax_bg flax_rgb flax_bg_rgb flax_reset
export -f flax_bold flax_dim flax_italic flax_underline flax_blink flax_reverse
export -f flax_cursor_hide flax_cursor_show
export -f flax_screen_clear flax_clear_line flax_clear_down
export -f flax_alt_screen flax_main_screen
export -f flax_set_offset flax_center
