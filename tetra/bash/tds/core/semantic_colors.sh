#!/usr/bin/env bash

# TDS Semantic Color System
# High-level semantic color tokens for consistent UI theming

# Source color primitives
TDS_CORE="${TDS_SRC:-$(dirname "$(dirname "${BASH_SOURCE[0]}")")}"
COLOR_SRC="${COLOR_SRC:-$(dirname "$TDS_CORE")/color}"

if [[ -f "$COLOR_SRC/color_core.sh" ]]; then
    source "$COLOR_SRC/color_core.sh"
else
    echo "Error: color_core.sh not found" >&2
    return 1
fi

# Semantic color token mappings (hex values)
# These are populated by theme loaders via tds_apply_semantic_colors()
declare -gA TDS_SEMANTIC_COLORS=()

# Universal SEMANTIC rainbow - maximally distinct colors for status/action
# All themes should use this for SEMANTIC palette to maintain consistency
# Call tds_apply_semantic_rainbow() in theme loaders instead of duplicating this array
tds_apply_semantic_rainbow() {
    SEMANTIC=(
        "#E53935"  # 0: red (0°) - error
        "#FB8C00"  # 1: orange (30°) - warning
        "#43A047"  # 2: green (120°) - success
        "#1E88E5"  # 3: blue (210°) - info
        "#941513"  # 4: error dim
        "#995400"  # 5: warning dim
        "#28602A"  # 6: success dim
        "#104E88"  # 7: info dim
    )
}
export -f tds_apply_semantic_rainbow

# Legacy alias
tds_apply_verbs_rainbow() { tds_apply_semantic_rainbow; }
export -f tds_apply_verbs_rainbow

# Apply semantic color mappings from theme palettes
# This is called by theme loaders after they set palette arrays
# Themes can override specific mappings by passing custom args
tds_apply_semantic_colors() {
    # Validate palettes are loaded
    if [[ ${#PRIMARY[@]} -eq 0 || ${#SECONDARY[@]} -eq 0 ||
          ${#SEMANTIC[@]} -eq 0 || ${#SURFACE[@]} -eq 0 ]]; then
        echo "Error: Theme palettes not loaded" >&2
        return 1
    fi

    # Map palette colors to semantic tokens
    # These mappings define the semantic meaning of each palette position

    # Status colors - from SEMANTIC palette
    TDS_SEMANTIC_COLORS[success]="${SEMANTIC[2]}"      # Green - success, active, connected
    TDS_SEMANTIC_COLORS[error]="${SEMANTIC[0]}"        # Red - error, failed, critical
    TDS_SEMANTIC_COLORS[warning]="${SEMANTIC[1]}"      # Orange - warning, caution
    TDS_SEMANTIC_COLORS[info]="${SEMANTIC[3]}"         # Blue - information, neutral
    TDS_SEMANTIC_COLORS[pending]="${SURFACE[0]}"       # Surface - in progress, loading

    # UI structural colors
    TDS_SEMANTIC_COLORS[primary]="${SECONDARY[0]}"     # Primary brand/accent
    TDS_SEMANTIC_COLORS[secondary]="${PRIMARY[0]}"     # Secondary accent
    TDS_SEMANTIC_COLORS[muted]="${SURFACE[5]}"         # Dimmed/disabled text
    TDS_SEMANTIC_COLORS[border]="${SURFACE[5]}"        # Borders and separators
    TDS_SEMANTIC_COLORS[background]="${SURFACE[0]}"    # Background (dark theme)
    TDS_SEMANTIC_COLORS[surface]="${SURFACE[1]}"       # Surface/panel background

    # Text hierarchy - from SURFACE palette (bg to fg gradient)
    TDS_SEMANTIC_COLORS[text.primary]="${SURFACE[7]}"     # Primary text (brightest)
    TDS_SEMANTIC_COLORS[text.secondary]="${SURFACE[6]}"   # Secondary text
    TDS_SEMANTIC_COLORS[text.tertiary]="${SURFACE[5]}"    # Tertiary text
    TDS_SEMANTIC_COLORS[text.disabled]="${SURFACE[4]}"    # Disabled text

    # Interactive states
    TDS_SEMANTIC_COLORS[interactive.default]="${SECONDARY[0]}"    # Default interactive
    TDS_SEMANTIC_COLORS[interactive.hover]="${SECONDARY[3]}"      # Hover state
    TDS_SEMANTIC_COLORS[interactive.active]="${PRIMARY[0]}"       # Active/selected state
    TDS_SEMANTIC_COLORS[interactive.disabled]="${SURFACE[4]}"     # Disabled state

    # Contextual colors (from tview)
    TDS_SEMANTIC_COLORS[env.local]="${PRIMARY[4]}"     # Cyan - local development
    TDS_SEMANTIC_COLORS[env.dev]="${PRIMARY[3]}"       # Green - dev environment
    TDS_SEMANTIC_COLORS[env.staging]="${SEMANTIC[1]}"  # Orange - staging
    TDS_SEMANTIC_COLORS[env.prod]="${SEMANTIC[0]}"     # Red - production (caution!)
    TDS_SEMANTIC_COLORS[env.qa]="${SURFACE[0]}"        # Surface - QA/testing

    TDS_SEMANTIC_COLORS[mode.config]="${PRIMARY[4]}"   # Cyan - configuration
    TDS_SEMANTIC_COLORS[mode.service]="${SECONDARY[0]}" # Blue - service management
    TDS_SEMANTIC_COLORS[mode.deploy]="${SEMANTIC[0]}"  # Red - deployment
    TDS_SEMANTIC_COLORS[mode.keys]="${SURFACE[0]}"     # Surface - key management

    # Content rendering tokens (for markdown, TOML, etc.)
    TDS_SEMANTIC_COLORS[content.heading.h1]="${SECONDARY[2]}"      # Bright - main headings
    TDS_SEMANTIC_COLORS[content.heading.h2]="${SECONDARY[1]}"      # Medium
    TDS_SEMANTIC_COLORS[content.heading.h3]="${SECONDARY[0]}"      # Sub headings
    TDS_SEMANTIC_COLORS[content.emphasis.bold]="${SURFACE[7]}"     # Bright - bold text
    TDS_SEMANTIC_COLORS[content.emphasis.italic]="${SURFACE[6]}"   # Light - italic text
    TDS_SEMANTIC_COLORS[content.code.inline]="${PRIMARY[6]}"       # Purple - inline code
    TDS_SEMANTIC_COLORS[content.code.block]="${PRIMARY[5]}"        # Blue - code blocks
    TDS_SEMANTIC_COLORS[content.link]="${PRIMARY[4]}"              # Cyan - links/URLs
    TDS_SEMANTIC_COLORS[content.quote]="${SURFACE[5]}"             # Gray - blockquotes
    TDS_SEMANTIC_COLORS[content.list]="${SURFACE[7]}"              # Bright - list items

    return 0
}

# Resolve semantic color token to hex
# Args: token_name
# Returns: hex color value
tds_semantic_color() {
    local token="$1"
    local hex="${TDS_SEMANTIC_COLORS[$token]}"

    if [[ -z "$hex" ]]; then
        # Fallback to primary text
        hex="${TDS_SEMANTIC_COLORS[text.primary]}"
    fi

    echo "$hex"
}

# Apply semantic color to text (foreground)
# Args: token, text
tds_color() {
    local token="$1"
    local text="$2"
    local hex=$(tds_semantic_color "$token")

    text_color "$hex"
    printf "%s" "$text"
    reset_color
}

# Apply semantic background color
# Args: token, text
tds_bg() {
    local token="$1"
    local text="$2"
    local hex=$(tds_semantic_color "$token")

    bg_only "$hex"
    printf "%s" "$text"
    reset_color
}

# Status indicator with icon and color
# Args: status (success|error|warning|info|pending), text
tds_status() {
    local status="$1"
    local text="$2"
    local icon=""

    case "$status" in
        success)  icon="✓" ;;
        error)    icon="✗" ;;
        warning)  icon="⚠" ;;
        info)     icon="ℹ" ;;
        pending)  icon="⟳" ;;
        *)        icon="•" ;;
    esac

    tds_color "$status" "$icon $text"
}

