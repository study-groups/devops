#!/usr/bin/env bash

# TUI Color Designer System - A Graphic Designer's Dream
# Advanced color theory, harmony, and accessibility tools for TUI design

# Source dependencies
COLORS_DIR="$(dirname "${BASH_SOURCE[0]}")"
source "$COLORS_DIR/color_core.sh"
source "$COLORS_DIR/color_module.sh"

# ===== COLOR HARMONY GENERATORS =====

# Generate complementary color
generate_complement() {
    local hex="$1"
    local r g b
    local r g b
    read r g b < <(hex_to_rgb "$hex")

    # Complement = 255 - original
    local comp_r=$((255 - r))
    local comp_g=$((255 - g))
    local comp_b=$((255 - b))

    rgb_to_hex "$comp_r" "$comp_g" "$comp_b"
}

# Generate triadic colors (120° apart)
generate_triadic() {
    local hex="$1"
    local r g b
    local r g b
    read r g b < <(hex_to_rgb "$hex")

    # Simple triadic approximation using RGB rotation
    local t1_r=$(( (r + 85) % 256 ))
    local t1_g=$(( (g + 85) % 256 ))
    local t1_b=$(( (b + 85) % 256 ))

    local t2_r=$(( (r + 170) % 256 ))
    local t2_g=$(( (g + 170) % 256 ))
    local t2_b=$(( (b + 170) % 256 ))

    echo "$(rgb_to_hex "$t1_r" "$t1_g" "$t1_b") $(rgb_to_hex "$t2_r" "$t2_g" "$t2_b")"
}

# Generate analogous colors (30° apart)
generate_analogous() {
    local hex="$1"
    local r g b
    local r g b
    read r g b < <(hex_to_rgb "$hex")

    # Analogous colors - subtle shifts
    local a1_r=$(( (r + 25) % 256 ))
    local a1_g=$(( (g + 10) % 256 ))
    local a1_b=$(( (b - 15 + 256) % 256 ))

    local a2_r=$(( (r - 25 + 256) % 256 ))
    local a2_g=$(( (g - 10 + 256) % 256 ))
    local a2_b=$(( (b + 15) % 256 ))

    echo "$(rgb_to_hex "$a1_r" "$a1_g" "$a1_b") $(rgb_to_hex "$a2_r" "$a2_g" "$a2_b")"
}

# Generate monochromatic palette (different lightness)
generate_monochromatic() {
    local hex="$1"
    local count="${2:-5}"
    local r g b
    local r g b
    read r g b < <(hex_to_rgb "$hex")

    local palette=()
    for i in $(seq 1 "$count"); do
        # Create lightness variations
        local factor=$(( (i * 100) / count ))  # 0-100%
        local adj_r=$(( (r * factor) / 100 ))
        local adj_g=$(( (g * factor) / 100 ))
        local adj_b=$(( (b * factor) / 100 ))

        palette+=("$(rgb_to_hex "$adj_r" "$adj_g" "$adj_b")")
    done

    echo "${palette[@]}"
}

# ===== ACCESSIBILITY & CONTRAST TOOLS =====

# Check WCAG AA compliance (4.5:1 ratio)
check_wcag_aa() {
    local fg="$1" bg="$2"
    local ratio=$(color_contrast_ratio "$fg" "$bg")

    if (( ratio >= 450 )); then  # 4.5 * 100
        echo "PASS"
    else
        echo "FAIL"
    fi
}

# Find accessible color pairs from palette
find_accessible_pairs() {
    local palette_name="$1"
    local -n palette_ref=$palette_name
    local pairs=()

    for i in "${!palette_ref[@]}"; do
        for j in "${!palette_ref[@]}"; do
            if [[ $i -ne $j ]]; then
                local color1="${palette_ref[$i]}"
                local color2="${palette_ref[$j]}"
                local compliance=$(check_wcag_aa "$color1" "$color2")

                if [[ "$compliance" == "PASS" ]]; then
                    pairs+=("$color1:$color2")
                fi
            fi
        done
    done

    printf "%s\n" "${pairs[@]}"
}

