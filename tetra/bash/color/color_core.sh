#!/usr/bin/env bash

# Color conversion functions
hex_to_rgb() {
    local hex=${1#\#}

    # Validate input - must be 6 characters
    if [[ ${#hex} -ne 6 ]]; then
        echo "0 0 0"  # Default to black for invalid input
        return 1
    fi

    # Ensure all characters are hex digits
    if [[ ! "$hex" =~ ^[0-9A-Fa-f]{6}$ ]]; then
        echo "0 0 0"  # Default to black for invalid input
        return 1
    fi

    echo "$((16#${hex:0:2})) $((16#${hex:2:2})) $((16#${hex:4:2}))"
}

rgb_to_hex() {
    printf "%02X%02X%02X" "$1" "$2" "$3"
}

complement_hue() {
    local h=$1
    echo $(( (h + 180) % 360 ))
}

brighten() {
    echo "$1"  # Just return original hex
}

darken() {
    echo "$1"  # Just return original hex
}

# Color application functions
hex_to_256() {
    local hex="$1"
    local r g b

    # Extract RGB values manually without arithmetic
    local hex_clean=${hex#\#}
    r=$((16#${hex_clean:0:2}))
    g=$((16#${hex_clean:2:2}))
    b=$((16#${hex_clean:4:2}))

    # Convert RGB to 256-color palette
    local result
    if [[ $r -eq $g && $g -eq $b ]]; then
        # Grayscale: use gray ramp (colors 232-255)
        result=$(( r * 23 / 255 + 232 ))
    else
        # Color cube: 6x6x6 RGB cube (colors 16-231)
        local r6=$(( r * 5 / 255 ))
        local g6=$(( g * 5 / 255 ))
        local b6=$(( b * 5 / 255 ))
        result=$(( 16 + r6 * 36 + g6 * 6 + b6 ))
    fi

    echo "$result"
}

# Solid color block (fg+bg same color) - for palette swatches and visual indicators
color_swatch() {
    local hex="$1"
    local color256=$(hex_to_256 "$hex")
    printf "\033[38;5;%d;48;5;%dm" "$color256" "$color256"
}

# Legacy alias for backward compatibility
fg_color() { color_swatch "$@"; }

# Pure foreground text color - for UI text and labels
text_color() {
    local hex="$1"
    local color256=$(hex_to_256 "$hex")
    printf "\033[38;5;%dm" "$color256"
}

# Legacy alias for backward compatibility
fg_only() { text_color "$@"; }

# Background color only - for highlighting and emphasis
bg_only() {
    local hex="$1"
    local color256=$(hex_to_256 "$hex")
    printf "\033[48;5;%dm" "$color256"
}

# Full RGB background color - for terminal background setting
bg_color() {
    local hex="$1"
    local r g b
    read r g b < <(hex_to_rgb "$hex")
    printf "\033[48;2;%d;%d;%dm" "$r" "$g" "$b"
}
# Reset all color formatting - use after every color sequence
reset_color() { printf "\033[0m"; }

# Desaturation function - works with our color system
desaturate_hex() {
    local hex="$1"
    local level="$2"  # 0-7, where 0=full color, 7=grayscale

    if [[ $level -eq 0 ]]; then
        echo "$hex"
        return
    fi

    local r g b
    read r g b < <(hex_to_rgb "$hex")

    # Convert to grayscale using luminance formula
    local gray=$(( (r * 299 + g * 587 + b * 114) / 1000 ))

    # Interpolate between original color and grayscale
    local factor=$(( 7 - level ))  # 7=original, 0=grayscale
    r=$(( (r * factor + gray * level) / 7 ))
    g=$(( (g * factor + gray * level) / 7 ))
    b=$(( (b * factor + gray * level) / 7 ))

    rgb_to_hex "$r" "$g" "$b"
}

# Desaturated color functions
desaturated_bg_only() {
    local hex="$1"
    local level="$2"
    local desat_hex=$(desaturate_hex "$hex" "$level")
    bg_only "$desat_hex"
}

desaturated_fg_only() {
    local hex="$1"
    local level="$2"
    local desat_hex=$(desaturate_hex "$hex" "$level")
    fg_only "$desat_hex"
}

# Background detection and management
term_bg_color() { printf "\033]11;#%s\007" "$1"; }
set_background() {
    SCREEN_BACKGROUND="$1"
    term_bg_color "$1"
}

# Smart background detection with Mac-safe fallbacks
get_effective_background() {
    if [[ -n "$SCREEN_BACKGROUND" ]]; then
        echo "$SCREEN_BACKGROUND"
    elif [[ -n "$CURRENT_THEME" ]]; then
        case "$CURRENT_THEME" in
            light) echo "FFFFFF" ;;
            dark) echo "1E1E1E" ;;
            solarized) echo "002B36" ;;
            *) echo "000000" ;;  # Safe black fallback
        esac
    else
        echo "000000"  # Conservative black for unknown Mac terminal backgrounds
    fi
}

# Theme-aware dimming - interpolates colors toward effective background
theme_aware_dim() {
    local fg_hex="$1"
    local level="$2"  # 0-7, where 0=full color, 7=merge with background

    if [[ $level -eq 0 ]]; then
        echo "$fg_hex"
        return
    fi

    local bg_hex=$(get_effective_background)

    # Get RGB values for both colors
    local fg_r fg_g fg_b bg_r bg_g bg_b
    # Get RGB values for both colors - bulletproof method
    local fg_rgb=$(hex_to_rgb "$fg_hex")
    local bg_rgb=$(hex_to_rgb "$bg_hex")
    # Parse RGB values using parameter expansion (no read command)
    local fg_r=${fg_rgb%% *}                    # First value
    local temp1=${fg_rgb#* }                   # Remove first
    local fg_g=${temp1%% *}                    # Second value
    local fg_b=${temp1#* }                     # Third value
    local bg_r=${bg_rgb%% *}                    # First value
    local temp2=${bg_rgb#* }                   # Remove first
    local bg_g=${temp2%% *}                    # Second value
    local bg_b=${temp2#* }                     # Third value
    # Interpolate between foreground and background
    local fg_factor=$(( 7 - level ))  # 7=pure fg, 0=pure bg
    local bg_factor=$level            # 0=no bg, 7=pure bg

    local r=$(( (fg_r * fg_factor + bg_r * bg_factor) / 7 ))
    local g=$(( (fg_g * fg_factor + bg_g * bg_factor) / 7 ))
    local b=$(( (fg_b * fg_factor + bg_b * bg_factor) / 7 ))

    rgb_to_hex "$r" "$g" "$b"
}

# Theme-aware dimmed color functions
theme_dimmed_fg_only() {
    local hex="$1"
    local level="$2"
    local dimmed_hex=$(theme_aware_dim "$hex" "$level")
    text_color "$dimmed_hex"
}

theme_dimmed_bg_only() {
    local hex="$1"
    local level="$2"
    local dimmed_hex=$(theme_aware_dim "$hex" "$level")
    bg_only "$dimmed_hex"
}

# Emergency black override for maximum safety
slam_to_black() {
    SCREEN_BACKGROUND="000000"
    term_bg_color "000000"
}
