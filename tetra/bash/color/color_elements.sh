#!/usr/bin/env bash

# Element-based color system - maps colors to named UI elements, not selection state
# Follows palette.sh gold standard patterns with heavy bold usage

COLORS_DIR="$(dirname "${BASH_SOURCE[0]}")"
source "$COLORS_DIR/color_core.sh"
source "$COLORS_DIR/color_palettes.sh"

# Element color assignments by semantic name (using existing palette colors)
declare -gA ELEMENT_COLORS=(
    # Demo modules - use first color from each palette
    [demo_env]="00AA00"         # ENV_PRIMARY[0] - Green family
    [demo_mode]="0088FF"        # MODE_PRIMARY[0] - Blue family
    [demo_action]="FF0044"      # VERBS_PRIMARY[0] - Red/orange family
    [demo_noun]="AA00AA"        # NOUNS_PRIMARY[0] - Purple family

    # TUI structural elements
    [tui_header]="4488AA"       # Header/title areas - steel blue
    [tui_border]="666666"       # Borders and separators - neutral gray
    [tui_label]="888888"        # Field labels - medium gray
    [tui_content]="CCCCCC"      # Main content text - light gray

    # Interactive elements
    [button_primary]="0088FF"   # Primary buttons/actions - bright blue
    [button_secondary]="888888" # Secondary buttons - muted
    [link_normal]="4488AA"      # Links and navigation - steel
    [input_field]="FFFFFF"      # Input backgrounds - white

    # Status indicators
    [status_success]="22DD22"   # Success states - bright green
    [status_warning]="FFAA00"   # Warning states - orange
    [status_error]="FF4444"     # Error states - red
    [status_info]="4488DD"      # Information - blue
)

# Get color for any element in any state
get_element_color() {
    local element="$1"
    local state="${2:-normal}"  # normal, selected, unselected, disabled, hover, muted

    local base_color="${ELEMENT_COLORS[$element]}"

    # Handle missing elements gracefully
    if [[ -z "$base_color" ]]; then
        base_color="FFFFFF"  # Safe white fallback
    fi

    case "$state" in
        normal)
            # Base color as-is
            echo "$base_color"
            ;;
        selected)
            # Brighten for selection (like palette.sh bright variants)
            echo "$(brighten "$base_color" 40)"
            ;;
        unselected)
            # Theme-aware dimming toward background (dirty white effect)
            echo "$(theme_aware_dim "$base_color" 5)"
            ;;
        disabled)
            # Heavy dimming toward background
            echo "$(theme_aware_dim "$base_color" 6)"
            ;;
        hover)
            # Slight brighten for hover states
            echo "$(brighten "$base_color" 20)"
            ;;
        muted)
            # Moderate dimming for secondary text
            echo "$(theme_aware_dim "$base_color" 4)"
            ;;
        *)
            # Unknown state, return base color
            echo "$base_color"
            ;;
    esac
}

# Core element styling functions (following palette.sh patterns)
element_text() {
    local element="$1"
    local state="${2:-normal}"
    local use_bold="${3:-true}"  # Default to bold like palette.sh

    local color=$(get_element_color "$element" "$state")

    if [[ "$use_bold" == "true" ]]; then
        printf "\033[1m"  # Bold
    fi

    text_color "$color"
}

element_bg() {
    local element="$1"
    local state="${2:-normal}"
    local color=$(get_element_color "$element" "$state")
    bg_only "$color"
}

element_swatch() {
    local element="$1"
    local state="${2:-normal}"
    local color=$(get_element_color "$element" "$state")
    color_swatch "$color"
}

# Demo module functions (heavy bold usage like palette.sh)
demo_env_text() {
    local state="${1:-normal}"
    printf "\033[1m"  # Always bold for demo modules
    element_text "demo_env" "$state" false  # Don't double-bold
}

demo_mode_text() {
    local state="${1:-normal}"
    printf "\033[1m"
    element_text "demo_mode" "$state" false
}

demo_action_text() {
    local state="${1:-normal}"
    printf "\033[1m"
    element_text "demo_action" "$state" false
}

