#!/usr/bin/env bash

# TDOCS Color Explorer
# Interactive tool for exploring colors, converting 24-bit to 256-color,
# and managing 8-color patterns for the 4 major tdocs semantic categories

# Source required dependencies
# Load TDS via module system if not already loaded
if [[ "${TDS_LOADED}" != "true" ]] && [[ $(type -t tetra_load_module) == "function" ]]; then
    tetra_load_module "tds"
elif [[ "${TDS_LOADED}" != "true" ]]; then
    # Fallback to direct sourcing if module system not available
    TDS_SRC="${TDS_SRC:-$TETRA_SRC/bash/tds}"
    if [[ -f "$TDS_SRC/includes.sh" ]]; then
        source "$TDS_SRC/includes.sh"
    fi
fi

# Ensure TDS_SRC is set for later use
TDS_SRC="${TDS_SRC:-$TETRA_SRC/bash/tds}"

# The 4 major tdocs semantic categories (NEW TAXONOMY)
declare -gA TDOCS_SEMANTIC_CATEGORIES=(
    [scope]="Application reach (system, module, feature, temporal)"
    [type]="Document type (spec, guide, investigation, reference, plan, summary, scratch)"
    [module]="Module ownership (tdocs, rag, repl, midi, etc.)"
    [grade]="Reliability/authority (A=Canonical, B=Established, C=Working, X=Ephemeral)"
)

# Palette assignments for each semantic category (simplified single-color design)
declare -gA TDOCS_PALETTE_ASSIGNMENTS=(
    [scope]="env"       # ENV_PRIMARY[0] - green (application reach)
    [type]="mode"       # MODE_PRIMARY[0] - blue (document type)
    [module]="verbs"    # VERBS_PRIMARY[0] - red/orange (module)
    [grade]="nouns"     # NOUNS_PRIMARY[0] - purple (reliability)
)

# Convert 24-bit hex color to closest 256-color ANSI code
# This is an enhanced version with better color matching
tdocs_hex_to_256() {
    local hex="$1"

    # Use existing color_core function if available
    if declare -f hex_to_256 >/dev/null 2>&1; then
        hex_to_256 "$hex"
        return
    fi

    # Fallback implementation
    local hex_clean="${hex#\#}"

    if [[ ! "$hex_clean" =~ ^[0-9A-Fa-f]{6}$ ]]; then
        echo "15"  # Default to white
        return 1
    fi

    local r=$((16#${hex_clean:0:2}))
    local g=$((16#${hex_clean:2:2}))
    local b=$((16#${hex_clean:4:2}))

    # Check for grayscale
    if [[ $r -eq $g && $g -eq $b ]]; then
        echo $(( r * 23 / 255 + 232 ))
        return
    fi

    # Color cube mapping
    local r6=$(( r * 5 / 255 ))
    local g6=$(( g * 5 / 255 ))
    local b6=$(( b * 5 / 255 ))
    echo $(( 16 + r6 * 36 + g6 * 6 + b6 ))
}

# Convert 256-color code back to approximate hex
tdocs_256_to_hex() {
    local color256="$1"

    # System colors (0-15) - use standard palette
    if [[ $color256 -lt 16 ]]; then
        case $color256 in
            0) echo "000000" ;;   # Black
            1) echo "800000" ;;   # Red
            2) echo "008000" ;;   # Green
            3) echo "808000" ;;   # Yellow
            4) echo "000080" ;;   # Blue
            5) echo "800080" ;;   # Magenta
            6) echo "008080" ;;   # Cyan
            7) echo "C0C0C0" ;;   # White
            8) echo "808080" ;;   # Bright Black
            9) echo "FF0000" ;;   # Bright Red
            10) echo "00FF00" ;;  # Bright Green
            11) echo "FFFF00" ;;  # Bright Yellow
            12) echo "0000FF" ;;  # Bright Blue
            13) echo "FF00FF" ;;  # Bright Magenta
            14) echo "00FFFF" ;;  # Bright Cyan
            15) echo "FFFFFF" ;;  # Bright White
        esac
        return
    fi

    # Grayscale ramp (232-255)
    if [[ $color256 -ge 232 ]]; then
        local gray=$(( (color256 - 232) * 255 / 23 ))
        printf "%02X%02X%02X" $gray $gray $gray
        return
    fi

    # Color cube (16-231)
    local index=$(( color256 - 16 ))
    local r=$(( index / 36 ))
    local g=$(( (index % 36) / 6 ))
    local b=$(( index % 6 ))

    # Convert 0-5 range to 0-255
    r=$(( r * 255 / 5 ))
    g=$(( g * 255 / 5 ))
    b=$(( b * 255 / 5 ))

    printf "%02X%02X%02X" $r $g $b
}

