#!/usr/bin/env bash

# traks_config.sh - Shared constants and configuration
#
# Source this first. All other traks modules depend on it.

# Module paths
TRAKS_SRC="${TRAKS_SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
TDS_SRC="${TDS_SRC:-$TRAKS_SRC/../tds}"

# ============================================================================
# GAME CONSTANTS
# ============================================================================

ARENA_WIDTH=60
ARENA_HEIGHT=20
GAME_TICK=0.08
TRAIL_LENGTH=8
DIAGONAL_SLOWDOWN=2  # multiplier for diagonal movement interval

# Input config
TRAKS_FIFO="${TRAKS_FIFO:-/tmp/traks_input}"
TRAKS_USE_FIFO="${TRAKS_USE_FIFO:-false}"

# MIDI config (shared with JS)
MIDI_DEADZONE=20
MIDI_CENTER=64
MIDI_TICK_RATE=150
MIDI_TURN_THRESHOLD=2

# CC assignments (shared with JS)
P1_LEFT_CC="${P1_LEFT:-40}"
P1_RIGHT_CC="${P1_RIGHT:-41}"
P2_LEFT_CC="${P2_LEFT:-46}"
P2_RIGHT_CC="${P2_RIGHT:-47}"

# OSC config
OSC_MULTICAST="${TRAKS_OSC_MULTICAST:-239.1.1.1}"
OSC_PORT="${TRAKS_OSC_PORT:-1983}"

# ============================================================================
# 8-DIRECTION HEADINGS
# ============================================================================

# Heading deltas (screen coords: +X=right, +Y=down)
declare -gA HEADING_DX=(
    [n]=0 [ne]=1 [e]=1 [se]=1 [s]=0 [sw]=-1 [w]=-1 [nw]=-1
)
declare -gA HEADING_DY=(
    [n]=-1 [ne]=-1 [e]=0 [se]=1 [s]=1 [sw]=1 [w]=0 [nw]=-1
)

# Turn mappings (8 positions, 45 degrees each)
declare -gA TURN_LEFT=(
    [n]="nw" [nw]="w" [w]="sw" [sw]="s" [s]="se" [se]="e" [e]="ne" [ne]="n"
)
declare -gA TURN_RIGHT=(
    [n]="ne" [ne]="e" [e]="se" [se]="s" [s]="sw" [sw]="w" [w]="nw" [nw]="n"
)

# Direction arrows (8 directions)
declare -gA DIR_ARROWS=(
    [n]="▲" [ne]="◥" [e]="▶" [se]="◢" [s]="▼" [sw]="◣" [w]="◀" [nw]="◤"
)

# Wall characters
declare -gA WALLS=(
    [h]="─"
    [v]="│"
    [tl]="┌"
    [tr]="┐"
    [bl]="└"
    [br]="┘"
)

# Trail character
TRAIL_CHAR="·"

# ============================================================================
# COLOR PALETTES (256 color mode)
# ============================================================================

# VERBS palette - warm (reds/oranges) for P1
declare -ga VERBS_COLORS=(
    196   # 0 - bright red
    202   # 1 - orange-red
    208   # 2 - orange
    214   # 3 - yellow-orange
    209   # 4
    203   # 5
    167   # 6
    131   # 7 - dim red
)

# NOUNS palette - cool (purples/magentas) for P2
declare -ga NOUNS_COLORS=(
    135   # 0 - bright purple
    141   # 1 - lighter purple
    147   # 2 - blue-purple
    111   # 3 - more blue
    105   # 4
    99    # 5
    93    # 6
    57    # 7 - dim purple
)

# Food color
FOOD_COLOR=220
FOOD_CHAR="◆"

# ============================================================================
# 3D VIEW CONFIG
# ============================================================================

# View modes: 2d, cockpit, iso
declare -g VIEW_MODE="2d"
declare -ga VIEW_MODES=("2d" "cockpit" "iso")

# Active player for POV (1 or 2)
declare -g ACTIVE_PLAYER=1

# Depth shading characters (near to far)
declare -ga DEPTH_CHARS=("█" "▓" "▒" "░" " ")

# 3D rendering constants
HORIZON_Y=8          # Screen row for horizon line
GROUND_COLOR=240     # Dark gray for ground
SKY_COLOR=17         # Dark blue for sky
COCKPIT_HEIGHT=2     # How high cockpit floats above wings

# ============================================================================
# DISPLAY
# ============================================================================

DISPLAY_WIDTH=$((ARENA_WIDTH + 4))   # 2 border + 2 padding
DISPLAY_HEIGHT=$((ARENA_HEIGHT + 10)) # 2 border + score + status + 4 REPL lines
REPL_LINES=4

# Screen centering offsets (set by calc_center)
declare -g OFFSET_X=0
declare -g OFFSET_Y=0

# ANSI codes
RST=$'\033[0m'