demo_noun_text() {
    local state="${1:-normal}"
    printf "\033[1m"
    element_text "demo_noun" "$state" false
}

# TUI structural functions (selective bold usage)
tui_header_text() {
    local state="${1:-normal}"
    printf "\033[1m"  # Headers always bold
    element_text "tui_header" "$state" false
}

tui_border_text() {
    local state="${1:-normal}"
    element_text "tui_border" "$state" false  # Borders not bold
}

tui_label_text() {
    local state="${1:-normal}"
    element_text "tui_label" "$state" true   # Labels bold by default
}

tui_content_text() {
    local state="${1:-normal}"
    element_text "tui_content" "$state" false  # Content not bold
}

# Status indicator functions (with icons like palette.sh examples)
status_success_text() {
    local text="$1"
    printf "\033[1m"
    element_text "status_success" "normal" false
    printf "✓ %s" "$text"
    reset_color
}

status_warning_text() {
    local text="$1"
    printf "\033[1m"
    element_text "status_warning" "normal" false
    printf "⚠ %s" "$text"
    reset_color
}

status_error_text() {
    local text="$1"
    printf "\033[1m"
    element_text "status_error" "normal" false
    printf "✗ %s" "$text"
    reset_color
}

status_info_text() {
    local text="$1"
    printf "\033[1m"
    element_text "status_info" "normal" false
    printf "ℹ %s" "$text"
    reset_color
}

# Convenience functions for common patterns
bold_element() {
    local element="$1"
    local state="${2:-normal}"
    printf "\033[1m"
    element_text "$element" "$state" false
}

dim_element() {
    local element="$1"
    printf "\033[2m"  # ANSI dim
    element_text "$element" "muted" false
}

# Display element palette for reference (like palette.sh examples)
show_element_palette() {
    echo
    printf "\033[1m"
    tui_header_text
    echo "Element Color System"
    reset_color
    echo

    echo "Demo Modules (always bold):"
    printf "  ENV:    "; demo_env_text; printf "█████"; reset_color; echo " $(get_element_color demo_env)"
    printf "  MODE:   "; demo_mode_text; printf "█████"; reset_color; echo " $(get_element_color demo_mode)"
    printf "  ACTION: "; demo_action_text; printf "█████"; reset_color; echo " $(get_element_color demo_action)"
    printf "  NOUN:   "; demo_noun_text; printf "█████"; reset_color; echo " $(get_element_color demo_noun)"
    echo

    echo "TUI Elements:"
    printf "  Header: "; tui_header_text; printf "█████"; reset_color; echo " $(get_element_color tui_header)"
    printf "  Border: "; tui_border_text; printf "█████"; reset_color; echo " $(get_element_color tui_border)"
    printf "  Label:  "; tui_label_text; printf "█████"; reset_color; echo " $(get_element_color tui_label)"
    echo

    echo "States (ENV example):"
    printf "  Normal:   "; element_text "demo_env" "normal"; printf "█████"; reset_color; echo
    printf "  Selected: "; element_text "demo_env" "selected"; printf "█████"; reset_color; echo
    printf "  Unselect: "; element_text "demo_env" "unselected"; printf "█████"; reset_color; echo " (theme-aware dim)"
    printf "  Disabled: "; element_text "demo_env" "disabled"; printf "█████"; reset_color; echo
    printf "  Muted:    "; element_text "demo_env" "muted"; printf "█████"; reset_color; echo
    echo

    echo "Status Indicators:"
    printf "  "; status_success_text "Success"
    echo
    printf "  "; status_warning_text "Warning"
    echo
    printf "  "; status_error_text "Error"
    echo
    printf "  "; status_info_text "Info"
    echo
    echo
}

# Test background detection
show_background_info() {
    echo "Background Detection:"
    echo "  Effective background: $(get_effective_background)"
    echo "  Current theme: ${CURRENT_THEME:-none}"
    echo "  Screen background: ${SCREEN_BACKGROUND:-none}"
    echo
}