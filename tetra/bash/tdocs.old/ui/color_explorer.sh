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

# ============================================================================
# Screen Geometry Helpers
# ============================================================================

# Get terminal width, default to 80
_ce_width() {
    echo "${COLUMNS:-$(tput cols 2>/dev/null || echo 80)}"
}

# Delegate to TDS UI functions (defined in tds/layout/spacing.sh)
_ce_header() { tds_header "$@"; }
_ce_subheader() { tds_section "$@"; }

# Delegate to TDS swatch functions (defined in tds/core/ansi.sh)
_ce_swatch() { tds_swatch "$1" "${2:-█████}"; }
_ce_block() { tds_block "$@"; }

# The 4 major tdocs semantic categories (NEW TAXONOMY)
declare -gA TDOCS_SEMANTIC_CATEGORIES=(
    [scope]="Application reach (system, module, feature, temporal)"
    [type]="Document type (spec, guide, investigation, reference, plan, summary, scratch)"
    [module]="Module ownership (tdocs, rag, repl, midi, etc.)"
    [grade]="Reliability/authority (A=Canonical, B=Established, C=Working, X=Ephemeral)"
)

# Palette assignments for each semantic category (simplified single-color design)
declare -gA TDOCS_PALETTE_ASSIGNMENTS=(
    [scope]="primary"     # PRIMARY[0] - rainbow main (application reach)
    [type]="secondary"    # SECONDARY[0] - accent (document type)
    [module]="semantic"   # SEMANTIC[0] - status colors (module)
    [grade]="surface"     # SURFACE[0] - bg/fg gradient (reliability)
)

# Convert 24-bit hex color to closest 256-color ANSI code
tdocs_hex_to_256() {
    tds_hex_to_256 "$1"
}

# Convert 256-color code back to approximate hex
# Delegates to TDS implementation
tdocs_256_to_hex() {
    tds_256_to_hex "$1"
}

