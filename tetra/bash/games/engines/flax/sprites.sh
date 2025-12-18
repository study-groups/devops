#!/usr/bin/env bash

# Flax Engine - Sprite System
# Manages visual elements as compositable sprites

# =============================================================================
# SPRITE STORAGE
# =============================================================================

# Sprite registry: id -> "x,y,w,h,z,visible,color"
declare -gA FLAX_SPRITES=()

# Sprite content: id -> array of lines
declare -gA FLAX_SPRITE_CONTENT=()

# Next sprite ID
declare -gi FLAX_SPRITE_ID=0

# =============================================================================
# SPRITE CREATION
# =============================================================================

# Create a sprite, returns sprite ID
# Usage: id=$(flax_sprite_create x y [z] [color])
flax_sprite_create() {
    local x=${1:-1} y=${2:-1} z=${3:-0} color=${4:-0}
    local id=$((++FLAX_SPRITE_ID))

    FLAX_SPRITES[$id]="$x,$y,0,0,$z,1,$color"
    FLAX_SPRITE_CONTENT[$id]=""

    echo "$id"
}

# Create sprite from text (single line)
# Usage: id=$(flax_sprite_text x y "text" [z] [color])
flax_sprite_text() {
    local x=$1 y=$2 text=$3 z=${4:-0} color=${5:-0}
    local id=$((++FLAX_SPRITE_ID))
    local w=${#text}

    FLAX_SPRITES[$id]="$x,$y,$w,1,$z,1,$color"
    FLAX_SPRITE_CONTENT[$id]="$text"

    echo "$id"
}

# Create sprite from multiline content
# Usage: id=$(flax_sprite_box x y width height [z] [color])
flax_sprite_box() {
    local x=$1 y=$2 w=$3 h=$4 z=${5:-0} color=${6:-0}
    local id=$((++FLAX_SPRITE_ID))

    FLAX_SPRITES[$id]="$x,$y,$w,$h,$z,1,$color"
    FLAX_SPRITE_CONTENT[$id]=""

    echo "$id"
}

# =============================================================================
# SPRITE CONTENT
# =============================================================================

# Set sprite content (newline-separated lines)
# Usage: flax_sprite_set_content id "line1\nline2\nline3"
flax_sprite_set_content() {
    local id=$1 content=$2
    FLAX_SPRITE_CONTENT[$id]="$content"

    # Update dimensions
    local -a lines
    IFS=$'\n' read -ra lines <<< "$content"
    local h=${#lines[@]}
    local w=0
    for line in "${lines[@]}"; do
        ((${#line} > w)) && w=${#line}
    done

    # Update sprite metadata
    local data="${FLAX_SPRITES[$id]}"
    IFS=',' read -r x y _ _ z vis col <<< "$data"
    FLAX_SPRITES[$id]="$x,$y,$w,$h,$z,$vis,$col"
}

# Set single line of sprite content
# Usage: flax_sprite_set_line id line_num "content"
flax_sprite_set_line() {
    local id=$1 line_num=$2 content=$3
    local -a lines
    IFS=$'\n' read -ra lines <<< "${FLAX_SPRITE_CONTENT[$id]}"
    lines[$line_num]="$content"
    FLAX_SPRITE_CONTENT[$id]=$(IFS=$'\n'; echo "${lines[*]}")
}

# =============================================================================
# SPRITE PROPERTIES
# =============================================================================

# Move sprite to position
flax_sprite_move() {
    local id=$1 x=$2 y=$3
    local data="${FLAX_SPRITES[$id]}"
    IFS=',' read -r _ _ w h z vis col <<< "$data"
    FLAX_SPRITES[$id]="$x,$y,$w,$h,$z,$vis,$col"
}

# Set sprite z-order
flax_sprite_z() {
    local id=$1 z=$2
    local data="${FLAX_SPRITES[$id]}"
    IFS=',' read -r x y w h _ vis col <<< "$data"
    FLAX_SPRITES[$id]="$x,$y,$w,$h,$z,$vis,$col"
}

# Show/hide sprite
flax_sprite_show() {
    local id=$1
    local data="${FLAX_SPRITES[$id]}"
    IFS=',' read -r x y w h z _ col <<< "$data"
    FLAX_SPRITES[$id]="$x,$y,$w,$h,$z,1,$col"
}

flax_sprite_hide() {
    local id=$1
    local data="${FLAX_SPRITES[$id]}"
    IFS=',' read -r x y w h z _ col <<< "$data"
    FLAX_SPRITES[$id]="$x,$y,$w,$h,$z,0,$col"
}

# Set sprite color
flax_sprite_color() {
    local id=$1 color=$2
    local data="${FLAX_SPRITES[$id]}"
    IFS=',' read -r x y w h z vis _ <<< "$data"
    FLAX_SPRITES[$id]="$x,$y,$w,$h,$z,$vis,$color"
}

# Get sprite info
flax_sprite_get() {
    local id=$1 field=$2
    local data="${FLAX_SPRITES[$id]}"
    IFS=',' read -r x y w h z vis col <<< "$data"

    case "$field" in
        x) echo "$x" ;;
        y) echo "$y" ;;
        w|width) echo "$w" ;;
        h|height) echo "$h" ;;
        z) echo "$z" ;;
        visible) echo "$vis" ;;
        color) echo "$col" ;;
        *) echo "$data" ;;
    esac
}

