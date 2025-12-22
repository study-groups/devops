#!/usr/bin/env bash
# tps/core/context_kv.sh - Unified multi-context system using kv_store
#
# Supports multiple simultaneous contexts (DEPLOY + GAMES + TDOCS all visible)
# Uses exportable kv_store instead of non-exportable associative arrays
#
# Usage:
#   tps_ctx register deploy DEPLOY 10 1    # Register module (red, priority 10)
#   tps_ctx set deploy tetra docs prod     # Set context
#   tps_ctx get deploy org                 # Get single value
#   tps_ctx show                           # Show all active contexts
#   tps_ctx lines                          # Build prompt lines

# =============================================================================
# DEPENDENCIES
# =============================================================================

if ! type tetra_kv_init &>/dev/null; then
    if [[ -f "$TETRA_SRC/bash/utils/kv_store.sh" ]]; then
        source "$TETRA_SRC/bash/utils/kv_store.sh"
    else
        echo "context_kv: requires kv_store.sh" >&2
        return 1
    fi
fi

# =============================================================================
# STORES
# =============================================================================

# Context values: "module:slot" -> value
# Example: "deploy:org" -> "nodeholder", "games:project" -> "trax"
tetra_kv_init TPS_CTX_VALUES

# Module registry: "module" -> "prefix:priority:color"
# Example: "deploy" -> "DEPLOY:10:1"
tetra_kv_init TPS_CTX_MODULES

# Persistence file
TPS_CTX_FILE="${TPS_CTX_FILE:-$TETRA_DIR/tps/contexts.kv}"

# =============================================================================
# SLOTS (standard across all modules)
# =============================================================================

declare -ga TPS_CTX_SLOTS=(org project subject)

# =============================================================================
# REGISTRATION
# =============================================================================

# Register a module for context display
# Usage: tps_ctx_register <module> <prefix> <priority> <color> [pinned]
# Colors: 1=red, 2=green, 3=yellow, 4=blue, 5=magenta, 6=cyan, 7=white
# Pinned: 1=show in prompt (default), 0=hide
tps_ctx_register() {
    local module="$1"
    local prefix="$2"
    local priority="${3:-50}"
    local color="${4:-7}"
    local pinned="${5:-1}"  # Default: pinned (shown)

    tetra_kv_set TPS_CTX_MODULES "$module" "${prefix}:${priority}:${color}:${pinned}"
}

# Pin a module (show in prompt)
# Usage: tps_ctx_pin <module>
tps_ctx_pin() {
    local module="$1"
    local config
    config=$(tetra_kv_get TPS_CTX_MODULES "$module" 2>/dev/null)
    if [[ -z "$config" ]]; then
        echo "Module not registered: $module" >&2
        return 1
    fi

    local prefix priority color pinned
    IFS=':' read -r prefix priority color pinned <<< "$config"
    tetra_kv_set TPS_CTX_MODULES "$module" "${prefix}:${priority}:${color}:1"
    _tps_ctx_save
    echo "$module pinned (will show in prompt)"
}

# Unpin a module (hide from prompt)
# Usage: tps_ctx_unpin <module>
tps_ctx_unpin() {
    local module="$1"
    local config
    config=$(tetra_kv_get TPS_CTX_MODULES "$module" 2>/dev/null)
    if [[ -z "$config" ]]; then
        echo "Module not registered: $module" >&2
        return 1
    fi

    local prefix priority color pinned
    IFS=':' read -r prefix priority color pinned <<< "$config"
    tetra_kv_set TPS_CTX_MODULES "$module" "${prefix}:${priority}:${color}:0"
    _tps_ctx_save
    echo "$module unpinned (hidden from prompt)"
}

# Check if module is pinned
# Usage: tps_ctx_is_pinned <module>
tps_ctx_is_pinned() {
    local module="$1"
    local config
    config=$(tetra_kv_get TPS_CTX_MODULES "$module" 2>/dev/null) || return 1

    local prefix priority color pinned
    IFS=':' read -r prefix priority color pinned <<< "$config"
    # Default to pinned if not specified (backward compat)
    [[ "${pinned:-1}" == "1" ]]
}

# Unregister a module
tps_ctx_unregister() {
    local module="$1"
    tetra_kv_unset TPS_CTX_MODULES "$module"
    # Also clear its values
    local slot
    for slot in "${TPS_CTX_SLOTS[@]}"; do
        tetra_kv_unset TPS_CTX_VALUES "${module}_${slot}"
    done
}

# =============================================================================
# CONTEXT OPERATIONS
# =============================================================================

