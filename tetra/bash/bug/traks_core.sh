#!/usr/bin/env bash

# traks_core.sh - Game state and tank model
#
# Requires: traks_config.sh

# ============================================================================
# GAME STATE
# ============================================================================

declare -gA GAME_STATE=(
    [running]="true"
    [paused]="false"
    [winner]=""
    [tick]="0"
    [show_log]="false"
    [cmd_mode]="false"
    [cmd_buffer]=""
)

# Log buffer (4 lines)
declare -ga LOG_BUFFER=("" "" "" "")

# REPL buffer (4 lines)
declare -ga REPL_BUFFER=("" "" "" "")

# ============================================================================
# PLAYER STATE
# ============================================================================

declare -gA PLAYER_LEFT=(
    [x]="8"
    [y]="10"
    [score]="0"
    [name]="P1"
    [heading]="e"
    [velocity]="0"
    [anim_phase]="0"
    [left_track_phase]="0"
    [right_track_phase]="0"
)

declare -gA PLAYER_RIGHT=(
    [x]="50"
    [y]="10"
    [score]="0"
    [name]="P2"
    [heading]="w"
    [velocity]="0"
    [anim_phase]="0"
    [left_track_phase]="0"
    [right_track_phase]="0"
)

declare -gA FOOD=(
    [x]="30"
    [y]="12"
    [active]="true"
)

# Trail storage: arrays of "x,y" positions (newest first)
declare -ga TRAIL_LEFT=()
declare -ga TRAIL_RIGHT=()

# ============================================================================
# STATE RESET
# ============================================================================

reset_game_state() {
    GAME_STATE[running]="true"
    GAME_STATE[paused]="false"
    GAME_STATE[winner]=""
    GAME_STATE[tick]="0"
    GAME_STATE[cmd_mode]="false"
    GAME_STATE[cmd_buffer]=""

    PLAYER_LEFT[x]="8"
    PLAYER_LEFT[y]="10"
    PLAYER_LEFT[score]="0"
    PLAYER_LEFT[heading]="e"
    PLAYER_LEFT[velocity]="0"
    PLAYER_LEFT[anim_phase]="0"
    PLAYER_LEFT[left_track_phase]="0"
    PLAYER_LEFT[right_track_phase]="0"

    PLAYER_RIGHT[x]="50"
    PLAYER_RIGHT[y]="10"
    PLAYER_RIGHT[score]="0"
    PLAYER_RIGHT[heading]="w"
    PLAYER_RIGHT[velocity]="0"
    PLAYER_RIGHT[anim_phase]="0"
    PLAYER_RIGHT[left_track_phase]="0"
    PLAYER_RIGHT[right_track_phase]="0"

    TRAIL_LEFT=()
    TRAIL_RIGHT=()

    LOG_BUFFER=("" "" "" "")
    REPL_BUFFER=("" "" "" "")
}

# ============================================================================
# TANK OPERATIONS
# ============================================================================

# Adjust velocity (keyboard: tap to increment/decrement)
adjust_velocity() {
    local -n player=$1
    local delta=$2  # +1 or -1

    local new_vel=$((player[velocity] + delta))
    # Clamp to -3..+3
    ((new_vel > 3)) && new_vel=3
    ((new_vel < -3)) && new_vel=-3
    player[velocity]="$new_vel"
}

# Set velocity directly (MIDI: absolute value)
set_velocity() {
    local -n player=$1
    local vel=$2

    # Clamp to -3..+3
    ((vel > 3)) && vel=3
    ((vel < -3)) && vel=-3
    player[velocity]="$vel"
}

# Turn player (change heading)
turn_player() {
    local -n player=$1
    local turn_dir=$2  # "left" or "right"

    local heading="${player[heading]}"

    if [[ "$turn_dir" == "left" ]]; then
        player[heading]="${TURN_LEFT[$heading]}"
        # Outside track (right) moves faster on left turn
        ((player[right_track_phase] += 3))
        ((player[left_track_phase] += 1))
    else
        player[heading]="${TURN_RIGHT[$heading]}"
        # Outside track (left) moves faster on right turn
        ((player[left_track_phase] += 3))
        ((player[right_track_phase] += 1))
    fi

    # Keep in 0-7 range
    ((player[left_track_phase] %= 8))
    ((player[right_track_phase] %= 8))
}

# ============================================================================
# TRAIL MANAGEMENT
# ============================================================================

add_to_trail() {
    local trail_name=$1
    local x=$2
    local y=$3

    # Get current length via indirect expansion
    local len_var="${trail_name}[@]"
    local -a current=("${!len_var}")
    local len=${#current[@]}

    # Prepend new position
    eval "$trail_name=(\"\$x,\$y\" \"\${${trail_name}[@]}\")"

    # Trim to max length
    if ((len >= TRAIL_LENGTH)); then
        eval "$trail_name=(\"\${${trail_name}[@]:0:\$TRAIL_LENGTH}\")"
    fi
}

# ============================================================================
# POSITION UPDATE
# ============================================================================

update_position() {
    local -n player=$1
    local trail_name=$2

    local vel="${player[velocity]}"
    ((vel == 0)) && return

    local heading="${player[heading]}"
    local abs_vel=${vel#-}  # absolute value

    # Move every N ticks based on speed (3=every tick, 2=every 2, 1=every 3)
    local tick="${GAME_STATE[tick]}"
    local move_interval=$((4 - abs_vel))

    # Diagonals move √2 distance per step, slow them down
    case "$heading" in
        ne|se|sw|nw) move_interval=$((move_interval * DIAGONAL_SLOWDOWN)) ;;
    esac

    ((tick % move_interval != 0)) && return

    # Direction: positive velocity = forward (toward arrow), negative = backward
    local direction=1
    ((vel < 0)) && direction=-1

    local dx=$((HEADING_DX[$heading] * direction))
    local dy=$((HEADING_DY[$heading] * direction))

    local old_x="${player[x]}"
    local old_y="${player[y]}"
    local new_x=$((player[x] + dx))
    local new_y=$((player[y] + dy))

    # Boundary check (account for 3x3 sprite)
    if ((new_x >= 2 && new_x < ARENA_WIDTH - 2)); then
        if ((new_y >= 2 && new_y < ARENA_HEIGHT - 2)); then
            player[x]="$new_x"
            player[y]="$new_y"
            add_to_trail "$trail_name" "$old_x" "$old_y"
        fi
    fi

    # Animate tracks based on velocity
    ((player[left_track_phase] += direction))
    ((player[right_track_phase] += direction))
    ((player[left_track_phase] = (player[left_track_phase] + 8) % 8))
    ((player[right_track_phase] = (player[right_track_phase] + 8) % 8))
}

# ============================================================================
# LOGGING
# ============================================================================

game_log() {
    local msg="$1"
    # Shift buffer up
    LOG_BUFFER[3]="${LOG_BUFFER[2]}"
    LOG_BUFFER[2]="${LOG_BUFFER[1]}"
    LOG_BUFFER[1]="${LOG_BUFFER[0]}"
    LOG_BUFFER[0]="$msg"
}

repl_set() {
    local line=$1
    local msg="$2"
    ((line >= 0 && line < 4)) && REPL_BUFFER[$line]="$msg"
}
