#!/usr/bin/env bash

LOG_FILE="/tmp/color_debug.log"
echo "=== COLOR ERROR DEBUG $(date) ===" > "$LOG_FILE"

echo "1. Testing hex_to_rgb function:" >> "$LOG_FILE"
source ./modules/colors/color_core.sh >> "$LOG_FILE" 2>&1
echo "hex_to_rgb 00AA00: $(hex_to_rgb "00AA00")" >> "$LOG_FILE"

echo -e "\n2. Testing variable assignment:" >> "$LOG_FILE"
{
    read fg_r fg_g fg_b
} < <(hex_to_rgb "00AA00")
echo "fg_r='$fg_r' fg_g='$fg_g' fg_b='$fg_b'" >> "$LOG_FILE"

echo -e "\n3. Testing arithmetic with actual values:" >> "$LOG_FILE"
set -x
fg_factor=7
bg_factor=0
bg_r=255
bg_g=255
bg_b=255
echo "Before arithmetic: fg_r='$fg_r' bg_r='$bg_r'" >> "$LOG_FILE"
r=$(( (fg_r * fg_factor + bg_r * bg_factor) / 7 )) 2>> "$LOG_FILE"
echo "Result r='$r'" >> "$LOG_FILE"
set +x

echo -e "\n4. Testing theme_aware_dim directly:" >> "$LOG_FILE"
theme_aware_dim "00AA00" 3 >> "$LOG_FILE" 2>&1

echo -e "\n5. Checking what calls theme_aware_dim:" >> "$LOG_FILE"
grep -n "theme_aware_dim" ./modules/colors/*.sh >> "$LOG_FILE"

echo -e "\n6. Full backtrace when error occurs:" >> "$LOG_FILE"
bash -x ./modules/colors/color_elements.sh >> "$LOG_FILE" 2>&1 | head -50

echo "Debug complete. Send this log:"
echo "cat /tmp/color_debug.log"