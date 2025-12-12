#!/usr/bin/env bash

# bug.sh - Two-player CLI game
#
# VISUAL ELEMENTS:
#   - Arena:           The play field
#   - Player Left:     Left player's bug (WASD controls, VERBS palette)
#   - Player Right:    Right player's bug (IJKL controls, NOUNS palette)
#   - Trail:           Fading path behind each bug (8 steps)
#   - Score Bar:       Current scores
#   - Food:            Collectible items
#
# CONTROLS:
#   Player 1 (Left):   W/A/S/D for movement
#   Player 2 (Right):  I/J/K/L for movement
#   Space:             Pause
#   Q:                 Quit

# Module paths
BUG_SRC="${BUG_SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
TDS_SRC="${TDS_SRC:-$BUG_SRC/../tds}"

# Source TDS (optional - works without it)
if [[ -f "$TDS_SRC/tds.sh" ]]; then
    source "$TDS_SRC/tds.sh"
fi

# ============================================================================
# GAME CONSTANTS
# ============================================================================

ARENA_WIDTH=60
ARENA_HEIGHT=20
GAME_TICK=0.08
TRAIL_LENGTH=8

# Direction arrows
declare -A DIR_ARROWS=(
    [up]="▲"
    [down]="▼"
    [left]="◀"
    [right]="▶"
)

# Wall characters
declare -A WALLS=(
    [h]="─"
    [v]="│"
    [tl]="┌"
    [tr]="┐"
    [bl]="└"
    [br]="┘"
)

# Trail character (fading dot)
TRAIL_CHAR="·"

# ============================================================================
# COLOR PALETTES (VERBS for P1, NOUNS for P2)
# ============================================================================

# VERBS palette - warm (reds/oranges) - 8 steps bright to dim
declare -a VERBS_COLORS=(
    "255;100;100"   # 0 - brightest
    "230;90;90"     # 1
    "200;80;80"     # 2
    "170;70;70"     # 3
    "140;60;60"     # 4
    "110;50;50"     # 5
    "80;40;40"      # 6
    "50;30;30"      # 7 - dimmest
)

# NOUNS palette - cool (purples/magentas) - 8 steps bright to dim
declare -a NOUNS_COLORS=(
    "200;100;255"   # 0 - brightest
    "180;90;230"    # 1
    "160;80;200"    # 2
    "140;70;170"    # 3
    "120;60;140"    # 4
    "100;50;110"    # 5
    "80;40;80"      # 6
    "60;30;50"      # 7 - dimmest
)

# Food color (yellow)
FOOD_COLOR="255;220;100"
FOOD_CHAR="◆"

# ============================================================================
# GAME STATE
# ============================================================================

declare -gA GAME_STATE=(
    [running]="true"
    [paused]="false"
    [winner]=""
    [tick]="0"
    [show_log]="false"
)

# Log buffer (4 lines)
declare -ga LOG_BUFFER=("" "" "" "")

declare -gA PLAYER_LEFT=(
    [x]="5"
    [y]="10"
    [score]="0"
    [name]="P1"
    [dir]="right"
)

declare -gA PLAYER_RIGHT=(
    [x]="54"
    [y]="10"
    [score]="0"
    [name]="P2"
    [dir]="left"
)

declare -gA FOOD=(
    [x]="30"
    [y]="10"
    [active]="true"
)

# Trail storage: arrays of "x,y" positions (newest first)
declare -ga TRAIL_LEFT=()
declare -ga TRAIL_RIGHT=()

# Visual elements metadata
declare -gA VISUAL_ELEMENTS=(
    [arena]="Arena|Play field|The game boundary"
    [player_left]="Player Left|P1 bug|WASD, VERBS palette"
    [player_right]="Player Right|P2 bug|IJKL, NOUNS palette"
    [trail]="Trail|Fading path|8-step fade to background"
    [score_bar]="Score Bar|P1:X P2:X|Current scores"
    [food]="Food|Collectible|Score points"
)

# ============================================================================
# RENDERING - Double buffered, centered
# ============================================================================

# Frame buffer
declare -g FRAME_BUFFER=""

# Screen centering offsets
declare -g OFFSET_X=0
declare -g OFFSET_Y=0