# ===== ADVANCED PALETTE GENERATION =====

# Generate professional color palette based on base color
generate_professional_palette() {
    local base_color="$1"
    local palette_type="${2:-balanced}"  # balanced, warm, cool, vibrant, muted

    case "$palette_type" in
        "balanced")
            # Complement + analogous for balance
            local complement=$(generate_complement "$base_color")
            local analogous=($(generate_analogous "$base_color"))
            echo "$base_color $complement ${analogous[@]}"
            ;;
        "warm")
            # Shift toward reds/oranges
            local r g b
            read -r r g b < <(hex_to_rgb "$base_color")
            local warm1=$(rgb_to_hex $((r + 20)) $((g + 10)) $((b - 10)))
            local warm2=$(rgb_to_hex $((r + 40)) $((g + 5)) $((b - 20)))
            echo "$base_color $warm1 $warm2"
            ;;
        "cool")
            # Shift toward blues/greens
            local r g b
            read -r r g b < <(hex_to_rgb "$base_color")
            local cool1=$(rgb_to_hex $((r - 10)) $((g + 10)) $((b + 20)))
            local cool2=$(rgb_to_hex $((r - 20)) $((g + 20)) $((b + 40)))
            echo "$base_color $cool1 $cool2"
            ;;
        "vibrant")
            # Increase saturation and use triadic
            local triadic=($(generate_triadic "$base_color"))
            echo "$base_color ${triadic[@]}"
            ;;
        "muted")
            # Decrease saturation, monochromatic approach
            local mono=($(generate_monochromatic "$base_color" 4))
            echo "${mono[@]}"
            ;;
    esac
}

# ===== DESIGNER PREVIEW TOOLS =====

# Show color with metadata
show_color_info() {
    local hex="$1"
    local r g b
    local r g b
    read r g b < <(hex_to_rgb "$hex")

    # Display color swatch with info
    printf "\033[48;2;%d;%d;%dm    \033[0m" "$r" "$g" "$b"
    printf " #%s RGB(%d,%d,%d)" "$hex" "$r" "$g" "$b"

    # Calculate luminance indicator
    local lum=$(( (r*30 + g*59 + b*11) / 100 ))
    if (( lum > 128 )); then
        printf " [LIGHT]"
    else
        printf " [DARK]"
    fi
}

# Preview color palette as swatches
preview_palette() {
    local palette_name="$1"
    local -n palette_ref=$palette_name

    echo "=== Palette Preview: $palette_name ==="
    for i in "${!palette_ref[@]}"; do
        printf "%2d: " "$i"
        show_color_info "${palette_ref[$i]}"
        echo
    done
    echo
}

# Show color harmony analysis
analyze_color_harmony() {
    local color1="$1" color2="$2"

    echo "=== Color Harmony Analysis ==="
    printf "Color 1: "
    show_color_info "$color1"
    echo
    printf "Color 2: "
    show_color_info "$color2"
    echo

    local distance=$(color_distance "$color1" "$color2")
    local contrast=$(color_contrast_ratio "$color1" "$color2")
    local wcag=$(check_wcag_aa "$color1" "$color2")

    printf "Distance: %d (higher = more distinct)\n" "$distance"
    printf "Contrast: %d:1 (450+ recommended)\n" "$((contrast / 100))"
    printf "WCAG AA: %s\n" "$wcag"
    echo
}

# ===== DYNAMIC THEME BUILDER =====

# Build complete UI theme from base colors
build_ui_theme() {
    local primary="$1"
    local secondary="$2"
    local accent="$3"
    local theme_name="${4:-custom}"

    echo "=== Building UI Theme: $theme_name ==="

    # Generate supporting colors
    local primary_complement=$(generate_complement "$primary")
    local secondary_analogous=($(generate_analogous "$secondary"))
    local accent_mono=($(generate_monochromatic "$accent" 3))

    # Create theme structure
    echo "Primary: $primary (complement: $primary_complement)"
    echo "Secondary: $secondary (analogous: ${secondary_analogous[*]})"
    echo "Accent: $accent (monochromatic: ${accent_mono[*]})"
    echo

    # Generate UI assignments
    echo "Suggested UI Assignments:"
    echo "  Headers/Labels: $primary"
    echo "  Selected Items: $accent"
    echo "  Backgrounds: ${accent_mono[0]}"
    echo "  Text on Primary: $primary_complement"
    echo "  Borders: ${secondary_analogous[0]}"
    echo
}

