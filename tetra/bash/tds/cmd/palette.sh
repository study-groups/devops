#!/usr/bin/env bash
# TDS Palette Commands - New 4-palette system
#
# PRIMARY[0-7]   - Main rainbow (defined)
# SECONDARY[0-7] - Theme accent (defined)
# SEMANTIC[0-7]  - Derived: error/warning/success/info
# SURFACE[0-7]   - Derived: bg→fg gradient

# Set individual palette color (in-memory only)
_tds_cmd_set_palette() {
    local palette="$1"
    local index="$2"
    local hex="$3"

    if [[ -z "$palette" || -z "$index" || -z "$hex" ]]; then
        echo "Usage: tds palette set <name> <index> <hex>"
        echo "Example: tds palette set primary 0 FF0000"
        echo "Palettes: primary, secondary (semantic/surface are derived)"
        return 1
    fi

    # Strip # if present
    hex="${hex#\#}"

    if [[ ! "$hex" =~ ^[0-9a-fA-F]{6}$ ]]; then
        echo "Invalid hex color: $hex (expected RRGGBB)"
        return 1
    fi

    if [[ ! "$index" =~ ^[0-9]+$ ]] || ((index > 7)); then
        echo "Invalid index: $index (expected 0-7)"
        return 1
    fi

    local array_name
    case "${palette,,}" in
        primary)   array_name="PRIMARY" ;;
        secondary) array_name="SECONDARY" ;;
        semantic|surface)
            echo "Cannot set $palette - it's derived from PRIMARY/SECONDARY"
            echo "Use: tds palette set primary <index> <hex>"
            return 1
            ;;
        # Legacy names
        env)   array_name="PRIMARY" ;;
        mode)  array_name="SECONDARY" ;;
        *)
            echo "Unknown palette: $palette"
            echo "Palettes: primary, secondary"
            return 1
            ;;
    esac

    declare -n arr="$array_name"
    local old_value="${arr[$index]:-}"
    arr[$index]="${hex^^}"

    echo "Set ${array_name}[$index]: ${old_value:-<empty>} → ${hex^^}"

    # Re-derive dependent palettes
    if declare -f tds_derive >/dev/null 2>&1; then
        tds_derive
        echo "(SEMANTIC and SURFACE re-derived)"
    fi
}

_tds_cmd_get_palette() {
    local palette_name="${1,,}"

    if [[ -z "$palette_name" ]]; then
        _tds_show_all_palettes
        return
    fi

    case "$palette_name" in
        primary)   _tds_show_palette_detail "PRIMARY" "Main rainbow" ;;
        secondary) _tds_show_palette_detail "SECONDARY" "Theme accent" ;;
        semantic)  _tds_show_palette_detail "SEMANTIC" "Status colors (derived)" ;;
        surface)   _tds_show_palette_detail "SURFACE" "Text/bg gradient (derived)" ;;
        # Legacy names
        env)       _tds_show_palette_detail "PRIMARY" "Main rainbow" ;;
        mode)      _tds_show_palette_detail "SECONDARY" "Theme accent" ;;
        verbs)     _tds_show_palette_detail "SEMANTIC" "Status colors (derived)" ;;
        nouns)     _tds_show_palette_detail "SURFACE" "Text/bg gradient (derived)" ;;
        *)
            echo "Unknown palette: $palette_name"
            echo "Available: primary, secondary, semantic, surface"
            return 1
            ;;
    esac
}