# Total display size (arena + borders + padding)
DISPLAY_WIDTH=$((ARENA_WIDTH + 4))   # 2 border + 2 padding
DISPLAY_HEIGHT=$((ARENA_HEIGHT + 4)) # 2 border + score + status

# Calculate center offsets based on terminal size
calc_center() {
    local term_cols term_lines
    term_cols=$(tput cols)
    term_lines=$(tput lines)

    OFFSET_X=$(( (term_cols - DISPLAY_WIDTH) / 2 ))
    OFFSET_Y=$(( (term_lines - DISPLAY_HEIGHT) / 2 + 1 ))

    # Ensure minimum of 1 for top margin
    ((OFFSET_X < 0)) && OFFSET_X=0
    ((OFFSET_Y < 1)) && OFFSET_Y=1
}

# ANSI codes
RST=$'\033[0m'

rgb_fg() {
    printf "\033[38;2;%sm" "$1"
}

# Add to buffer instead of printing directly
buf() {
    FRAME_BUFFER+="$*"
}

# Goto with centering offset applied
buf_goto() {
    local row=$((OFFSET_Y + $1))
    local col=$((OFFSET_X + $2))
    FRAME_BUFFER+=$'\033['"${row};${col}H"
}

buf_rgb() {
    FRAME_BUFFER+="\033[38;2;$1m"
}

buf_reset() {
    FRAME_BUFFER+="$RST"
}