# Show color conversion examples
tdocs_show_color_conversion() {
    local width=$(_ce_width)

    _ce_header "TDS 24-bit to 256-color Conversion"
    echo

    # Get current theme palette
    if [[ ${#PRIMARY[@]} -eq 0 ]]; then
        tds_text_color "status.warning"
        echo "No TDS theme loaded. Loading default theme..."
        reset_color
        tds_load_theme 2>/dev/null || {
            tds_text_color "status.error"
            echo "Warning: Could not load TDS theme"
            reset_color
        }
        echo
    fi

    # Show palette conversions
    local palettes=("PRIMARY" "SECONDARY" "SEMANTIC" "SURFACE")
    local -A palette_labels=([PRIMARY]="primary" [SECONDARY]="secondary" [SEMANTIC]="semantic" [SURFACE]="surface")

    for palette_name in "${palettes[@]}"; do
        _ce_subheader "${palette_labels[$palette_name]}"

        # Use indirect reference to access the array
        local -n palette_ref=$palette_name

        for i in {0..7}; do
            local hex="${palette_ref[$i]}"
            hex="${hex#\#}"
            local code256=$(tdocs_hex_to_256 "$hex")
            local back_hex=$(tdocs_256_to_hex "$code256")

            # Index and hex value
            tds_text_color "text.muted"
            printf "  [%d] " "$i"
            reset_color

            printf "#%s " "$hex"

            # Arrow
            tds_text_color "text.dim"
            printf "→ "
            reset_color

            # Color swatch using 256-color
            _ce_swatch "$hex"

            # 256 code
            tds_text_color "text.muted"
            printf " %3d " "$code256"
            reset_color

            # Truncate output if terminal is narrow
            if [[ $width -ge 70 ]]; then
                tds_text_color "text.dim"
                printf "→ "
                reset_color
                printf "#%s " "$back_hex"

                # Visual comparison only if wide enough
                if [[ $width -ge 90 ]]; then
                    tds_text_color "text.dim"
                    printf "24b:"
                    reset_color
                    _ce_swatch "$hex" "██"
                    printf " "
                    tds_text_color "text.dim"
                    printf "256:"
                    reset_color
                    printf "\033[38;5;%dm██\033[0m" "$code256"
                fi

                # Show difference indicator
                if [[ "$hex" != "$back_hex" ]]; then
                    tds_text_color "status.warning"
                    printf " Δ"
                    reset_color
                fi
            fi
            echo
        done
    done
    echo
}

# Show current palette assignments for semantic categories
tdocs_show_palette_assignments() {
    local width=$(_ce_width)

    _ce_header "TDOCS Semantic Category → Palette Assignments"
    echo

    for category in scope type module grade; do
        local palette="${TDOCS_PALETTE_ASSIGNMENTS[$category]}"
        local description="${TDOCS_SEMANTIC_CATEGORIES[$category]}"

        # Truncate description to fit
        local desc_width=$((width - 30))
        [[ $desc_width -lt 20 ]] && desc_width=20
        local truncated_desc=$(tds_truncate "$description" "$desc_width")

        # Category name in color
        tds_text_color "action.primary"
        printf "  %-10s" "$category"
        reset_color

        tds_text_color "text.dim"
        printf " → "
        reset_color

        # Palette name
        tds_text_color "status.info"
        printf "%-8s" "$palette"
        reset_color

        # Description
        tds_text_color "text.muted"
        printf " %s" "$truncated_desc"
        reset_color
        echo
    done
    echo
}

# Show 8-color pattern for a specific semantic category
tdocs_show_category_pattern() {
    local category="$1"
    local width=$(_ce_width)

    if [[ -z "${TDOCS_PALETTE_ASSIGNMENTS[$category]+isset}" ]]; then
        tds_text_color "status.error"
        echo "Error: Unknown category '$category'"
        reset_color
        tds_text_color "text.muted"
        echo "Valid categories: scope, type, module, grade"
        reset_color
        return 1
    fi

    local palette="${TDOCS_PALETTE_ASSIGNMENTS[$category]}"
    local description="${TDOCS_SEMANTIC_CATEGORIES[$category]}"

    _ce_header "Category Pattern: $category"
    echo

    # Info section
    tds_text_color "text.muted"
    printf "  Palette:     "
    reset_color
    tds_text_color "status.info"
    printf "%s\n" "$palette"
    reset_color

    tds_text_color "text.muted"
    printf "  Description: "
    reset_color
    local desc_width=$((width - 16))
    printf "%s\n" "$(tds_truncate "$description" "$desc_width")"

    # Determine which palette array to use (PRIMARY, SECONDARY, SEMANTIC, SURFACE)
    local palette_array_name="${palette^^}"
    local -n palette_ref=$palette_array_name

    _ce_subheader "8-Color Pattern"

    for i in {0..7}; do
        local hex="${palette_ref[$i]}"
        hex="${hex#\#}"
        local code256=$(tdocs_hex_to_256 "$hex")

        # Index
        tds_text_color "text.dim"
        printf "  [%d] " "$i"
        reset_color

        # Color swatch
        _ce_block "$hex"
        printf " "

        # Hex and 256 code
        printf "#%s " "$hex"
        tds_text_color "text.muted"
        printf "(%3d) " "$code256"
        reset_color

        # Usage description - truncate to fit
        local usage=""
        if [[ $i -eq 0 ]]; then
            case "$category" in
                scope)  usage="ALL scope values (system/module/feature/temporal)" ;;
                type)   usage="ALL type values (spec/guide/investigation/etc)" ;;
                module) usage="ALL modules (tdocs/rag/repl/etc)" ;;
                grade)  usage="ALL grades (A/B/C/X)" ;;
            esac
            tds_text_color "status.success"
        else
            usage="(future: round-robin)"
            tds_text_color "text.dim"
        fi

        local usage_width=$((width - 32))
        [[ $usage_width -gt 10 ]] && printf "%s" "$(tds_truncate "$usage" "$usage_width")"
        reset_color
        echo
    done
    echo
}

# Interactive palette swapper - swap which palette is used for which category
tdocs_swap_palette() {
    local category="$1"
    local new_palette="$2"

    if [[ -z "${TDOCS_PALETTE_ASSIGNMENTS[$category]+isset}" ]]; then
        tds_text_color "status.error"
        echo "Error: Unknown category '$category'"
        reset_color
        tds_text_color "text.muted"
        echo "Valid categories: scope, type, module, grade"
        reset_color
        return 1
    fi

    local valid_palettes=("primary" "secondary" "semantic" "surface")
    if [[ ! " ${valid_palettes[@]} " =~ " ${new_palette} " ]]; then
        tds_text_color "status.error"
        echo "Error: Unknown palette '$new_palette'"
        reset_color
        tds_text_color "text.muted"
        echo "Valid palettes: primary (rainbow), secondary (accent), semantic (status), surface (bg/fg)"
        reset_color
        return 1
    fi

    local old_palette="${TDOCS_PALETTE_ASSIGNMENTS[$category]}"
    TDOCS_PALETTE_ASSIGNMENTS[$category]="$new_palette"

    tds_text_color "status.success"
    printf "Swapped palette for '%s':" "$category"
    reset_color
    echo

    tds_text_color "text.dim"
    printf "  Old: "
    reset_color
    printf "%s\n" "$old_palette"

    tds_text_color "text.dim"
    printf "  New: "
    reset_color
    tds_text_color "status.info"
    printf "%s\n" "$new_palette"
    reset_color

    echo
    tds_text_color "text.muted"
    echo "Note: Runtime change only. Update ui/tokens.sh to persist."
    reset_color
    echo

    # Show the new pattern
    tdocs_show_category_pattern "$category"
}

