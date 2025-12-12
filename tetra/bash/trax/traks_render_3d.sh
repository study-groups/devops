#!/usr/bin/env bash

# traks_render_3d.sh - 3D view rendering
#
# Requires: traks_config.sh, traks_core.sh, traks_render.sh (for buf_* functions)
#
# View modes:
#   - chase: Camera behind active player, looking at opponent
#   - cockpit: First-person from active player, opponent has "wings"
#   - spectator: Isometric overhead view of whole arena

# ============================================================================
# 3D TANK MODEL (3x3x3 Tensor)
# ============================================================================
#
# Tank occupies a 3x3x3 volume in world space:
#   X: left(-1) to right(+1)
#   Y: back(-1) to front(+1)
#   Z: bottom(0) to top(2) - cockpit floats at z=2
#
# Model points (local coords relative to tank center):
#   Treads (z=0):  (-1,-1,0) (-1,0,0) (-1,1,0)  and  (1,-1,0) (1,0,0) (1,1,0)
#   Body (z=1):    (0,0,1) center mass
#   Cockpit (z=2): (0,0,2) top

# Tank model vertices (x,y,z offsets from center)
# Format: "x,y,z,char" where char is what to render
declare -ga TANK_MODEL_TREADS=(
    "-1,-1,0,┃"  "-1,0,0,┃"  "-1,1,0,┃"   # Left tread
    "1,-1,0,┃"   "1,0,0,┃"   "1,1,0,┃"    # Right tread
)
declare -ga TANK_MODEL_BODY=(
    "0,0,1,█"    # Center body
)
declare -ga TANK_MODEL_COCKPIT=(
    "0,0,2,▲"    # Cockpit (arrow shows heading)
)

# ============================================================================
# PROJECTION MATH
# ============================================================================

# Scale factor based on distance - closer = bigger
# Returns scale multiplier (1-30, where 30 = fills screen)
calc_scale() {
    local dist=$1
    local scale

    if ((dist <= 0)); then
        scale=30
    elif ((dist < 10)); then
        scale=25
    elif ((dist < 25)); then
        scale=20
    elif ((dist < 50)); then
        scale=15
    elif ((dist < 100)); then
        scale=10
    elif ((dist < 200)); then
        scale=7
    elif ((dist < 400)); then
        scale=5
    elif ((dist < 800)); then
        scale=3
    elif ((dist < 1500)); then
        scale=2
    else
        scale=1
    fi
    echo "$scale"
}

# Get depth character based on distance
depth_char() {
    local dist=$1
    local idx
    if ((dist < 100)); then
        idx=0  # █ very close
    elif ((dist < 400)); then
        idx=1  # ▓ close
    elif ((dist < 900)); then
        idx=2  # ▒ medium
    elif ((dist < 1600)); then
        idx=3  # ░ far
    else
        idx=4  # space, very far
    fi
    echo "${DEPTH_CHARS[$idx]}"
}

# Dim a color based on distance (returns palette index offset)
depth_color_offset() {
    local dist=$1
    if ((dist < 200)); then
        echo 0
    elif ((dist < 600)); then
        echo 2
    elif ((dist < 1200)); then
        echo 4
    else
        echo 6
    fi
}

# ============================================================================
# ISOMETRIC PROJECTION (Spectator View)
# ============================================================================

# Convert world coords to isometric screen coords
# Returns: sets PROJ_X and PROJ_Y globals
project_isometric() {
    local wx=$1 wy=$2 wz=${3:-0}

    # Isometric: x' = x - y, y' = (x + y) / 2 - z
    PROJ_X=$((wx - wy + ARENA_WIDTH / 2 + 10))
    PROJ_Y=$(((wx + wy) / 2 - wz + 5))
}

# ============================================================================
# CHASE CAM PROJECTION
# ============================================================================

