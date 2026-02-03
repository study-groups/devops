#!/usr/bin/env bash

# TDS CSS Export Layer
# Generates CSS custom properties from TDS palettes for web dashboard parity
#
# Usage:
#   tds css                           # Output :root block to stdout
#   tds css > dashboard/tds-vars.css  # Write to file
#   tds css --json                    # Output as JSON
#   tds css --sync                    # Write to dashboard/tds-vars.css
#
# The exported CSS variables match shared.css naming:
#   --paper-dark, --paper-mid, --paper-light
#   --ink, --ink-muted
#   --border
#   --one (error), --two (success), --three (warning), --four (accent)

: "${TDS_SRC:=$TETRA_SRC/bash/tds}"
: "${TETRA_SRC:=$HOME/tetra/src}"

# =============================================================================
# CSS VARIABLE MAPPING
# =============================================================================
# Maps CSS variable names to palette references
# Format: "palette:index" where palette is primary|secondary|semantic|surface

declare -gA TDS_CSS_MAP=(
    # Paper (background) - from SURFACE palette (dark theme: low indices = dark)
    [--paper-dark]="surface:0"      # Darkest background
    [--paper-mid]="surface:1"       # Mid background (cards, panels)
    [--paper-light]="surface:2"     # Light background (hover, active)

    # Ink (text) - from SURFACE palette (dark theme: high indices = light)
    [--ink]="surface:7"             # Primary text (brightest)
    [--ink-muted]="surface:3"       # Muted/secondary text

    # Border - from SURFACE palette
    [--border]="surface:2"          # Border color (same as paper-light works well)

    # Semantic colors - from SEMANTIC palette
    # These are the "numbered" accent colors used throughout the dashboard
    [--one]="semantic:0"            # Red - error, danger, prod
    [--two]="semantic:2"            # Teal/Green - success, online, local
    [--three]="semantic:1"          # Yellow/Orange - warning, dev/staging

    # Accent - from PRIMARY or SECONDARY palette
    [--four]="primary:6"            # Purple - accent, active, links
)

# Additional semantic aliases for clarity (optional export)
declare -gA TDS_CSS_SEMANTIC_ALIASES=(
    [--error]="semantic:0"
    [--success]="semantic:2"
    [--warning]="semantic:1"
    [--info]="semantic:3"
    [--accent]="primary:6"
    [--accent-secondary]="secondary:4"
)

# =============================================================================
# RESOLUTION
# =============================================================================

# Resolve palette reference to hex color
# Args: palette_ref (e.g., "surface:3")
# Returns: hex color without #
_tds_css_resolve_ref() {
    local ref="$1"
    local palette="${ref%%:*}"
    local index="${ref##*:}"

    case "$palette" in
        primary)   echo "${PRIMARY[$index]:-888888}" ;;
        secondary) echo "${SECONDARY[$index]:-888888}" ;;
        semantic)  echo "${SEMANTIC[$index]:-888888}" ;;
        surface)   echo "${SURFACE[$index]:-888888}" ;;
        *)         echo "888888" ;;
    esac
}

# Ensure palettes are loaded
_tds_css_ensure_palettes() {
    # Check if SURFACE is populated (indicates tds_derive was run)
    if [[ -z "${SURFACE[0]}" ]]; then
        # Try to source color palettes
        if [[ -f "$TETRA_SRC/bash/color/color_palettes.sh" ]]; then
            source "$TETRA_SRC/bash/color/color_palettes.sh"
        else
            # Hardcoded fallback matching shared.css defaults
            SURFACE=(
                "0a0a0a"  # 0: paper-dark
                "1a1a1a"  # 1: paper-mid
                "2a2a2a"  # 2: paper-light
                "666666"  # 3: ink-muted
                "888888"  # 4
                "aaaaaa"  # 5
                "cccccc"  # 6
                "e0e0e0"  # 7: ink
            )
            SEMANTIC=(
                "ff6b6b"  # 0: one/error (red)
                "ffe66d"  # 1: three/warning (yellow)
                "4ecdc4"  # 2: two/success (teal)
                "6b9dfc"  # 3: info (blue)
                "994444"  # 4-7: dim variants
                "998844"
                "449988"
                "446699"
            )
            PRIMARY=(
                "E53935" "FB8C00" "FDD835" "43A047"
                "00ACC1" "1E88E5" "6b5ce7" "EC407A"
            )
            SECONDARY=(
                "E56335" "C8A400" "7DBB00" "00A86B"
                "007BA7" "4169E1" "A347A3" "E5355E"
            )
        fi
    fi
}

# =============================================================================
# EXPORT FUNCTIONS
# =============================================================================

