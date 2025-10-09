#!/usr/bin/env bash
source ./modules/colors/color_core.sh

# Override theme_aware_dim with debug version
theme_aware_dim() {
    local fg_hex="$1"
    local level="$2"

    echo "DEBUG: theme_aware_dim called with fg_hex='$fg_hex' level='$level'" >&2

    if [[ $level -eq 0 ]]; then
        echo "$fg_hex"
        return
    fi

    local bg_hex=$(get_effective_background)
    echo "DEBUG: bg_hex='$bg_hex'" >&2

    # Get RGB values for both colors
    local fg_r fg_g fg_b bg_r bg_g bg_b
    read fg_r fg_g fg_b < <(hex_to_rgb "$fg_hex")
    read bg_r bg_g bg_b < <(hex_to_rgb "$bg_hex")

    echo "DEBUG: After read - fg_r='$fg_r' fg_g='$fg_g' fg_b='$fg_b'" >&2
    echo "DEBUG: After read - bg_r='$bg_r' bg_g='$bg_g' bg_b='$bg_b'" >&2

    # Check if variables contain spaces
    if [[ "$fg_r" =~ [[:space:]] ]]; then
        echo "ERROR: fg_r contains spaces: '$fg_r'" >&2
    fi

    # Interpolate between foreground and background
    local fg_factor=$(( 7 - level ))  # 7=pure fg, 0=pure bg
    local bg_factor=$level            # 0=no bg, 7=pure bg

    local r=$(( (fg_r * fg_factor + bg_r * bg_factor) / 7 ))
    local g=$(( (fg_g * fg_factor + bg_g * bg_factor) / 7 ))
    local b=$(( (fg_b * fg_factor + bg_b * bg_factor) / 7 ))

    rgb_to_hex "$r" "$g" "$b"
}

# Test with actual demo colors
echo "Testing with demo colors:"
theme_aware_dim "00AA00" 3
theme_aware_dim "0088FF" 2
