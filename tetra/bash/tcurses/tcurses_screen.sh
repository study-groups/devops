#!/usr/bin/env bash

# TCurses Screen Management Module
# Handles terminal setup, teardown, screen buffer, and cursor control

# Include guard
[[ -n "${_TCURSES_SCREEN_LOADED:-}" ]] && return
declare -g _TCURSES_SCREEN_LOADED=1

# Terminal state
_TCURSES_OLD_TTY_STATE=""
_TCURSES_INITIALIZED=false
_TCURSES_IN_ALTBUF=false

# Screen dimensions (cached)
_TCURSES_HEIGHT=24
_TCURSES_WIDTH=80

# Initialize terminal for TUI mode
# Usage: tcurses_screen_init
# Returns: 0 on success, 1 on failure
tcurses_screen_init() {
    if [[ "$_TCURSES_INITIALIZED" == "true" ]]; then
        echo "tcurses_screen: already initialized" >&2
        return 1
    fi

    # Save original terminal state
    _TCURSES_OLD_TTY_STATE=$(stty -g 2>/dev/null)
    if [[ -z "$_TCURSES_OLD_TTY_STATE" ]]; then
        echo "tcurses_screen: failed to save terminal state" >&2
        return 1
    fi

    # Get terminal dimensions
    if [[ -e /dev/tty ]]; then
        read _TCURSES_HEIGHT _TCURSES_WIDTH < <(stty size </dev/tty 2>/dev/null)
    fi
    [[ -z "$_TCURSES_HEIGHT" ]] && _TCURSES_HEIGHT=$(tput lines 2>/dev/null || echo 24)
    [[ -z "$_TCURSES_WIDTH" ]] && _TCURSES_WIDTH=$(tput cols 2>/dev/null || echo 80)

    # Enter alternate screen buffer
    tput smcup 2>/dev/null || true
    _TCURSES_IN_ALTBUF=true

    # Hide cursor
    tput civis 2>/dev/null || true

    # Configure terminal for raw input
    # -echo: don't echo input
    # -icanon: disable line buffering (char-by-char)
    # -isig: disable signal generation (Ctrl-C becomes \x03)
    # min 1: wait for at least 1 character (blocking read)
    # time 0: no inter-character timer
    stty -echo -icanon -isig min 1 time 0 </dev/tty 2>/dev/null

    # Clear screen
    clear

    _TCURSES_INITIALIZED=true
    return 0
}

# Restore terminal to original state
# Usage: tcurses_screen_cleanup
tcurses_screen_cleanup() {
    if [[ "$_TCURSES_INITIALIZED" != "true" ]]; then
        return 0
    fi

    # Show cursor
    tput cnorm 2>/dev/null || true

    # Exit alternate screen buffer
    if [[ "$_TCURSES_IN_ALTBUF" == "true" ]]; then
        tput rmcup 2>/dev/null || true
        _TCURSES_IN_ALTBUF=false
    fi

    # Restore terminal state
    if [[ -n "$_TCURSES_OLD_TTY_STATE" ]]; then
        stty "$_TCURSES_OLD_TTY_STATE" </dev/tty 2>/dev/null || stty sane 2>/dev/null
    fi

    _TCURSES_INITIALIZED=false
}

# Get terminal dimensions
# Usage: tcurses_screen_size
# Output: "HEIGHT WIDTH" (space-separated)
tcurses_screen_size() {
    echo "$_TCURSES_HEIGHT $_TCURSES_WIDTH"
}

# Get terminal height
# Usage: tcurses_screen_height
tcurses_screen_height() {
    echo "$_TCURSES_HEIGHT"
}

# Get terminal width
# Usage: tcurses_screen_width
tcurses_screen_width() {
    echo "$_TCURSES_WIDTH"
}

# Update cached terminal dimensions
# Usage: tcurses_screen_update_size
tcurses_screen_update_size() {
    if [[ -e /dev/tty ]]; then
        read _TCURSES_HEIGHT _TCURSES_WIDTH < <(stty size </dev/tty 2>/dev/null)
    fi
    [[ -z "$_TCURSES_HEIGHT" ]] && _TCURSES_HEIGHT=$(tput lines 2>/dev/null || echo 24)
    [[ -z "$_TCURSES_WIDTH" ]] && _TCURSES_WIDTH=$(tput cols 2>/dev/null || echo 80)
}

# Clear entire screen
# Usage: tcurses_screen_clear
tcurses_screen_clear() {
    clear
}

# Move cursor to position (1-based)
# Usage: tcurses_screen_move_cursor ROW COL
tcurses_screen_move_cursor() {
    local row="${1:-1}"
    local col="${2:-1}"
    tput cup "$((row - 1))" "$((col - 1))" 2>/dev/null || printf '\033[%d;%dH' "$row" "$col"
}

# Hide cursor
# Usage: tcurses_screen_hide_cursor
tcurses_screen_hide_cursor() {
    tput civis 2>/dev/null || printf '\033[?25l'
}