# Delete sprite
flax_sprite_delete() {
    local id=$1
    unset "FLAX_SPRITES[$id]"
    unset "FLAX_SPRITE_CONTENT[$id]"
}

# Clear all sprites
flax_sprites_clear() {
    FLAX_SPRITES=()
    FLAX_SPRITE_CONTENT=()
    FLAX_SPRITE_ID=0
}

# =============================================================================
# COMPOSITING
# =============================================================================

# Render all sprites to buffer (sorted by z-order)
flax_sprites_render() {
    # Build sorted list of sprite IDs by z-order
    local -a sorted=()
    local id data z

    for id in "${!FLAX_SPRITES[@]}"; do
        data="${FLAX_SPRITES[$id]}"
        IFS=',' read -r _ _ _ _ z vis _ <<< "$data"
        ((vis)) && sorted+=("$z:$id")
    done

    # Sort by z (simple bubble sort for small counts)
    local i j temp n=${#sorted[@]}
    for ((i=0; i<n-1; i++)); do
        for ((j=0; j<n-i-1; j++)); do
            local z1=${sorted[j]%%:*}
            local z2=${sorted[j+1]%%:*}
            if ((z1 > z2)); then
                temp="${sorted[j]}"
                sorted[j]="${sorted[j+1]}"
                sorted[j+1]="$temp"
            fi
        done
    done

    # Render each sprite
    for entry in "${sorted[@]}"; do
        id=${entry#*:}
        flax_sprite_render_one "$id"
    done
}

# Render single sprite
flax_sprite_render_one() {
    local id=$1
    local data="${FLAX_SPRITES[$id]}"
    [[ -z "$data" ]] && return

    IFS=',' read -r x y w h z vis col <<< "$data"
    ((! vis)) && return

    local content="${FLAX_SPRITE_CONTENT[$id]}"
    [[ -z "$content" ]] && return

    # Set color if specified
    ((col > 0)) && flax_color "$col"

    # Render each line
    local -a lines
    IFS=$'\n' read -ra lines <<< "$content"
    local row=0
    for line in "${lines[@]}"; do
        flax_goto "$((y + row))" "$x"
        flax_add "$line"
        ((row++))
    done

    ((col > 0)) && flax_reset
}

# =============================================================================
# DEBUG
# =============================================================================

# List all sprites (for debugging)
flax_sprites_list() {
    echo "Sprites (${#FLAX_SPRITES[@]} total):"
    local id data
    for id in "${!FLAX_SPRITES[@]}"; do
        data="${FLAX_SPRITES[$id]}"
        IFS=',' read -r x y w h z vis col <<< "$data"
        local preview="${FLAX_SPRITE_CONTENT[$id]:0:20}"
        echo "  [$id] pos:($x,$y) size:${w}x${h} z:$z vis:$vis col:$col \"$preview...\""
    done
}

# Get sprite count
flax_sprites_count() {
    echo "${#FLAX_SPRITES[@]}"
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f flax_sprite_create flax_sprite_text flax_sprite_box
export -f flax_sprite_set_content flax_sprite_set_line
export -f flax_sprite_move flax_sprite_z flax_sprite_show flax_sprite_hide
export -f flax_sprite_color flax_sprite_get flax_sprite_delete
export -f flax_sprites_clear flax_sprites_render flax_sprite_render_one
export -f flax_sprites_list flax_sprites_count