# Project from behind active player toward opponent
project_chase() {
    local wx=$1 wy=$2 wz=${3:-0}
    local -n me=$4      # Active player
    local -n them=$5    # Opponent

    local my_x=${me[x]} my_y=${me[y]}
    local their_x=${them[x]} their_y=${them[y]}

    # Vector from me to target point
    local dx=$((wx - my_x))
    local dy=$((wy - my_y))

    # Distance (for scaling)
    local dist_sq=$((dx * dx + dy * dy))
    ((dist_sq < 1)) && dist_sq=1

    # Simple perspective: divide by distance, scale to screen
    # Center of screen, scaled by distance
    local scale=$((400 / (dist_sq / 10 + 1)))
    ((scale < 1)) && scale=1
    ((scale > 30)) && scale=30

    PROJ_X=$((ARENA_WIDTH / 2 + dx * scale / 10))
    PROJ_Y=$((HORIZON_Y + dy * scale / 20 - wz * scale / 15))

    # Return distance for depth shading
    PROJ_DIST=$dist_sq
}

# ============================================================================
# COCKPIT PROJECTION (First Person)
# ============================================================================

project_cockpit() {
    local wx=$1 wy=$2 wz=${3:-0}
    local -n me=$4

    local my_x=${me[x]} my_y=${me[y]}
    local my_hdg=${me[heading]}

    # Vector from me to point
    local dx=$((wx - my_x))
    local dy=$((wy - my_y))

    # Rotate based on heading (simplified - just 8 directions)
    local rdx rdy
    case "$my_hdg" in
        n)  rdx=$dx;       rdy=$dy ;;
        ne) rdx=$((dx+dy)); rdy=$((dy-dx)) ;;
        e)  rdx=$dy;       rdy=$((-dx)) ;;
        se) rdx=$((dy-dx)); rdy=$((-dx-dy)) ;;
        s)  rdx=$((-dx));  rdy=$((-dy)) ;;
        sw) rdx=$((-dx-dy)); rdy=$((dx-dy)) ;;
        w)  rdx=$((-dy));  rdy=$dx ;;
        nw) rdx=$((dx-dy)); rdy=$((dx+dy)) ;;
    esac

    # Forward distance
    local forward=$rdy
    ((forward < 1)) && forward=1

    # Perspective projection
    local scale=$((200 / forward))
    ((scale < 1)) && scale=1
    ((scale > 40)) && scale=40

    PROJ_X=$((ARENA_WIDTH / 2 + rdx * scale / 5))
    PROJ_Y=$((HORIZON_Y - wz * scale / 10 + 2))

    PROJ_DIST=$((rdx * rdx + rdy * rdy))
    PROJ_FORWARD=$forward
}

# ============================================================================
# 3D BUILD FUNCTIONS
# ============================================================================

build_horizon() {
    local y=$((HORIZON_Y + 2))

    # Sky (above horizon)
    buf_color "$SKY_COLOR"
    for ((row=1; row<y; row++)); do
        buf_goto "$row" 1
        printf -v line '%*s' "$ARENA_WIDTH" ''
        buf "$line"
    done

    # Horizon line
    buf_goto "$y" 1
    buf_color 250
    for ((i=0; i<ARENA_WIDTH; i++)); do
        buf "─"
    done

    # Ground (below horizon)
    buf_color "$GROUND_COLOR"
    for ((row=y+1; row<=ARENA_HEIGHT; row++)); do
        buf_goto "$row" 1
        printf -v line '%*s' "$ARENA_WIDTH" ''
        buf "$line"
    done
    buf_reset
}