# Show cursor
# Usage: tcurses_screen_show_cursor
tcurses_screen_show_cursor() {
    tput cnorm 2>/dev/null || printf '\033[?25h'
}

# Save cursor position
# Usage: tcurses_screen_save_cursor
tcurses_screen_save_cursor() {
    tput sc 2>/dev/null || printf '\033[s'
}

# Restore cursor position
# Usage: tcurses_screen_restore_cursor
tcurses_screen_restore_cursor() {
    tput rc 2>/dev/null || printf '\033[u'
}

# Check if terminal is initialized
# Usage: tcurses_screen_is_initialized
tcurses_screen_is_initialized() {
    [[ "$_TCURSES_INITIALIZED" == "true" ]]
}

# ============================================================================
# SCROLL REGION SUPPORT
# Enables protected status areas at top/bottom of screen
# ============================================================================

# Scroll region state
_TCURSES_SCROLL_TOP=0
_TCURSES_SCROLL_BOTTOM=0
_TCURSES_SCROLL_ACTIVE=false

# Set scroll region (0-based row numbers)
# Usage: tcurses_screen_set_scroll_region TOP BOTTOM
# Example: tcurses_screen_set_scroll_region 0 20  (rows 0-20 scroll, rest protected)
tcurses_screen_set_scroll_region() {
    local top="${1:-0}"
    local bottom="${2:-$((_TCURSES_HEIGHT - 1))}"

    _TCURSES_SCROLL_TOP="$top"
    _TCURSES_SCROLL_BOTTOM="$bottom"
    _TCURSES_SCROLL_ACTIVE=true

    # tput csr uses 0-based indexing
    tput csr "$top" "$bottom" 2>/dev/null || printf '\033[%d;%dr' "$((top + 1))" "$((bottom + 1))"
}

# Reset scroll region to full screen
# Usage: tcurses_screen_reset_scroll_region
tcurses_screen_reset_scroll_region() {
    _TCURSES_SCROLL_TOP=0
    _TCURSES_SCROLL_BOTTOM=$((_TCURSES_HEIGHT - 1))
    _TCURSES_SCROLL_ACTIVE=false

    tput csr 0 $((_TCURSES_HEIGHT - 1)) 2>/dev/null || printf '\033[r'
}

# Get scroll region boundaries
# Usage: tcurses_screen_get_scroll_region
# Output: "TOP BOTTOM" (space-separated, 0-based)
tcurses_screen_get_scroll_region() {
    echo "$_TCURSES_SCROLL_TOP $_TCURSES_SCROLL_BOTTOM"
}

# Check if scroll region is active
# Usage: tcurses_screen_has_scroll_region
tcurses_screen_has_scroll_region() {
    [[ "$_TCURSES_SCROLL_ACTIVE" == "true" ]]
}

# Reserve bottom N lines as protected status area
# Usage: tcurses_screen_reserve_bottom LINES
# Example: tcurses_screen_reserve_bottom 5  (protect last 5 lines)
tcurses_screen_reserve_bottom() {
    local lines="${1:-1}"
    local bottom=$((_TCURSES_HEIGHT - lines - 1))
    tcurses_screen_set_scroll_region 0 "$bottom"
}

# Reserve top N lines as protected header area
# Usage: tcurses_screen_reserve_top LINES
tcurses_screen_reserve_top() {
    local lines="${1:-1}"
    tcurses_screen_set_scroll_region "$lines" $((_TCURSES_HEIGHT - 1))
}

# Write to protected area (outside scroll region) without moving cursor
# Usage: tcurses_screen_write_status ROW TEXT
# Note: ROW is absolute (0-based), works even if in scroll region
tcurses_screen_write_status() {
    local row="$1"
    local text="$2"

    # Save cursor position
    tcurses_screen_save_cursor

    # Move to status row and write
    tput cup "$row" 0 2>/dev/null || printf '\033[%d;1H' "$((row + 1))"
    printf '%s' "$text"

    # Clear to end of line
    tput el 2>/dev/null || printf '\033[K'

    # Restore cursor position
    tcurses_screen_restore_cursor
}

# Clear a protected status line
# Usage: tcurses_screen_clear_status ROW
tcurses_screen_clear_status() {
    local row="$1"
    tcurses_screen_save_cursor
    tput cup "$row" 0 2>/dev/null || printf '\033[%d;1H' "$((row + 1))"
    tput el 2>/dev/null || printf '\033[K'
    tcurses_screen_restore_cursor
}

# Get terminal state for debugging
# Usage: tcurses_screen_debug_state
tcurses_screen_debug_state() {
    cat <<EOF
TCurses Screen State:
  Initialized: $_TCURSES_INITIALIZED
  In AltBuf: $_TCURSES_IN_ALTBUF
  Dimensions: ${_TCURSES_HEIGHT}x${_TCURSES_WIDTH}
  Saved State: ${_TCURSES_OLD_TTY_STATE:0:30}...
  Current TTY Settings:
$(stty -a </dev/tty 2>/dev/null | head -5)
EOF
}
