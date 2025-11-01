#!/usr/bin/env bash

source "$(dirname "${BASH_SOURCE[0]}")/color_core.sh"

# Theme definitions
declare -A THEME_LIGHT=(
    [bg]="FFFFFF"
    [text]="000000"
    [accent]="4169E1"
)

declare -A THEME_DARK=(
    [bg]="1E1E1E"
    [text]="FFFFFF"
    [accent]="87CEEB"
)

declare -A THEME_SOLARIZED_DARK=(
    [bg]="002B36"
    [text]="839496"
    [accent]="268BD2"
)

# Current theme
CURRENT_THEME="dark"
SCREEN_BACKGROUND=""

get_theme_color() {
    local key=$1
    case "$CURRENT_THEME" in
        light) echo "${THEME_LIGHT[$key]}" ;;
        dark) echo "${THEME_DARK[$key]}" ;;
        solarized) echo "${THEME_SOLARIZED_DARK[$key]}" ;;
    esac
}

set_theme() {
    CURRENT_THEME="$1"
    SCREEN_BACKGROUND=""  # Clear custom background when setting theme
    term_bg_color "$(get_theme_color bg)"
}

set_screen_background() {
    CURRENT_THEME=""  # Clear theme when setting custom background
    SCREEN_BACKGROUND="$1"
    term_bg_color "$1"
}

# Themed color helpers
themed_fg() { fg_color "$(get_theme_color text)"; }
themed_bg() { bg_color "$(get_theme_color bg)"; }
themed_accent() { fg_color "$(get_theme_color accent)"; }

# UI color functions for clean text display (using new semantic functions)
env_color() {
    local idx=$1
    local variant=${2:-primary}
    case "$variant" in
        bright) text_color "${ENV_COMPLEMENT[$idx]}" ;;
        *) text_color "${ENV_PRIMARY[$idx]}" ;;
    esac
}
mode_color() {
    local idx=$1
    local variant=${2:-primary}
    case "$variant" in
        bright) text_color "${MODE_COMPLEMENT[$idx]}" ;;
        *) text_color "${MODE_PRIMARY[$idx]}" ;;
    esac
}
verbs_color() {
    local idx=$1
    local variant=${2:-primary}
    case "$variant" in
        bright) text_color "${VERBS_COMPLEMENT[$idx]}" ;;
        *) text_color "${VERBS_PRIMARY[$idx]}" ;;
    esac
}
nouns_color() {
    local idx=$1
    local variant=${2:-primary}
    case "$variant" in
        bright) text_color "${NOUNS_COMPLEMENT[$idx]}" ;;
        *) text_color "${NOUNS_PRIMARY[$idx]}" ;;
    esac
}