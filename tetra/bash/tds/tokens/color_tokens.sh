#!/usr/bin/env bash

# TDS Color Token System
# Three-layer indirection: Semantic Role → Color Token → Palette Reference → Hex Value
#
# PALETTE STRUCTURE:
#   ENV   - ALTERNATE: two hue families [0-3]=A, [4-7]=B variants
#   MODE  - STATUS: [0]=error [1]=warning [2]=success [3]=info [4-7]=dim versions
#   VERBS - ACTIONS: [0]=primary [1]=secondary [2]=destructive [3]=constructive
#                    [4]=accent [5]=highlight [6]=focus [7]=muted
#   NOUNS - GRADIENT: [0]=darkest → [7]=lightest

# Color token definitions map semantic names to palette references
# Format: "palette:index" where palette is env|mode|verbs|nouns, index is 0-7
declare -gA TDS_COLOR_TOKENS=(
    # =========================================================================
    # STATUS tokens (MODE palette)
    # =========================================================================
    [status.error]="mode:0"
    [status.warning]="mode:1"
    [status.success]="mode:2"
    [status.info]="mode:3"
    [status.error.dim]="mode:4"
    [status.warning.dim]="mode:5"
    [status.success.dim]="mode:6"
    [status.info.dim]="mode:7"

    # =========================================================================
    # ACTION tokens (VERBS palette)
    # =========================================================================
    [action.primary]="verbs:0"
    [action.secondary]="verbs:1"
    [action.destructive]="verbs:2"
    [action.constructive]="verbs:3"
    [action.accent]="verbs:4"
    [action.highlight]="verbs:5"
    [action.focus]="verbs:6"
    [action.muted]="verbs:7"

    # =========================================================================
    # TEXT tokens (NOUNS gradient)
    # =========================================================================
    [text.darkest]="nouns:0"
    [text.dark]="nouns:1"
    [text.dim]="nouns:2"
    [text.muted]="nouns:3"
    [text.subtle]="nouns:4"
    [text.light]="nouns:5"
    [text.pale]="nouns:6"
    [text.brightest]="nouns:7"

    # Aliases for common usage
    [text.primary]="nouns:7"           # brightest for primary text
    [text.secondary]="nouns:5"         # light for secondary
    [text.tertiary]="nouns:3"          # muted for tertiary

    # =========================================================================
    # ENVIRONMENT tokens (ENV alternate palette)
    # =========================================================================
    [env.a.primary]="env:0"
    [env.b.primary]="env:1"
    [env.a.light]="env:2"
    [env.b.light]="env:3"
    [env.a.muted]="env:4"
    [env.b.muted]="env:5"
    [env.a.dim]="env:6"
    [env.b.dim]="env:7"

    # =========================================================================
    # STRUCTURAL tokens (mapped to new structure)
    # =========================================================================
    [structural.primary]="env:0"       # ENV hue A
    [structural.secondary]="env:1"     # ENV hue B
    [structural.accent]="verbs:4"      # accent color
    [structural.muted]="nouns:3"       # muted gray
    [structural.separator]="nouns:2"   # dim gray

    # Structural background tokens
    [structural.bg.primary]="nouns:0"  # darkest
    [structural.bg.secondary]="nouns:1" # dark
    [structural.bg.tertiary]="nouns:2" # dim

    # =========================================================================
    # INTERACTIVE tokens
    # =========================================================================
    [interactive.link]="verbs:0"       # primary action color
    [interactive.active]="verbs:4"     # accent
    [interactive.hover]="verbs:5"      # highlight
    [interactive.focus]="verbs:6"      # focus
    [interactive.selected]="verbs:0"   # primary
    [interactive.disabled]="verbs:7"   # muted

    # =========================================================================
    # CONTENT tokens
    # =========================================================================
    [content.heading.h1]="env:0"       # ENV hue A - top level
    [content.heading.h2]="env:1"       # ENV hue B
    [content.heading.h3]="verbs:0"     # primary action
    [content.heading.h4]="verbs:1"     # secondary action
    [content.code.inline]="verbs:4"    # accent
    [content.code.block]="verbs:1"     # secondary
    [content.quote]="nouns:3"          # muted
    [content.list]="verbs:3"           # constructive (green)
    [content.emphasis.bold]="verbs:5"  # highlight
    [content.emphasis.italic]="env:2"  # ENV A light
    [content.link]="verbs:0"           # primary action
    [content.hr]="nouns:2"             # dim

    # =========================================================================
    # TERMINAL tokens (for TUT rendering)
    # =========================================================================
    [content.terminal.prompt]="verbs:3"    # constructive (green)
    [content.terminal.command]="verbs:0"   # primary
    [content.terminal.output]="nouns:5"    # light gray
    [content.terminal.success]="mode:2"    # success (green)
    [content.terminal.warning]="mode:1"    # warning (amber)
    [content.terminal.error]="mode:0"      # error (red)
    [content.terminal.comment]="nouns:3"   # muted

    # =========================================================================
    # MODULE/ACTION syntax tokens
    # =========================================================================
    [action.module]="env:0"            # ENV hue A
    [action.separator]="nouns:2"       # dim
    [action.name]="verbs:0"            # primary action
    [action.param]="verbs:1"           # secondary
    [action.description]="nouns:3"     # muted
    [action.tes.prefix]="verbs:4"      # accent
    [action.tes.endpoint]="verbs:5"    # highlight

    # =========================================================================
    # MARKER tokens
    # =========================================================================
    [marker.primary]="verbs:0"         # primary action
    [marker.active]="verbs:4"          # accent
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
        echo "$TDS_FALLBACK_TEXT"
        return 1
    fi

    # Parse palette reference: "palette:index"
    local palette="${palette_ref%%:*}"
    local index="${palette_ref##*:}"

    # Validate index is 0-7
    if [[ ! "$index" =~ ^[0-7]$ ]]; then
        echo "$TDS_FALLBACK_TEXT"
        return 1
    fi

    # Resolve to hex based on palette and state
    local hex=""
    local palette_upper="${palette^^}"
    local primary_name="${palette_upper}_PRIMARY"
    local complement_name="${palette_upper}_COMPLEMENT"

    # Validate palette exists
    if ! declare -p "$primary_name" &>/dev/null; then
        echo "$TDS_FALLBACK_TEXT"
        return
    fi

    local -n primary_arr="$primary_name"

    case "$state" in
        bright)
            if declare -p "$complement_name" &>/dev/null; then
                local -n complement_arr="$complement_name"
                hex="${complement_arr[$index]:-$TDS_FALLBACK_TEXT}"
            else
                hex="${primary_arr[$index]:-$TDS_FALLBACK_TEXT}"
            fi
            ;;
        dim)
            hex="$(theme_aware_dim "${primary_arr[$index]:-$TDS_FALLBACK_TEXT}" 4)"
            ;;
        *)
            hex="${primary_arr[$index]:-$TDS_FALLBACK_TEXT}"
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

