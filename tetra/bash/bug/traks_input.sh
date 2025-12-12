#!/usr/bin/env bash

# traks_input.sh - Input handling and REPL commands
#
# Requires: traks_config.sh, traks_core.sh

# Saved terminal state
SAVED_STTY=""

# Current input key
INPUT_KEY=""

# ============================================================================
# INPUT SETUP/CLEANUP
# ============================================================================

setup_input() {
    # Always setup keyboard
    SAVED_STTY=$(stty -g)
    stty -echo -icanon min 0 time 0

    # Optionally setup FIFO
    if [[ "$TRAKS_USE_FIFO" == "true" ]]; then
        [[ -p "$TRAKS_FIFO" ]] || mkfifo "$TRAKS_FIFO" 2>/dev/null
        exec 3<>"$TRAKS_FIFO"
    fi
}

cleanup_input() {
    [[ -n "$SAVED_STTY" ]] && stty "$SAVED_STTY"

    if [[ "$TRAKS_USE_FIFO" == "true" ]]; then
        exec 3<&- 2>/dev/null
    fi
}

# ============================================================================
# INPUT READING
# ============================================================================

read_input() {
    INPUT_KEY=""

    # Try keyboard (single char)
    if read -t 0.02 -n1 INPUT_KEY 2>/dev/null && [[ -n "$INPUT_KEY" ]]; then
        return 0
    fi

    # Try FIFO (full line)
    if [[ "$TRAKS_USE_FIFO" == "true" ]]; then
        if read -t 0.02 -u 3 INPUT_KEY 2>/dev/null && [[ -n "$INPUT_KEY" ]]; then
            return 0
        fi
    fi

    # No input
    sleep "$GAME_TICK"
    return 1
}

# ============================================================================
# REPL COMMANDS
# ============================================================================

process_cmd() {
    local cmd="$1"
    case "$cmd" in
        help)
            repl_set 3 "diag N | trail N | tick N | p1hdg X | p2hdg X"
            ;;
        diag\ *)
            DIAGONAL_SLOWDOWN="${cmd#diag }"
            repl_set 3 "diagonal = $DIAGONAL_SLOWDOWN"
            ;;
        trail\ *)
            TRAIL_LENGTH="${cmd#trail }"
            repl_set 3 "trail = $TRAIL_LENGTH"
            ;;
        tick\ *)
            GAME_TICK="${cmd#tick }"
            repl_set 3 "tick = $GAME_TICK"
            ;;
        p1hdg\ *)
            PLAYER_LEFT[heading]="${cmd#p1hdg }"
            repl_set 3 "P1 hdg = ${PLAYER_LEFT[heading]}"
            ;;
        p2hdg\ *)
            PLAYER_RIGHT[heading]="${cmd#p2hdg }"
            repl_set 3 "P2 hdg = ${PLAYER_RIGHT[heading]}"
            ;;
        *)
            repl_set 3 "unknown: $cmd"
            ;;
    esac
}

# ============================================================================
# INPUT PROCESSING
# ============================================================================

process_input() {
    local key="$1"

    # Command mode input
    if [[ "${GAME_STATE[cmd_mode]}" == "true" ]]; then
        case "$key" in
            $'\n'|$'\r')  # Enter
                process_cmd "${GAME_STATE[cmd_buffer]}"
                GAME_STATE[cmd_mode]="false"
                GAME_STATE[cmd_buffer]=""
                ;;
            $'\x7f'|$'\b')  # Backspace
                GAME_STATE[cmd_buffer]="${GAME_STATE[cmd_buffer]%?}"
                repl_set 3 ":${GAME_STATE[cmd_buffer]}_"
                ;;
            $'\x1b')  # Escape
                GAME_STATE[cmd_mode]="false"
                GAME_STATE[cmd_buffer]=""
                repl_set 3 "cancelled"
                ;;
            *)  # Add to buffer
                GAME_STATE[cmd_buffer]+="$key"
                repl_set 3 ":${GAME_STATE[cmd_buffer]}_"
                ;;
        esac
        return
    fi

    case "$key" in
        # Enter command mode
        :)
            GAME_STATE[cmd_mode]="true"
            GAME_STATE[cmd_buffer]=""
            repl_set 3 ":_"
            return
            ;;

        # Player 1 (WASD)
        w|W) adjust_velocity PLAYER_LEFT 1 ;;
        s|S) adjust_velocity PLAYER_LEFT -1 ;;
        a|A) turn_player PLAYER_LEFT "left" ;;
        d|D) turn_player PLAYER_LEFT "right" ;;

        # Player 2 (IJKL)
        i|I) adjust_velocity PLAYER_RIGHT 1 ;;
        k|K) adjust_velocity PLAYER_RIGHT -1 ;;
        j|J) turn_player PLAYER_RIGHT "left" ;;
        l|L) turn_player PLAYER_RIGHT "right" ;;

        # MIDI velocity commands (V:player:velocity format)
        V:1:*)
            set_velocity PLAYER_LEFT "${key##*:}"
            ;;
        V:2:*)
            set_velocity PLAYER_RIGHT "${key##*:}"
            ;;

        # Game controls
        " ")  # Space - toggle pause
            if [[ "${GAME_STATE[paused]}" == "true" ]]; then
                GAME_STATE[paused]="false"
            else
                GAME_STATE[paused]="true"
            fi
            ;;

        p|P)  # Play (unpause)
            GAME_STATE[paused]="false"
            ;;

        h|H) render_help ;;

        # View mode controls
        v|V)  # Cycle view mode: 2d → chase → cockpit → spectator → 2d
            local i mode_count=${#VIEW_MODES[@]}
            for ((i=0; i<mode_count; i++)); do
                if [[ "${VIEW_MODES[$i]}" == "$VIEW_MODE" ]]; then
                    VIEW_MODE="${VIEW_MODES[$(( (i + 1) % mode_count ))]}"
                    repl_set 2 "view: $VIEW_MODE"
                    break
                fi
            done
            ;;

        1)  # P1 POV
            ACTIVE_PLAYER=1
            repl_set 2 "POV: P1"
            ;;

        2)  # P2 POV
            ACTIVE_PLAYER=2
            repl_set 2 "POV: P2"
            ;;

        "/"|"\\")  # Toggle log panel
            if [[ "${GAME_STATE[show_log]}" == "true" ]]; then
                GAME_STATE[show_log]="false"
            else
                GAME_STATE[show_log]="true"
                game_log "Log enabled - press / to hide"
            fi
            ;;

        q|Q)
            GAME_STATE[running]="false"
            ;;
    esac
}
