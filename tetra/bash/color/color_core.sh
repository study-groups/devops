#!/usr/bin/env bash

# Source guard
[[ -n "${_COLOR_CORE_LOADED}" ]] && return 0
_COLOR_CORE_LOADED=1

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

# =============================================================================
# HSL CONVERSION (for color transforms)
# =============================================================================

# Convert RGB (0-255) to HSL (h:0-360, s:0-100, l:0-100)
# Output: "H S L" space-separated
rgb_to_hsl() {
    local r=$1 g=$2 b=$3

    # Normalize to 0-1 range (scaled by 1000 for integer math)
    local r1=$((r * 1000 / 255))
    local g1=$((g * 1000 / 255))
    local b1=$((b * 1000 / 255))

    # Find min/max
    local max=$r1 min=$r1
    ((g1 > max)) && max=$g1
    ((b1 > max)) && max=$b1
    ((g1 < min)) && min=$g1
    ((b1 < min)) && min=$b1

    local delta=$((max - min))
    local l=$(((max + min) / 2))

    local h=0 s=0

    if ((delta > 0)); then
        # Saturation
        if ((l > 500)); then
            s=$((delta * 1000 / (2000 - max - min)))
        else
            s=$((delta * 1000 / (max + min)))
        fi

        # Hue
        if ((max == r1)); then
            h=$(((g1 - b1) * 60 / delta))
            ((h < 0)) && h=$((h + 360))
        elif ((max == g1)); then
            h=$((120 + (b1 - r1) * 60 / delta))
        else
            h=$((240 + (r1 - g1) * 60 / delta))
        fi
    fi

    # Scale s and l to 0-100
    s=$((s / 10))
    l=$((l / 10))

    echo "$h $s $l"
}

# Convert HSL to RGB
# Input: h (0-360), s (0-100), l (0-100)
# Output: "R G B" space-separated (0-255)
hsl_to_rgb() {
    local h=$1 s=$2 l=$3

    # Handle grayscale
    if ((s == 0)); then
        local v=$((l * 255 / 100))
        echo "$v $v $v"
        return
    fi

    # Scale to 0-1000 for integer math
    local s1=$((s * 10))
    local l1=$((l * 10))

    local q
    if ((l1 < 500)); then
        q=$((l1 * (1000 + s1) / 1000))
    else
        q=$((l1 + s1 - l1 * s1 / 1000))
    fi
    local p=$((2 * l1 - q))

    _hue_to_rgb() {
        local p=$1 q=$2 t=$3
        ((t < 0)) && t=$((t + 360))
        ((t > 360)) && t=$((t - 360))

        if ((t < 60)); then
            echo $((p + (q - p) * t / 60))
        elif ((t < 180)); then
            echo $q
        elif ((t < 240)); then
            echo $((p + (q - p) * (240 - t) / 60))
        else
            echo $p
        fi
    }

    local r=$(_hue_to_rgb $p $q $((h + 120)))
    local g=$(_hue_to_rgb $p $q $h)
    local b=$(_hue_to_rgb $p $q $((h - 120)))

    # Scale back to 0-255
    r=$((r * 255 / 1000))
    g=$((g * 255 / 1000))
    b=$((b * 255 / 1000))

    # Clamp
    ((r > 255)) && r=255; ((r < 0)) && r=0
    ((g > 255)) && g=255; ((g < 0)) && g=0
    ((b > 255)) && b=255; ((b < 0)) && b=0

    echo "$r $g $b"
}