# Clear a line region in buffer
buf_clear_line() {
    FRAME_BUFFER+=$'\033[K'
}

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
        # Clear interior with spaces
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
    local trail_name=$1
    local colors_name=$2
    local i pos x y screen_x screen_y

    local trail_var="${trail_name}[@]"
    local -a trail_arr=("${!trail_var}")
    local colors_var="${colors_name}[@]"
    local -a colors_arr=("${!colors_var}")

    for ((i=0; i<${#trail_arr[@]} && i<TRAIL_LENGTH; i++)); do
        pos="${trail_arr[$i]}"
        x="${pos%,*}"
        y="${pos#*,}"
        screen_x=$((x + 3))
        screen_y=$((y + 2))

        buf_goto "$screen_y" "$screen_x"
        buf_rgb "${colors_arr[$i]}"
        buf "$TRAIL_CHAR"
        buf_reset
    done
}

build_player() {
    local -n player=$1
    local colors_name=$2
    local screen_x=$((player[x] + 3))
    local screen_y=$((player[y] + 2))
    local arrow="${DIR_ARROWS[${player[dir]}]}"

    local colors_var="${colors_name}[0]"
    local color="${!colors_var}"

    buf_goto "$screen_y" "$screen_x"
    buf_rgb "$color"
    buf "$arrow"
    buf_reset
}

build_food() {
    if [[ "${FOOD[active]}" == "true" ]]; then
        local screen_x=$((FOOD[x] + 3))
        local screen_y=$((FOOD[y] + 2))
        buf_goto "$screen_y" "$screen_x"
        buf_rgb "$FOOD_COLOR"
        buf "$FOOD_CHAR"
        buf_reset
    fi
}

build_scores() {
    local p1_score="${PLAYER_LEFT[name]}: ${PLAYER_LEFT[score]}"
    local p2_score="${PLAYER_RIGHT[name]}: ${PLAYER_RIGHT[score]}"
    local gap_size=$((ARENA_WIDTH - ${#p1_score} - ${#p2_score}))
    local gap
    printf -v gap '%*s' "$gap_size" ''

    buf_goto 1 3
    buf_rgb "${VERBS_COLORS[0]}"
    buf "$p1_score"
    buf_reset
    buf "$gap"
    buf_rgb "${NOUNS_COLORS[0]}"
    buf "$p2_score"
    buf_reset
}

build_status() {
    buf_goto $((ARENA_HEIGHT + 4)) 3
    if [[ "${GAME_STATE[paused]}" == "true" ]]; then
        # Center the pause text
        local pause_x=$(( (ARENA_WIDTH - 8) / 2 ))
        buf_goto $((ARENA_HEIGHT + 4)) $((3 + pause_x))
        buf_rgb "255;220;100"
        buf "[PAUSED]"
        buf_reset
    fi
}

# Add message to log buffer
game_log() {
    local msg="$1"
    # Shift buffer up
    LOG_BUFFER[3]="${LOG_BUFFER[2]}"
    LOG_BUFFER[2]="${LOG_BUFFER[1]}"
    LOG_BUFFER[1]="${LOG_BUFFER[0]}"
    LOG_BUFFER[0]="$msg"
}

# Build log panel (4 lines below arena)
build_log() {
    [[ "${GAME_STATE[show_log]}" != "true" ]] && return

    local log_y=$((ARENA_HEIGHT + 5))
    local i

    buf_rgb "100;100;100"
    for ((i=0; i<4; i++)); do
        buf_goto $((log_y + i)) 3
        buf "${LOG_BUFFER[$i]:0:$ARENA_WIDTH}"
        buf_clear_line
    done
    buf_reset
}

render_frame() {
    # Clear buffer
    FRAME_BUFFER=""

    # Hide cursor
    FRAME_BUFFER+=$'\033[?25l'

    # Build frame
    build_scores
    build_arena
    build_trail TRAIL_LEFT VERBS_COLORS
    build_trail TRAIL_RIGHT NOUNS_COLORS
    build_food
    build_player PLAYER_LEFT VERBS_COLORS
    build_player PLAYER_RIGHT NOUNS_COLORS
    build_status
    build_log

    # Output entire frame at once
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
    printf '\033[2J\033[H'  # Clear and home
    printf '\n'
    printf '  BUG - Two Player Game\n'
    printf '  =====================\n'
    printf '\n'
    printf '  VISUAL ELEMENTS:\n'
    printf '  [Arena]        - The play field boundary\n'
    printf '  [Player Left]  - P1 bug (VERBS palette - warm)\n'
    printf '  [Player Right] - P2 bug (NOUNS palette - cool)\n'
    printf '  [Trail]        - Fading 8-step path\n'
    printf '  [Score Bar]    - Current scores\n'
    printf '  [Food]         - Yellow collectible\n'
    printf '\n'
    printf '  CONTROLS:\n'
    printf '  Player 1: W=up, A=left, S=down, D=right\n'
    printf '  Player 2: I=up, J=left, K=down, L=right\n'
    printf '  Space:    Pause/Resume\n'
    printf '  H:        This help\n'
    printf '  Q:        Quit\n'
    printf '\n'
    printf '  GOAL: First to 10 wins!\n'
    printf '\n'
    printf '  Press any key to continue...'
    IFS= read -rsn1 -t 10 2>/dev/null || true
    printf '\033[2J'  # Clear for return to game
}

# ============================================================================
# GAME LOGIC
# ============================================================================

spawn_food() {
    FOOD[x]=$((RANDOM % (ARENA_WIDTH - 2) + 1))
    FOOD[y]=$((RANDOM % (ARENA_HEIGHT - 2) + 1))
    FOOD[active]="true"
}

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

move_player() {
    local -n player=$1
    local trail_name=$2
    local dx=$3
    local dy=$4
    local dir=$5

    local old_x="${player[x]}"
    local old_y="${player[y]}"
    local new_x=$((player[x] + dx))
    local new_y=$((player[y] + dy))

    # Boundary check
    local moved=false
    if ((new_x >= 1 && new_x < ARENA_WIDTH - 1)); then
        player[x]="$new_x"
        moved=true
    fi
    if ((new_y >= 1 && new_y < ARENA_HEIGHT - 1)); then
        player[y]="$new_y"
        moved=true
    fi

    # Update direction and add trail
    if [[ "$moved" == true ]]; then
        player[dir]="$dir"
        add_to_trail "$trail_name" "$old_x" "$old_y"
    fi
}

check_food_collision() {
    local -n player=$1

    if [[ "${FOOD[active]}" == "true" ]]; then
        if ((player[x] == FOOD[x] && player[y] == FOOD[y])); then
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

process_input() {
    local key="$1"

    case "$key" in
        # Player 1 (WASD)
        w|W) move_player PLAYER_LEFT TRAIL_LEFT 0 -1 "up" ;;
        a|A) move_player PLAYER_LEFT TRAIL_LEFT -1 0 "left" ;;
        s)   move_player PLAYER_LEFT TRAIL_LEFT 0 1 "down" ;;
        d|D) move_player PLAYER_LEFT TRAIL_LEFT 1 0 "right" ;;

        # Player 2 (IJKL)
        i|I) move_player PLAYER_RIGHT TRAIL_RIGHT 0 -1 "up" ;;
        j|J) move_player PLAYER_RIGHT TRAIL_RIGHT -1 0 "left" ;;
        k|K) move_player PLAYER_RIGHT TRAIL_RIGHT 0 1 "down" ;;
        l|L) move_player PLAYER_RIGHT TRAIL_RIGHT 1 0 "right" ;;

        # Game controls
        " ") # Space - toggle pause
            if [[ "${GAME_STATE[paused]}" == "true" ]]; then
                GAME_STATE[paused]="false"
            else
                GAME_STATE[paused]="true"
            fi
            ;;

        p|P) # Play (unpause)
            GAME_STATE[paused]="false"
            ;;

        h|H) render_help ;;

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