# Show color conversion examples
tdocs_show_color_conversion() {
    echo "TDS 24-bit to 256-color Conversion"
    echo "===================================="
    echo

    # Get current theme palette
    if [[ ${#ENV_PRIMARY[@]} -eq 0 ]]; then
        echo "No TDS theme loaded. Loading default theme..."
        tds_load_theme 2>/dev/null || echo "Warning: Could not load TDS theme"
        echo
    fi

    # Show palette conversions
    local palettes=("ENV_PRIMARY" "MODE_PRIMARY" "VERBS_PRIMARY" "NOUNS_PRIMARY")

    for palette_name in "${palettes[@]}"; do
        echo "$palette_name:"

        # Use indirect reference to access the array
        local -n palette_ref=$palette_name

        for i in {0..7}; do
            local hex="${palette_ref[$i]}"
            # Clean any # prefix from hex value
            hex="${hex#\#}"
            local code256=$(tdocs_hex_to_256 "$hex")
            local back_hex=$(tdocs_256_to_hex "$code256")

            printf "  [%d] #%s → \033[38;5;%dm█████\033[0m %3d → #%s " \
                "$i" "$hex" "$code256" "$code256" "$back_hex"

            # Show visual comparison
            printf "24bit:\033[38;2;%d;%d;%dm███\033[0m " \
                "$((16#${hex:0:2}))" "$((16#${hex:2:2}))" "$((16#${hex:4:2}))"
            printf "256:\033[38;5;%dm███\033[0m" "$code256"

            # Show difference if any
            if [[ "$hex" != "$back_hex" ]]; then
                printf " (Δ)"
            fi
            echo
        done
        echo
    done
}

# Show current palette assignments for semantic categories
tdocs_show_palette_assignments() {
    echo "TDOCS Semantic Category → Palette Assignments"
    echo "=============================================="
    echo

    for category in type intent grade category; do
        local palette="${TDOCS_PALETTE_ASSIGNMENTS[$category]}"
        local description="${TDOCS_SEMANTIC_CATEGORIES[$category]}"

        printf "%-12s → %-12s %s\n" "$category" "$palette" "($description)"
    done
    echo
}

# Show 8-color pattern for a specific semantic category
tdocs_show_category_pattern() {
    local category="$1"

    if [[ ! -v "TDOCS_PALETTE_ASSIGNMENTS[$category]" ]]; then
        echo "Error: Unknown category '$category'"
        echo "Valid categories: scope, type, module, grade"
        return 0
    fi

    local palette="${TDOCS_PALETTE_ASSIGNMENTS[$category]}"
    local description="${TDOCS_SEMANTIC_CATEGORIES[$category]}"

    echo "Category: $category"
    echo "Palette: $palette"
    echo "Description: $description"
    echo

    # Determine which palette array to use
    local palette_array_name="${palette^^}_PRIMARY"
    local -n palette_ref=$palette_array_name

    # Show the 8-color pattern
    echo "8-Color Pattern:"
    for i in {0..7}; do
        local hex="${palette_ref[$i]}"
        # Clean any # prefix from hex value
        hex="${hex#\#}"
        local code256=$(tdocs_hex_to_256 "$hex")

        # Show color swatch and codes
        printf "  [%d] " "$i"
        printf "\033[38;5;%dm\033[48;5;%dm  \033[0m " "$code256" "$code256"
        printf "#%s (256:%3d) " "$hex" "$code256"

        # Show actual usage in tdocs based on category (simplified single-color design)
        case "$category" in
            scope)
                case $i in
                    0) printf "ALL scope values use this color (system/module/feature/temporal)" ;;
                    *) printf "(future: tags round-robin)" ;;
                esac
                ;;
            type)
                case $i in
                    0) printf "ALL type values use this color (spec/guide/investigation/etc)" ;;
                    *) printf "(future: tags round-robin)" ;;
                esac
                ;;
            module)
                case $i in
                    0) printf "ALL modules use this color (tdocs/rag/repl/etc)" ;;
                    *) printf "(future: tags round-robin)" ;;
                esac
                ;;
            grade)
                case $i in
                    0) printf "ALL grade values use this color (A/B/C/X)" ;;
                    *) printf "(future: tags round-robin)" ;;
                esac
                ;;
        esac
        echo
    done
    echo
}