# Set context for a module
# Usage: tps_ctx_set <module> <org> [project] [subject]
tps_ctx_set() {
    local module="$1"
    local org="$2"
    local project="${3:-}"
    local subject="${4:-}"

    # Auto-register if not registered (with defaults)
    if ! tetra_kv_has TPS_CTX_MODULES "$module"; then
        local prefix="${module^^}"
        tps_ctx_register "$module" "$prefix" 50 7
    fi

    tetra_kv_set TPS_CTX_VALUES "${module}_org" "$org"
    tetra_kv_set TPS_CTX_VALUES "${module}_project" "$project"
    tetra_kv_set TPS_CTX_VALUES "${module}_subject" "$subject"

    _tps_ctx_save
}

# Get a context value
# Usage: tps_ctx_get <module> <slot>
tps_ctx_get() {
    local module="$1"
    local slot="$2"
    tetra_kv_get TPS_CTX_VALUES "${module}_${slot}"
}

# Get via nameref (no subshell)
# Usage: tps_ctx_get_ref <module> <slot> <out_var>
tps_ctx_get_ref() {
    local module="$1"
    local slot="$2"
    local -n _out="$3"
    tetra_kv_get_ref TPS_CTX_VALUES "${module}_${slot}" _out
}

# Clear context for a module
# Usage: tps_ctx_clear <module>
tps_ctx_clear() {
    local module="$1"
    local slot
    for slot in "${TPS_CTX_SLOTS[@]}"; do
        tetra_kv_unset TPS_CTX_VALUES "${module}_${slot}"
    done
    _tps_ctx_save
}

# Check if module has any context set
# Usage: tps_ctx_has <module>
tps_ctx_has() {
    local module="$1"
    local slot val
    for slot in "${TPS_CTX_SLOTS[@]}"; do
        val=$(tetra_kv_get TPS_CTX_VALUES "${module}_${slot}" 2>/dev/null)
        [[ -n "$val" ]] && return 0
    done
    return 1
}

# =============================================================================
# PERSISTENCE
# =============================================================================

_tps_ctx_save() {
    local dir
    dir=$(dirname "$TPS_CTX_FILE")
    mkdir -p "$dir"

    # Save both stores to single file
    cat > "$TPS_CTX_FILE" <<EOF
# TPS Context Store (auto-generated)
TPS_CTX_VALUES='${TPS_CTX_VALUES}'
TPS_CTX_MODULES='${TPS_CTX_MODULES}'
EOF
}

_tps_ctx_load() {
    [[ ! -f "$TPS_CTX_FILE" ]] && return 0
    # Source the file - it contains valid bash variable assignments
    # Safe because we generate it ourselves in _tps_ctx_save
    source "$TPS_CTX_FILE"
    export TPS_CTX_VALUES TPS_CTX_MODULES
}

# =============================================================================
# PROMPT BUILDING
# =============================================================================

