#!/usr/bin/env bash

# traks.sh - Two-player tank game with animated treads
#
# =============================================================================
# TANK STATE MODEL
# =============================================================================
#
# Each tank has:
#   - position (x, y): screen coordinates
#   - heading: n, ne, e, se, s, sw, w, nw (direction arrow points)
#   - velocity: -3 to +3
#       * Positive = moving TOWARD where arrow points (forward)
#       * Negative = moving AWAY from where arrow points (reverse)
#       * Zero = stopped
#
# COORDINATE SYSTEM (screen coordinates):
#   - X increases rightward →
#   - Y increases downward ↓
#   - North (n) arrow ▲ points up, so dy=-1 moves tank up
#
# HEADING DELTAS (for forward motion, velocity > 0):
#   n:  dx=0,  dy=-1  (up)
#   ne: dx=1,  dy=-1  (up-right)
#   e:  dx=1,  dy=0   (right)
#   se: dx=1,  dy=1   (down-right)
#   s:  dx=0,  dy=1   (down)
#   sw: dx=-1, dy=1   (down-left)
#   w:  dx=-1, dy=0   (left)
#   nw: dx=-1, dy=-1  (up-left)
#
# =============================================================================
# INPUT MODEL
# =============================================================================
#
# KEYBOARD (incremental):
#   W/I = increase velocity (+1, toward +3)
#   S/K = decrease velocity (-1, toward -3)
#   A/J = turn left (rotate heading counterclockwise)
#   D/L = turn right (rotate heading clockwise)
#
# MIDI (absolute, via V:player:velocity commands):
#   Faders pushed away from user → positive velocity → forward
#   Faders pulled toward user → negative velocity → reverse
#   Fader differential → turn
#
# =============================================================================
# VISUAL ELEMENTS
# =============================================================================
#
#   - Arena:           The play field (60x20)
#   - Player Left:     P1 tank (WASD controls, VERBS palette - warm)
#   - Player Right:    P2 tank (IJKL controls, NOUNS palette - cool)
#   - Trail:           Fading path behind each tank (8 steps)
#   - Score Bar:       Current scores and velocity
#   - Food:            Yellow collectible diamond
#   - REPL:            4-line status area at bottom
#
# =============================================================================

# Module paths
TRAKS_SRC="${TRAKS_SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
TDS_SRC="${TDS_SRC:-$TRAKS_SRC/../tds}"

# TDS disabled for now - using built-in colors
# if [[ -f "$TDS_SRC/tds.sh" ]]; then
#     source "$TDS_SRC/tds.sh"
# fi

# ============================================================================
# GAME CONSTANTS
# ============================================================================

ARENA_WIDTH=60
ARENA_HEIGHT=20
GAME_TICK=0.08
TRAIL_LENGTH=8
DIAGONAL_SLOWDOWN=2  # multiplier for diagonal movement interval

# 8-direction headings and their deltas
# Screen coords: +X = right, +Y = down
declare -A HEADING_DX=(
    [n]=0 [ne]=1 [e]=1 [se]=1 [s]=0 [sw]=-1 [w]=-1 [nw]=-1
)
declare -A HEADING_DY=(
    [n]=-1 [ne]=-1 [e]=0 [se]=1 [s]=1 [sw]=1 [w]=0 [nw]=-1
)

# Movement direction: +1 = forward (in heading direction), -1 = backward
# If this feels inverted, flip the sign in update_position

# Turn mappings (8 positions, 45 degrees each)
declare -A TURN_LEFT=(
    [n]="nw" [nw]="w" [w]="sw" [sw]="s" [s]="se" [se]="e" [e]="ne" [ne]="n"
)
declare -A TURN_RIGHT=(
    [n]="ne" [ne]="e" [e]="se" [se]="s" [s]="sw" [sw]="w" [w]="nw" [nw]="n"
)

# Direction arrows for center of sprite (8 directions)
declare -A DIR_ARROWS=(
    [n]="▲" [ne]="◥" [e]="▶" [se]="◢" [s]="▼" [sw]="◣" [w]="◀" [nw]="◤"
)