# Visual color picker - show all 256 colors in a grid
tdocs_show_256_palette() {
    local width=$(_ce_width)

    _ce_header "256-Color Palette"
    echo

    # Each color cell is 5 chars wide " NNN "
    local cell_width=5
    local max_cols=$((width / cell_width))
    [[ $max_cols -lt 4 ]] && max_cols=4

    # System colors (0-15) - adaptive columns
    _ce_subheader "System Colors (0-15)"
    local sys_cols=$max_cols
    [[ $sys_cols -gt 16 ]] && sys_cols=16
    [[ $sys_cols -gt 8 ]] && sys_cols=8  # Prefer 8 for clean 2 rows

    for i in {0..15}; do
        printf "\033[48;5;%dm %3d \033[0m" "$i" "$i"
        [[ $(( (i + 1) % sys_cols )) -eq 0 ]] && echo
    done
    [[ $((16 % sys_cols)) -ne 0 ]] && echo
    echo

    # Color cube (16-231) - 6x6x6 cube
    # Show as 6 colors per row (one green-blue slice per line)
    # For wide terminals (>=60 cols), show 12 per row (2 slices)
    # For narrow terminals (<30 cols), show 3 per row
    _ce_subheader "Color Cube (16-231)"

    local cube_cols=6
    if [[ $width -ge 65 ]]; then
        cube_cols=12
    elif [[ $width -lt 30 ]]; then
        cube_cols=3
    fi

    local count=0
    for code in {16..231}; do
        printf "\033[48;5;%dm %3d \033[0m" "$code" "$code"
        ((count++))
        if [[ $((count % cube_cols)) -eq 0 ]]; then
            echo
            # Add spacing between red layers (every 36 colors) for readability
            if [[ $((count % 36)) -eq 0 && $width -ge 40 ]]; then
                echo
            fi
        fi
    done
    [[ $((count % cube_cols)) -ne 0 ]] && echo

    # Grayscale ramp (232-255) - adaptive columns
    _ce_subheader "Grayscale Ramp (232-255)"
    local gray_cols=$max_cols
    [[ $gray_cols -gt 12 ]] && gray_cols=12
    [[ $gray_cols -gt 8 ]] && gray_cols=8  # Prefer 8 for clean 3 rows

    for i in {232..255}; do
        printf "\033[48;5;%dm %3d \033[0m" "$i" "$i"
        [[ $(( (i - 231) % gray_cols )) -eq 0 ]] && echo
    done
    [[ $((24 % gray_cols)) -ne 0 ]] && echo
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

    _ce_header "Color Comparison"
    echo

    # Color 1
    tds_text_color "text.muted"
    printf "  Color 1: "
    reset_color
    printf "#%s " "$hex1"
    tds_text_color "text.dim"
    printf "(256:%3d) " "$code1"
    reset_color
    _ce_block "$hex1" "     "
    echo

    # Color 2
    tds_text_color "text.muted"
    printf "  Color 2: "
    reset_color
    printf "#%s " "$hex2"
    tds_text_color "text.dim"
    printf "(256:%3d) " "$code2"
    reset_color
    _ce_block "$hex2" "     "
    echo

    echo
    tds_text_color "text.muted"
    printf "  Side by side: "
    reset_color
    _ce_block "$hex1" "  1  "
    printf " "
    _ce_block "$hex2" "  2  "
    echo
}