# Interactive palette swapper - swap which palette is used for which category
tdocs_swap_palette() {
    local category="$1"
    local new_palette="$2"

    if [[ ! -v "TDOCS_PALETTE_ASSIGNMENTS[$category]" ]]; then
        echo "Error: Unknown category '$category'"
        echo "Valid categories: scope, type, module, grade"
        return 0
    fi

    local valid_palettes=("env" "mode" "verbs" "nouns")
    if [[ ! " ${valid_palettes[@]} " =~ " ${new_palette} " ]]; then
        echo "Error: Unknown palette '$new_palette'"
        echo "Valid palettes: env, mode, verbs, nouns"
        return 0
    fi

    local old_palette="${TDOCS_PALETTE_ASSIGNMENTS[$category]}"
    TDOCS_PALETTE_ASSIGNMENTS[$category]="$new_palette"

    echo "Swapped palette for category '$category':"
    echo "  Old: $old_palette"
    echo "  New: $new_palette"
    echo
    echo "Note: This is a runtime change. To persist, update ui/tdocs_tokens.sh"
    echo

    # Show the new pattern
    tdocs_show_category_pattern "$category"
}

# Visual color picker - show all 256 colors in a grid
tdocs_show_256_palette() {
    echo "256-Color Palette"
    echo "================="
    echo

    echo "System Colors (0-15):"
    for i in {0..15}; do
        printf "\033[48;5;%dm %3d \033[0m" "$i" "$i"
        [[ $(( (i + 1) % 8 )) -eq 0 ]] && echo
    done
    echo

    echo "Color Cube (16-231):"
    for r in {0..5}; do
        for g in {0..5}; do
            for b in {0..5}; do
                local code=$(( 16 + r * 36 + g * 6 + b ))
                printf "\033[48;5;%dm %3d \033[0m" "$code" "$code"
            done
            echo
        done
        echo
    done

    echo "Grayscale Ramp (232-255):"
    for i in {232..255}; do
        printf "\033[48;5;%dm %3d \033[0m" "$i" "$i"
        [[ $(( (i - 232 + 1) % 12 )) -eq 0 ]] && echo
    done
    echo
}

# Compare two colors side by side
tdocs_compare_colors() {
    local color1="$1"  # Can be hex or 256 code
    local color2="$2"

    local hex1 code1 hex2 code2

    # Parse color1
    if [[ "$color1" =~ ^[0-9]+$ ]]; then
        code1="$color1"
        hex1=$(tdocs_256_to_hex "$code1")
    else
        hex1="${color1#\#}"
        code1=$(tdocs_hex_to_256 "$hex1")
    fi

    # Parse color2
    if [[ "$color2" =~ ^[0-9]+$ ]]; then
        code2="$color2"
        hex2=$(tdocs_256_to_hex "$code2")
    else
        hex2="${color2#\#}"
        code2=$(tdocs_hex_to_256 "$hex2")
    fi

    echo "Color Comparison"
    echo "================"
    echo

    printf "Color 1: #%s (256:%d) " "$hex1" "$code1"
    printf "\033[38;5;%dm\033[48;5;%dm     \033[0m\n" "$code1" "$code1"

    printf "Color 2: #%s (256:%d) " "$hex2" "$code2"
    printf "\033[38;5;%dm\033[48;5;%dm     \033[0m\n" "$code2" "$code2"

    echo
    printf "Side by side: "
    printf "\033[38;5;%dm\033[48;5;%dm  1  \033[0m " "$code1" "$code1"
    printf "\033[38;5;%dm\033[48;5;%dm  2  \033[0m\n" "$code2" "$code2"
}

