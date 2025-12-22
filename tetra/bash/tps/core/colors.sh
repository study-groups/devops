#!/usr/bin/env bash
# tps/core/colors.sh - TDS theme integration for prompt colors
#
# PERFORMANCE: Colors are cached and only recalculated when theme or
# overrides change. This avoids 12 conversions per prompt.
#
# Uses kv_store for exportable storage (survives subshells).

# Color variables with defaults (overridden by TDS when available)
declare -g _TPS_C_RESET='\[\e[0m\]'
declare -g _TPS_C_USER='\[\e[0;38;5;228m\]'
declare -g _TPS_C_GIT='\[\e[0;38;5;51m\]'
declare -g _TPS_C_PATH='\[\e[0;38;5;250m\]'
declare -g _TPS_C_PATH_DIM='\[\e[0;38;5;240m\]'
declare -g _TPS_C_ORG='\[\e[0;38;5;51m\]'
declare -g _TPS_C_TARGET='\[\e[0;38;5;220m\]'
declare -g _TPS_C_ENV='\[\e[0;38;5;82m\]'
declare -g _TPS_C_SEP='\[\e[0;38;5;240m\]'
declare -g _TPS_C_BRACKET='\[\e[0;38;5;245m\]'
declare -g _TPS_C_DURATION='\[\e[0;38;5;240m\]'
declare -g _TPS_C_ERROR='\[\e[0;38;5;196m\]'
declare -g _TPS_C_PURPLE='\[\e[0;38;5;129m\]'

# Cache signature for dirty checking
declare -g _TPS_COLOR_CACHE_SIG=""

# =============================================================================
# KV STORES (exportable, survive subshells)
# =============================================================================

# Initialize color stores if not already done
if [[ -z "${_TPS_COLOR_DEFS:-}" ]]; then
    tetra_kv_init _TPS_COLOR_DEFS
    tetra_kv_init _TPS_COLOR_OVERRIDES

    # Color element definitions: element -> "variable_name:tds_source:default_hex"
    tetra_kv_set _TPS_COLOR_DEFS user "_TPS_C_USER:ENV_PRIMARY[0]:e4e47a"
    tetra_kv_set _TPS_COLOR_DEFS git "_TPS_C_GIT:ENV_PRIMARY[1]:00d7ff"
    tetra_kv_set _TPS_COLOR_DEFS path "_TPS_C_PATH:NOUNS_PRIMARY[6]:e4e4e7"
    tetra_kv_set _TPS_COLOR_DEFS path_dim "_TPS_C_PATH_DIM:NOUNS_PRIMARY[3]:71717a"
    tetra_kv_set _TPS_COLOR_DEFS org "_TPS_C_ORG:ENV_PRIMARY[0]:00d7ff"
    tetra_kv_set _TPS_COLOR_DEFS target "_TPS_C_TARGET:VERBS_PRIMARY[4]:ffc107"
    tetra_kv_set _TPS_COLOR_DEFS env "_TPS_C_ENV:MODE_PRIMARY[2]:4caf50"
    tetra_kv_set _TPS_COLOR_DEFS sep "_TPS_C_SEP:NOUNS_PRIMARY[3]:666666"
    tetra_kv_set _TPS_COLOR_DEFS bracket "_TPS_C_BRACKET:NOUNS_PRIMARY[4]:888888"
    tetra_kv_set _TPS_COLOR_DEFS duration "_TPS_C_DURATION:NOUNS_PRIMARY[3]:71717a"
    tetra_kv_set _TPS_COLOR_DEFS error "_TPS_C_ERROR:VERBS_PRIMARY[0]:ff5252"
    tetra_kv_set _TPS_COLOR_DEFS purple "_TPS_C_PURPLE:VERBS_PRIMARY[6]:8E24AA"
fi

# Ordered list of color elements (for iteration)
declare -ga _TPS_COLOR_ELEMENTS=(user git path path_dim org target env sep bracket duration error purple)