# Show a single token with swatch and hex value
_ce_show_token() {
    local token="$1"
    local width=$(_ce_width)
    local hex=$(tds_resolve_color "$token" 2>/dev/null)

    if [[ -n "$hex" && ${#hex} -eq 6 ]]; then
        _ce_swatch "$hex" "██"
    else
        printf "░░"
    fi

    # Token name and hex - truncate if needed
    local token_width=$((width - 20))
    [[ $token_width -lt 20 ]] && token_width=20
    printf " %-${token_width}s" "$(tds_truncate "$token" "$token_width")"
    tds_text_color "text.dim"
    printf "→ %s\n" "${hex:-N/A}"
    reset_color
}

# Show all design tokens with live color rendering
tdocs_show_design_tokens() {
    local width=$(_ce_width)

    _ce_header "TDOCS Design Token Viewer"
    echo

    # TDOCS Tokens using NEW TAXONOMY (scope/type/module/grade)
    _ce_subheader "Scope Tokens (application reach)"
    for key in tdocs.scope.system tdocs.scope.module tdocs.scope.feature tdocs.scope.temporal; do
        printf "  "
        _ce_show_token "$key"
    done

    _ce_subheader "Type Tokens (document type)"
    for key in tdocs.type.spec tdocs.type.guide tdocs.type.investigation tdocs.type.reference \
               tdocs.type.plan tdocs.type.summary tdocs.type.scratch; do
        printf "  "
        _ce_show_token "$key"
    done

    _ce_subheader "Module Token (ownership)"
    printf "  "
    _ce_show_token "tdocs.module"

    _ce_subheader "Grade Tokens (reliability)"
    for key in tdocs.grade.A tdocs.grade.B tdocs.grade.C tdocs.grade.X; do
        printf "  "
        _ce_show_token "$key"
    done

    _ce_subheader "Lifecycle Tokens"
    for key in tdocs.lifecycle.C tdocs.lifecycle.S tdocs.lifecycle.W tdocs.lifecycle.D tdocs.lifecycle.X; do
        printf "  "
        _ce_show_token "$key"
    done

    _ce_subheader "Completeness Levels"
    for level in {0..4}; do
        printf "  "
        _ce_show_token "tdocs.level.$level"
    done

    echo
    _ce_header "Semantic Token Layers" "-"
    echo

    # Show 3-layer token architecture
    tds_text_color "text.muted"
    echo "  Token indirection: Semantic Role → Palette Slot → Hex"
    reset_color
    echo

    # Primary/Secondary/Semantic/Surface mapping
    _ce_subheader "Action Tokens (interactive elements)"
    local -a action_tokens=("action.primary" "action.secondary" "action.destructive" "action.constructive")
    for token in "${action_tokens[@]}"; do
        printf "  "
        _ce_show_token "$token"
    done

    _ce_subheader "Text Tokens (typography hierarchy)"
    local -a text_tokens=("text.primary" "text.secondary" "text.muted" "text.dim")
    for token in "${text_tokens[@]}"; do
        printf "  "
        _ce_show_token "$token"
    done

    _ce_subheader "Status Tokens (semantic feedback)"
    local -a status_tokens=("status.error" "status.warning" "status.success" "status.info")
    for token in "${status_tokens[@]}"; do
        printf "  "
        _ce_show_token "$token"
    done

    _ce_subheader "Surface Tokens (backgrounds)"
    local -a surface_tokens=("structural.bg.primary" "structural.bg.secondary" "structural.bg.tertiary")
    for token in "${surface_tokens[@]}"; do
        printf "  "
        _ce_show_token "$token"
    done

    echo
    tds_text_color "text.dim"
    echo "All tokens use FOREGROUND-ONLY colors (no background)"
    reset_color
}

# Interactive color picker - navigate 256 colors with keyboard
tdocs_color_pick() {
    local selected=0
    local max=255

    _ce_header "Interactive Color Picker"
    echo
    tds_text_color "text.muted"
    echo "  Use: j/k or arrows to navigate, q to quit, enter to select"
    reset_color
    echo

    # Simple picker - show current selection with neighbors
    while true; do
        # Clear previous line and show current selection
        printf "\r\033[K"

        # Show context: 5 colors before, current, 5 after
        for offset in -5 -4 -3 -2 -1 0 1 2 3 4 5; do
            local idx=$((selected + offset))
            [[ $idx -lt 0 || $idx -gt $max ]] && { printf "     "; continue; }

            if [[ $offset -eq 0 ]]; then
                printf "\033[48;5;%dm>[%3d]\033[0m" "$idx" "$idx"
            else
                printf "\033[48;5;%dm %3d \033[0m" "$idx" "$idx"
            fi
        done

        local hex=$(tds_256_to_hex "$selected")
        printf "  #%s" "$hex"

        # Read single keypress
        read -rsn1 key
        case "$key" in
            j|B) ((selected < max)) && ((selected++)) ;;
            k|A) ((selected > 0)) && ((selected--)) ;;
            h|D) ((selected >= 10)) && ((selected-=10)) ;;
            l|C) ((selected <= max-10)) && ((selected+=10)) ;;
            q) echo; return 0 ;;
            '') echo; echo "Selected: $selected (#$hex)"; return 0 ;;
        esac
    done
}