# ===== EXPORT FUNCTIONS =====

# Export palette to various formats
export_palette() {
    local palette_name="$1"
    local format="${2:-bash}"
    local -n palette_ref=$palette_name

    case "$format" in
        "css")
            echo "/* CSS Custom Properties */"
            for i in "${!palette_ref[@]}"; do
                echo "--color-$i: #${palette_ref[$i]};"
            done
            ;;
        "json")
            echo "{"
            local first=true
            for i in "${!palette_ref[@]}"; do
                if [[ "$first" != "true" ]]; then
                    echo ","
                fi
                printf '  "color_%d": "#%s"' "$i" "${palette_ref[$i]}"
                first=false
            done
            echo ""
            echo "}"
            ;;
        *)
            echo "# Bash Array"
            echo "declare -a $palette_name=("
            for color in "${palette_ref[@]}"; do
                echo "    \"$color\""
            done
            echo ")"
            ;;
    esac
}

# ===== DESIGNER REPL COMMANDS =====

# Process designer commands
process_designer_command() {
    local cmd="$1"
    shift
    local args=("$@")

    case "$cmd" in
        "harmony")
            if [[ ${#args[@]} -eq 2 ]]; then
                analyze_color_harmony "${args[0]}" "${args[1]}"
            else
                echo "Usage: harmony <color1> <color2>"
            fi
            ;;
        "complement")
            if [[ ${#args[@]} -eq 1 ]]; then
                local comp=$(generate_complement "${args[0]}")
                printf "Complement of #%s: #%s\n" "${args[0]}" "$comp"
                show_color_info "$comp"
                echo
            else
                echo "Usage: complement <color>"
            fi
            ;;
        "triadic")
            if [[ ${#args[@]} -eq 1 ]]; then
                local triads=($(generate_triadic "${args[0]}"))
                echo "Triadic colors for #${args[0]}:"
                for triad in "${triads[@]}"; do
                    printf "  "
                    show_color_info "$triad"
                    echo
                done
            else
                echo "Usage: triadic <color>"
            fi
            ;;
        "palette")
            local base_color="${args[0]}"
            local palette_type="${args[1]:-balanced}"
            if [[ -n "$base_color" ]]; then
                local palette=($(generate_professional_palette "$base_color" "$palette_type"))
                echo "Generated $palette_type palette from #$base_color:"
                for color in "${palette[@]}"; do
                    printf "  "
                    show_color_info "$color"
                    echo
                done
            else
                echo "Usage: palette <base_color> [balanced|warm|cool|vibrant|muted]"
            fi
            ;;
        "theme")
            if [[ ${#args[@]} -ge 3 ]]; then
                build_ui_theme "${args[0]}" "${args[1]}" "${args[2]}" "${args[3]:-custom}"
            else
                echo "Usage: theme <primary> <secondary> <accent> [name]"
            fi
            ;;
        "preview")
            if [[ ${#args[@]} -eq 1 ]]; then
                preview_palette "${args[0]}"
            else
                echo "Usage: preview <palette_name>"
                echo "Available palettes: ENV_PRIMARY MODE_PRIMARY VERBS_PRIMARY NOUNS_PRIMARY"
            fi
            ;;
        *)
            echo "Designer commands:"
            echo "  harmony <c1> <c2>     - Analyze color relationship"
            echo "  complement <color>    - Generate complement"
            echo "  triadic <color>       - Generate triadic harmony"
            echo "  palette <color> [type] - Generate professional palette"
            echo "  theme <p> <s> <a>     - Build complete UI theme"
            echo "  preview <palette>     - Preview palette swatches"
            ;;
    esac
}

echo "🎨 Color Designer System loaded - A graphic designer's dream!"