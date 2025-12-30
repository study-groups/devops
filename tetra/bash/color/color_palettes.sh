#!/usr/bin/env bash

# Source guard
[[ -n "${_COLOR_PALETTES_LOADED}" ]] && return 0
_COLOR_PALETTES_LOADED=1

source "$(dirname "${BASH_SOURCE[0]}")/color_core.sh"

# =============================================================================
# TDS 4-PALETTE SYSTEM
# =============================================================================
#
# PRIMARY[0-7]    - Main rainbow (universal, for list cycling)
# SECONDARY[0-7]  - Theme accent (theme personality)
# SEMANTIC[0-7]   - Derived: error/warning/success/info + dims
# SURFACE[0-7]    - Derived: bg→fg gradient, tinted
#
# Theme authors define: BACKGROUND, TINT, PRIMARY, SECONDARY
# System derives: SEMANTIC, SURFACE via tds_derive()

# =============================================================================
# THEME INPUTS (defined by theme or defaults)
# =============================================================================

# Background anchor color
declare -g BACKGROUND="${BACKGROUND:-1A1A2E}"

# Surface tint saturation (0=pure gray, higher=more tinted)
declare -g TINT="${TINT:-10}"

# PRIMARY - Main rainbow for list cycling
# 8 maximally distinct hues spread across color wheel
declare -ga PRIMARY=(
    "E53935"  # 0: red (0°)
    "FB8C00"  # 1: orange (30°)
    "FDD835"  # 2: yellow (60°)
    "43A047"  # 3: green (120°)
    "00ACC1"  # 4: cyan (180°)
    "1E88E5"  # 5: blue (210°)
    "8E24AA"  # 6: purple (270°)
    "EC407A"  # 7: pink (330°)
)

# SECONDARY - Theme accent palette
# Default: offset rainbow (+22° from PRIMARY)
# Themes can override with earth tones, pastels, etc.
declare -ga SECONDARY=(
    "E56335"  # 0: coral      (22°)
    "C8A400"  # 1: gold       (52°)
    "7DBB00"  # 2: lime       (82°)
    "00A86B"  # 3: emerald    (142°)
    "007BA7"  # 4: azure      (202°)
    "4169E1"  # 5: royal blue (232°)
    "A347A3"  # 6: orchid     (292°)
    "E5355E"  # 7: rose       (352°)
)

# =============================================================================
# DERIVED PALETTES (computed by tds_derive)
# =============================================================================

# SEMANTIC - Status colors derived from PRIMARY
declare -ga SEMANTIC=()

# SURFACE - Background to foreground gradient, tinted
declare -ga SURFACE=()

# =============================================================================
# tds_derive() - Compute SEMANTIC and SURFACE from inputs
# =============================================================================

tds_derive() {
    # Extract background properties
    local bg_hsl=$(hex_to_hsl "$BACKGROUND")
    local bg_h=${bg_hsl%% *}
    local temp=${bg_hsl#* }
    local bg_s=${temp%% *}
    local bg_l=${temp#* }

    # -------------------------------------------------------------------------
    # SEMANTIC: error/warning/success/info from PRIMARY slots
    # -------------------------------------------------------------------------
    # Slots: 0=red(error), 1=orange(warning), 3=green(success), 5=blue(info)
    local error_hex="${PRIMARY[0]}"
    local warning_hex="${PRIMARY[1]}"
    local success_hex="${PRIMARY[3]}"
    local info_hex="${PRIMARY[5]}"

    # Ensure contrast against background
    error_hex=$(tds_ensure_contrast "$error_hex" "$BACKGROUND")
    warning_hex=$(tds_ensure_contrast "$warning_hex" "$BACKGROUND")
    success_hex=$(tds_ensure_contrast "$success_hex" "$BACKGROUND")
    info_hex=$(tds_ensure_contrast "$info_hex" "$BACKGROUND")

    SEMANTIC=(
        "$error_hex"                      # 0: error
        "$warning_hex"                    # 1: warning
        "$success_hex"                    # 2: success
        "$info_hex"                       # 3: info
        "$(tds_dim "$error_hex" 40)"      # 4: error dim
        "$(tds_dim "$warning_hex" 40)"    # 5: warning dim
        "$(tds_dim "$success_hex" 40)"    # 6: success dim
        "$(tds_dim "$info_hex" 40)"       # 7: info dim
    )

    # -------------------------------------------------------------------------
    # SURFACE: tinted gradient from background to foreground
    # -------------------------------------------------------------------------
    SURFACE=()
    local i l
    for i in {0..7}; do
        if ((bg_l < 50)); then
            # Dark theme: 0=dark (bg), 7=light (fg)
            l=$((8 + i * 12))   # 8% to 92%
        else
            # Light theme: 0=light (bg), 7=dark (fg)
            l=$((92 - i * 12))  # 92% to 8%
        fi
        SURFACE+=("$(hsl_to_hex "$bg_h" "$TINT" "$l")")
    done
}

# =============================================================================
# COLOR ACCESS FUNCTIONS
# =============================================================================

# Get color from palette by name and index
# Usage: tds_color primary 3 → hex color
tds_color() {
    local palette="${1,,}"  # lowercase
    local index="${2:-0}"

    case "$palette" in
        primary)   echo "${PRIMARY[$index]:-888888}" ;;
        secondary) echo "${SECONDARY[$index]:-888888}" ;;
        semantic)  echo "${SEMANTIC[$index]:-888888}" ;;
        surface)   echo "${SURFACE[$index]:-888888}" ;;
        *)         echo "888888" ;;
    esac
}

# Apply color from palette
# Usage: tds_apply primary 3 → sets terminal color
tds_apply() {
    local hex=$(tds_color "$1" "$2")
    text_color "$hex"
}

# =============================================================================
# CONVENIENCE FUNCTIONS (using new names)
# =============================================================================

primary_color() {
    local index=$1 variant=${2:-primary}
    local color="${PRIMARY[$index]}"
    case "$variant" in
        bright) color="$(tds_bright "$color" 30)" ;;
        dark)   color="$(tds_dim "$color" 30)" ;;
    esac
    text_color "$color"
}

secondary_color() {
    local index=$1 variant=${2:-primary}
    local color="${SECONDARY[$index]}"
    case "$variant" in
        bright) color="$(tds_bright "$color" 30)" ;;
        dark)   color="$(tds_dim "$color" 30)" ;;
    esac
    text_color "$color"
}

semantic_color() {
    local index=$1
    text_color "${SEMANTIC[$index]}"
}

surface_color() {
    local index=$1
    text_color "${SURFACE[$index]}"
}

# =============================================================================
# INITIALIZATION
# =============================================================================

# Run derivation with defaults
tds_derive
