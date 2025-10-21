#!/usr/bin/env bash
# Enhanced Color Theme System with Runtime Switching

# Source guard
[[ -n "${_COLOR_THEMES_LOADED}" ]] && return 0
_COLOR_THEMES_LOADED=1

# Source core color system
source "$(dirname "${BASH_SOURCE[0]}")/color_core.sh"
source "$(dirname "${BASH_SOURCE[0]}")/color_palettes.sh"

# Theme state
CURRENT_THEME_BASE=""       # light/dark/solarized
CURRENT_THEME_PALETTE=""    # default/tokyo_night/nord/gruvbox
THEME_SWITCH_CALLBACKS=()   # Registered callbacks
PALETTE_BRIGHTNESS=4        # 0-7 brightness level

# Legacy theme definitions (keep for backward compatibility)
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

# Current theme (legacy)
CURRENT_THEME="dark"
SCREEN_BACKGROUND=""

# Legacy functions (backward compatibility)
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

    # Also update new theme system
    theme_set_base "$1" 2>/dev/null
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

# New runtime theme switching system

# Set base theme (background + brightness)
theme_set_base() {
    local base="$1"  # light/dark/solarized

    case "$base" in
        light)
            SCREEN_BACKGROUND="FFFFFF"
            PALETTE_BRIGHTNESS=7  # Bright colors for light bg
            ;;
        dark)
            SCREEN_BACKGROUND="1E1E1E"
            PALETTE_BRIGHTNESS=4  # Muted colors for dark bg
            ;;
        solarized)
            SCREEN_BACKGROUND="002B36"
            PALETTE_BRIGHTNESS=5  # Solarized-tuned
            ;;
        *)
            echo "Unknown base theme: $base" >&2
            return 1
            ;;
    esac

    CURRENT_THEME_BASE="$base"
    set_background "$SCREEN_BACKGROUND"
    _theme_notify_callbacks "base" "$base"
}

# Set palette theme (color scheme)
theme_set_palette() {
    local palette="$1"  # default/tokyo_night/nord/gruvbox

    # Default means use built-in palettes
    if [[ "$palette" == "default" ]]; then
        source "$(dirname "${BASH_SOURCE[0]}")/color_palettes.sh"
        CURRENT_THEME_PALETTE="default"
        _theme_notify_callbacks "palette" "default"
        return 0
    fi

    # Try to load palette theme file
    local palette_file="$(dirname "${BASH_SOURCE[0]}")/themes/palette/${palette}.sh"
    if [[ -f "$palette_file" ]]; then
        source "$palette_file"
        CURRENT_THEME_PALETTE="$palette"
        _theme_notify_callbacks "palette" "$palette"
    else
        echo "Unknown palette theme: $palette" >&2
        return 1
    fi
}

# Unified theme setter (base + palette)
theme_set_combined() {
    local theme="$1"

    # Check if it's a compound theme (e.g., "dark/tokyo_night")
    if [[ "$theme" == */* ]]; then
        local base="${theme%%/*}"
        local palette="${theme##*/}"
        theme_set_base "$base" && theme_set_palette "$palette"
    # Check if it's a base theme
    elif [[ "$theme" =~ ^(light|dark|solarized)$ ]]; then
        theme_set_base "$theme"
    # Assume it's a palette theme
    else
        theme_set_palette "$theme"
    fi
}

# Register callback for theme changes
theme_register_callback() {
    local callback="$1"
    THEME_SWITCH_CALLBACKS+=("$callback")
}

# Notify callbacks of theme change
_theme_notify_callbacks() {
    local type="$1"  # base/palette
    local value="$2"

    for callback in "${THEME_SWITCH_CALLBACKS[@]}"; do
        if command -v "$callback" >/dev/null 2>&1; then
            "$callback" "$type" "$value"
        fi
    done
}

# Query current theme
theme_current() {
    if [[ -n "$CURRENT_THEME_PALETTE" && "$CURRENT_THEME_PALETTE" != "default" ]]; then
        echo "${CURRENT_THEME_BASE}/${CURRENT_THEME_PALETTE}"
    else
        echo "${CURRENT_THEME_BASE:-default}"
    fi
}

# List available themes
theme_list() {
    echo "Base themes:"
    echo "  light      - Light background, bright colors"
    echo "  dark       - Dark background, muted colors"
    echo "  solarized  - Solarized background"
    echo ""
    echo "Palette themes:"
    echo "  default    - Built-in Tetra palettes"

    local themes_dir="$(dirname "${BASH_SOURCE[0]}")/themes/palette"
    if [[ -d "$themes_dir" ]]; then
        for palette in "$themes_dir"/*.sh; do
            [[ -f "$palette" ]] || continue
            local name=$(basename "$palette" .sh)
            echo "  $name"
        done
    fi

    echo ""
    echo "Current: $(theme_current)"
}

# Save theme preference
theme_save() {
    local config_file="${TETRA_DIR:-$HOME/.tetra}/config/theme"
    mkdir -p "$(dirname "$config_file")"
    echo "$(theme_current)" > "$config_file"
}

# Load saved theme
theme_load() {
    local config_file="${TETRA_DIR:-$HOME/.tetra}/config/theme"
    if [[ -f "$config_file" ]]; then
        local saved_theme=$(cat "$config_file")
        theme_set_combined "$saved_theme"
    fi
}

# Initialize theme system
theme_init() {
    local default_theme="${TETRA_THEME:-dark}"

    # Try to load saved theme first
    local config_file="${TETRA_DIR:-$HOME/.tetra}/config/theme"
    if [[ -f "$config_file" ]]; then
        theme_load
    else
        theme_set_combined "$default_theme"
    fi

    # Auto-save on theme changes
    theme_register_callback "theme_save"
}

# Export functions
export -f theme_set_base
export -f theme_set_palette
export -f theme_set_combined
export -f theme_register_callback
export -f theme_current
export -f theme_list
export -f theme_save
export -f theme_load
export -f theme_init
