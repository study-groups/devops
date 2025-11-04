#!/usr/bin/env bash

# TDS Color Token System
# Three-layer indirection: Semantic Role → Color Token → Palette Reference → Hex Value

# Color token definitions map semantic names to palette references
# Format: "palette:index" where palette is env|mode|verbs|nouns, index is 0-7
declare -A TDS_COLOR_TOKENS=(
    # Structural tokens - main UI structure
    [structural.primary]="env:0"           # ENV_PRIMARY[0] - green
    [structural.secondary]="mode:0"        # MODE_PRIMARY[0] - blue
    [structural.accent]="verbs:0"          # VERBS_PRIMARY[0] - red/orange
    [structural.muted]="env:5"             # ENV_PRIMARY[5] - muted green
    [structural.separator]="mode:6"        # MODE_PRIMARY[6] - gray-blue

    # Text tokens - content text hierarchy
    [text.primary]="mode:7"                # MODE_PRIMARY[7] - light text
    [text.secondary]="mode:6"              # MODE_PRIMARY[6] - medium text
    [text.tertiary]="env:6"                # ENV_PRIMARY[6] - subtle text
    [text.muted]="mode:5"                  # MODE_PRIMARY[5] - very subtle

    # Interactive tokens - clickable/navigable elements
    [interactive.link]="mode:0"            # MODE_PRIMARY[0] - blue
    [interactive.active]="verbs:3"         # VERBS_PRIMARY[3] - bright orange
    [interactive.hover]="verbs:1"          # VERBS_PRIMARY[1] - lighter red
    [interactive.selected]="env:3"         # ENV_PRIMARY[3] - bright green

    # Status tokens - state indicators
    [status.success]="env:1"               # ENV_PRIMARY[1] - bright green
    [status.warning]="verbs:3"             # VERBS_PRIMARY[3] - orange
    [status.error]="verbs:0"               # VERBS_PRIMARY[0] - red
    [status.info]="mode:0"                 # MODE_PRIMARY[0] - blue

    # Content type tokens - specific content rendering
    [content.heading.h1]="mode:0"          # Blue - top level
    [content.heading.h2]="mode:1"          # Darker blue
    [content.heading.h3]="nouns:3"         # Light purple
    [content.heading.h4]="nouns:1"         # Bright magenta
    [content.code.inline]="verbs:0"        # Red - inline code
    [content.code.block]="mode:1"          # Blue - code blocks
    [content.quote]="mode:5"               # Gray - blockquotes
    [content.list]="env:1"                 # Green - list markers
    [content.emphasis.bold]="verbs:3"      # Orange - bold text
    [content.emphasis.italic]="env:1"      # Bright green - italic
    [content.link]="mode:0"                # Blue - links
    [content.hr]="mode:5"                  # Gray - horizontal rules

    # Action tokens - module.action syntax
    [action.module]="env:0"                # Module name (green - nouns/data)
    [action.separator]="mode:6"            # Dot separator (muted)
    [action.name]="verbs:0"                # Action name (red/orange - verbs)
    [action.param]="mode:1"                # Parameters (blue)
    [action.description]="mode:6"          # Help text (muted)
    [action.tes.prefix]="verbs:3"          # @ symbol (orange)
    [action.tes.endpoint]="nouns:1"        # Endpoint name (magenta - target)

    # Marker tokens - module visual markers
    [marker.primary]="mode:0"              # Primary marker color (changes with temperature)
    [marker.active]="verbs:3"              # Active/selected marker
)

