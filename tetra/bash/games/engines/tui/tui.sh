#!/usr/bin/env bash

# TUI Engine - tcurses-Based Terminal Game Engine
# For interactive, menu-driven, modal games
#
# Wraps the tcurses module for game use with double-buffering
# and differential rendering.
#
# Usage:
#   source "$GAMES_SRC/engines/tui/tui.sh"
#   tui_init
#   # ... game loop ...
#   tui_cleanup

# Version
TUI_VERSION="1.0.0"

# Locate engine source
if [[ -z "$TUI_SRC" ]]; then
    TUI_SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi
export TUI_SRC

# Require TETRA_SRC
if [[ -z "$TETRA_SRC" ]]; then
    echo "Error: TETRA_SRC must be set" >&2
    return 1
fi

# Source tcurses modules
source "$TETRA_SRC/bash/tcurses/tcurses_input.sh"
source "$TETRA_SRC/bash/tcurses/tcurses_screen.sh"
source "$TETRA_SRC/bash/tcurses/tcurses_buffer.sh"
source "$TETRA_SRC/bash/tcurses/tcurses_animation.sh" 2>/dev/null || true

# =============================================================================
# ENGINE STATE
# =============================================================================

declare -g TUI_RUNNING=0
declare -g TUI_PAUSED=0
declare -g TUI_KEY=""
declare -g TUI_WIDTH=80
declare -g TUI_HEIGHT=24

# =============================================================================
# INITIALIZATION
# =============================================================================

# Initialize TUI engine
tui_init() {
    local fps="${1:-30}"

    # Get terminal size
    read -r TUI_HEIGHT TUI_WIDTH < <(stty size 2>/dev/null || echo "24 80")

    # Initialize tcurses components
    tcurses_screen_init 2>/dev/null || true
    tcurses_buffer_init "$TUI_HEIGHT" "$TUI_WIDTH" 2>/dev/null || true

    # Set up animation timing if available
    if declare -f tcurses_animation_init >/dev/null 2>&1; then
        tcurses_animation_init "$fps"
    fi

    # Terminal setup
    stty -echo -icanon 2>/dev/null || true
    printf '\033[?25l'  # Hide cursor
    printf '\033[2J'    # Clear screen

    TUI_RUNNING=1
    TUI_PAUSED=0
}

# Cleanup TUI engine
tui_cleanup() {
    TUI_RUNNING=0

    # Restore terminal
    stty echo icanon 2>/dev/null || true
    tcurses_screen_cleanup 2>/dev/null || true

    printf '\033[?25h'  # Show cursor
    printf '\033[0m'    # Reset colors
    printf '\033[2J\033[H'  # Clear and home
}

# =============================================================================
# INPUT
# =============================================================================

# Read key with timeout
# Usage: tui_read_key [timeout]
tui_read_key() {
    local timeout="${1:-0.033}"
    TUI_KEY=""

    if tcurses_input_read_key "$timeout" 2>/dev/null; then
        TUI_KEY="$TCURSES_KEY"
        return 0
    fi

    return 1
}

# Check if key matches
tui_key_is() {
    [[ "$TUI_KEY" == "$1" ]]
}

# =============================================================================
# RENDERING
# =============================================================================

# Clear buffer
tui_clear() {
    tcurses_buffer_clear 2>/dev/null || true
}

# Write text at position
tui_write() {
    local row="$1" col="$2" text="$3"
    tcurses_buffer_write_at "$row" "$col" "$text" 2>/dev/null || {
        printf '\033[%d;%dH%s' "$row" "$col" "$text"
    }
}

# Write full line
tui_write_line() {
    local row="$1" text="$2"
    tcurses_buffer_write_line "$row" "$text" 2>/dev/null || {
        printf '\033[%d;1H%s' "$row" "$text"
    }
}

# Flush to screen (differential update)
tui_render() {
    tcurses_buffer_render_vsync 2>/dev/null || {
        # Fallback: just flush stdout
        true
    }
}

# Force full redraw
tui_render_full() {
    tcurses_buffer_render_full 2>/dev/null || true
}

# =============================================================================
# GAME LOOP
# =============================================================================

# Main game loop
# Usage: tui_loop update_fn render_fn [init_fn]
tui_loop() {
    local update_fn="$1"
    local render_fn="$2"
    local init_fn="${3:-}"

    # Run init function if provided
    [[ -n "$init_fn" ]] && $init_fn

    while ((TUI_RUNNING)); do
        # Clear buffer
        tui_clear

        # Render
        $render_fn

        # Differential update
        tui_render

        # Input with frame timeout
        tui_read_key

        # Handle built-in keys
        case "$TUI_KEY" in
            q|Q) TUI_RUNNING=0; continue ;;
            p|P) ((TUI_PAUSED = !TUI_PAUSED)) ;;
        esac

        # Update (skip if paused)
        if ((! TUI_PAUSED)); then
            $update_fn "$TUI_KEY"
        fi
    done
}

# Stop the loop
tui_stop() {
    TUI_RUNNING=0
}

# Pause control
tui_pause() { TUI_PAUSED=1; }
tui_unpause() { TUI_PAUSED=0; }
tui_toggle_pause() { ((TUI_PAUSED = !TUI_PAUSED)); }
tui_is_paused() { ((TUI_PAUSED)); }

# =============================================================================
# QUICK RUN
# =============================================================================

# Simple run helper
# Usage: tui_run render_fn update_fn [fps]
tui_run() {
    local render_fn="$1"
    local update_fn="$2"
    local fps="${3:-30}"

    tui_init "$fps"
    tui_loop "$update_fn" "$render_fn"
    tui_cleanup
}

# =============================================================================
# ENGINE INFO
# =============================================================================

tui_version() {
    echo "tui v$TUI_VERSION"
}

tui_info() {
    cat << EOF
TUI Engine v$TUI_VERSION
========================
tcurses-based terminal game engine with double-buffering.

Source: $TUI_SRC

Core Functions:
  Init:    tui_init, tui_cleanup
  Render:  tui_clear, tui_write, tui_render
  Input:   tui_read_key, tui_key_is
  Loop:    tui_loop, tui_run

Screen: ${TUI_WIDTH}x${TUI_HEIGHT}
EOF
}

# =============================================================================
# EXPORTS
# =============================================================================

export TUI_VERSION
export -f tui_init tui_cleanup
export -f tui_read_key tui_key_is
export -f tui_clear tui_write tui_write_line tui_render tui_render_full
export -f tui_loop tui_stop tui_pause tui_unpause tui_toggle_pause tui_is_paused
export -f tui_run tui_version tui_info

echo "TUI engine loaded (v$TUI_VERSION)" >&2