build_tank_3d_chase() {
    local -n player=$1
    local -n colors=$2
    local -n viewer=$3

    local px=${player[x]} py=${player[y]}
    local vx=${viewer[x]} vy=${viewer[y]}

    # Calculate distance
    local dx=$((px - vx)) dy=$((py - vy))
    local dist=$((dx * dx + dy * dy))

    # Get scale factor
    local scale
    scale=$(calc_scale "$dist")

    # Project tank position
    project_chase "$px" "$py" 0 viewer player

    local sx=$PROJ_X sy=$PROJ_Y

    local dchar
    dchar=$(depth_char "$dist")
    local coffset
    coffset=$(depth_color_offset "$dist")

    # Tank dimensions based on scale
    local tank_width=$((scale + 2))
    local tank_height=$((scale / 2 + 1))
    ((tank_width < 3)) && tank_width=3
    ((tank_height < 2)) && tank_height=2

    # Position on screen (centered, lower half)
    local center_x=$((ARENA_WIDTH / 2))
    local center_y=$((HORIZON_Y + 5 - scale / 4))
    ((center_y < HORIZON_Y + 2)) && center_y=$((HORIZON_Y + 2))
    ((center_y > ARENA_HEIGHT - 3)) && center_y=$((ARENA_HEIGHT - 3))

    buf_color "${colors[$coffset]}"

    if ((scale >= 10)); then
        # Large - full 3D tank shape
        local half_w=$((tank_width / 2))

        # Cockpit (top)
        local cockpit_y=$((center_y - tank_height))
        ((cockpit_y >= 2)) && {
            buf_color "${colors[0]}"
            buf_goto "$cockpit_y" "$center_x"
            buf "${DIR_ARROWS[${player[heading]}]}"
        }

        # Wings (middle)
        buf_color "${colors[$coffset]}"
        buf_goto "$((center_y - 1))" "$((center_x - half_w))"
        for ((i=0; i<tank_width; i++)); do
            buf "$dchar"
        done

        # Body
        buf_goto "$center_y" "$((center_x - half_w))"
        for ((i=0; i<tank_width; i++)); do
            buf "$dchar"
        done

        # Treads
        buf_goto "$((center_y + 1))" "$((center_x - half_w))"
        buf "┃"
        buf_goto "$((center_y + 1))" "$((center_x + half_w - 1))"
        buf "┃"

    elif ((scale >= 5)); then
        # Medium tank
        buf_color "${colors[0]}"
        buf_goto "$((center_y - 1))" "$center_x"
        buf "${DIR_ARROWS[${player[heading]}]}"

        buf_color "${colors[$coffset]}"
        buf_goto "$center_y" "$((center_x - 2))"
        buf "$dchar$dchar$dchar$dchar$dchar"

        buf_goto "$((center_y + 1))" "$((center_x - 2))"
        buf "┃   ┃"

    elif ((scale >= 2)); then
        # Small tank
        buf_goto "$center_y" "$center_x"
        buf_color "${colors[0]}"
        buf "${DIR_ARROWS[${player[heading]}]}"
        buf_color "${colors[$coffset]}"
        buf_goto "$((center_y + 1))" "$((center_x - 1))"
        buf "─$dchar─"
    else
        # Tiny - just a dot
        buf_goto "$center_y" "$center_x"
        buf "$dchar"
    fi

    buf_reset
}