# Build context line for a single module (uses nameref, no subshell)
# Usage: _tps_ctx_build_line_ref <module> <out_var>
_tps_ctx_build_line_ref() {
    local module="$1"
    local -n _line="$2"
    _line=""

    # Get module config
    local config
    config=$(tetra_kv_get TPS_CTX_MODULES "$module" 2>/dev/null) || return

    local prefix priority color
    IFS=':' read -r prefix priority color <<< "$config"

    # Get context values
    local org proj subj
    tps_ctx_get_ref "$module" org org
    tps_ctx_get_ref "$module" project proj
    tps_ctx_get_ref "$module" subject subj

    # Skip if all empty
    [[ -z "$org" && -z "$proj" && -z "$subj" ]] && return

    # Prefix colors (1-8)
    local -A pcolors=(
        [1]=$'\e[31m' [2]=$'\e[32m' [3]=$'\e[33m' [4]=$'\e[34m'
        [5]=$'\e[35m' [6]=$'\e[36m' [7]=$'\e[37m' [8]=$'\e[1;37m'
    )

    # Prefix color from registration
    local c_prefix="${pcolors[$color]:-${pcolors[7]}}"

    # Slot colors - use TPS theme if available, else defaults
    local c_org c_proj c_subj c_sep c_bracket c_empty r=$'\e[0m'

    # Helper: hex to raw ANSI
    _hex_to_ansi() {
        local hex="${1#\#}"
        [[ ${#hex} -ne 6 ]] && { printf '\e[0m'; return; }
        local red=$((16#${hex:0:2})) grn=$((16#${hex:2:2})) blu=$((16#${hex:4:2}))
        local c256=$(( 16 + 36*(red/51) + 6*(grn/51) + (blu/51) ))
        printf '\e[38;5;%dm' "$c256"
    }

    if type _tps_get_color_hex &>/dev/null; then
        # Use theme colors
        c_proj=$(_hex_to_ansi "$(_tps_get_color_hex target)")
        c_sep=$(_hex_to_ansi "$(_tps_get_color_hex sep)")
        c_bracket=$(_hex_to_ansi "$(_tps_get_color_hex bracket)")
        c_empty="$c_sep"
    else
        # Fallback defaults
        c_proj=$'\e[38;5;220m'    # Yellow
        c_sep=$'\e[38;5;240m'     # Dim gray
        c_bracket=$'\e[38;5;245m' # Gray
        c_empty=$'\e[38;5;240m'   # Dim
    fi

    # Org color from ENV_PRIMARY palette (hashed by org name for consistency)
    # Each org gets a unique color from the 8-color palette
    if [[ -n "${ENV_PRIMARY[0]:-}" && -n "$org" ]]; then
        # Simple hash: sum of ASCII values mod 8
        local hash=0 i
        for ((i = 0; i < ${#org}; i++)); do
            hash=$(( (hash + $(printf '%d' "'${org:i:1}")) % 8 ))
        done
        c_org=$(_hex_to_ansi "${ENV_PRIMARY[$hash]}")
    elif type _tps_get_color_hex &>/dev/null; then
        c_org=$(_hex_to_ansi "$(_tps_get_color_hex org)")
    else
        c_org=$'\e[38;5;51m'   # Cyan fallback
    fi

    # Subject color based on env type (prod/staging/dev awareness)
    case "${subj,,}" in
        prod|production)
            c_subj=$'\e[38;5;196m'  # Red - critical
            ;;
        stage|staging|stg)
            c_subj=$'\e[38;5;208m'  # Orange - warning
            ;;
        dev|development)
            c_subj=$'\e[38;5;82m'   # Green - safe
            ;;
        local|localhost)
            c_subj=$'\e[38;5;51m'   # Cyan - neutral
            ;;
        *)
            if type _tps_get_color_hex &>/dev/null; then
                c_subj=$(_hex_to_ansi "$(_tps_get_color_hex env)")
            else
                c_subj=$'\e[38;5;82m'  # Green fallback
            fi
            ;;
    esac

    # Build line: PREFIX[org:project:subject] with colors
    _line="${c_prefix}${prefix}${r}"
    _line+="${c_bracket}[${r}"

    # Org
    if [[ -n "$org" ]]; then
        _line+="${c_org}${org}${r}"
    else
        _line+="${c_empty}?${r}"
    fi

    _line+="${c_sep}:${r}"

    # Project
    if [[ -n "$proj" ]]; then
        _line+="${c_proj}${proj}${r}"
    else
        _line+="${c_empty}?${r}"
    fi

    _line+="${c_sep}:${r}"

    # Subject
    if [[ -n "$subj" ]]; then
        _line+="${c_subj}${subj}${r}"
    else
        _line+="${c_empty}?${r}"
    fi

    _line+="${c_bracket}]${r}"
}

# Build all context lines sorted by priority (only pinned modules)
# Usage: tps_ctx_lines
tps_ctx_lines() {
    local modules=()
    local priorities=()

    # Collect registered modules with their priorities (skip unpinned)
    local mod config prefix priority color pinned
    while read -r mod; do
        [[ -z "$mod" ]] && continue
        config=$(tetra_kv_get TPS_CTX_MODULES "$mod")
        IFS=':' read -r prefix priority color pinned <<< "$config"
        # Skip unpinned modules (default to pinned for backward compat)
        [[ "${pinned:-1}" == "0" ]] && continue
        modules+=("$mod")
        priorities+=("${priority:-50}")
    done < <(tetra_kv_keys TPS_CTX_MODULES)

    # Sort by priority (simple bubble sort, few modules expected)
    local i j tmp_m tmp_p n=${#modules[@]}
    for ((i = 0; i < n - 1; i++)); do
        for ((j = 0; j < n - i - 1; j++)); do
            if ((priorities[j] > priorities[j + 1])); then
                tmp_m="${modules[j]}"
                tmp_p="${priorities[j]}"
                modules[j]="${modules[j + 1]}"
                priorities[j]="${priorities[j + 1]}"
                modules[j + 1]="$tmp_m"
                priorities[j + 1]="$tmp_p"
            fi
        done
    done

    # Build lines
    local line
    for mod in "${modules[@]}"; do
        _tps_ctx_build_line_ref "$mod" line
        [[ -n "$line" ]] && echo "$line"
    done
}

# =============================================================================
# CLI INTERFACE
# =============================================================================

# Show all active contexts
tps_ctx_show() {
    echo "Active Contexts"
    echo "==============="

    local mod config prefix priority color pinned org proj subj pin_icon
    while read -r mod; do
        [[ -z "$mod" ]] && continue

        config=$(tetra_kv_get TPS_CTX_MODULES "$mod")
        IFS=':' read -r prefix priority color pinned <<< "$config"

        tps_ctx_get_ref "$mod" org org
        tps_ctx_get_ref "$mod" project proj
        tps_ctx_get_ref "$mod" subject subj

        # Skip if empty
        [[ -z "$org" && -z "$proj" && -z "$subj" ]] && continue

        # Pin indicator (default to pinned for backward compat)
        if [[ "${pinned:-1}" == "1" ]]; then
            pin_icon="+"
        else
            pin_icon="-"
        fi

        printf "  %s %-10s %s[%s:%s:%s]\n" "$pin_icon" "$mod" "$prefix" "${org:-?}" "${proj:-?}" "${subj:-?}"
    done < <(tetra_kv_keys TPS_CTX_MODULES)

    echo ""
    echo "  + = pinned (shown), - = unpinned (hidden)"
    echo "  Use: tps_ctx pin <mod> | tps_ctx unpin <mod>"
}

# Main dispatcher
tps_ctx() {
    local cmd="${1:-show}"
    shift 2>/dev/null || true

    case "$cmd" in
        register|reg)
            tps_ctx_register "$@"
            ;;
        unregister|unreg)
            tps_ctx_unregister "$@"
            ;;
        set)
            tps_ctx_set "$@"
            ;;
        get)
            tps_ctx_get "$@"
            ;;
        clear)
            tps_ctx_clear "$@"
            ;;
        has)
            tps_ctx_has "$@"
            ;;
        pin)
            tps_ctx_pin "$@"
            ;;
        unpin)
            tps_ctx_unpin "$@"
            ;;
        show|status)
            tps_ctx_show
            ;;
        lines)
            tps_ctx_lines
            ;;
        modules)
            tetra_kv_keys TPS_CTX_MODULES
            ;;
        dump)
            echo "=== Modules ==="
            tetra_kv_dump TPS_CTX_MODULES
            echo ""
            echo "=== Values ==="
            tetra_kv_dump TPS_CTX_VALUES
            ;;
        *)
            cat <<'EOF'