# Compare current theme with another theme
tdocs_theme_compare() {
    local other_theme="${1:-}"
    local width=$(_ce_width)

    if [[ -z "$other_theme" ]]; then
        _ce_header "Available Themes"
        echo
        local theme_dir="$TDS_SRC/themes"
        if [[ -d "$theme_dir" ]]; then
            for f in "$theme_dir"/*.sh; do
                [[ -f "$f" ]] || continue
                local name=$(basename "$f" .sh)
                [[ "$name" == "theme_registry" ]] && continue
                printf "  %s\n" "$name"
            done
        fi
        echo
        tds_text_color "text.muted"
        echo "Usage: colors theme <name>"
        reset_color
        return 0
    fi

    _ce_header "Theme Comparison: current vs $other_theme"
    echo

    # Save current palette
    local -a save_primary=("${PRIMARY[@]}")
    local -a save_secondary=("${SECONDARY[@]}")
    local -a save_semantic=("${SEMANTIC[@]}")
    local -a save_surface=("${SURFACE[@]}")

    # Load other theme
    local theme_file="$TDS_SRC/themes/${other_theme}.sh"
    if [[ ! -f "$theme_file" ]]; then
        tds_text_color "status.error"
        echo "Theme not found: $other_theme"
        reset_color
        return 1
    fi

    source "$theme_file"
    local load_func="tds_load_theme_${other_theme}"
    if declare -f "$load_func" >/dev/null 2>&1; then
        "$load_func"
    fi

    # Show side-by-side comparison
    _ce_subheader "Palette Comparison"
    printf "  %-12s %-20s %-20s\n" "Slot" "Current" "$other_theme"

    for palette in PRIMARY SECONDARY SEMANTIC SURFACE; do
        printf "\n  %s:\n" "${palette,,}"
        local save_arr="save_${palette,,}[@]"
        local new_arr="${palette}[@]"

        local -a saved=("${!save_arr}")
        local -a new=("${!new_arr}")

        for i in {0..7}; do
            printf "    [%d] " "$i"
            _ce_swatch "${saved[$i]}" "██"
            printf " #%-6s  " "${saved[$i]}"
            _ce_swatch "${new[$i]}" "██"
            printf " #%-6s" "${new[$i]}"
            [[ "${saved[$i]}" != "${new[$i]}" ]] && printf " *"
            echo
        done
    done

    # Restore original palette
    PRIMARY=("${save_primary[@]}")
    SECONDARY=("${save_secondary[@]}")
    SEMANTIC=("${save_semantic[@]}")
    SURFACE=("${save_surface[@]}")
    echo
}

# Export tokens in various formats
tdocs_export_tokens() {
    local format="${1:-css}"
    local width=$(_ce_width)

    case "$format" in
        css)
            echo ":root {"
            for token in "${!TDS_COLOR_TOKENS[@]}"; do
                local hex=$(tds_resolve_color "$token" 2>/dev/null)
                [[ -n "$hex" ]] && printf "  --tds-%s: #%s;\n" "${token//./-}" "$hex"
            done | sort
            echo "}"
            ;;
        json)
            echo "{"
            local first=true
            for token in "${!TDS_COLOR_TOKENS[@]}"; do
                local hex=$(tds_resolve_color "$token" 2>/dev/null)
                if [[ -n "$hex" ]]; then
                    $first || printf ",\n"
                    printf '  "%s": "#%s"' "$token" "$hex"
                    first=false
                fi
            done | sort
            echo
            echo "}"
            ;;
        toml)
            echo "[tds.colors]"
            for token in "${!TDS_COLOR_TOKENS[@]}"; do
                local hex=$(tds_resolve_color "$token" 2>/dev/null)
                [[ -n "$hex" ]] && printf '%s = "#%s"\n' "${token//./_}" "$hex"
            done | sort
            ;;
        *)
            tds_text_color "status.error"
            echo "Unknown format: $format"
            reset_color
            tds_text_color "text.muted"
            echo "Supported: css, json, toml"
            reset_color
            return 1
            ;;
    esac
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
                tds_text_color "status.warning"
                echo "Usage: tdocs_color_explorer swap <category> <palette>"
                reset_color
                tds_text_color "text.muted"
                echo "Example: tdocs_color_explorer swap type primary"
                reset_color
                return 1
            fi
            tdocs_swap_palette "$2" "$3"
            ;;
        256|palette256)
            tdocs_show_256_palette
            ;;
        compare)
            if [[ $# -lt 3 ]]; then
                tds_text_color "status.warning"
                echo "Usage: tdocs_color_explorer compare <color1> <color2>"
                reset_color
                tds_text_color "text.muted"
                echo "Example: tdocs_color_explorer compare FF5733 33"
                reset_color
                return 1
            fi
            tdocs_compare_colors "$2" "$3"
            ;;
        tokens|viewer|view)
            tdocs_show_design_tokens
            ;;
        pick|picker)
            tdocs_color_pick
            ;;
        theme)
            tdocs_theme_compare "$2"
            ;;
        export)
            tdocs_export_tokens "${2:-css}"
            ;;
        menu|help|*)
            _ce_show_help
            ;;
    esac
}

# Formatted help output using TDS colors
_ce_show_help() {
    local width=$(_ce_width)

    _ce_header "TDOCS Color Explorer"
    echo
    tds_text_color "text.secondary"
    printf "%s\n" "$(tds_truncate "A tool for exploring TDS colors, converting between formats, and managing" "$((width - 2))")"
    printf "%s\n" "$(tds_truncate "the 8-color patterns used for tdocs' 4 major semantic categories." "$((width - 2))")"
    reset_color
    echo

    _ce_subheader "USAGE"
    tds_text_color "text.muted"
    echo "  tdocs_color_explorer <command> [args]"
    reset_color
    echo

    _ce_subheader "COMMANDS"

    # Command list with colors
    local -a cmds=(
        "tokens:Show design tokens with semantic layers"
        "pick:Interactive 256-color picker"
        "theme [name]:Compare themes or list available"
        "export [fmt]:Export tokens (css/json/toml)"
        "convert:Show 24-bit to 256-color conversion"
        "assignments:Show palette assignments"
        "pattern <cat>:Show 8-color pattern for category"
        "256:Show all 256 ANSI colors"
        "compare <c1> <c2>:Compare two colors"
        "help:Show this help"
    )

    for entry in "${cmds[@]}"; do
        local cmd="${entry%%:*}"
        local desc="${entry#*:}"

        tds_text_color "action.primary"
        printf "  %-18s" "$cmd"
        reset_color
        tds_text_color "text.muted"
        local desc_width=$((width - 22))
        printf "%s\n" "$(tds_truncate "$desc" "$desc_width")"
        reset_color
    done
    echo

    _ce_subheader "SEMANTIC CATEGORIES"
    local -a cats=(
        "scope:Application reach (system, module, feature, temporal)"
        "type:Document type (spec, guide, investigation, etc.)"
        "module:Module ownership (tdocs, rag, repl, etc.)"
        "grade:Reliability (A=Canonical, B=Established, C=Working, X=Ephemeral)"
    )
    for entry in "${cats[@]}"; do
        local cat="${entry%%:*}"
        local desc="${entry#*:}"
        tds_text_color "status.info"
        printf "  %-10s" "$cat"
        reset_color
        tds_text_color "text.muted"
        printf "%s\n" "$(tds_truncate "$desc" "$((width - 14))")"
        reset_color
    done
    echo

    _ce_subheader "PALETTES"
    local -a pals=(
        "primary:PRIMARY[0-7]:Rainbow colors for cycling"
        "secondary:SECONDARY[0-7]:Theme accent palette"
        "semantic:SEMANTIC[0-7]:Status colors (error/warn/success/info)"
        "surface:SURFACE[0-7]:Background to foreground gradient"
    )
    for entry in "${pals[@]}"; do
        IFS=':' read -r name arr desc <<< "$entry"
        tds_text_color "action.primary"
        printf "  %-10s" "$name"
        reset_color
        tds_text_color "text.dim"
        printf "%-16s" "$arr"
        reset_color
        tds_text_color "text.muted"
        printf "%s\n" "$desc"
        reset_color
    done
    echo

    tds_text_color "text.dim"
    echo "Semantic categories (scope/type/module/grade) map to these palettes."
    reset_color
}

# Alias for REPL convenience - "colors" command
colors() {
    tdocs_color_explorer "$@"
}

# Functions are available in current shell - no export needed
# (export -f causes errors when child processes use /bin/sh)
