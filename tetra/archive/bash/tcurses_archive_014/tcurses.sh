#!/usr/bin/env bash

# TCurses - Tetra Curses
# A mini ncurses-like library for Bash TUI applications
#
# Features:
# - Raw terminal input handling
# - Screen management (alternate buffer, cursor control)
# - Double-buffered rendering with differential updates
# - BPM-synchronized animation loop
# - Multiplexed input (keyboard + optional pipe)
#
# Usage:
#   source tcurses.sh
#   tcurses_init
#   # ... your TUI code ...
#   tcurses_cleanup

# Module directory
TCURSES_DIR="$(dirname "${BASH_SOURCE[0]}")"

# Source all TCurses modules
source "$TCURSES_DIR/tcurses_screen.sh"
source "$TCURSES_DIR/tcurses_input.sh"
source "$TCURSES_DIR/tcurses_animation.sh"
source "$TCURSES_DIR/tcurses_buffer.sh"

# TCurses version
TCURSES_VERSION="1.0.0"

# TCurses capabilities
declare -g TCURSES_HAS_RLWRAP=false

# Check for rlwrap availability
# Usage: tcurses_check_rlwrap
# Returns: 0 if available, 1 if not
tcurses_check_rlwrap() {
    if command -v rlwrap >/dev/null 2>&1; then
        TCURSES_HAS_RLWRAP=true
        return 0
    fi
    TCURSES_HAS_RLWRAP=false
    return 1
}

# Warn about missing rlwrap with install instructions
# Usage: tcurses_warn_rlwrap
tcurses_warn_rlwrap() {
    cat >&2 <<'EOF'
Warning: rlwrap not found (enhanced line editing disabled)

rlwrap provides readline features like:
  - Command history (up/down arrows)
  - Line editing (Ctrl-A/E, Ctrl-K/Y, etc.)
  - History search (Ctrl-R)

Install instructions:
  macOS:  brew install rlwrap
  Ubuntu: sudo apt install rlwrap
  Fedora: sudo dnf install rlwrap
  Arch:   sudo pacman -S rlwrap

After installing, restart your application.
EOF
}

# Check Bash version (required: 5.2+)
# Usage: tcurses_check_bash_version
# Returns: 0 if OK, 1 if too old
tcurses_check_bash_version() {
    local major="${BASH_VERSINFO[0]}"
    local minor="${BASH_VERSINFO[1]}"

    if [[ "$major" -lt 5 ]] || { [[ "$major" -eq 5 ]] && [[ "$minor" -lt 2 ]]; }; then
        echo "Error: TCurses requires Bash 5.2+ (found $BASH_VERSION)" >&2
        echo "  macOS: brew install bash" >&2
        return 1
    fi
    return 0
}

# Initialize TCurses (all subsystems)
# Usage: tcurses_init [FPS] [BPM]
tcurses_init() {
    local fps="${1:-30}"
    local bpm="${2:-120}"

    # Check Bash version
    if ! tcurses_check_bash_version; then
        return 1
    fi

    # Check for rlwrap (optional)
    if ! tcurses_check_rlwrap; then
        tcurses_warn_rlwrap
    fi

    # Initialize screen first
    if ! tcurses_screen_init; then
        echo "tcurses: failed to initialize screen" >&2
        return 1
    fi

    # Initialize buffer system
    tcurses_buffer_init "$(tcurses_screen_height)" "$(tcurses_screen_width)"

    # Initialize animation
    tcurses_animation_init "$fps" "$bpm"

    return 0
}

# Cleanup TCurses (restore terminal)
# Usage: tcurses_cleanup
tcurses_cleanup() {
    tcurses_animation_disable
    tcurses_screen_cleanup
}

# Main event loop with animation
# Usage: tcurses_main_loop RENDER_CALLBACK INPUT_CALLBACK [TICK_CALLBACK]
#
# RENDER_CALLBACK: Called to render frame (gets first_render flag)
# INPUT_CALLBACK: Called when key pressed (gets key)
# TICK_CALLBACK: Optional, called on each animation tick
#
# Example:
#   render() { echo "Rendering..."; }
#   handle_input() { [[ "$1" == "q" ]] && return 1; }
#   tcurses_main_loop render handle_input
tcurses_main_loop() {
    local render_callback="$1"
    local input_callback="$2"
    local tick_callback="${3:-}"

    local is_first_render=true
    local needs_redraw=true

    # Main loop
    while true; do
        # Render if needed
        if [[ "$needs_redraw" == "true" ]]; then
            "$render_callback" "$is_first_render"
            needs_redraw=false
            is_first_render=false
        fi

        # Animation tick
        if tcurses_animation_should_tick; then
            # Call tick callback if provided
            if [[ -n "$tick_callback" ]]; then
                "$tick_callback"
            fi

            # Record frame for FPS tracking
            tcurses_animation_record_frame

            # Check performance
            tcurses_animation_check_performance || true
        fi

        # Read input with frame-paced timeout
        local timeout=$(tcurses_animation_get_frame_time)
        if ! tcurses_animation_should_tick; then
            timeout=0  # Blocking read when animation off
        fi

        local key=""
        key=$(tcurses_input_read_key "$timeout") || key=""

        # Handle input if key pressed
        if [[ -n "$key" ]]; then
            # Call input handler - if it returns non-zero, exit loop
            if ! "$input_callback" "$key"; then
                break
            fi
            needs_redraw=true
        fi
    done
}

# Simplified main loop (no animation)
# Usage: tcurses_simple_loop RENDER_CALLBACK INPUT_CALLBACK
tcurses_simple_loop() {
    local render_callback="$1"
    local input_callback="$2"

    # Render initial screen
    "$render_callback" true

    # Input loop
    while true; do
        local key=""
        key=$(tcurses_input_read_key_blocking) || continue

        # Only handle if we got a key
        if [[ -z "$key" ]]; then
            continue
        fi

        # Call input handler - if returns non-zero, exit
        if ! "$input_callback" "$key"; then
            break
        fi

        # Re-render
        "$render_callback" false
    done
}

# Get TCurses version
# Usage: tcurses_version
tcurses_version() {
    echo "TCurses v$TCURSES_VERSION"
}

# Get TCurses info
# Usage: tcurses_info
tcurses_info() {
    cat <<EOF
TCurses v$TCURSES_VERSION - Tetra Curses Library

Modules:
  - tcurses_screen: Terminal setup, screen buffer, cursor control
  - tcurses_input: Keyboard input, escape sequences, multiplexing
  - tcurses_animation: BPM-sync animation loop, FPS tracking
  - tcurses_buffer: Double-buffered rendering, differential updates

Screen: $(tcurses_screen_size)
Animation: $(tcurses_animation_get_status) @ $(tcurses_animation_get_fps) FPS
BPM: $(tcurses_animation_get_bpm) (beat every $(tcurses_animation_get_beat_interval)s)
EOF
}

# Helper: Set up cleanup trap
# Usage: tcurses_setup_cleanup_trap
tcurses_setup_cleanup_trap() {
    trap 'tcurses_cleanup; exit' EXIT INT TERM
}

# Export main functions
export -f tcurses_init
export -f tcurses_cleanup
export -f tcurses_main_loop
export -f tcurses_simple_loop
export -f tcurses_version
export -f tcurses_info
export -f tcurses_setup_cleanup_trap
export -f tcurses_check_rlwrap
export -f tcurses_check_bash_version
export -f tcurses_warn_rlwrap
