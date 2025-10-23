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

# Apply semantic color mappings from theme palettes
# This is called by theme loaders after they set palette arrays
# Themes can override specific mappings by passing custom args
tds_apply_semantic_colors() {
    # Validate palettes are loaded
    if [[ ${#ENV_PRIMARY[@]} -eq 0 || ${#MODE_PRIMARY[@]} -eq 0 ||
          ${#VERBS_PRIMARY[@]} -eq 0 || ${#NOUNS_PRIMARY[@]} -eq 0 ]]; then
        echo "Error: Theme palettes not loaded" >&2
        return 1
    fi

    # Map palette colors to semantic tokens
    # These mappings define the semantic meaning of each palette position

    # Status colors - universal meanings
    TDS_SEMANTIC_COLORS[success]="${ENV_PRIMARY[0]}"      # Green - success, active, connected
    TDS_SEMANTIC_COLORS[error]="${VERBS_PRIMARY[0]}"      # Red - error, failed, critical
    TDS_SEMANTIC_COLORS[warning]="${VERBS_PRIMARY[2]}"    # Orange/Yellow - warning, caution
    TDS_SEMANTIC_COLORS[info]="${MODE_PRIMARY[0]}"        # Blue - information, neutral
    TDS_SEMANTIC_COLORS[pending]="${NOUNS_PRIMARY[0]}"    # Purple - in progress, loading

    # UI structural colors
    TDS_SEMANTIC_COLORS[primary]="${MODE_PRIMARY[0]}"     # Primary brand/accent
    TDS_SEMANTIC_COLORS[secondary]="${ENV_PRIMARY[0]}"    # Secondary accent
    TDS_SEMANTIC_COLORS[muted]="${MODE_PRIMARY[5]}"       # Dimmed/disabled text
    TDS_SEMANTIC_COLORS[border]="${MODE_PRIMARY[5]}"      # Borders and separators
    TDS_SEMANTIC_COLORS[background]="${MODE_PRIMARY[5]}"  # Background (dark theme)
    TDS_SEMANTIC_COLORS[surface]="${MODE_PRIMARY[6]}"     # Surface/panel background

    # Text hierarchy
    TDS_SEMANTIC_COLORS[text.primary]="${MODE_PRIMARY[7]}"     # Primary text
    TDS_SEMANTIC_COLORS[text.secondary]="${MODE_PRIMARY[6]}"   # Secondary text
    TDS_SEMANTIC_COLORS[text.tertiary]="${MODE_PRIMARY[5]}"    # Tertiary text
    TDS_SEMANTIC_COLORS[text.disabled]="${MODE_PRIMARY[5]}"    # Disabled text

    # Interactive states
    TDS_SEMANTIC_COLORS[interactive.default]="${MODE_PRIMARY[0]}"    # Default interactive
    TDS_SEMANTIC_COLORS[interactive.hover]="${MODE_PRIMARY[3]}"      # Hover state
    TDS_SEMANTIC_COLORS[interactive.active]="${NOUNS_PRIMARY[0]}"    # Active/selected state
    TDS_SEMANTIC_COLORS[interactive.disabled]="${MODE_PRIMARY[5]}"   # Disabled state

    # Contextual colors (from tview)
    TDS_SEMANTIC_COLORS[env.local]="${ENV_PRIMARY[1]}"     # Teal/Cyan - local development
    TDS_SEMANTIC_COLORS[env.dev]="${ENV_PRIMARY[0]}"       # Green - dev environment
    TDS_SEMANTIC_COLORS[env.staging]="${VERBS_PRIMARY[2]}" # Yellow/Orange - staging
    TDS_SEMANTIC_COLORS[env.prod]="${VERBS_PRIMARY[0]}"    # Red - production (caution!)
    TDS_SEMANTIC_COLORS[env.qa]="${NOUNS_PRIMARY[0]}"      # Purple - QA/testing

    TDS_SEMANTIC_COLORS[mode.config]="${ENV_PRIMARY[3]}"   # Cyan - configuration
    TDS_SEMANTIC_COLORS[mode.service]="${MODE_PRIMARY[0]}" # Blue - service management
    TDS_SEMANTIC_COLORS[mode.deploy]="${VERBS_PRIMARY[0]}" # Red - deployment
    TDS_SEMANTIC_COLORS[mode.keys]="${NOUNS_PRIMARY[0]}"   # Purple - key management

    # Content rendering tokens (for markdown, TOML, etc.)
    TDS_SEMANTIC_COLORS[content.heading.h1]="${MODE_PRIMARY[2]}"      # Bright blue - main headings
    TDS_SEMANTIC_COLORS[content.heading.h2]="${MODE_PRIMARY[1]}"      # Medium blue
    TDS_SEMANTIC_COLORS[content.heading.h3]="${MODE_PRIMARY[0]}"      # Blue - sub headings
    TDS_SEMANTIC_COLORS[content.emphasis.bold]="${MODE_PRIMARY[7]}"   # White/bright - bold text
    TDS_SEMANTIC_COLORS[content.emphasis.italic]="${MODE_PRIMARY[6]}" # Light - italic text
    TDS_SEMANTIC_COLORS[content.code.inline]="${NOUNS_PRIMARY[0]}"    # Purple - inline code
    TDS_SEMANTIC_COLORS[content.code.block]="${NOUNS_PRIMARY[1]}"     # Light purple - code blocks
    TDS_SEMANTIC_COLORS[content.link]="${ENV_PRIMARY[3]}"             # Cyan - links/URLs
    TDS_SEMANTIC_COLORS[content.quote]="${MODE_PRIMARY[6]}"           # Light gray - blockquotes
    TDS_SEMANTIC_COLORS[content.list]="${MODE_PRIMARY[7]}"            # White - list items

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
