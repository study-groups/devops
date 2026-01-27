#!/usr/bin/env bash

# Flax Engine - Game Loop
# Simple, fast game loop with input timeout for frame rate control

# =============================================================================
# LOOP STATE
# =============================================================================

declare -g FLAX_RUNNING=0
declare -g FLAX_PAUSED=0
declare -g FLAX_TICK=0.033       # ~30 FPS default
declare -g FLAX_KEY=""
declare -g FLAX_FRAME=0

# Config: set to 0 to handle all keys in update_fn
declare -gi FLAX_BUILTIN_KEYS=1

# Protocol mode: "key" for single chars (terminal), "line" for commands (hosted)
declare -g FLAX_PROTOCOL_MODE="${FLAX_PROTOCOL_MODE:-key}"

# Debug/metrics
declare -gi FLAX_DEBUG=0
declare -g FLAX_FRAME_START=0
declare -g FLAX_FRAME_TIME=0
declare -g FLAX_FPS_ACTUAL=0

# =============================================================================
# TIMING
# =============================================================================

# Set target FPS
flax_set_fps() {
    local fps="$1"
    if ((fps > 0)); then
        FLAX_TICK=$(awk "BEGIN {printf \"%.3f\", 1.0 / $fps}")
    fi
}

# Get current frame number
flax_get_frame() {
    echo "$FLAX_FRAME"
}

# =============================================================================
# INPUT
# =============================================================================

# Read input with timeout
# In "key" mode: reads single character (for terminal use)
# In "line" mode: reads full line (for hosted/WebSocket use)
# Sets FLAX_KEY, returns 0 if input read, 1 if timeout
flax_read_key() {
    local timeout="${1:-$FLAX_TICK}"
    FLAX_KEY=""

    if [[ "$FLAX_PROTOCOL_MODE" == "line" ]]; then
        # Line mode: read full line (for commands like I:0:w)
        if read -r -t "$timeout" FLAX_KEY 2>/dev/null; then
            [[ -n "$FLAX_KEY" ]] && return 0
        fi
    else
        # Key mode: read single character (for direct terminal)
        if read -rsn1 -t "$timeout" FLAX_KEY 2>/dev/null; then
            [[ -n "$FLAX_KEY" ]] && return 0
        fi
    fi

    return 1
}

# Check if specific key was pressed
flax_key_is() {
    [[ "$FLAX_KEY" == "$1" ]]
}

# =============================================================================
# GAME LOOP
# =============================================================================

# Initialize loop (call before flax_loop)
flax_loop_init() {
    FLAX_RUNNING=1
    FLAX_PAUSED=0
    FLAX_FRAME=0
    FLAX_KEY=""

    # Terminal setup
    stty -echo -icanon 2>/dev/null || true

    # Clear and hide cursor
    flax_clear
    flax_screen_clear
    flax_cursor_hide
    flax_flush
}

# Cleanup loop (call after flax_loop)
flax_loop_cleanup() {
    FLAX_RUNNING=0

    # Restore terminal
    stty echo icanon 2>/dev/null || true

    # Show cursor, reset colors, clear
    flax_clear
    flax_cursor_show
    flax_reset
    flax_flush
    printf '\033[2J\033[H'
}

# Get time in milliseconds (bash 5.0+)
flax_time_ms() {
    printf '%(%s)T' -1
    printf '%03d' $((RANDOM % 1000))  # Approximate ms
}

# Main game loop
# Usage: flax_loop update_fn render_fn [init_fn]
flax_loop() {
    local update_fn="$1"
    local render_fn="$2"
    local init_fn="${3:-}"

    # Run init function if provided
    [[ -n "$init_fn" ]] && $init_fn

    flax_loop_init

    local frame_start frame_end
    local fps_counter=0
    local fps_time=${EPOCHSECONDS:-$(printf '%(%s)T' -1)}

    while ((FLAX_RUNNING)); do
        frame_start=${EPOCHREALTIME:-$(date +%s.%N)}

        # Start fresh frame
        flax_clear
        flax_cursor_hide

        # Render
        $render_fn

        # Debug overlay
        ((FLAX_DEBUG)) && flax_render_debug

        # Flush to screen (single atomic output)
        flax_flush

        # Input with frame-time timeout (natural rate limiting)
        if flax_read_key "$FLAX_TICK"; then
            # Handle built-in keys (if enabled)
            if ((FLAX_BUILTIN_KEYS)); then
                case "$FLAX_KEY" in
                    Q) FLAX_RUNNING=0; continue ;;  # Only Shift-Q quits
                    P) ((FLAX_PAUSED = !FLAX_PAUSED)) ;;
                    D) ((FLAX_DEBUG = !FLAX_DEBUG)) ;;  # Toggle debug
                esac
            fi
        fi

        # Update game state (skip if paused)
        if ((! FLAX_PAUSED)); then
            $update_fn "$FLAX_KEY"
            ((FLAX_FRAME++))
            ((fps_counter++))
        fi

        # Calculate frame time and FPS
        frame_end=${EPOCHREALTIME:-$(date +%s.%N)}
        FLAX_FRAME_TIME=$(awk "BEGIN {printf \"%.1f\", ($frame_end - $frame_start) * 1000}")

        # Update FPS every second
        local now=${EPOCHSECONDS:-$(printf '%(%s)T' -1)}
        if ((now > fps_time)); then
            FLAX_FPS_ACTUAL=$fps_counter
            fps_counter=0
            fps_time=$now
        fi
    done

    flax_loop_cleanup
}

# Render debug overlay
flax_render_debug() {
    local cols lines
    read -r lines cols < <(stty size 2>/dev/null || echo "24 80")

    flax_goto 1 1
    flax_color 226
    flax_add "FPS:$FLAX_FPS_ACTUAL Frame:$FLAX_FRAME Time:${FLAX_FRAME_TIME}ms Buf:${#FLAX_BUFFER}"
    flax_reset
}

# Stop the loop
flax_stop() {
    FLAX_RUNNING=0
}

# Pause/unpause
flax_pause() {
    FLAX_PAUSED=1
}

flax_unpause() {
    FLAX_PAUSED=0
}

flax_toggle_pause() {
    ((FLAX_PAUSED = !FLAX_PAUSED))
}

flax_is_paused() {
    ((FLAX_PAUSED))
}

# =============================================================================
# SIMPLE RUN HELPER
# =============================================================================

# Quick run: just provide render and update functions
# Usage: flax_run render_fn update_fn [fps]
flax_run() {
    local render_fn="$1"
    local update_fn="$2"
    local fps="${3:-30}"

    flax_set_fps "$fps"
    flax_loop "$update_fn" "$render_fn"
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f flax_set_fps flax_get_frame flax_time_ms
export -f flax_read_key flax_key_is
export -f flax_loop_init flax_loop_cleanup flax_loop flax_render_debug
export -f flax_stop flax_pause flax_unpause flax_toggle_pause flax_is_paused
export -f flax_run