# Track characters based on heading
declare -A TRACK_CHAR_V="┃"  # vertical track (up/down)
declare -A TRACK_CHAR_H="━"  # horizontal track (left/right)

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
# COLOR PALETTES (VERBS for P1, NOUNS for P2) - 256 color mode
# ============================================================================

# VERBS palette - warm (reds/oranges) - 256 color codes
declare -a VERBS_COLORS=(
    196   # 0 - bright red
    202   # 1 - orange-red
    208   # 2 - orange
    214   # 3 - yellow-orange
    209   # 4
    203   # 5
    167   # 6
    131   # 7 - dim red
)

# NOUNS palette - cool (purples/magentas) - 256 color codes
declare -a NOUNS_COLORS=(
    135   # 0 - bright purple
    141   # 1 - lighter purple
    147   # 2 - blue-purple
    111   # 3 - more blue
    105   # 4
    99    # 5
    93    # 6
    57    # 7 - dim purple
)

# Food color (yellow) - 256 color
FOOD_COLOR=220
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
    [cmd_mode]="false"
    [cmd_buffer]=""
)

# Log buffer (4 lines) - used for old log panel
declare -ga LOG_BUFFER=("" "" "" "")

# REPL buffer (4 lines) - status/debug area at bottom
declare -ga REPL_BUFFER=("" "" "" "")

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

# Visual elements metadata
declare -gA VISUAL_ELEMENTS=(
    [arena]="Arena|Play field|The game boundary"
    [player_left]="Player Left|P1 tank|WASD, VERBS palette"
    [player_right]="Player Right|P2 tank|IJKL, NOUNS palette"
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

# Total display size (arena + borders + padding + REPL)
DISPLAY_WIDTH=$((ARENA_WIDTH + 4))   # 2 border + 2 padding
DISPLAY_HEIGHT=$((ARENA_HEIGHT + 10)) # 2 border + score + status + 4 REPL lines
REPL_LINES=4

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

buf_color() {
    FRAME_BUFFER+=$'\033[38;5;'"$1"'m'
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

# Build 3x3 tank sprite with animated tracks (8 directions)
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

    # Determine orientation based on heading
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
            # Diagonal / - tracks at corners
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
            # Diagonal \ - tracks at corners
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
        # Center the pause text
        local pause_x=$(( (ARENA_WIDTH - 8) / 2 ))
        buf_goto $((ARENA_HEIGHT + 4)) $((3 + pause_x))
        buf_color 220
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

# Build log panel (4 lines below arena) - old toggle panel
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

# Update REPL status line (0-3)
repl_set() {
    local line=$1
    local msg="$2"
    ((line >= 0 && line < 4)) && REPL_BUFFER[$line]="$msg"
}

# Build REPL area (always visible, 4 lines at bottom)
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
    build_tank PLAYER_LEFT VERBS_COLORS
    build_tank PLAYER_RIGHT NOUNS_COLORS
    build_status
    build_repl

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
    printf '  SPEED: -3 to +3 (negative = reverse, ║═ tracks at max speed)\n'
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
    # Keep food away from edges to avoid 3x3 sprite overlap issues
    FOOD[x]=$((RANDOM % (ARENA_WIDTH - 6) + 3))
    FOOD[y]=$((RANDOM % (ARENA_HEIGHT - 6) + 3))
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

# Update position based on velocity (called each tick)
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

process_input() {
    local key="$1"

    # Command mode input
    if [[ "${GAME_STATE[cmd_mode]}" == "true" ]]; then
        case "$key" in
            $'\n'|$'\r')  # Enter - execute command
                process_cmd "${GAME_STATE[cmd_buffer]}"
                GAME_STATE[cmd_mode]="false"
                GAME_STATE[cmd_buffer]=""
                ;;
            $'\x7f'|$'\b')  # Backspace
                GAME_STATE[cmd_buffer]="${GAME_STATE[cmd_buffer]%?}"
                repl_set 3 ":${GAME_STATE[cmd_buffer]}_"
                ;;
            $'\x1b')  # Escape - cancel
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

    # Debug: show what key was pressed
    [[ -n "$key" ]] && repl_set 2 "key: '$key' (${#key} chars)"

    case "$key" in
        # Enter command mode
        :)
            GAME_STATE[cmd_mode]="true"
            GAME_STATE[cmd_buffer]=""
            repl_set 3 ":_"
            return
            ;;

        # Player 1 (WASD) - Tank controls
        w|W) adjust_velocity PLAYER_LEFT 1 ;;              # Speed up
        s|S) adjust_velocity PLAYER_LEFT -1 ;;             # Slow down
        a|A) turn_player PLAYER_LEFT "left" ;;             # Turn left
        d|D) turn_player PLAYER_LEFT "right" ;;            # Turn right

        # Player 2 (IJKL) - Tank controls
        i|I) adjust_velocity PLAYER_RIGHT 1 ;;             # Speed up
        k|K) adjust_velocity PLAYER_RIGHT -1 ;;            # Slow down
        j|J) turn_player PLAYER_RIGHT "left" ;;            # Turn left
        l|L) turn_player PLAYER_RIGHT "right" ;;           # Turn right

        # MIDI velocity commands (V:player:velocity format)
        V:1:*)
            set_velocity PLAYER_LEFT "${key##*:}"
            ;;
        V:2:*)
            set_velocity PLAYER_RIGHT "${key##*:}"
            ;;

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
# INPUT SYSTEM - Keyboard + optional FIFO (both can work together)
# ============================================================================

