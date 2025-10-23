#!/usr/bin/env bash

# Game Loop System
# Main game loop with input, update, render cycle

# Game loop state
GAME_LOOP_RUNNING=0
GAME_LOOP_TARGET_FPS=30
GAME_LOOP_SHOW_DEBUG=0
GAME_LOOP_PAUSED=0

# Input state
GAME_INPUT_KEY=""
GAME_INPUT_QUIT=0

# Statistics
GAME_LOOP_TOTAL_FRAMES=0
GAME_LOOP_START_TIME=0
GAME_LOOP_PAUSE_START=0
GAME_LOOP_TOTAL_PAUSE_TIME=0

# Read input without blocking (uses tcurses)
game_loop_read_input() {
    GAME_INPUT_KEY=""

    # Calculate frame time for timeout (this IS the frame limiter!)
    local frame_time=$(awk "BEGIN {printf \"%.4f\", 1.0 / $GAME_LOOP_TARGET_FPS}")
    local before=$(game_time_ms)

    # Use tcurses_input_read_key with frame-time timeout
    if declare -f tcurses_input_read_key >/dev/null 2>&1; then
        local key=$(tcurses_input_read_key "$frame_time" 2>/dev/null)
        local status=$?

        if [[ $status -eq 0 ]]; then
            GAME_INPUT_KEY="$key"

            # Check for quit
            if [[ "$key" == "q" || "$key" == "Q" || "$key" == "$TCURSES_KEY_ESC" ]]; then
                GAME_INPUT_QUIT=1
            fi

            # Check for pause
            if [[ "$key" == "p" || "$key" == "P" ]]; then
                game_loop_toggle_pause
            fi

            # Check for FPS adjustment (arrow keys or +/-)
            if [[ "$key" == "$TCURSES_KEY_UP" || "$key" == "+" || "$key" == "=" ]]; then
                game_loop_increase_fps
            elif [[ "$key" == "$TCURSES_KEY_DOWN" || "$key" == "-" || "$key" == "_" ]]; then
                game_loop_decrease_fps
            fi
        fi
    else
        # Fallback: use read with frame-time timeout
        local key=""
        if IFS= read -rsn1 -t "$frame_time" key 2>/dev/null; then
            GAME_INPUT_KEY="$key"
            [[ "$key" == "q" || "$key" == "Q" || "$key" == $'\x1b' ]] && GAME_INPUT_QUIT=1
            [[ "$key" == "p" || "$key" == "P" ]] && game_loop_toggle_pause
            [[ "$key" == "+" || "$key" == "=" ]] && game_loop_increase_fps
            [[ "$key" == "-" || "$key" == "_" ]] && game_loop_decrease_fps
        fi
    fi

    # Ensure we actually waited for the frame time (fallback if read failed/returned fast)
    local after=$(game_time_ms)
    local elapsed=$((after - before))
    local target_ms=$((1000 / GAME_LOOP_TARGET_FPS))
    local remaining=$((target_ms - elapsed))

    if [[ $remaining -gt 5 ]]; then
        # Read didn't block long enough, sleep the remainder
        local sleep_time=$(awk "BEGIN {printf \"%.4f\", $remaining / 1000.0}")

        # Use perl for more accurate sleep if available
        if command -v perl >/dev/null 2>&1; then
            perl -e "select(undef, undef, undef, $sleep_time)"
        else
            sleep "$sleep_time" 2>/dev/null || sleep 0.001
        fi
    fi
}

# Increase FPS
game_loop_increase_fps() {
    if [[ $GAME_LOOP_TARGET_FPS -lt 60 ]]; then
        GAME_LOOP_TARGET_FPS=$((GAME_LOOP_TARGET_FPS + 5))
        game_jitter_clear  # Clear samples when FPS changes
    fi
}

# Decrease FPS
game_loop_decrease_fps() {
    if [[ $GAME_LOOP_TARGET_FPS -gt 10 ]]; then
        GAME_LOOP_TARGET_FPS=$((GAME_LOOP_TARGET_FPS - 5))
        game_jitter_clear  # Clear samples when FPS changes
    fi
}

# Toggle pause state
game_loop_toggle_pause() {
    if [[ $GAME_LOOP_PAUSED -eq 0 ]]; then
        GAME_LOOP_PAUSED=1
        GAME_LOOP_PAUSE_START=$(game_time_ms)
    else
        GAME_LOOP_PAUSED=0
        local pause_duration=$(($(game_time_ms) - GAME_LOOP_PAUSE_START))
        GAME_LOOP_TOTAL_PAUSE_TIME=$((GAME_LOOP_TOTAL_PAUSE_TIME + pause_duration))
    fi
}

