#!/usr/bin/env bash

# traks_render.sh - All rendering functions
#
# Requires: traks_config.sh, traks_core.sh

# Frame buffer
declare -g FRAME_BUFFER=""

# ============================================================================
# BUFFER HELPERS
# ============================================================================

calc_center() {
    local term_cols term_lines
    term_cols=$(tput cols)
    term_lines=$(tput lines)

    OFFSET_X=$(( (term_cols - DISPLAY_WIDTH) / 2 ))
    OFFSET_Y=$(( (term_lines - DISPLAY_HEIGHT) / 2 + 1 ))

    ((OFFSET_X < 0)) && OFFSET_X=0
    ((OFFSET_Y < 1)) && OFFSET_Y=1
}

buf() {
    FRAME_BUFFER+="$*"
}

buf_goto() {
    local row=$((OFFSET_Y + $1))
    local col=$((OFFSET_X + $2))
    FRAME_BUFFER+=$'\033['"${row};${col}H"
}

buf_color() {
    FRAME_BUFFER+=$'\033[38;5;'"$1"'m'
}

buf_reset() {
    FRAME_BUFFER+="$RST"
}

buf_clear_line() {
    FRAME_BUFFER+=$'\033[K'
}

# ============================================================================
# BUILD FUNCTIONS
# ============================================================================

build_arena() {
    local row col line

    # Top border
    buf_goto 2 1
    buf "  ${WALLS[tl]}"
    for ((col=0; col<ARENA_WIDTH; col++)); do
        buf "${WALLS[h]}"
    done
    buf "${WALLS[tr]}"

    # Side borders and clear interior
    for ((row=1; row<=ARENA_HEIGHT; row++)); do
        buf_goto $((row + 2)) 1
        buf "  ${WALLS[v]}"
        printf -v line '%*s' "$ARENA_WIDTH" ''
        buf "$line"
        buf "${WALLS[v]}"
    done

    # Bottom border
    buf_goto $((ARENA_HEIGHT + 3)) 1
    buf "  ${WALLS[bl]}"
    for ((col=0; col<ARENA_WIDTH; col++)); do
        buf "${WALLS[h]}"
    done
    buf "${WALLS[br]}"
}