# ============================================================================
# INPUT SYSTEM - FIFO only
# ============================================================================
#
# All input comes through FIFO. Start input writers separately:
#   ./bug_keyboard.sh > /tmp/bug_input &    # keyboard
#   node bug_osc_listener.js > /tmp/bug_input &  # MIDI/OSC
#
# ============================================================================

BUG_FIFO="${BUG_FIFO:-/tmp/bug_input}"

# Setup FIFO for input
setup_fifo() {
    [[ -p "$BUG_FIFO" ]] || mkfifo "$BUG_FIFO" 2>/dev/null
    # Open read+write to prevent blocking if no writer yet
    exec 3<>"$BUG_FIFO"
}

# Cleanup FIFO
cleanup_fifo() {
    exec 3<&- 2>/dev/null
}

# Read single character from FIFO with timeout
read_input() {
    local key=""
    if read -t "$GAME_TICK" -u 3 -n1 key 2>/dev/null && [[ -n "$key" ]]; then
        echo "$key"
        return 0
    fi
    return 1
}

# ============================================================================
# MAIN GAME LOOP
# ============================================================================

bug_repl() {
    # Setup FIFO input
    setup_fifo

    # Signal handlers
    trap 'GAME_STATE[running]="false"' SIGUSR1   # Quit
    trap 'GAME_STATE[paused]="true"' SIGUSR2     # Pause
    trap 'GAME_STATE[paused]="false"' SIGCONT    # Resume

    # Cleanup on exit
    trap 'cleanup_fifo; printf "\033[?25h\033[0m"; tput clear' EXIT

    # Reset state for fresh game
    GAME_STATE[running]="true"
    GAME_STATE[paused]="false"
    GAME_STATE[winner]=""
    GAME_STATE[tick]="0"
    PLAYER_LEFT[x]="5"
    PLAYER_LEFT[y]="10"
    PLAYER_LEFT[score]="0"
    PLAYER_LEFT[dir]="right"
    PLAYER_RIGHT[x]="54"
    PLAYER_RIGHT[y]="10"
    PLAYER_RIGHT[score]="0"
    PLAYER_RIGHT[dir]="left"
    TRAIL_LEFT=()
    TRAIL_RIGHT=()

    # Initialize display
    printf '\033[?25l'  # Hide cursor
    printf '\033[2J'    # Clear screen
    calc_center         # Center the display
    spawn_food

    while [[ "${GAME_STATE[running]}" == "true" ]]; do
        render_frame

        # Read from keyboard or FIFO
        local key
        key=$(read_input) && [[ -n "$key" ]] && process_input "$key"

        # Game tick (only when not paused)
        if [[ "${GAME_STATE[paused]}" != "true" ]]; then
            ((GAME_STATE[tick]++))
            check_food_collision PLAYER_LEFT
            check_food_collision PLAYER_RIGHT
            check_winner
        fi
    done

    # Show winner if there is one
    if [[ -n "${GAME_STATE[winner]}" ]]; then
        render_frame
        render_winner
        sleep 2
    fi

    # Restore terminal
    cleanup_fifo
    printf '\033[?25h'  # Show cursor
    printf '\033[0m'    # Reset colors
    tput clear
    trap - EXIT

    echo "Game Over!"
    echo "Final Score: ${PLAYER_LEFT[name]}: ${PLAYER_LEFT[score]}  ${PLAYER_RIGHT[name]}: ${PLAYER_RIGHT[score]}"
}

# Export functions
export -f bug_repl

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
    bug_repl
fi
