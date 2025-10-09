#!/usr/bin/env bash

# Instrument the actual color functions to log when variables get corrupted
LOG_FILE="/tmp/color_corruption.log"
echo "=== COLOR CORRUPTION DEBUG $(date) ===" > "$LOG_FILE"

# Backup original functions and replace with instrumented versions
source ./modules/colors/color_core.sh

# Override theme_aware_dim with logging
original_theme_aware_dim=$(declare -f theme_aware_dim)
eval "original_$original_theme_aware_dim"

theme_aware_dim() {
    local fg_hex="$1"
    local level="$2"

    echo "CALL: theme_aware_dim('$fg_hex', '$level') from ${BASH_SOURCE[1]}:${BASH_LINENO[0]}" >> "$LOG_FILE"

    if [[ $level -eq 0 ]]; then
        echo "$fg_hex"
        return
    fi

    local bg_hex=$(get_effective_background)
    local fg_r fg_g fg_b bg_r bg_g bg_b
    local fg_rgb=$(hex_to_rgb "$fg_hex")
    local bg_rgb=$(hex_to_rgb "$bg_hex")

    echo "  hex_to_rgb outputs: fg_rgb='$fg_rgb' bg_rgb='$bg_rgb'" >> "$LOG_FILE"

    read fg_r fg_g fg_b <<< "$fg_rgb"
    read bg_r bg_g bg_b <<< "$bg_rgb"

    echo "  After read: fg_r='$fg_r' fg_g='$fg_g' fg_b='$fg_b'" >> "$LOG_FILE"
    echo "  After read: bg_r='$bg_r' bg_g='$bg_g' bg_b='$bg_b'" >> "$LOG_FILE"

    # Check for corruption
    if [[ "$fg_r" =~ [[:space:]] ]] || [[ "$fg_g" =~ [[:space:]] ]] || [[ "$fg_b" =~ [[:space:]] ]]; then
        echo "  CORRUPTION DETECTED: fg variables contain spaces!" >> "$LOG_FILE"
        echo "    fg_r='$fg_r' fg_g='$fg_g' fg_b='$fg_b'" >> "$LOG_FILE"
        echo "    Environment dump:" >> "$LOG_FILE"
        env | grep -E "^(fg_|bg_|r|g|b)=" >> "$LOG_FILE" 2>/dev/null
    fi

    local fg_factor=$(( 7 - level ))
    local bg_factor=$level

    echo "  Computing: r=(($fg_r * $fg_factor + $bg_r * $bg_factor) / 7)" >> "$LOG_FILE"

    local r=$(( (fg_r * fg_factor + bg_r * bg_factor) / 7 )) 2>>"$LOG_FILE"
    local g=$(( (fg_g * fg_factor + bg_g * bg_factor) / 7 )) 2>>"$LOG_FILE"
    local b=$(( (fg_b * fg_factor + bg_b * bg_factor) / 7 )) 2>>"$LOG_FILE"

    rgb_to_hex "$r" "$g" "$b"
}

# Export the function so it's available to child processes
export -f theme_aware_dim

echo "Debug trap set. Run your demo now and check: tail -f $LOG_FILE"