tps_ctx - Multi-context management

Commands:
  register <mod> <PREFIX> <pri> <color>   Register module
  set <mod> <org> [proj] [subj]           Set context
  get <mod> <slot>                        Get value
  clear <mod>                             Clear module context
  pin <mod>                               Pin module (show in prompt)
  unpin <mod>                             Unpin module (hide from prompt)
  show                                    Show all active (+ pinned, - unpinned)
  lines                                   Build prompt lines
  modules                                 List registered modules
  dump                                    Debug dump stores

Colors: 1=red, 2=green, 3=yellow, 4=blue, 5=magenta, 6=cyan, 7=white

Examples:
  tps_ctx register deploy DEPLOY 10 1     # Red, high priority
  tps_ctx set deploy nodeholder docs prod
  tps_ctx pin deploy                      # Show in prompt
  tps_ctx unpin games                     # Hide from prompt
  tps_ctx show                            # See pin status
EOF
            ;;
    esac
}

# =============================================================================
# MODULE HELPER (for backward compat)
# =============================================================================

# Generate legacy-compatible functions for a module
# Usage: tps_ctx_module_compat <module>
tps_ctx_module_compat() {
    local module="$1"
    local MODULE="${module^^}"

    # Generate provider functions that modules expect
    eval "_${module}_prompt_org() { tps_ctx_get $module org; }"
    eval "_${module}_prompt_project() { tps_ctx_get $module project; }"
    eval "_${module}_prompt_subject() { tps_ctx_get $module subject; }"

    # Generate context command
    eval "${module}_ctx() {
        local cmd=\"\${1:-status}\"
        shift 2>/dev/null || true
        case \"\$cmd\" in
            set) tps_ctx_set $module \"\$@\" ;;
            clear) tps_ctx_clear $module ;;
            status|'')
                echo \"${MODULE} Context\"
                echo \"===============\"
                echo \"  Org:     \$(tps_ctx_get $module org)\"
                echo \"  Project: \$(tps_ctx_get $module project)\"
                echo \"  Subject: \$(tps_ctx_get $module subject)\"
                ;;
            *) tps_ctx_set $module \"\$cmd\" \"\$@\" ;;
        esac
    }"

    export -f "_${module}_prompt_org" "_${module}_prompt_project" "_${module}_prompt_subject"
    export -f "${module}_ctx"
}

# =============================================================================
# INIT
# =============================================================================

_tps_ctx_load

# =============================================================================
# EXPORTS
# =============================================================================

export -f tps_ctx_register tps_ctx_unregister
export -f tps_ctx_pin tps_ctx_unpin tps_ctx_is_pinned
export -f tps_ctx_set tps_ctx_get tps_ctx_get_ref tps_ctx_clear tps_ctx_has
export -f _tps_ctx_save _tps_ctx_load
export -f _tps_ctx_build_line_ref tps_ctx_lines
export -f tps_ctx_show tps_ctx tps_ctx_module_compat