# Show all palettes in compact view
_tds_show_all_palettes() {
    echo
    # Background header
    echo "╭────────────────────────────────────────────────────────────────╮"
    printf "│  BACKGROUND  "
    if declare -f bg_only >/dev/null 2>&1; then
        bg_only "$BACKGROUND"
        printf "                        "
        reset_color
    fi
    printf "  #%s  TINT: %s%%  │\n" "$BACKGROUND" "$TINT"
    echo "╰────────────────────────────────────────────────────────────────╯"
    echo

    # PRIMARY
    echo "  PRIMARY (defined)"
    _tds_show_palette_row "PRIMARY"
    echo "  red   org   yel   grn   cyn   blu   pur   pnk"
    echo "  :0    :1    :2    :3    :4    :5    :6    :7"
    echo

    # SECONDARY
    echo "  SECONDARY (defined)"
    _tds_show_palette_row "SECONDARY"
    echo "  :0    :1    :2    :3    :4    :5    :6    :7"
    echo

    # SEMANTIC
    echo "  SEMANTIC (derived from PRIMARY)"
    _tds_show_palette_row "SEMANTIC"
    echo "  err   warn  ok    info  err↓  wrn↓  ok↓   inf↓"
    echo "  :0    :1    :2    :3    :4    :5    :6    :7"
    echo

    # SURFACE
    echo "  SURFACE (derived from BACKGROUND)"
    _tds_show_palette_row "SURFACE"
    echo "  bg    +1    +2    +3    +4    +5    +6    fg"
    echo "  :0    :1    :2    :3    :4    :5    :6    :7"
    echo
}

# Show a row of color swatches
_tds_show_palette_row() {
    local array_name="$1"
    printf "  "

    if declare -p "$array_name" >/dev/null 2>&1; then
        local -n palette="$array_name"
        for i in {0..7}; do
            local hex="${palette[$i]:-888888}"
            if declare -f text_color >/dev/null 2>&1; then
                text_color "$hex"
                bg_only "$hex"
                printf "████"
                reset_color
                printf "  "
            else
                printf "[%s] " "$hex"
            fi
        done
    else
        echo "(not defined)"
    fi
    echo
}

# Show detailed single palette
_tds_show_palette_detail() {
    local array_name="$1"
    local description="$2"

    echo
    echo "  $array_name - $description"
    echo

    if declare -p "$array_name" >/dev/null 2>&1; then
        local -n palette="$array_name"
        local name_lower="${array_name,,}"
        for i in "${!palette[@]}"; do
            local hex="${palette[$i]}"
            printf "  "
            if declare -f text_color >/dev/null 2>&1; then
                text_color "$hex"
                bg_only "$hex"
                printf "████████████"
                reset_color
            fi
            printf "  %d  %s  %s:%d\n" "$i" "$hex" "$name_lower" "$i"
        done
    else
        echo "  (not defined)"
    fi
    echo
}

_tds_cmd_list_palettes() {
    echo
    echo "=== Palettes ==="
    echo
    echo "  primary    PRIMARY      Main rainbow (8 hues)"
    echo "  secondary  SECONDARY    Theme accent (8 hues)"
    echo "  semantic   SEMANTIC     Status: error/warning/success/info (derived)"
    echo "  surface    SURFACE      Text/bg gradient (derived)"
    echo
    echo "Theme inputs: BACKGROUND, TINT, PRIMARY, SECONDARY"
    echo "Derived:      tds_derive → SEMANTIC, SURFACE"
    echo
}

# Resource handler
_tds_palette() {
    local action="${1:-}"
    shift 2>/dev/null || true

    case "$action" in
        list|ls)     _tds_cmd_list_palettes ;;
        get)         _tds_cmd_get_palette "$@" ;;
        set)         _tds_cmd_set_palette "$@" ;;
        help|--help|-h|"")
            _tds_palette_help
            ;;
        *)
            echo "Unknown action: palette $action"
            _tds_palette_help
            return 1
            ;;
    esac
}

_tds_palette_help() {
    echo
    echo "tds palette - Manage color palettes"
    echo
    echo "  list                   List palette names"
    echo "  get [name]             Show palette colors"
    echo "  set <name> <i> <hex>   Set color (in-memory)"
    echo
    echo "Palettes: primary, secondary, semantic, surface"
    echo
}

export -f _tds_palette _tds_palette_help _tds_cmd_set_palette
export -f _tds_cmd_get_palette _tds_cmd_list_palettes
export -f _tds_show_all_palettes _tds_show_palette_row _tds_show_palette_detail