# Resolve color token to hex value
# Args: token, state (normal|bright|dim)
# Returns: hex color value
tds_resolve_color() {
    local token="$1"
    local state="${2:-normal}"

    local palette_ref="${TDS_COLOR_TOKENS["$token"]}"

    if [[ -z "$palette_ref" ]]; then
        # Fallback to light text color
        echo "C0CAF5"
        return 1
    fi

    # Parse palette reference: "palette:index"
    local palette="${palette_ref%%:*}"
    local index="${palette_ref##*:}"

    # Resolve to hex based on palette and state
    local hex=""
    case "$palette" in
        env)
            case "$state" in
                bright) hex="${ENV_COMPLEMENT[$index]}" ;;
                dim) hex="$(theme_aware_dim "${ENV_PRIMARY[$index]}" 4)" ;;
                *) hex="${ENV_PRIMARY[$index]}" ;;
            esac
            ;;
        mode)
            case "$state" in
                bright) hex="${MODE_COMPLEMENT[$index]}" ;;
                dim) hex="$(theme_aware_dim "${MODE_PRIMARY[$index]}" 4)" ;;
                *) hex="${MODE_PRIMARY[$index]}" ;;
            esac
            ;;
        verbs)
            case "$state" in
                bright) hex="${VERBS_COMPLEMENT[$index]}" ;;
                dim) hex="$(theme_aware_dim "${VERBS_PRIMARY[$index]}" 4)" ;;
                *) hex="${VERBS_PRIMARY[$index]}" ;;
            esac
            ;;
        nouns)
            case "$state" in
                bright) hex="${NOUNS_COMPLEMENT[$index]}" ;;
                dim) hex="$(theme_aware_dim "${NOUNS_PRIMARY[$index]}" 4)" ;;
                *) hex="${NOUNS_PRIMARY[$index]}" ;;
            esac
            ;;
        *)
            # Unknown palette, return safe fallback
            hex="C0CAF5"
            ;;
    esac

    echo "$hex"
}

# Apply text color from token
tds_text_color() {
    local token="$1"
    local state="${2:-normal}"
    local hex=$(tds_resolve_color "$token" "$state")
    text_color "$hex"
}

# Apply background color from token
tds_bg_color() {
    local token="$1"
    local state="${2:-normal}"
    local hex=$(tds_resolve_color "$token" "$state")
    bg_only "$hex"
}

# Apply color swatch from token (fg+bg same)
tds_color_swatch() {
    local token="$1"
    local state="${2:-normal}"
    local hex=$(tds_resolve_color "$token" "$state")
    color_swatch "$hex"
}

# Show all defined tokens with their resolved colors
tds_show_tokens() {
    echo "TDS Color Token System"
    echo "====================="
    echo

    echo "Structural Tokens:"
    for key in structural.primary structural.secondary structural.accent structural.muted structural.separator; do
        printf "  %-30s " "$key"
        tds_color_swatch "$key"
        printf " %s → %s\n" "${TDS_COLOR_TOKENS["$key"]}" "$(tds_resolve_color "$key")"
        reset_color
    done
    echo

    echo "Text Tokens:"
    for key in text.primary text.secondary text.tertiary text.muted; do
        printf "  %-30s " "$key"
        tds_color_swatch "$key"
        printf " %s → %s\n" "${TDS_COLOR_TOKENS["$key"]}" "$(tds_resolve_color "$key")"
        reset_color
    done
    echo

    echo "Interactive Tokens:"
    for key in interactive.link interactive.active interactive.hover interactive.selected; do
        printf "  %-30s " "$key"
        tds_color_swatch "$key"
        printf " %s → %s\n" "${TDS_COLOR_TOKENS["$key"]}" "$(tds_resolve_color "$key")"
        reset_color
    done
    echo

    echo "Status Tokens:"
    for key in status.success status.warning status.error status.info; do
        printf "  %-30s " "$key"
        tds_color_swatch "$key"
        printf " %s → %s\n" "${TDS_COLOR_TOKENS["$key"]}" "$(tds_resolve_color "$key")"
        reset_color
    done
    echo

    echo "Content Tokens:"
    for key in content.heading.h1 content.heading.h2 content.heading.h3 content.heading.h4 \
               content.code.inline content.code.block content.quote content.emphasis.bold \
               content.emphasis.italic content.link content.hr; do
        printf "  %-30s " "$key"
        tds_color_swatch "$key"
        printf " %s → %s\n" "${TDS_COLOR_TOKENS["$key"]}" "$(tds_resolve_color "$key")"
        reset_color
    done
    echo
}