build_tank_3d_cockpit() {
    local -n player=$1
    local -n colors=$2
    local -n viewer=$3

    local px=${player[x]} py=${player[y]}

    # Calculate distance to opponent
    local vx=${viewer[x]} vy=${viewer[y]}
    local dx=$((px - vx)) dy=$((py - vy))
    local dist=$((dx * dx + dy * dy))

    # Get scale factor (1-30, closer = bigger)
    local scale
    scale=$(calc_scale "$dist")

    # Skip if behind us
    project_cockpit "$px" "$py" 0 viewer
    ((PROJ_FORWARD < 3)) && return

    local dchar
    dchar=$(depth_char "$dist")
    local coffset
    coffset=$(depth_color_offset "$dist")

    # === TANK MODEL (front view) ===
    #
    #        ▲        <- cockpit
    #     ╔═════╗     <- hull top
    #   ┃ ║█████║ ┃   <- treads + hull
    #   ┃ ╚═════╝ ┃   <- hull bottom

    local center_x=$((ARENA_WIDTH / 2))
    local center_y=$((HORIZON_Y + 4))

    # Scale dimensions proportionally
    local hull_width=$((scale + 2))
    local hull_height=$((scale / 2 + 2))
    local tread_width=$((scale / 4 + 1))
    local cockpit_size=$((scale / 5 + 1))

    # Clamp
    ((hull_width > 30)) && hull_width=30
    ((hull_height > 10)) && hull_height=10
    ((tread_width > 4)) && tread_width=4

    local hull_left=$((center_x - hull_width / 2))
    local hull_right=$((center_x + hull_width / 2))
    local tread_left=$((hull_left - tread_width - 1))
    local tread_right=$((hull_right + 2))

    ((tread_left < 2)) && tread_left=2
    ((tread_right + tread_width > ARENA_WIDTH - 2)) && tread_right=$((ARENA_WIDTH - 2 - tread_width))

    local hull_top=$((center_y - hull_height / 2))
    local hull_bot=$((center_y + hull_height / 2))

    ((hull_top < 3)) && hull_top=3
    ((hull_bot > ARENA_HEIGHT - 2)) && hull_bot=$((ARENA_HEIGHT - 2))

    # === HULL ===
    buf_color "${colors[$coffset]}"

    # Top edge
    buf_goto "$hull_top" "$hull_left"
    buf "╔"
    for ((i=hull_left+1; i<hull_right; i++)); do buf "═"; done
    buf "╗"

    # Sides + fill
    for ((row=hull_top+1; row<hull_bot; row++)); do
        buf_goto "$row" "$hull_left"
        buf "║"
        for ((i=hull_left+1; i<hull_right; i++)); do buf "$dchar"; done
        buf "║"
    done

    # Bottom edge
    buf_goto "$hull_bot" "$hull_left"
    buf "╚"
    for ((i=hull_left+1; i<hull_right; i++)); do buf "═"; done
    buf "╝"

    # === TREADS ===
    buf_color 245

    # Left tread
    for ((row=hull_top; row<=hull_bot; row++)); do
        buf_goto "$row" "$tread_left"
        for ((i=0; i<tread_width; i++)); do buf "┃"; done
    done

    # Right tread
    for ((row=hull_top; row<=hull_bot; row++)); do
        buf_goto "$row" "$tread_right"
        for ((i=0; i<tread_width; i++)); do buf "┃"; done
    done

    # === COCKPIT ===
    local cockpit_y=$((hull_top - 2))
    ((cockpit_y < 2)) && cockpit_y=2

    buf_color "${colors[0]}"
    if ((cockpit_size <= 1)); then
        buf_goto "$cockpit_y" "$center_x"
        buf "${DIR_ARROWS[${player[heading]}]}"
    elif ((cockpit_size <= 3)); then
        buf_goto "$cockpit_y" "$((center_x - 1))"
        buf "╱${DIR_ARROWS[${player[heading]}]}╲"
    else
        buf_goto "$((cockpit_y - 1))" "$center_x"
        buf "${DIR_ARROWS[${player[heading]}]}"
        buf_goto "$cockpit_y" "$((center_x - 2))"
        buf "╱───╲"
    fi

    buf_reset
}

build_arena_3d_iso() {
    # Draw isometric floor grid
    local x y

    buf_color "$GROUND_COLOR"

    # Horizontal grid lines
    for ((y=0; y<=ARENA_HEIGHT; y+=5)); do
        for ((x=0; x<=ARENA_WIDTH; x+=2)); do
            project_isometric "$x" "$y" 0
            ((PROJ_X > 0 && PROJ_X < ARENA_WIDTH && PROJ_Y > 0 && PROJ_Y < ARENA_HEIGHT)) && {
                buf_goto "$PROJ_Y" "$PROJ_X"
                buf "·"
            }
        done
    done

    # Vertical grid lines
    for ((x=0; x<=ARENA_WIDTH; x+=10)); do
        for ((y=0; y<=ARENA_HEIGHT; y+=2)); do
            project_isometric "$x" "$y" 0
            ((PROJ_X > 0 && PROJ_X < ARENA_WIDTH && PROJ_Y > 0 && PROJ_Y < ARENA_HEIGHT)) && {
                buf_goto "$PROJ_Y" "$PROJ_X"
                buf "·"
            }
        done
    done

    buf_reset
}

