#!/usr/bin/env bash
# Palette Management System
# Load and apply color palettes from TOML files

[[ -n "${_GAME_PALETTE_LOADED}" ]] && return 0
_GAME_PALETTE_LOADED=1

# Global palette storage
declare -g -A GAME_PALETTE_COLORS      # [index] = hex
declare -g -A GAME_PALETTE_NAMES       # [index] = name
declare -g -A GAME_PALETTE_SEMANTIC    # [name] = index
declare -g -A GAME_PALETTE_GRADIENTS   # [gradient_name] = "i1 i2 i3 i4"
declare -g GAME_CURRENT_PALETTE="default"

# Load palette from TOML file
# Usage: game_palette_load "neon"
game_palette_load() {
    local palette_name="$1"

    # Determine GAME_SRC if not set
    local base_dir="${GAME_SRC:-$TETRA_SRC/bash/game}"
    local palette_file="$base_dir/assets/palettes/${palette_name}.toml"

    if [[ ! -f "$palette_file" ]]; then
        echo "Error: Palette not found: $palette_name (looked in $palette_file)" >&2
        return 1
    fi

    # Parse TOML file (simple parser for our specific format)
    local in_color_section=0
    local current_index=""
    local current_name=""
    local current_hex=""

    while IFS= read -r line; do
        # Detect color section
        if [[ "$line" == "[[colors]]" ]]; then
            # Save previous color
            if [[ -n "$current_index" && -n "$current_hex" ]]; then
                GAME_PALETTE_COLORS[$current_index]="$current_hex"
                GAME_PALETTE_NAMES[$current_index]="$current_name"
            fi

            current_index=""
            current_name=""
            current_hex=""
            in_color_section=1
            continue
        fi

        # Exit color section
        if [[ "$in_color_section" == 1 ]]; then
            if [[ "$line" =~ ^index\ *=\ *([0-9]+) ]]; then
                current_index="${BASH_REMATCH[1]}"
            elif [[ "$line" =~ ^name\ *=\ *\"([^\"]+)\" ]]; then
                current_name="${BASH_REMATCH[1]}"
            elif [[ "$line" =~ ^hex\ *=\ *\"([0-9A-Fa-f]{6})\" ]]; then
                current_hex="${BASH_REMATCH[1]}"
            elif [[ "$line" =~ ^\[ ]]; then
                in_color_section=0
            fi
        fi

        # Parse semantic mappings
        if [[ "$line" =~ ^([a-z_]+)\ *=\ *([0-9]+) ]]; then
            local sem_name="${BASH_REMATCH[1]}"
            local sem_index="${BASH_REMATCH[2]}"
            GAME_PALETTE_SEMANTIC[$sem_name]="$sem_index"
        fi

        # Parse gradients
        if [[ "$line" =~ ^([a-z_]+)\ *=\ *\[([^\]]+)\] ]]; then
            local grad_name="${BASH_REMATCH[1]}"
            local grad_values="${BASH_REMATCH[2]}"
            GAME_PALETTE_GRADIENTS[$grad_name]="$grad_values"
        fi

    done < "$palette_file"

    # Save last color
    if [[ -n "$current_index" && -n "$current_hex" ]]; then
        GAME_PALETTE_COLORS[$current_index]="$current_hex"
        GAME_PALETTE_NAMES[$current_index]="$current_name"
    fi

    GAME_CURRENT_PALETTE="$palette_name"
    echo "Loaded palette: $palette_name (${#GAME_PALETTE_COLORS[@]} colors)" >&2
}

# Get hex color by index
# Usage: hex=$(game_palette_get 0)
game_palette_get() {
    local index="$1"
    echo "${GAME_PALETTE_COLORS[$index]:-000000}"
}

# Get index by semantic name
# Usage: index=$(game_palette_get_semantic "player_core")
game_palette_get_semantic() {
    local name="$1"
    echo "${GAME_PALETTE_SEMANTIC[$name]:-0}"
}

# Get color by semantic name
# Usage: hex=$(game_palette_get_semantic_color "player_core")
game_palette_get_semantic_color() {
    local name="$1"
    local index=$(game_palette_get_semantic "$name")
    game_palette_get "$index"
}

# Get gradient color indices
# Usage: indices=($(game_palette_get_gradient "player_energy"))
game_palette_get_gradient() {
    local name="$1"
    echo "${GAME_PALETTE_GRADIENTS[$name]}"
}

# Interpolate color from gradient based on value [0.0, 1.0]
# Usage: hex=$(game_palette_interpolate_gradient "player_energy" 0.75)
game_palette_interpolate_gradient() {
    local gradient_name="$1"
    local value="$2"  # 0.0 to 1.0

    local indices=($(game_palette_get_gradient "$gradient_name"))
    local count=${#indices[@]}

    if [[ $count -eq 0 ]]; then
        echo "000000"
        return
    fi

    # Clamp value
    if (( $(echo "$value < 0" | bc -l) )); then
        value=0.0
    elif (( $(echo "$value > 1" | bc -l) )); then
        value=1.0
    fi

    # Find interpolation position
    local pos=$(echo "$value * ($count - 1)" | bc -l)
    local lower_idx=$(printf "%.0f" "$(echo "$pos" | bc -l | awk '{print int($1)}')")
    local upper_idx=$((lower_idx + 1))

    # Handle edge cases
    if [[ $upper_idx -ge $count ]]; then
        upper_idx=$((count - 1))
        lower_idx=$upper_idx
    fi

    # Get colors
    local lower_color_idx=${indices[$lower_idx]}
    local upper_color_idx=${indices[$upper_idx]}

    # If same index, no interpolation needed
    if [[ $lower_idx -eq $upper_idx ]]; then
        game_palette_get "$lower_color_idx"
        return
    fi

    # Linear interpolation between colors
    local lower_hex=$(game_palette_get "$lower_color_idx")
    local upper_hex=$(game_palette_get "$upper_color_idx")

    local t=$(echo "$pos - $lower_idx" | bc -l)

    game_palette_lerp_hex "$lower_hex" "$upper_hex" "$t"
}

# Linear interpolation between two hex colors
# Usage: hex=$(game_palette_lerp_hex "FF0000" "0000FF" 0.5)
game_palette_lerp_hex() {
    local hex1="$1"
    local hex2="$2"
    local t="$3"  # 0.0 to 1.0

    # Parse hex to RGB
    local r1=$((16#${hex1:0:2}))
    local g1=$((16#${hex1:2:2}))
    local b1=$((16#${hex1:4:2}))

    local r2=$((16#${hex2:0:2}))
    local g2=$((16#${hex2:2:2}))
    local b2=$((16#${hex2:4:2}))

    # Interpolate
    local r=$(echo "$r1 + ($r2 - $r1) * $t" | bc -l | awk '{printf "%.0f", $1}')
    local g=$(echo "$g1 + ($g2 - $g1) * $t" | bc -l | awk '{printf "%.0f", $1}')
    local b=$(echo "$b1 + ($b2 - $b1) * $t" | bc -l | awk '{printf "%.0f", $1}')

    # Convert back to hex
    printf "%02X%02X%02X" "$r" "$g" "$b"
}

# Apply palette to C engine
# Usage: game_palette_apply_to_engine
game_palette_apply_to_engine() {
    echo "SET_PALETTE $GAME_CURRENT_PALETTE"

    # Send all colors
    for index in "${!GAME_PALETTE_COLORS[@]}"; do
        local hex="${GAME_PALETTE_COLORS[$index]}"
        echo "SET_COLOR $index $hex"
    done

    echo "END_PALETTE"
}

# List available palettes
# Usage: game_palette_list
game_palette_list() {
    local palette_dir="$GAME_SRC/assets/palettes"

    if [[ ! -d "$palette_dir" ]]; then
        echo "No palettes directory found" >&2
        return 1
    fi

    for file in "$palette_dir"/*.toml; do
        if [[ -f "$file" ]]; then
            local name=$(basename "$file" .toml)
            echo "$name"
        fi
    done
}

# Preview palette (print color swatches)
# Usage: game_palette_preview "neon"
game_palette_preview() {
    local palette_name="$1"

    # Load palette temporarily
    local prev_palette="$GAME_CURRENT_PALETTE"
    game_palette_load "$palette_name"

    echo "=== Palette: $palette_name ==="
    echo

    # Show colors
    for i in {0..31}; do
        local hex="${GAME_PALETTE_COLORS[$i]}"
        local name="${GAME_PALETTE_NAMES[$i]}"

        if [[ -n "$hex" ]]; then
            # Convert hex to 256-color
            local r=$((16#${hex:0:2}))
            local g=$((16#${hex:2:2}))
            local b=$((16#${hex:4:2}))

            # Print color swatch
            printf "\033[38;2;%d;%d;%dm█████\033[0m  " "$r" "$g" "$b"
            printf "%2d  #%s  %s\n" "$i" "$hex" "$name"
        fi
    done

    echo
    echo "=== Semantic Mappings ==="
    for name in player_core player_arm enemy_core enemy_arm success warning danger info; do
        local index=$(game_palette_get_semantic "$name")
        local hex=$(game_palette_get "$index")

        if [[ -n "$hex" ]]; then
            local r=$((16#${hex:0:2}))
            local g=$((16#${hex:2:2}))
            local b=$((16#${hex:4:2}))
            printf "\033[38;2;%d;%d;%dm█\033[0m  %-15s -> %2d (#%s)\n" "$r" "$g" "$b" "$name" "$index" "$hex"
        fi
    done

    # Restore previous palette
    if [[ "$prev_palette" != "$palette_name" ]]; then
        game_palette_load "$prev_palette"
    fi
}

# Export palette to C engine format
# Usage: game_palette_export_c > palette.h
game_palette_export_c() {
    echo "// Auto-generated palette: $GAME_CURRENT_PALETTE"
    echo "#ifndef PALETTE_H"
    echo "#define PALETTE_H"
    echo
    echo "typedef struct {"
    echo "    unsigned char r, g, b;"
    echo "} Color;"
    echo
    echo "static const Color PALETTE[] = {"

    for i in {0..255}; do
        local hex="${GAME_PALETTE_COLORS[$i]:-000000}"
        local r=$((16#${hex:0:2}))
        local g=$((16#${hex:2:2}))
        local b=$((16#${hex:4:2}))

        printf "    {%3d, %3d, %3d},  // %3d: %s\n" "$r" "$g" "$b" "$i" "${GAME_PALETTE_NAMES[$i]:-unused}"
    done

    echo "};"
    echo
    echo "#endif // PALETTE_H"
}

# Initialize default palette
game_palette_init() {
    # Try to load default palette
    if [[ -f "$GAME_SRC/assets/palettes/default.toml" ]]; then
        game_palette_load "default"
    else
        # Create basic fallback palette
        for i in {0..7}; do
            GAME_PALETTE_COLORS[$i]=$(printf "%02X%02X%02X" $((i*32)) $((i*32)) $((i*32)))
            GAME_PALETTE_NAMES[$i]="gray_$i"
        done
    fi
}