build_trail() {
    local -n trail_arr=$1
    local -n colors_arr=$2
    local i pos x y screen_x screen_y

    for ((i=0; i<${#trail_arr[@]} && i<TRAIL_LENGTH; i++)); do
        pos="${trail_arr[$i]}"
        x="${pos%,*}"
        y="${pos#*,}"
        screen_x=$((x + 3))
        screen_y=$((y + 2))

        buf_goto "$screen_y" "$screen_x"
        buf_color "${colors_arr[$i]}"
        buf "$TRAIL_CHAR"
        buf_reset
    done
}

build_tank() {
    local -n player=$1
    local -n colors=$2

    local px="${player[x]}"
    local py="${player[y]}"
    local heading="${player[heading]}"
    local left_phase="${player[left_track_phase]}"
    local right_phase="${player[right_track_phase]}"
    local vel="${player[velocity]}"
    local abs_vel=${vel#-}

    local arrow="${DIR_ARROWS[$heading]}"

    # Track characters based on speed (double-line at max speed)
    local tv="┃" th="━"
    ((abs_vel >= 3)) && { tv="║"; th="═"; }

    # Screen coords for center of 3x3 sprite
    local cx=$((px + 3))
    local cy=$((py + 2))

    case "$heading" in
        n|s)
            # Vertical: tracks left/right
            buf_goto $((cy - 1)) $((cx - 1))
            buf_color "${colors[$(( left_phase % 8 ))]}"
            buf "$tv"
            buf_reset
            buf " "
            buf_color "${colors[$(( right_phase % 8 ))]}"
            buf "$tv"
            buf_reset

            buf_goto "$cy" $((cx - 1))
            buf_color "${colors[$(( (left_phase + 3) % 8 ))]}"
            buf "$tv"
            buf_reset
            buf_color "${colors[0]}"
            buf "$arrow"
            buf_reset
            buf_color "${colors[$(( (right_phase + 3) % 8 ))]}"
            buf "$tv"
            buf_reset

            buf_goto $((cy + 1)) $((cx - 1))
            buf_color "${colors[$(( (left_phase + 6) % 8 ))]}"
            buf "$tv"
            buf_reset
            buf " "
            buf_color "${colors[$(( (right_phase + 6) % 8 ))]}"
            buf "$tv"
            buf_reset
            ;;

        e|w)
            # Horizontal: tracks top/bottom
            buf_goto $((cy - 1)) $((cx - 1))
            buf_color "${colors[$(( left_phase % 8 ))]}"
            buf "$th"
            buf_color "${colors[$(( (left_phase + 3) % 8 ))]}"
            buf "$th"
            buf_color "${colors[$(( (left_phase + 6) % 8 ))]}"
            buf "$th"
            buf_reset

            buf_goto "$cy" $((cx - 1))
            buf " "
            buf_color "${colors[0]}"
            buf "$arrow"
            buf_reset
            buf " "

            buf_goto $((cy + 1)) $((cx - 1))
            buf_color "${colors[$(( right_phase % 8 ))]}"
            buf "$th"
            buf_color "${colors[$(( (right_phase + 3) % 8 ))]}"
            buf "$th"
            buf_color "${colors[$(( (right_phase + 6) % 8 ))]}"
            buf "$th"
            buf_reset
            ;;

        ne|sw)
            # Diagonal /
            buf_goto $((cy - 1)) $((cx - 1))
            buf_color "${colors[$(( left_phase % 8 ))]}"
            buf "╱"
            buf_reset
            buf " "
            buf_color "${colors[$(( right_phase % 8 ))]}"
            buf "╱"
            buf_reset

            buf_goto "$cy" $((cx - 1))
            buf " "
            buf_color "${colors[0]}"
            buf "$arrow"
            buf_reset
            buf " "

            buf_goto $((cy + 1)) $((cx - 1))
            buf_color "${colors[$(( (left_phase + 4) % 8 ))]}"
            buf "╱"
            buf_reset
            buf " "
            buf_color "${colors[$(( (right_phase + 4) % 8 ))]}"
            buf "╱"
            buf_reset
            ;;

        nw|se)
            # Diagonal \
            buf_goto $((cy - 1)) $((cx - 1))
            buf_color "${colors[$(( left_phase % 8 ))]}"
            buf "╲"
            buf_reset
            buf " "
            buf_color "${colors[$(( right_phase % 8 ))]}"
            buf "╲"
            buf_reset

            buf_goto "$cy" $((cx - 1))
            buf " "
            buf_color "${colors[0]}"
            buf "$arrow"
            buf_reset
            buf " "

            buf_goto $((cy + 1)) $((cx - 1))
            buf_color "${colors[$(( (left_phase + 4) % 8 ))]}"
            buf "╲"
            buf_reset
            buf " "
            buf_color "${colors[$(( (right_phase + 4) % 8 ))]}"
            buf "╲"
            buf_reset
            ;;
    esac
}

build_food() {
    if [[ "${FOOD[active]}" == "true" ]]; then
        local screen_x=$((FOOD[x] + 3))
        local screen_y=$((FOOD[y] + 2))
        buf_goto "$screen_y" "$screen_x"
        buf_color "$FOOD_COLOR"
        buf "$FOOD_CHAR"
        buf_reset
    fi
}

