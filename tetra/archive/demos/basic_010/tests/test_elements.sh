#!/usr/bin/env bash

# Test script for the new element-based color system
# Demonstrates theme-aware dimming and element naming patterns

source ./colors.sh  # Load full color system

echo "=== Element-Based Color System Test ==="
echo

# Test background detection
show_background_info

# Test element palette
show_element_palette

# Test different themes
echo "=== Theme Awareness Test ==="
echo

echo "Testing with different themes:"
echo

# Test with dark theme
echo "Setting dark theme..."
CURRENT_THEME="dark"
echo "Background: $(get_effective_background)"
printf "  ENV unselected: "; demo_env_text "unselected"; printf "SAMPLE"; reset_color; echo " (should dim toward dark)"
printf "  MODE unselected: "; demo_mode_text "unselected"; printf "SAMPLE"; reset_color; echo " (should dim toward dark)"
echo

# Test with light theme
echo "Setting light theme..."
CURRENT_THEME="light"
echo "Background: $(get_effective_background)"
printf "  ENV unselected: "; demo_env_text "unselected"; printf "SAMPLE"; reset_color; echo " (should dim toward white)"
printf "  MODE unselected: "; demo_mode_text "unselected"; printf "SAMPLE"; reset_color; echo " (should dim toward white)"
echo

# Test with custom background
echo "Setting custom background (purple)..."
SCREEN_BACKGROUND="663366"
echo "Background: $(get_effective_background)"
printf "  ENV unselected: "; demo_env_text "unselected"; printf "SAMPLE"; reset_color; echo " (should dim toward purple)"
printf "  MODE unselected: "; demo_mode_text "unselected"; printf "SAMPLE"; reset_color; echo " (should dim toward purple)"
echo

# Reset to safe defaults
CURRENT_THEME="dark"
SCREEN_BACKGROUND=""
echo "Reset to dark theme"
echo

# Test UI function mapping
echo "=== UI Function Mapping Test ==="
echo

echo "NEW element-based functions:"
printf "  env_selected:   "; ui_env_selected; printf "SELECTED"; reset_color; echo
printf "  env_other:      "; ui_env_other; printf "UNSELECTED"; reset_color; echo " (theme-aware dirty white)"
printf "  mode_selected:  "; ui_mode_selected; printf "SELECTED"; reset_color; echo
printf "  mode_other:     "; ui_mode_other; printf "UNSELECTED"; reset_color; echo " (theme-aware dirty white)"
printf "  action_selected:"; ui_action_selected; printf "SELECTED"; reset_color; echo
printf "  action_other:   "; ui_action_other; printf "UNSELECTED"; reset_color; echo " (theme-aware dirty white)"
echo

echo "LEGACY palette-based functions (for comparison):"
printf "  env_selected:   "; ui_env_selected_legacy; printf "SELECTED"; reset_color; echo
printf "  env_other:      "; ui_env_other_legacy; printf "UNSELECTED"; reset_color; echo " (old desaturation)"
printf "  mode_selected:  "; ui_mode_selected_legacy; printf "SELECTED"; reset_color; echo
printf "  mode_other:     "; ui_mode_other_legacy; printf "UNSELECTED"; reset_color; echo " (old desaturation)"
echo

# Demonstrate palette.sh style patterns
echo "=== Palette.sh Style Demo ==="
echo

echo "Four-module layout with bold text (following palette.sh patterns):"
printf "  "; demo_env_text "selected"; printf "ENV MODULE"; reset_color
printf "  "; demo_mode_text "selected"; printf "MODE MODULE"; reset_color
printf "  "; demo_action_text "selected"; printf "ACTION MODULE"; reset_color
printf "  "; demo_noun_text "selected"; printf "NOUN MODULE"; reset_color
echo
echo

printf "  "; demo_env_text "unselected"; printf "ENV MODULE"; reset_color
printf "  "; demo_mode_text "unselected"; printf "MODE MODULE"; reset_color
printf "  "; demo_action_text "unselected"; printf "ACTION MODULE"; reset_color
printf "  "; demo_noun_text "unselected"; printf "NOUN MODULE"; reset_color
echo
echo

# Emergency test
echo "=== Emergency Black Test ==="
echo "Testing slam_to_black function..."
echo "Current background: $(get_effective_background)"
slam_to_black
echo "After slam_to_black: $(get_effective_background)"
printf "  Text should be visible: "; demo_env_text "normal"; printf "VISIBLE TEXT"; reset_color
echo
echo

# Reset
CURRENT_THEME="dark"
SCREEN_BACKGROUND=""

echo "Test complete. New element-based color system ready."