# Convert hex to PS1-safe 256-color escape
_tps_hex_to_ps1() {
    local hex="${1#\#}"
    [[ ${#hex} -ne 6 ]] && { echo '\[\e[0m\]'; return; }

    local r=$((16#${hex:0:2}))
    local g=$((16#${hex:2:2}))
    local b=$((16#${hex:4:2}))
    local c256=$(( 16 + 36*(r/51) + 6*(g/51) + (b/51) ))
    printf '\[\e[0;38;5;%dm\]' "$c256"
}

# Get hex value for an element (override > TDS > default)
_tps_get_color_hex() {
    local element="$1"
    local def
    def=$(tetra_kv_get _TPS_COLOR_DEFS "$element") || return 1

    # Check for custom override first
    local override
    if override=$(tetra_kv_get _TPS_COLOR_OVERRIDES "$element" 2>/dev/null); then
        echo "$override"
        return
    fi

    # Parse definition: var_name:tds_source:default
    local tds_source default_hex
    IFS=':' read -r _ tds_source default_hex <<< "$def"

    # Try to get from TDS array
    local tds_value
    if [[ "$tds_source" =~ ^([A-Z_]+)\[([0-9]+)\]$ ]]; then
        local arr_name="${BASH_REMATCH[1]}"
        local arr_idx="${BASH_REMATCH[2]}"
        local -n arr_ref="$arr_name" 2>/dev/null || { echo "$default_hex"; return; }
        tds_value="${arr_ref[$arr_idx]:-}"
    fi

    echo "${tds_value:-$default_hex}"
}

# Build cache signature for dirty checking - uses nameref to avoid subshell
# Usage: _tps_color_cache_sig_ref <output_var>
_tps_color_cache_sig_ref() {
    local -n _sig_out="$1"
    local override_count
    override_count=$(tetra_kv_count _TPS_COLOR_OVERRIDES)
    _sig_out="${TDS_ACTIVE_THEME:-default}:${override_count}"
    # Include the full overrides string in signature (changes trigger rebuild)
    _sig_out+=":${_TPS_COLOR_OVERRIDES:-}"
}

# Update colors from TDS theme (respects overrides)
# PERFORMANCE: Caches colors and only rebuilds when theme/overrides change
_tps_update_colors() {
    # Check if colors need updating (no subshell via nameref)
    local current_sig
    _tps_color_cache_sig_ref current_sig
    [[ "$current_sig" == "$_TPS_COLOR_CACHE_SIG" ]] && return 0
    _TPS_COLOR_CACHE_SIG="$current_sig"

    # Rebuild all colors using the ordered element list
    local element def var_name hex
    for element in "${_TPS_COLOR_ELEMENTS[@]}"; do
        def=$(tetra_kv_get _TPS_COLOR_DEFS "$element") || continue
        IFS=':' read -r var_name _ _ <<< "$def"
        hex=$(_tps_get_color_hex "$element")
        printf -v "$var_name" '%s' "$(_tps_hex_to_ps1 "$hex")"
    done
}

# =============================================================================
# COLOR EDITING API
# =============================================================================

# Set a color override
_tps_color_set() {
    local element="$1"
    local hex="${2#\#}"

    if ! tetra_kv_has _TPS_COLOR_DEFS "$element"; then
        echo "Unknown element: $element" >&2
        echo "Valid: ${_TPS_COLOR_ELEMENTS[*]}" >&2
        return 1
    fi

    if [[ ! "$hex" =~ ^[0-9a-fA-F]{6}$ ]]; then
        echo "Invalid hex color: $hex (expected 6 hex digits)" >&2
        return 1
    fi

    tetra_kv_set _TPS_COLOR_OVERRIDES "$element" "$hex"
    _tps_update_colors
    echo "Set $element to #$hex"
}

# Clear a specific override or all overrides
_tps_color_reset() {
    local element="$1"

    if [[ -z "$element" || "$element" == "all" ]]; then
        tetra_kv_init _TPS_COLOR_OVERRIDES  # Reinit clears it
        _tps_update_colors
        echo "Reset all colors to theme defaults"
    elif tetra_kv_has _TPS_COLOR_DEFS "$element"; then
        tetra_kv_unset _TPS_COLOR_OVERRIDES "$element"
        _tps_update_colors
        echo "Reset $element to theme default"
    else
        echo "Unknown element: $element" >&2
        return 1
    fi
}

# List all colors with current values
_tps_color_list() {
    local theme="${TDS_ACTIVE_THEME:-default}"

    _swatch() {
        local hex="${1#\#}"
        [[ ${#hex} -ne 6 ]] && { printf "      "; return; }
        local r=$((16#${hex:0:2})) g=$((16#${hex:2:2})) b=$((16#${hex:4:2}))
        local c256=$(( 16 + 36*(r/51) + 6*(g/51) + (b/51) ))
        printf "\e[48;5;%dm  \e[0m #%s" "$c256" "$hex"
    }

    echo ""
    printf "  \e[1mTPS Colors\e[0m (theme: %s)\n" "$theme"
    echo ""
    printf "  %-12s %-10s %-18s %s\n" "Element" "Override" "TDS Source" "Color"
    printf "  %s\n" "─────────────────────────────────────────────────────────"

    local element def var_name tds_source default_hex hex override
    for element in "${_TPS_COLOR_ELEMENTS[@]}"; do
        def=$(tetra_kv_get _TPS_COLOR_DEFS "$element") || continue
        IFS=':' read -r var_name tds_source default_hex <<< "$def"
        hex=$(_tps_get_color_hex "$element")

        if tetra_kv_has _TPS_COLOR_OVERRIDES "$element"; then
            override="*"
        else
            override=""
        fi

        printf "  %-12s %-10s %-18s " "$element" "$override" "$tds_source"
        _swatch "$hex"
        echo ""
    done

    local override_count
    override_count=$(tetra_kv_count _TPS_COLOR_OVERRIDES)
    if [[ "$override_count" -gt 0 ]]; then
        echo ""
        echo "  * = custom override (use 'tps color reset' to clear)"
    fi
    echo ""
}

# Main color command dispatcher
tps_color() {
    case "$1" in
        set)
            shift
            _tps_color_set "$@"
            ;;
        reset)
            shift
            _tps_color_reset "$@"
            ;;
        list|"")
            _tps_color_list
            ;;
        *)
            cat <<'EOF'
Usage: tps color <command>

Commands:
  list              Show all color elements with current values
  set <elem> <hex>  Set a color override (e.g., tps color set user ff5500)
  reset [elem|all]  Reset color(s) to theme defaults

Elements: user, git, path, path_dim, org, target, env, sep, bracket, duration, error, purple
EOF
            ;;
    esac
}

# Initialize colors (register for pre_prompt hook)
_tps_colors_init() {
    tps_hook_register pre_prompt _tps_update_colors 10
    _tps_update_colors
}

# Backward compat aliases
_tps_show_colors() { _tps_color_list; }
_update_prompt_colors() { _tps_update_colors; }
_update_deploy_colors() { _tps_update_colors; }
_hex_to_ps1() { _tps_hex_to_ps1 "$@"; }

# Only export public API - internal functions stay local to avoid /bin/sh import errors
export -f tps_color
export -f _tps_show_colors _update_prompt_colors _update_deploy_colors _hex_to_ps1