# Environment badge with color
# Args: env_name (local|dev|staging|prod|qa)
tds_env_badge() {
    local env="$1"
    local env_lower=$(echo "$env" | tr '[:upper:]' '[:lower:]')

    printf "["
    tds_color "env.$env_lower" "$env"
    printf "]"
}

# Mode badge with color
# Args: mode_name (config|service|deploy|keys)
tds_mode_badge() {
    local mode="$1"
    local mode_lower=$(echo "$mode" | tr '[:upper:]' '[:lower:]')

    printf "["
    tds_color "mode.$mode_lower" "$mode"
    printf "]"
}

# Show all semantic colors (debugging/reference)
tds_show_semantic_colors() {
    echo "TDS Semantic Color Tokens"
    echo "========================="
    echo

    echo "Status Colors:"
    for status in success error warning info pending; do
        printf "  %-15s " "$status:"
        tds_status "$status" "Sample text"
        echo
    done
    echo

    echo "UI Structural:"
    for token in primary secondary muted border; do
        printf "  %-15s " "$token:"
        tds_color "$token" "Sample text (#${TDS_SEMANTIC_COLORS[$token]})"
        echo
    done
    echo

    echo "Text Hierarchy:"
    for token in text.primary text.secondary text.tertiary text.disabled; do
        printf "  %-15s " "$token:"
        tds_color "$token" "Sample text"
        echo
    done
    echo

    echo "Environment Badges:"
    for env in local dev staging prod qa; do
        printf "  %-15s " "$env:"
        tds_env_badge "$env"
        echo
    done
    echo

    echo "Mode Badges:"
    for mode in config service deploy keys; do
        printf "  %-15s " "$mode:"
        tds_mode_badge "$mode"
        echo
    done
}

# Export functions
export -f tds_apply_semantic_colors tds_semantic_color tds_color tds_bg tds_status tds_env_badge tds_mode_badge tds_show_semantic_colors