# Convert hex to HSL
hex_to_hsl() {
    local hex="$1"
    local rgb=$(hex_to_rgb "$hex")
    local r=${rgb%% *}
    local temp=${rgb#* }
    local g=${temp%% *}
    local b=${temp#* }
    rgb_to_hsl "$r" "$g" "$b"
}

# Convert HSL to hex
hsl_to_hex() {
    local h=$1 s=$2 l=$3
    local rgb=$(hsl_to_rgb "$h" "$s" "$l")
    local r=${rgb%% *}
    local temp=${rgb#* }
    local g=${temp%% *}
    local b=${temp#* }
    rgb_to_hex "$r" "$g" "$b"
}

# =============================================================================
# COLOR TRANSFORMS (tunable)
# =============================================================================

# Global intensity parameters (0-100, default 50)
declare -g TDS_NEON_INTENSITY=${TDS_NEON_INTENSITY:-50}
declare -g TDS_MUTED_INTENSITY=${TDS_MUTED_INTENSITY:-50}
declare -g TDS_BRIGHT_INTENSITY=${TDS_BRIGHT_INTENSITY:-50}

# Neon transform: boost saturation and lightness
# Makes colors pop with a vibrant, electric feel
tds_neon() {
    local hex="$1"
    local intensity="${2:-$TDS_NEON_INTENSITY}"

    local hsl=$(hex_to_hsl "$hex")
    local h=${hsl%% *}
    local temp=${hsl#* }
    local s=${temp%% *}
    local l=${temp#* }

    # Boost saturation toward 100 based on intensity
    local s_boost=$((intensity * (100 - s) / 100))
    s=$((s + s_boost))
    ((s > 100)) && s=100

    # Slight lightness boost for glow effect
    local l_boost=$((intensity * 15 / 100))
    l=$((l + l_boost))
    ((l > 95)) && l=95

    hsl_to_hex "$h" "$s" "$l"
}

# Muted transform: reduce saturation
tds_muted() {
    local hex="$1"
    local intensity="${2:-$TDS_MUTED_INTENSITY}"

    local hsl=$(hex_to_hsl "$hex")
    local h=${hsl%% *}
    local temp=${hsl#* }
    local s=${temp%% *}
    local l=${temp#* }

    # Reduce saturation based on intensity
    local s_reduce=$((intensity * s / 100))
    s=$((s - s_reduce))
    ((s < 0)) && s=0

    hsl_to_hex "$h" "$s" "$l"
}

# Bright transform: increase lightness
tds_bright() {
    local hex="$1"
    local intensity="${2:-$TDS_BRIGHT_INTENSITY}"

    local hsl=$(hex_to_hsl "$hex")
    local h=${hsl%% *}
    local temp=${hsl#* }
    local s=${temp%% *}
    local l=${temp#* }

    # Boost lightness toward 100
    local l_boost=$((intensity * (100 - l) / 100))
    l=$((l + l_boost))
    ((l > 100)) && l=100

    hsl_to_hex "$h" "$s" "$l"
}

# Dim transform: decrease lightness (toward background)
tds_dim() {
    local hex="$1"
    local intensity="${2:-50}"

    local hsl=$(hex_to_hsl "$hex")
    local h=${hsl%% *}
    local temp=${hsl#* }
    local s=${temp%% *}
    local l=${temp#* }

    # Reduce lightness based on intensity
    local l_reduce=$((intensity * l / 100))
    l=$((l - l_reduce))
    ((l < 5)) && l=5

    hsl_to_hex "$h" "$s" "$l"
}

brighten() {
    tds_bright "$1" 30
}

darken() {
    tds_dim "$1" 30
}

# =============================================================================
# CONTRAST & ACCESSIBILITY
# =============================================================================

# Calculate relative luminance (WCAG formula)
# Returns luminance × 1000 (integer math)
tds_luminance() {
    local hex="$1"
    local hex_clean="${hex#\#}"

    [[ ! "$hex_clean" =~ ^[0-9A-Fa-f]{6}$ ]] && { echo "0"; return 1; }

    local r=$((16#${hex_clean:0:2}))
    local g=$((16#${hex_clean:2:2}))
    local b=$((16#${hex_clean:4:2}))

    # sRGB to linear (simplified: divide by 255, apply gamma)
    # Using integer math: scale by 1000
    # Gamma approximation: (x/255)^2.2 ≈ (x*x)/(255*255) for simplicity
    local r_lin=$(( (r * r * 2126) / (255 * 255) ))
    local g_lin=$(( (g * g * 7152) / (255 * 255) ))
    local b_lin=$(( (b * b * 722) / (255 * 255) ))

    echo $(( (r_lin + g_lin + b_lin) / 10 ))
}

# Calculate contrast ratio between two colors
# Returns ratio × 100 (e.g., 450 = 4.5:1)
tds_contrast_ratio() {
    local fg="$1"
    local bg="$2"

    local l1=$(tds_luminance "$fg")
    local l2=$(tds_luminance "$bg")

    # Ensure l1 is lighter
    if ((l2 > l1)); then
        local tmp=$l1
        l1=$l2
        l2=$tmp
    fi

    # Contrast ratio = (L1 + 0.05) / (L2 + 0.05)
    # Scaled: (L1 + 5) * 100 / (L2 + 5)
    echo $(( (l1 + 5) * 100 / (l2 + 5) ))
}

# Ensure a color has sufficient contrast against background
# Adjusts lightness until WCAG AA (4.5:1) is met
tds_ensure_contrast() {
    local fg="$1"
    local bg="${2:-$BACKGROUND}"
    local min_ratio="${3:-450}"  # 4.5:1 default

    local ratio=$(tds_contrast_ratio "$fg" "$bg")

    # Already sufficient
    ((ratio >= min_ratio)) && { echo "$fg"; return 0; }

    # Get HSL of foreground
    local hsl=$(hex_to_hsl "$fg")
    local h=${hsl%% *}
    local temp=${hsl#* }
    local s=${temp%% *}
    local l=${temp#* }

    # Determine if bg is dark or light
    local bg_l=$(tds_luminance "$bg")

    # Adjust lightness iteratively
    local step=5
    local attempts=0
    while ((ratio < min_ratio && attempts < 20)); do
        if ((bg_l < 50)); then
            # Dark bg: lighten fg
            l=$((l + step))
            ((l > 95)) && l=95
        else
            # Light bg: darken fg
            l=$((l - step))
            ((l < 5)) && l=5
        fi

        fg=$(hsl_to_hex "$h" "$s" "$l")
        ratio=$(tds_contrast_ratio "$fg" "$bg")
        ((attempts++))
    done

    echo "$fg"
}

# =============================================================================
# COLOR APPLICATION
# =============================================================================

# Color application functions
hex_to_256() {
    local hex="$1"
    local r g b
    local hex_clean

    # Extract RGB values manually without arithmetic
    hex_clean="${hex#\#}"

    # Validate hex_clean is 6 characters
    if [[ ! "$hex_clean" =~ ^[0-9A-Fa-f]{6}$ ]]; then
        echo "15"  # Default to white
        return 1
    fi

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
    local color256
    color256=$(hex_to_256 "$hex")
    printf "\033[38;5;%d;48;5;%dm" "$color256" "$color256"
}

# Legacy alias for backward compatibility
fg_color() { color_swatch "$@"; }

# Pure foreground text color - for UI text and labels
text_color() {
    local hex="$1"
    local color256
    color256=$(hex_to_256 "$hex")
    printf "\033[38;5;%dm" "$color256"
}

# Legacy alias for backward compatibility
fg_only() { text_color "$@"; }

# Background color only - for highlighting and emphasis
bg_only() {
    local hex="$1"
    local color256
    color256=$(hex_to_256 "$hex")
    printf "\033[48;5;%dm" "$color256"
}

# Full RGB background color - for terminal background setting
bg_color() {
    local hex="$1"
    local hex_clean="${hex#\#}"
    if [[ ! "$hex_clean" =~ ^[0-9A-Fa-f]{6}$ ]]; then
        return 1
    fi
    local r=$((16#${hex_clean:0:2}))
    local g=$((16#${hex_clean:2:2}))
    local b=$((16#${hex_clean:4:2}))
    printf "\033[48;2;%d;%d;%dm" "$r" "$g" "$b"
}
# Reset all color formatting - use after every color sequence
reset_color() { printf "\033[0m"; }

# Readline-aware versions - wrap escape codes for correct cursor positioning
# Use these when building prompts for readline input
text_color_rl() {
    local hex="$1"
    local color256
    color256=$(hex_to_256 "$hex")
    printf "\001\033[38;5;%dm\002" "$color256"
}

reset_color_rl() { printf "\001\033[0m\002"; }

# Desaturation function - works with our color system
desaturate_hex() {
    local hex="$1"
    local level="$2"  # 0-7, where 0=full color, 7=grayscale

    if [[ $level -eq 0 ]]; then
        echo "$hex"
        return
    fi

    # Parse hex directly to avoid IFS issues with process substitution
    local hex_clean="${hex#\#}"

    # Validate
    if [[ ! "$hex_clean" =~ ^[0-9A-Fa-f]{6}$ ]]; then
        echo "$hex"  # Return original if invalid
        return 1
    fi

    local r=$((16#${hex_clean:0:2}))
    local g=$((16#${hex_clean:2:2}))
    local b=$((16#${hex_clean:4:2}))

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
term_fg_color() { printf "\033]10;#%s\007" "$1"; }
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

# =============================================================================
# EXPORTS
# =============================================================================
export -f hex_to_256 hex_to_rgb rgb_to_hex
export -f text_color bg_only term_bg_color reset_color
export -f text_color_rl reset_color_rl
export -f desaturate_hex get_effective_background theme_aware_dim
export -f theme_dimmed_fg_only theme_dimmed_bg_only slam_to_black
