#!/usr/bin/env bash

# traks_game.sh - Main game loop, collision, scoring
#
# Requires: traks_config.sh, traks_core.sh, traks_render.sh, traks_input.sh

# ============================================================================
# FOOD & COLLISION
# ============================================================================

spawn_food() {
    # Keep food away from edges
    FOOD[x]=$((RANDOM % (ARENA_WIDTH - 6) + 3))
    FOOD[y]=$((RANDOM % (ARENA_HEIGHT - 6) + 3))
    FOOD[active]="true"
}

check_food_collision() {
    local -n player=$1

    if [[ "${FOOD[active]}" == "true" ]]; then
        # Check if food is within tank's 3x3 area
        local dx=$((FOOD[x] - player[x]))
        local dy=$((FOOD[y] - player[y]))
        if ((dx >= -1 && dx <= 1 && dy >= -1 && dy <= 1)); then
            ((player[score]++))
            game_log "${player[name]} scored! (${player[score]})"
            FOOD[active]="false"
            spawn_food
            return 0
        fi
    fi
    return 1
}

check_winner() {
    if ((PLAYER_LEFT[score] >= 10)); then
        GAME_STATE[winner]="${PLAYER_LEFT[name]}"
        GAME_STATE[running]="false"
    elif ((PLAYER_RIGHT[score] >= 10)); then
        GAME_STATE[winner]="${PLAYER_RIGHT[name]}"
        GAME_STATE[running]="false"
    fi
}

# ============================================================================
# MAIN GAME LOOP
# ============================================================================

traks_repl() {
    setup_input

    # Signal handlers
    trap 'GAME_STATE[running]="false"' SIGUSR1
    trap 'GAME_STATE[paused]="true"' SIGUSR2
    trap 'GAME_STATE[paused]="false"' SIGCONT

    # Cleanup on exit
    trap 'cleanup_input; printf "\033[?25h\033[0m"; tput clear' EXIT

    # Reset state
    reset_game_state

    # Initialize display
    printf '\033[?25l'
    printf '\033[2J'
    calc_center
    spawn_food

    while [[ "${GAME_STATE[running]}" == "true" ]]; do
        # Update REPL status
        repl_set 0 "P1: pos(${PLAYER_LEFT[x]},${PLAYER_LEFT[y]}) hdg=${PLAYER_LEFT[heading]} vel=${PLAYER_LEFT[velocity]}"
        repl_set 1 "P2: pos(${PLAYER_RIGHT[x]},${PLAYER_RIGHT[y]}) hdg=${PLAYER_RIGHT[heading]} vel=${PLAYER_RIGHT[velocity]}"

        # Render based on view mode
        if [[ "$VIEW_MODE" == "2d" ]]; then
            render_frame
        else
            render_frame_3d
        fi

        # Read from keyboard or FIFO
        read_input && process_input "$INPUT_KEY"

        # Game tick (only when not paused)
        if [[ "${GAME_STATE[paused]}" != "true" ]]; then
            ((GAME_STATE[tick]++))
            update_position PLAYER_LEFT TRAIL_LEFT
            update_position PLAYER_RIGHT TRAIL_RIGHT
            check_food_collision PLAYER_LEFT
            check_food_collision PLAYER_RIGHT
            check_winner
        fi
    done

    # Show winner
    if [[ -n "${GAME_STATE[winner]}" ]]; then
        render_frame
        render_winner
        sleep 2
    fi

    # Restore terminal
    cleanup_input
    printf '\033[?25h'
    printf '\033[0m'
    tput clear
    trap - EXIT

    echo "Game Over!"
    echo "Final Score: ${PLAYER_LEFT[name]}: ${PLAYER_LEFT[score]}  ${PLAYER_RIGHT[name]}: ${PLAYER_RIGHT[score]}"
}
