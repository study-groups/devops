#!/usr/bin/env bash

# Game Loop System - Pulsar Backend
# Hybrid loop: bash manages entities/input, C engine handles rendering

# Game loop state (reuse from game_loop.sh)
declare -g GAME_LOOP_RUNNING=0
declare -g GAME_LOOP_TARGET_FPS=60
declare -g GAME_LOOP_PULSAR_MODE=0

# Initialize game loop with Pulsar backend
# Args: target_fps (optional), cols (optional), rows (optional)
game_loop_pulsar_init() {
    local fps="${1:-60}"

    # Get actual terminal size if not specified
    local cols="${2:-}"
    local rows="${3:-}"
    if [[ -z "$cols" ]] || [[ -z "$rows" ]]; then
        # Use stty to get actual terminal dimensions from /dev/tty
        if [[ -c /dev/tty ]]; then
            read -r rows cols < <(stty size </dev/tty 2>/dev/null || echo "24 80")
        else
            # Fallback if /dev/tty not available
            read -r rows cols < <(stty size 2>/dev/null || echo "24 80")
        fi
    fi

    tetra_log_info "game" "Initializing Pulsar with terminal size: ${cols}×${rows}"

    GAME_LOOP_TARGET_FPS="$fps"
    GAME_LOOP_RUNNING=1
    GAME_INPUT_QUIT=0
    GAME_LOOP_PULSAR_MODE=1
    GAME_USE_PULSAR=1

    # Start Pulsar engine
    pulsar_start "$cols" "$rows" || {
        tetra_log_error "game" "Failed to start Pulsar engine"
        return 1
    }

    # Setup terminal for non-blocking input
    stty -echo -icanon time 0 min 0 2>/dev/null

    tetra_log_success "game" "Pulsar game loop initialized at ${fps} FPS"
}

# Main game loop with Pulsar backend
# This is a hybrid model:
# - Bash handles entity updates and input
# - C engine handles all rendering via RUN command (blocking)
# Args: init_fn, update_fn
game_loop_pulsar_run() {
    local init_fn="${1:-}"
    local update_fn="${2:-}"

    # Initialize game state
    if [[ -n "$init_fn" ]] && declare -f "$init_fn" >/dev/null 2>&1; then
        "$init_fn"
    fi

    # Send RUN command to Pulsar
    echo "RUN $GAME_LOOP_TARGET_FPS" >&"$PULSAR_FD_IN"

    # Bring to foreground - this blocks until user quits
    fg %PULSAR 2>/dev/null

    # When RUN completes (user pressed 'q'), cleanup
    game_loop_pulsar_cleanup
}

# Alternative: Fully manual loop (bash controls frame timing)
# Use this if you need more control over the update/render cycle
# Args: init_fn, update_fn
game_loop_pulsar_run_manual() {
    local init_fn="${1:-}"
    local update_fn="${2:-}"

    # Initialize game state
    if [[ -n "$init_fn" ]] && declare -f "$init_fn" >/dev/null 2>&1; then
        "$init_fn"
    fi

    # Manual frame loop
    local last_time=$(game_time_ms)
    local frame_ms=$((1000 / GAME_LOOP_TARGET_FPS))

    while [[ $GAME_LOOP_RUNNING -eq 1 && $GAME_INPUT_QUIT -eq 0 ]]; do
        local frame_start=$(game_time_ms)

        # Input (non-blocking)
        local key=""
        if IFS= read -rsn1 -t 0.001 key 2>/dev/null; then
            case "$key" in
                q|Q|$'\x1b') GAME_INPUT_QUIT=1 ;;
                p|P) game_loop_toggle_pause ;;
            esac
        fi

        # Calculate delta time
        local current_time=$(game_time_ms)
        local delta=$((current_time - last_time))
        last_time=$current_time

        # Update entities (if not paused)
        if [[ $GAME_LOOP_PAUSED -eq 0 ]]; then
            if [[ -n "$update_fn" ]] && declare -f "$update_fn" >/dev/null 2>&1; then
                "$update_fn" "$delta"
            fi
        fi

        # Render frame (tell C engine to draw)
        pulsar_cmd "RENDER" 2>/dev/null || true

        # Frame limiting
        local frame_elapsed=$(($(game_time_ms) - frame_start))
        local sleep_ms=$((frame_ms - frame_elapsed))
        if [[ $sleep_ms -gt 0 ]]; then
            sleep "$(awk "BEGIN {printf \"%.4f\", $sleep_ms / 1000.0}")"
        fi
    done

    # Stop Pulsar render loop (if running)
    pulsar_cmd "QUIT" 2>/dev/null || true

    # Cleanup
    game_loop_pulsar_cleanup
}

# Cleanup Pulsar game loop
game_loop_pulsar_cleanup() {
    # Restore terminal FIRST (in case pulsar_stop hangs)
    stty sane 2>/dev/null
    printf "\033[?25h"  # Show cursor
    printf "\033[0m"    # Reset colors

    # Stop Pulsar engine
    pulsar_stop

    # Clear entities (this will also kill Pulsar sprites)
    game_entity_clear_all 2>/dev/null || true

    GAME_LOOP_PULSAR_MODE=0
    GAME_USE_PULSAR=0

    tetra_log_info "game" "Pulsar game loop stopped"
}

# Toggle pause (shared with regular game loop)
# Just reuse game_loop_toggle_pause from game_loop.sh

# Export functions
export -f game_loop_pulsar_init
export -f game_loop_pulsar_run
export -f game_loop_pulsar_run_manual
export -f game_loop_pulsar_cleanup