# Output :root CSS block
# Args: [indent] [include_aliases]
tds_export_css_root() {
    local indent="${1:-    }"
    local include_aliases="${2:-false}"

    _tds_css_ensure_palettes

    echo "/* TDS Generated CSS Variables */"
    echo "/* Run: tds css --sync to regenerate */"
    echo ""
    echo ":root {"

    # Core variables (match shared.css)
    local -a core_order=(
        "--paper-dark" "--paper-mid" "--paper-light"
        "--ink" "--ink-muted"
        "--border"
        "--one" "--two" "--three" "--four"
    )

    echo "${indent}/* Paper (backgrounds) */"
    for var in "--paper-dark" "--paper-mid" "--paper-light"; do
        local ref="${TDS_CSS_MAP[$var]}"
        local hex=$(_tds_css_resolve_ref "$ref")
        echo "${indent}${var}: #${hex};"
    done

    echo ""
    echo "${indent}/* Ink (text) */"
    for var in "--ink" "--ink-muted"; do
        local ref="${TDS_CSS_MAP[$var]}"
        local hex=$(_tds_css_resolve_ref "$ref")
        echo "${indent}${var}: #${hex};"
    done

    echo ""
    echo "${indent}/* Structure */"
    local ref="${TDS_CSS_MAP[--border]}"
    local hex=$(_tds_css_resolve_ref "$ref")
    echo "${indent}--border: #${hex};"

    echo ""
    echo "${indent}/* Semantic colors */"
    for var in "--one" "--two" "--three" "--four"; do
        local ref="${TDS_CSS_MAP[$var]}"
        local hex=$(_tds_css_resolve_ref "$ref")
        local comment=""
        case "$var" in
            --one)   comment=" /* error, danger, prod */" ;;
            --two)   comment=" /* success, online, local */" ;;
            --three) comment=" /* warning, dev/staging */" ;;
            --four)  comment=" /* accent, active */" ;;
        esac
        echo "${indent}${var}: #${hex};${comment}"
    done

    # Optional: include semantic aliases
    if [[ "$include_aliases" == "true" ]]; then
        echo ""
        echo "${indent}/* Semantic aliases */"
        for var in "--error" "--success" "--warning" "--info" "--accent"; do
            local ref="${TDS_CSS_SEMANTIC_ALIASES[$var]}"
            local hex=$(_tds_css_resolve_ref "$ref")
            echo "${indent}${var}: #${hex};"
        done
    fi

    echo "}"
}

# Output as JSON object
tds_export_css_json() {
    _tds_css_ensure_palettes

    echo "{"

    local -a order=(
        "--paper-dark" "--paper-mid" "--paper-light"
        "--ink" "--ink-muted"
        "--border"
        "--one" "--two" "--three" "--four"
    )

    local first=true
    for var in "${order[@]}"; do
        local ref="${TDS_CSS_MAP[$var]}"
        local hex=$(_tds_css_resolve_ref "$ref")

        # Convert --var-name to camelCase
        local key="${var#--}"
        key=$(echo "$key" | sed -E 's/-([a-z])/\U\1/g')

        [[ "$first" == "true" ]] || echo ","
        first=false
        printf '  "%s": "#%s"' "$key" "$hex"
    done

    echo ""
    echo "}"
}

# Write CSS file to dashboard
tds_export_css_sync() {
    local output="${1:-$TETRA_SRC/dashboard/tds-vars.css}"

    {
        echo "/* TDS Theme Variables - AUTO-GENERATED */"
        echo "/* Source: tds css --sync */"
        echo "/* Do not edit manually - changes will be overwritten */"
        echo "/* To customize: modify TDS theme, then run: tds css --sync */"
        echo ""
        tds_export_css_root
    } > "$output"

    echo "Synced TDS colors to: $output"
}

# Show mapping table for debugging
tds_css_show_mapping() {
    _tds_css_ensure_palettes

    echo "TDS → CSS Variable Mapping"
    echo "=========================="
    echo ""
    printf "%-16s %-14s %s\n" "CSS Variable" "Palette Ref" "Hex Value"
    printf "%-16s %-14s %s\n" "------------" "-----------" "---------"

    local -a order=(
        "--paper-dark" "--paper-mid" "--paper-light"
        "--ink" "--ink-muted"
        "--border"
        "--one" "--two" "--three" "--four"
    )

    for var in "${order[@]}"; do
        local ref="${TDS_CSS_MAP[$var]}"
        local hex=$(_tds_css_resolve_ref "$ref")
        printf "%-16s %-14s #%s\n" "$var" "$ref" "$hex"
    done
}

# =============================================================================
# CLI INTERFACE
# =============================================================================

tds_css() {
    case "${1:-}" in
        --json|-j)
            tds_export_css_json
            ;;
        --sync|-s)
            tds_export_css_sync "${2:-}"
            ;;
        --map|-m)
            tds_css_show_mapping
            ;;
        --help|-h)
            echo "Usage: tds css [option]"
            echo ""
            echo "Options:"
            echo "  (none)     Output CSS :root block to stdout"
            echo "  --json     Output as JSON object"
            echo "  --sync     Write to dashboard/tds-vars.css"
            echo "  --map      Show palette mapping table"
            echo ""
            echo "Example workflow:"
            echo "  tds theme warm        # Switch to warm theme"
            echo "  tds css --sync        # Sync colors to dashboard"
            ;;
        *)
            tds_export_css_root
            ;;
    esac
}

# Export for use by tds command
export -f tds_css tds_export_css_root tds_export_css_json tds_export_css_sync tds_css_show_mapping