build_tank_3d_iso() {
    local -n player=$1
    local -n colors=$2

    local px=${player[x]} py=${player[y]}

    project_isometric "$px" "$py" 0
    local sx=$PROJ_X sy=$PROJ_Y

    # Shadow on ground
    buf_color "$GROUND_COLOR"
    buf_goto "$((sy + 1))" "$((sx - 1))"
    buf "░░░"

    # Tank body (raised)
    project_isometric "$px" "$py" 2
    sx=$PROJ_X
    sy=$PROJ_Y

    buf_color "${colors[0]}"
    buf_goto "$((sy - 1))" "$((sx - 1))"
    buf "┌─┐"
    buf_goto "$sy" "$((sx - 1))"
    buf "│${DIR_ARROWS[${player[heading]}]}│"
    buf_goto "$((sy + 1))" "$((sx - 1))"
    buf "└─┘"

    buf_reset
}

build_food_3d() {
    [[ "${FOOD[active]}" != "true" ]] && return

    local fx=${FOOD[x]} fy=${FOOD[y]}

    case "$VIEW_MODE" in
        iso)
            project_isometric "$fx" "$fy" 1
            ;;
        cockpit)
            if ((ACTIVE_PLAYER == 1)); then
                project_cockpit "$fx" "$fy" 1 PLAYER_LEFT
            else
                project_cockpit "$fx" "$fy" 1 PLAYER_RIGHT
            fi
            ;;
    esac

    ((PROJ_X > 0 && PROJ_X < ARENA_WIDTH && PROJ_Y > 0 && PROJ_Y < ARENA_HEIGHT)) && {
        buf_goto "$PROJ_Y" "$PROJ_X"
        buf_color "$FOOD_COLOR"
        buf "$FOOD_CHAR"
        buf_reset
    }
}

build_hud() {
    # Show current view mode and active player
    buf_goto 1 2
    buf_color 250
    buf "[$VIEW_MODE] "

    if [[ "$VIEW_MODE" != "spectator" ]]; then
        if ((ACTIVE_PLAYER == 1)); then
            buf_color "${VERBS_COLORS[0]}"
            buf "P1 POV"
        else
            buf_color "${NOUNS_COLORS[0]}"
            buf "P2 POV"
        fi
    fi

    # Scores on right
    local score_text="P1:${PLAYER_LEFT[score]} P2:${PLAYER_RIGHT[score]}"
    buf_goto 1 $((ARENA_WIDTH - ${#score_text}))
    buf_color "${VERBS_COLORS[0]}"
    buf "P1:${PLAYER_LEFT[score]} "
    buf_color "${NOUNS_COLORS[0]}"
    buf "P2:${PLAYER_RIGHT[score]}"

    buf_reset
}

# ============================================================================
# MAIN 3D RENDER
# ============================================================================

render_frame_3d() {
    FRAME_BUFFER=""
    FRAME_BUFFER+=$'\033[?25l'  # Hide cursor
    FRAME_BUFFER+=$'\033[2J'    # Clear screen

    case "$VIEW_MODE" in
        iso)
            # Isometric overhead view
            build_arena_3d_iso
            build_tank_3d_iso PLAYER_LEFT VERBS_COLORS
            build_tank_3d_iso PLAYER_RIGHT NOUNS_COLORS
            build_food_3d
            ;;

        cockpit)
            build_horizon

            # Render opponent with wings from first-person view
            if ((ACTIVE_PLAYER == 1)); then
                build_tank_3d_cockpit PLAYER_RIGHT NOUNS_COLORS PLAYER_LEFT
            else
                build_tank_3d_cockpit PLAYER_LEFT VERBS_COLORS PLAYER_RIGHT
            fi
            build_food_3d
            ;;
    esac

    build_hud
    build_repl

    printf '%b' "$FRAME_BUFFER"
}