build_scores() {
    local v1="${PLAYER_LEFT[velocity]}"
    local v2="${PLAYER_RIGHT[velocity]}"
    local p1_info="${PLAYER_LEFT[name]}:${PLAYER_LEFT[score]} v${v1}"
    local p2_info="v${v2} ${PLAYER_RIGHT[name]}:${PLAYER_RIGHT[score]}"
    local gap_size=$((ARENA_WIDTH - ${#p1_info} - ${#p2_info}))
    local gap
    printf -v gap '%*s' "$gap_size" ''

    buf_goto 1 3
    buf_color "${VERBS_COLORS[0]}"
    buf "$p1_info"
    buf_reset
    buf "$gap"
    buf_color "${NOUNS_COLORS[0]}"
    buf "$p2_info"
    buf_reset
}

build_status() {
    buf_goto $((ARENA_HEIGHT + 4)) 3
    if [[ "${GAME_STATE[paused]}" == "true" ]]; then
        local pause_x=$(( (ARENA_WIDTH - 8) / 2 ))
        buf_goto $((ARENA_HEIGHT + 4)) $((3 + pause_x))
        buf_color 220
        buf "[PAUSED]"
        buf_reset
    fi
}

build_log() {
    [[ "${GAME_STATE[show_log]}" != "true" ]] && return

    local log_y=$((ARENA_HEIGHT + 5))
    local i

    buf_color 245
    for ((i=0; i<4; i++)); do
        buf_goto $((log_y + i)) 3
        buf "${LOG_BUFFER[$i]:0:$ARENA_WIDTH}"
        buf_clear_line
    done
    buf_reset
}

build_repl() {
    local repl_y=$((ARENA_HEIGHT + 5))
    local i

    # Separator line
    buf_goto "$repl_y" 3
    buf_color 240
    for ((i=0; i<ARENA_WIDTH; i++)); do buf "─"; done
    buf_reset

    # REPL lines
    buf_color 250
    for ((i=0; i<4; i++)); do
        buf_goto $((repl_y + 1 + i)) 3
        buf "${REPL_BUFFER[$i]:0:$ARENA_WIDTH}"
        buf_clear_line
    done
    buf_reset
}

# ============================================================================
# RENDER FUNCTIONS
# ============================================================================

render_frame() {
    FRAME_BUFFER=""
    FRAME_BUFFER+=$'\033[?25l'  # Hide cursor

    build_scores
    build_arena
    build_trail TRAIL_LEFT VERBS_COLORS
    build_trail TRAIL_RIGHT NOUNS_COLORS
    build_food
    build_tank PLAYER_LEFT VERBS_COLORS
    build_tank PLAYER_RIGHT NOUNS_COLORS
    build_status
    build_repl

    printf '%b' "$FRAME_BUFFER"
}

render_winner() {
    local winner="${GAME_STATE[winner]}"
    local mid_y=$((OFFSET_Y + ARENA_HEIGHT / 2 + 2))
    local mid_x=$((OFFSET_X + ARENA_WIDTH / 2 - 3))

    printf '\033[%d;%dH' "$mid_y" "$mid_x"
    printf '\033[38;2;100;255;100m'
    printf " %s WINS! " "$winner"
    printf '\033[0m'
}

render_help() {
    printf '\033[2J\033[H'
    printf '\n'
    printf '  TRAKS - Two Player Tank Game\n'
    printf '  =============================\n'
    printf '\n'
    printf '  VISUAL ELEMENTS:\n'
    printf '  [Arena]        - The play field boundary\n'
    printf '  [Player Left]  - P1 tank (VERBS palette - warm)\n'
    printf '  [Player Right] - P2 tank (NOUNS palette - cool)\n'
    printf '  [Trail]        - Fading 8-step path\n'
    printf '  [Score Bar]    - Score and velocity (v-3 to v3)\n'
    printf '  [Food]         - Yellow collectible\n'
    printf '\n'
    printf '  CONTROLS:\n'
    printf '  Player 1: W=speed up, S=slow down, A=turn left, D=turn right\n'
    printf '  Player 2: I=speed up, K=slow down, J=turn left, L=turn right\n'
    printf '  Space:    Pause/Resume\n'
    printf '  H:        This help\n'
    printf '  Q:        Quit\n'
    printf '\n'
    printf '  SPEED: -3 to +3 (negative = reverse)\n'
    printf '\n'
    printf '  GOAL: First to 10 wins!\n'
    printf '\n'
    printf '  Press any key to continue...'
    IFS= read -rsn1 -t 10 2>/dev/null || true
    printf '\033[2J'
}