# Initialize game loop
# Args: target_fps (optional)
game_loop_init() {
    local fps="${1:-30}"
    GAME_LOOP_TARGET_FPS="$fps"
    GAME_LOOP_RUNNING=1
    GAME_INPUT_QUIT=0
    GAME_LOOP_PAUSED=0
    GAME_LOOP_TOTAL_FRAMES=0
    GAME_LOOP_START_TIME=$(game_time_ms)
    GAME_LOOP_TOTAL_PAUSE_TIME=0

    # Initialize screen
    game_screen_init
    game_screen_hide_cursor

    # Setup terminal for non-blocking input
    stty -echo -icanon time 0 min 0 2>/dev/null
}

# Main game loop
# Calls user-provided init, update, and render callbacks
# Args: init_fn, update_fn, render_fn
game_loop_run() {
    local init_fn="${1:-}"
    local update_fn="${2:-}"
    local render_fn="${3:-}"

    # Initialize
    if [[ -n "$init_fn" ]] && declare -f "$init_fn" >/dev/null 2>&1; then
        "$init_fn"
    fi

    # Loop variables
    local last_time=$(game_time_ms)
    local frame_count=0
    local fps_display=0

    # Main loop
    while [[ $GAME_LOOP_RUNNING -eq 1 && $GAME_INPUT_QUIT -eq 0 ]]; do
        # Input (this blocks for frame_time, providing natural rate limiting)
        game_loop_read_input

        # Calculate delta time AFTER the frame delay
        local current_time=$(game_time_ms)
        local delta=$((current_time - last_time))
        last_time=$current_time

        # Record jitter
        game_record_jitter "$GAME_LOOP_TARGET_FPS" "$delta"

        # Skip update if paused
        if [[ $GAME_LOOP_PAUSED -eq 0 ]]; then
            # Update
            if [[ -n "$update_fn" ]] && declare -f "$update_fn" >/dev/null 2>&1; then
                "$update_fn" "$delta"
            fi
            GAME_LOOP_TOTAL_FRAMES=$((GAME_LOOP_TOTAL_FRAMES + 1))
        fi

        # Clear screen buffer
        game_screen_clear

        # Render
        if [[ -n "$render_fn" ]] && declare -f "$render_fn" >/dev/null 2>&1; then
            "$render_fn"
        fi

        # Debug info
        if [[ $GAME_LOOP_SHOW_DEBUG -eq 1 ]]; then
            frame_count=$((frame_count + 1))
            if [[ $delta -gt 0 ]]; then
                fps_display=$(game_fps_from_delta "$delta")
            fi
            local actual_fps=$(game_jitter_actual_fps)
            local jitter_avg=$(game_jitter_avg)
            local jitter_std=$(game_jitter_std)

            game_draw_text 2 1 "Target: ${GAME_LOOP_TARGET_FPS} FPS | Actual: ${actual_fps} FPS | Jitter avg: ${jitter_avg}ms std: ${jitter_std}ms" "\033[90m"
            game_draw_text 2 2 "[+/-] FPS | [p] Pause | [q] Quit" "\033[90m"
        fi

        # Flush to screen
        game_screen_flush

        # Note: Frame rate limiting happens in game_loop_read_input via timeout
    done

    # Cleanup
    game_loop_cleanup
}

# Stop game loop
game_loop_stop() {
    GAME_LOOP_RUNNING=0
}

# Cleanup game loop
game_loop_cleanup() {
    # Restore terminal
    stty sane 2>/dev/null
    game_screen_show_cursor
    game_screen_clear_screen

    # Clear entities
    game_entity_clear_all
}

# Set debug mode
# Args: 0 or 1
game_loop_set_debug() {
    GAME_LOOP_SHOW_DEBUG="${1:-0}"
}

# Set target FPS
# Args: fps
game_loop_set_fps() {
    GAME_LOOP_TARGET_FPS="${1:-30}"
}

# Get runtime in seconds (excluding pause time)
game_loop_get_runtime() {
    local current_time=$(game_time_ms)
    local active_pause=0
    if [[ $GAME_LOOP_PAUSED -eq 1 ]]; then
        active_pause=$((current_time - GAME_LOOP_PAUSE_START))
    fi
    local runtime_ms=$((current_time - GAME_LOOP_START_TIME - GAME_LOOP_TOTAL_PAUSE_TIME - active_pause))
    echo $((runtime_ms / 1000))
}

# Export game loop functions
export -f game_loop_read_input
export -f game_loop_toggle_pause
export -f game_loop_increase_fps
export -f game_loop_decrease_fps
export -f game_loop_init
export -f game_loop_run
export -f game_loop_stop
export -f game_loop_cleanup
export -f game_loop_set_debug
export -f game_loop_set_fps
export -f game_loop_get_runtime
