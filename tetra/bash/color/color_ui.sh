#!/usr/bin/env bash

COLORS_DIR="$(dirname "${BASH_SOURCE[0]}")"
source "$COLORS_DIR/color_palettes.sh"
source "$COLORS_DIR/color_themes.sh"
source "$COLORS_DIR/color_elements.sh"

# Legacy UI assignments (kept for backward compatibility)
# NEW: Element-based functions are preferred over these index-based assignments
declare -gA UI_ASSIGNMENTS=(
    [env_label]=0
    [env_selected]=0
    [env_other]=1
    [mode_label]=1
    [mode_selected]=0
    [mode_other]=5
    [action_label]=0
    [action_selected]=6
    [action_other]=1
)

# NEW: Element-based UI functions (preferred interface)

## Environment Colors - semantic states with theme-aware dimming
ui_env_label() { demo_env_text "normal"; }
ui_env_selected() { demo_env_text "selected"; }
ui_env_other() { demo_env_text "unselected"; }  # Theme-aware dirty white

## Mode Colors - semantic states with theme-aware dimming
ui_mode_label() { demo_mode_text "normal"; }
ui_mode_selected() { demo_mode_text "selected"; }
ui_mode_other() { demo_mode_text "unselected"; }  # Theme-aware dirty white

## Action Colors - semantic states with theme-aware dimming
ui_action_label() { demo_action_text "normal"; }
ui_action_selected() { demo_action_text "selected"; }
ui_action_other() { demo_action_text "unselected"; }  # Theme-aware dirty white

# LEGACY: Original index-based functions (kept for backward compatibility)
# These use the old palette system - prefer the element-based functions above

## Legacy Environment Colors (green-ish palette)
ui_env_label_legacy() { env_color "${UI_ASSIGNMENTS[env_label]}" primary; }
ui_env_selected_legacy() { env_color "${UI_ASSIGNMENTS[env_selected]}" bright; }
ui_env_other_legacy() { env_color "${UI_ASSIGNMENTS[env_other]}" primary; }

## Legacy Mode Colors (blue-ish palette)
ui_mode_label_legacy() { mode_color "${UI_ASSIGNMENTS[mode_label]}" primary; }
ui_mode_selected_legacy() { mode_color "${UI_ASSIGNMENTS[mode_selected]}" bright; }
ui_mode_other_legacy() { mode_color "${UI_ASSIGNMENTS[mode_other]}" primary; }

## Legacy Action Colors (red-orange palette for verbs)
ui_action_label_legacy() { verbs_color "${UI_ASSIGNMENTS[action_label]}" primary; }
ui_action_selected_legacy() { verbs_color "${UI_ASSIGNMENTS[action_selected]}" bright; }
ui_action_other_legacy() { verbs_color "${UI_ASSIGNMENTS[action_other]}" primary; }

## Direct Palette Access Functions
# Use these when you need specific palette colors by index
ui_env_text() { local idx=${1:-0}; text_color "${ENV_PRIMARY[$idx]}"; }
ui_env_bright() { local idx=${1:-0}; text_color "${ENV_COMPLEMENT[$idx]}"; }
ui_mode_text() { local idx=${1:-0}; text_color "${MODE_PRIMARY[$idx]}"; }
ui_mode_bright() { local idx=${1:-0}; text_color "${MODE_COMPLEMENT[$idx]}"; }
ui_verb_text() { local idx=${1:-0}; text_color "${VERBS_PRIMARY[$idx]}"; }
ui_verb_bright() { local idx=${1:-0}; text_color "${VERBS_COMPLEMENT[$idx]}"; }
ui_noun_text() { local idx=${1:-0}; text_color "${NOUNS_PRIMARY[$idx]}"; }
ui_noun_bright() { local idx=${1:-0}; text_color "${NOUNS_COMPLEMENT[$idx]}"; }

## Palette Swatch Functions
# Use these for color demonstrations and palette displays
ui_env_swatch() { local idx=${1:-0}; color_swatch "${ENV_PRIMARY[$idx]}"; }
ui_mode_swatch() { local idx=${1:-0}; color_swatch "${MODE_PRIMARY[$idx]}"; }
ui_verb_swatch() { local idx=${1:-0}; color_swatch "${VERBS_PRIMARY[$idx]}"; }
ui_noun_swatch() { local idx=${1:-0}; color_swatch "${NOUNS_PRIMARY[$idx]}"; }