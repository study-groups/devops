#!/usr/bin/env bash
# TDS Theme Validation
# Validates that themes properly define all required palettes and structures

# Required palette names
declare -ga TDS_REQUIRED_PALETTES=(
    "ENV_PRIMARY"
    "MODE_PRIMARY"
    "VERBS_PRIMARY"
    "NOUNS_PRIMARY"
)

# Required palette size
declare -g TDS_PALETTE_SIZE=8

# Validate that a palette array is properly defined
# Args: palette_name
# Returns: 0 if valid, 1 if invalid
tds_validate_palette() {
    local palette_name="$1"
    local -n palette_ref="$palette_name" 2>/dev/null || {
        echo "ERROR: Palette '$palette_name' is not defined" >&2
        return 1
    }

    local size="${#palette_ref[@]}"
    if [[ $size -ne $TDS_PALETTE_SIZE ]]; then
        echo "ERROR: Palette '$palette_name' has $size colors, expected $TDS_PALETTE_SIZE" >&2
        return 1
    fi

    # Validate each color is a hex value
    for i in "${!palette_ref[@]}"; do
        local color="${palette_ref[$i]}"
        if [[ ! "$color" =~ ^#[0-9A-Fa-f]{6}$ ]]; then
            echo "ERROR: Palette '$palette_name[$i]' has invalid color: '$color' (expected #RRGGBB)" >&2
            return 1
        fi
    done

    return 0
}

# Validate that all required palettes are defined and valid
# Returns: 0 if all valid, 1 if any invalid
tds_validate_all_palettes() {
    local all_valid=true

    for palette in "${TDS_REQUIRED_PALETTES[@]}"; do
        if ! tds_validate_palette "$palette"; then
            all_valid=false
        fi
    done

    if [[ "$all_valid" == "false" ]]; then
        return 1
    fi

    return 0
}

# Validate a theme after it's been loaded
# Args: theme_name
# Returns: 0 if valid, 1 if invalid
tds_validate_theme() {
    local theme_name="$1"

    # Check if theme is registered
    if [[ -z "${TDS_THEME_REGISTRY[$theme_name]}" ]]; then
        echo "ERROR: Theme '$theme_name' is not registered" >&2
        return 1
    fi

    # Load the theme
    local loader="${TDS_THEME_REGISTRY[$theme_name]}"
    if ! declare -f "$loader" >/dev/null; then
        echo "ERROR: Theme loader function '$loader' not found" >&2
        return 1
    fi

    # Call the loader
    "$loader" || {
        echo "ERROR: Theme loader '$loader' failed" >&2
        return 1
    }

    # Validate all palettes
    if ! tds_validate_all_palettes; then
        echo "ERROR: Theme '$theme_name' has invalid palettes" >&2
        return 1
    fi

    return 0
}

# Show validation report for a theme
# Args: theme_name
tds_show_theme_validation() {
    local theme_name="$1"

    echo "Validating theme: $theme_name"
    echo "================================"

    if tds_validate_theme "$theme_name"; then
        echo "✓ Theme is valid"
        echo
        echo "Palette summary:"
        for palette in "${TDS_REQUIRED_PALETTES[@]}"; do
            local -n p="$palette"
            echo "  ✓ $palette: ${#p[@]} colors"
        done
        return 0
    else
        echo "✗ Theme validation failed"
        return 1
    fi
}

# Export functions
export -f tds_validate_palette
export -f tds_validate_all_palettes
export -f tds_validate_theme
export -f tds_show_theme_validation
