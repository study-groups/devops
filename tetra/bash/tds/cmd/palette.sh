#!/usr/bin/env bash
# TDS Palette Commands

# Set individual palette color (in-memory only)
_tds_cmd_set_palette() {
    local palette="$1"
    local index="$2"
    local hex="$3"

    if [[ -z "$palette" || -z "$index" || -z "$hex" ]]; then
        echo "Usage: tds palette set <name> <index> <hex>"
        echo "Example: tds palette set env 0 #ff0000"
        echo "Palettes: env, mode, verbs, nouns"
        return 1
    fi

    if [[ ! "$hex" =~ ^#[0-9a-fA-F]{6}$ ]]; then
        echo "Invalid hex color: $hex (expected #RRGGBB)"
        return 1
    fi

    if [[ ! "$index" =~ ^[0-9]+$ ]]; then
        echo "Invalid index: $index (expected number)"
        return 1
    fi

    local array_name
    case "${palette,,}" in
        env)   array_name="ENV_PRIMARY" ;;
        mode)  array_name="MODE_PRIMARY" ;;
        verbs) array_name="VERBS_PRIMARY" ;;
        nouns) array_name="NOUNS_PRIMARY" ;;
        *)
            echo "Unknown palette: $palette"
            echo "Palettes: env, mode, verbs, nouns"
            return 1
            ;;
    esac

    declare -n arr="$array_name"
    local old_value="${arr[$index]:-}"
    arr[$index]="$hex"

    echo "Set ${array_name}[$index]: ${old_value:-<empty>} -> $hex"
    echo "(in-memory only, reset on theme switch)"
}

_tds_cmd_get_palette() {
    local palette_name="${1^^}"

    if [[ -z "$palette_name" ]]; then
        for name in ENV MODE VERBS NOUNS; do
            _tds_show_single_palette "${name}_PRIMARY"
        done
        return
    fi

    case "$palette_name" in
        ENV) palette_name="ENV_PRIMARY" ;;
        MODE) palette_name="MODE_PRIMARY" ;;
        VERBS) palette_name="VERBS_PRIMARY" ;;
        NOUNS) palette_name="NOUNS_PRIMARY" ;;
        *_PRIMARY) ;;
        *)
            echo "Unknown palette: $palette_name"
            echo "Available: env, mode, verbs, nouns"
            return 1
            ;;
    esac

    _tds_show_single_palette "$palette_name"
}

_tds_show_single_palette() {
    local palette_name="$1"
    echo
    echo "=== $palette_name ==="
    echo

    if declare -p "$palette_name" >/dev/null 2>&1; then
        local -n palette="$palette_name"
        for i in "${!palette[@]}"; do
            local hex="${palette[$i]}"
            printf "[%d] " "$i"
            if declare -f text_color >/dev/null 2>&1; then
                text_color "$hex"
                bg_only "$hex"
                printf "   "
                reset_color
            fi
            printf " %s\n" "$hex"
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
    echo "  env     ENV_PRIMARY     Environment colors"
    echo "  mode    MODE_PRIMARY    Mode indicators"
    echo "  verbs   VERBS_PRIMARY   Action colors"
    echo "  nouns   NOUNS_PRIMARY   Entity colors"
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
    echo "Palettes: env, mode, verbs, nouns"
    echo
}

export -f _tds_palette _tds_palette_help _tds_cmd_set_palette
export -f _tds_cmd_get_palette _tds_cmd_list_palettes _tds_show_single_palette