TRAKS_FIFO="${TRAKS_FIFO:-/tmp/traks_input}"
TRAKS_USE_FIFO="${TRAKS_USE_FIFO:-false}"
SAVED_STTY=""

# Setup input - always enable keyboard, optionally add FIFO
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

# Cleanup input
cleanup_input() {
    # Restore keyboard
    [[ -n "$SAVED_STTY" ]] && stty "$SAVED_STTY"

    # Close FIFO
    if [[ "$TRAKS_USE_FIFO" == "true" ]]; then
        exec 3<&- 2>/dev/null
    fi
}

# Read from either keyboard or FIFO
INPUT_KEY=""
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

    # No input - sleep for frame timing
    sleep "$GAME_TICK"
    return 1
}

# ============================================================================
# MAIN GAME LOOP
# ============================================================================

traks_repl() {
    # Setup input
    setup_input

    # Signal handlers
    trap 'GAME_STATE[running]="false"' SIGUSR1   # Quit
    trap 'GAME_STATE[paused]="true"' SIGUSR2     # Pause
    trap 'GAME_STATE[paused]="false"' SIGCONT    # Resume

    # Cleanup on exit
    trap 'cleanup_input; printf "\033[?25h\033[0m"; tput clear' EXIT

    # Reset state for fresh game
    GAME_STATE[running]="true"
    GAME_STATE[paused]="false"
    GAME_STATE[winner]=""
    GAME_STATE[tick]="0"
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

    # Initialize display
    printf '\033[?25l'  # Hide cursor
    printf '\033[2J'    # Clear screen
    calc_center         # Center the display
    spawn_food

    while [[ "${GAME_STATE[running]}" == "true" ]]; do
        # Update REPL status (only lines 0-1, leave 2-3 for commands/debug)
        repl_set 0 "P1: pos(${PLAYER_LEFT[x]},${PLAYER_LEFT[y]}) hdg=${PLAYER_LEFT[heading]} vel=${PLAYER_LEFT[velocity]}"
        repl_set 1 "P2: pos(${PLAYER_RIGHT[x]},${PLAYER_RIGHT[y]}) hdg=${PLAYER_RIGHT[heading]} vel=${PLAYER_RIGHT[velocity]}"

        render_frame

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

    # Show winner if there is one
    if [[ -n "${GAME_STATE[winner]}" ]]; then
        render_frame
        render_winner
        sleep 2
    fi

    # Restore terminal
    cleanup_input
    printf '\033[?25h'  # Show cursor
    printf '\033[0m'    # Reset colors
    tput clear
    trap - EXIT

    echo "Game Over!"
    echo "Final Score: ${PLAYER_LEFT[name]}: ${PLAYER_LEFT[score]}  ${PLAYER_RIGHT[name]}: ${PLAYER_RIGHT[score]}"
}

# Export functions
export -f traks_repl

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
    traks_repl
fi