# Apply color swatch from token (fg+bg same) - prints block and resets
tds_color_swatch() {
    local token="$1"
    local state="${2:-normal}"
    local hex=$(tds_resolve_color "$token" "$state")
    color_swatch "$hex"
    printf "   "
    reset_color
}

# Show all defined tokens with their resolved colors
tds_show_tokens() {
    echo "TDS Color Token System"
    echo "====================="
    echo

    echo "Status Tokens (MODE palette):"
    for key in status.error status.warning status.success status.info \
               status.error.dim status.warning.dim status.success.dim status.info.dim; do
        printf "  %-30s" "$key"
        tds_text_color "$key"
        printf "%s → %s" "${TDS_COLOR_TOKENS["$key"]}" "$(tds_resolve_color "$key")"
        reset_color
        echo
    done
    echo

    echo "Action Tokens (VERBS palette):"
    for key in action.primary action.secondary action.destructive action.constructive \
               action.accent action.highlight action.focus action.muted; do
        printf "  %-30s" "$key"
        tds_text_color "$key"
        printf "%s → %s" "${TDS_COLOR_TOKENS["$key"]}" "$(tds_resolve_color "$key")"
        reset_color
        echo
    done
    echo

    echo "Text Tokens (NOUNS gradient):"
    for key in text.darkest text.dark text.dim text.muted text.subtle text.light text.pale text.brightest; do
        printf "  %-30s" "$key"
        tds_text_color "$key"
        printf "%s → %s" "${TDS_COLOR_TOKENS["$key"]}" "$(tds_resolve_color "$key")"
        reset_color
        echo
    done
    echo

    echo "Environment Tokens (ENV alternate):"
    for key in env.a.primary env.b.primary env.a.light env.b.light \
               env.a.muted env.b.muted env.a.dim env.b.dim; do
        printf "  %-30s" "$key"
        tds_text_color "$key"
        printf "%s → %s" "${TDS_COLOR_TOKENS["$key"]}" "$(tds_resolve_color "$key")"
        reset_color
        echo
    done
    echo
}
