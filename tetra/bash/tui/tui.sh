#!/usr/bin/env bash

# Tetra TUI Library v1.0.0
# Unified Terminal User Interface system
#
# Consolidated from:
# - bash/tcurses (production v1.0.0)
# - demo/basic/014 (most modern implementation)
# - bash/repl (universal REPL system)
#
# Usage:
#   source "$TETRA_SRC/bash/tui/tui.sh"
#   tui_init
#   # Use tui_* functions
#   tui_cleanup  # Call on exit

# Version
declare -g TUI_VERSION="1.0.0"

# Module state
declare -g _TUI_INITIALIZED=false

# Source core modules (required)
source "$TETRA_SRC/bash/tui/core/screen.sh"
source "$TETRA_SRC/bash/tui/core/input.sh"
source "$TETRA_SRC/bash/tui/core/buffer.sh"
source "$TETRA_SRC/bash/tui/core/animation.sh"

# Source components (optional - only if used)
# Applications should source these explicitly if needed:
# - source "$TETRA_SRC/bash/tui/components/modal.sh"
# - source "$TETRA_SRC/bash/tui/components/header.sh"
# - source "$TETRA_SRC/bash/tui/components/footer.sh"

# Source integration modules (optional)
# - source "$TETRA_SRC/bash/tui/integration/repl.sh"
# - source "$TETRA_SRC/bash/tui/integration/actions.sh"

# Initialize TUI system
# Usage: tui_init [FPS] [BPM]
# Returns: 0 on success, 1 on failure
tui_init() {
    local fps="${1:-30}"
    local bpm="${2:-120}"

    if [[ "$_TUI_INITIALIZED" == "true" ]]; then
        echo "tui: already initialized" >&2
        return 1
    fi

    # Initialize screen
    if ! tcurses_screen_init; then
        echo "tui: failed to initialize screen" >&2
        return 1
    fi

    # Initialize buffer system
    local height=$(tcurses_screen_height)
    local width=$(tcurses_screen_width)
    tcurses_buffer_init "$height" "$width"

    # Initialize animation system
    tcurses_animation_init "$fps" "$bpm"

    # Initialize input
    tcurses_input_init

    _TUI_INITIALIZED=true
    return 0
}

# Cleanup TUI system
# Usage: tui_cleanup
tui_cleanup() {
    if [[ "$_TUI_INITIALIZED" != "true" ]]; then
        return 0
    fi

    # Cleanup input
    tcurses_input_cleanup

    # Stop animation if running
    tcurses_animation_disable 2>/dev/null || true

    # Cleanup screen (restore terminal)
    tcurses_screen_cleanup

    _TUI_INITIALIZED=false
}

# Check if TUI is initialized
# Usage: tui_is_initialized
tui_is_initialized() {
    [[ "$_TUI_INITIALIZED" == "true" ]]
}

# Get TUI version
# Usage: tui_version
tui_version() {
    echo "$TUI_VERSION"
}

# Convenience wrappers for common operations
# These provide a simplified API that wraps the tcurses_* functions

# Screen operations
alias tui_screen_size='tcurses_screen_size'
alias tui_screen_height='tcurses_screen_height'
alias tui_screen_width='tcurses_screen_width'
alias tui_screen_clear='tcurses_screen_clear'
alias tui_screen_move_cursor='tcurses_screen_move_cursor'

# Input operations
alias tui_read_key='tcurses_input_read_key'
alias tui_read_key_blocking='tcurses_input_read_key_blocking'
alias tui_read_line='tcurses_input_read_line'

# Buffer operations
alias tui_buffer_clear='tcurses_buffer_clear'
alias tui_buffer_write_line='tcurses_buffer_write_line'
alias tui_buffer_write_at='tcurses_buffer_write_at'
alias tui_buffer_render_full='tcurses_buffer_render_full'
alias tui_buffer_render_diff='tcurses_buffer_render_diff'
alias tui_buffer_render_vsync='tcurses_buffer_render_vsync'

# Animation operations
alias tui_animation_enable='tcurses_animation_enable'
alias tui_animation_disable='tcurses_animation_disable'
alias tui_animation_toggle='tcurses_animation_toggle'
alias tui_animation_pause='tcurses_animation_pause'
alias tui_animation_resume='tcurses_animation_resume'
alias tui_animation_should_tick='tcurses_animation_should_tick'
alias tui_animation_record_frame='tcurses_animation_record_frame'
alias tui_animation_get_avg_fps='tcurses_animation_get_avg_fps'
alias tui_animation_get_stats='tcurses_animation_get_stats'
alias tui_animation_set_fps='tcurses_animation_set_fps'
alias tui_animation_set_bpm='tcurses_animation_set_bpm'
alias tui_animation_get_beat_phase='tcurses_animation_get_beat_phase'

# Export key constants from input module
export TCURSES_KEY_UP TCURSES_KEY_DOWN TCURSES_KEY_RIGHT TCURSES_KEY_LEFT
export TCURSES_KEY_ESC TCURSES_KEY_ENTER TCURSES_KEY_CTRL_C TCURSES_KEY_CTRL_D
export TCURSES_KEY_CTRL_Z TCURSES_KEY_BACKSPACE TCURSES_KEY_TAB

# Export main functions
export -f tui_init
export -f tui_cleanup
export -f tui_is_initialized
export -f tui_version

# Library loaded successfully
# echo "TUI v$TUI_VERSION loaded" >&2
