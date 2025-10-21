#!/usr/bin/env bash
# TCurses - Terminal Curses Library for Tetra
# Provides TUI primitives: screen management, input handling, animation

# Library metadata
TCURSES_VERSION="1.0.0"
TCURSES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source all tcurses subsystems
source "$TCURSES_DIR/tcurses_screen.sh"
source "$TCURSES_DIR/tcurses_input.sh"
source "$TCURSES_DIR/tcurses_buffer.sh"
source "$TCURSES_DIR/tcurses_animation.sh"
source "$TCURSES_DIR/tcurses_modal.sh"
source "$TCURSES_DIR/tcurses_repl.sh"
source "$TCURSES_DIR/tcurses_log_footer.sh"
source "$TCURSES_DIR/tcurses_actions.sh"

# Library initialization (optional)
tcurses_init() {
    # Set up terminal for TUI mode
    tcurses_screen_init
    tcurses_input_init
    return 0
}

# Library cleanup
tcurses_cleanup() {
    tcurses_screen_cleanup
    tcurses_input_cleanup
    return 0
}

# Setup cleanup trap (call from application)
tcurses_setup_cleanup_trap() {
    trap 'tcurses_cleanup; exit 0' INT TERM EXIT
}

# Simple loop helper (from demo pattern)
tcurses_simple_loop() {
    local render_fn="$1"
    local input_fn="$2"

    local first_render=true

    while true; do
        # Render frame
        "$render_fn" "$first_render" || break
        first_render=false

        # Handle input
        local key
        read -rsn1 key
        "$input_fn" "$key" || break
    done
}

# Export public API
export -f tcurses_init
export -f tcurses_cleanup
export -f tcurses_setup_cleanup_trap
export -f tcurses_simple_loop

# Version info
tcurses_version() {
    echo "tcurses v$TCURSES_VERSION"
}
export -f tcurses_version