# Main color explorer interface
tdocs_color_explorer() {
    local mode="${1:-menu}"

    case "$mode" in
        convert|conversion)
            tdocs_show_color_conversion
            ;;
        assignments|assign)
            tdocs_show_palette_assignments
            ;;
        pattern)
            local category="${2:-type}"
            tdocs_show_category_pattern "$category"
            ;;
        swap)
            if [[ $# -lt 3 ]]; then
                echo "Usage: tdocs_color_explorer swap <category> <palette>"
                echo "Example: tdocs_color_explorer swap type env"
                return 0
            fi
            tdocs_swap_palette "$2" "$3"
            ;;
        256|palette256)
            tdocs_show_256_palette
            ;;
        compare)
            if [[ $# -lt 3 ]]; then
                echo "Usage: tdocs_color_explorer compare <color1> <color2>"
                echo "Example: tdocs_color_explorer compare FF5733 33"
                return 0
            fi
            tdocs_compare_colors "$2" "$3"
            ;;
        tokens|viewer|view)
            # Run the comprehensive color viewer
            local viewer_script="${TDOCS_SRC}/ui/color_viewer.sh"
            if [[ -f "$viewer_script" ]]; then
                bash "$viewer_script"
            else
                echo "Error: Color viewer not found at $viewer_script"
                return 1
            fi
            ;;
        menu|help|*)
            cat <<'EOF'
TDOCS Color Explorer
====================

A tool for exploring TDS colors, converting between formats, and managing
the 8-color patterns used for tdocs' 4 major semantic categories.

USAGE:
  tdocs_color_explorer <command> [args]

COMMANDS:
  tokens          Show all design tokens with live color rendering ★
  convert         Show 24-bit to 256-color conversion for all TDS palettes
  assignments     Show current palette assignments for semantic categories
  pattern <cat>   Show 8-color pattern for category (scope|type|module|grade)
  swap <cat> <pal> Swap palette for category (runtime only)
  256             Show all 256 ANSI colors in a grid
  compare <c1> <c2> Compare two colors (hex or 256 code)
  help            Show this help

EXAMPLES:
  # Show all design tokens with live color rendering (recommended!)
  tdocs_color_explorer tokens

  # Show color conversions
  tdocs_color_explorer convert

  # Show which palettes are assigned to which categories
  tdocs_color_explorer assignments

  # Show the 8-color pattern for "scope" category
  tdocs_color_explorer pattern scope

  # Swap the "scope" category to use the "mode" palette (runtime)
  tdocs_color_explorer swap scope mode

  # Show all 256 colors
  tdocs_color_explorer 256

  # Compare two colors
  tdocs_color_explorer compare FF5733 196

SEMANTIC CATEGORIES (NEW TAXONOMY):
  scope     Application reach (system, module, feature, temporal)
  type      Document type (spec, guide, investigation, etc.)
  module    Module ownership (tdocs, rag, repl, etc.)
  grade     Reliability/authority (A=Canonical, B=Established, C=Working, X=Ephemeral)

PALETTES (Simplified single-color design):
  env       ENV_PRIMARY[0] - Green (scope)
  mode      MODE_PRIMARY[0] - Blue (type)
  verbs     VERBS_PRIMARY[0] - Red/Orange (module)
  nouns     NOUNS_PRIMARY[0] - Purple (grade)

Each category uses palette index [0] only. Indices [1-7] reserved for future features.

EOF
            ;;
    esac
}

# Alias for REPL convenience - "colors" command
colors() {
    tdocs_color_explorer "$@"
}

# Export functions
export -f tdocs_hex_to_256
export -f tdocs_256_to_hex
export -f tdocs_show_color_conversion
export -f tdocs_show_palette_assignments
export -f tdocs_show_category_pattern
export -f tdocs_swap_palette
export -f tdocs_show_256_palette
export -f tdocs_compare_colors
export -f tdocs_color_explorer
export -f colors
