#!/usr/bin/env bash
# tps/core/context.sh - Multi-module context system
#
# PERFORMANCE: This file is in the hot path (runs every prompt).
# All rendering functions use namerefs to avoid subshell forking.
#
# Supports multiple context lines (e.g., deploy AND tdocs)
# Each module registers its own providers and gets its own line
# Format: DEPLOY[org:project:subject] with colored prefix
#
# Color codes (ENV 1-8):
#   1=red, 2=green, 3=yellow, 4=blue, 5=magenta, 6=cyan, 7=white, 8=bright

# =============================================================================
# PREFIX COLORS (ENV 1-8 mapped to ANSI)
# =============================================================================
# NOTE: Colors are defined inline in _tps_build_context_line_for_ref()
# because bash cannot export associative arrays across subshells.
# Color codes: 1=red, 2=green, 3=yellow, 4=blue, 5=magenta, 6=cyan, 7=white, 8=bright

# =============================================================================
# SLOT DEFINITIONS
# =============================================================================

# Primary slot names
declare -ga _TPS_CTX_SLOTS=(org project subject)

# Slot aliases for backward compatibility
declare -gA _TPS_CTX_SLOT_ALIASES=(
    [target]=project
    [env]=subject
)

# =============================================================================
# REGISTRIES
# =============================================================================

# Context lines: module_name -> "prefix:priority:color"
# Example: deploy -> "DEPLOY:10:1", tdocs -> "TDOCS:20:2"
declare -gA _TPS_CTX_LINES=()

# Provider functions: module:slot -> function_name
# Example: deploy:org -> _deploy_prompt_org
declare -gA _TPS_CTX_PROVIDERS=()

# =============================================================================
# SLOT RESOLUTION (No subshells)
# =============================================================================

# Resolve slot name (handle aliases) - uses nameref
# Usage: _tps_resolve_slot_ref <slot> <output_var>
_tps_resolve_slot_ref() {
    local slot="$1"
    local -n _slot_out="$2"
    _slot_out="${_TPS_CTX_SLOT_ALIASES[$slot]:-$slot}"
}

# Legacy wrapper (for non-hot-path code)
_tps_resolve_slot() {
    local slot="$1"
    echo "${_TPS_CTX_SLOT_ALIASES[$slot]:-$slot}"
}

# Validate slot name (no subshells)
_tps_valid_slot() {
    local slot="$1"
    local resolved
    _tps_resolve_slot_ref "$slot" resolved
    local s
    for s in "${_TPS_CTX_SLOTS[@]}"; do
        [[ "$resolved" == "$s" ]] && return 0
    done
    return 1
}

# =============================================================================
# REGISTRATION API
# =============================================================================

# Register a context line for a module
# Usage: tps_register_context_line <module> <prefix> <priority> [color]
# Example: tps_register_context_line deploy DEPLOY 10 1
# Colors: 1=red, 2=green, 3=yellow, 4=blue, 5=magenta, 6=cyan, 7=white, 8=bright
tps_register_context_line() {
    local module="$1"
    local prefix="$2"
    local priority="${3:-50}"
    local color="${4:-7}"  # Default: white
    _TPS_CTX_LINES[$module]="${prefix}:${priority}:${color}"
}

# Unregister a context line
tps_unregister_context_line() {
    local module="$1"
    unset "_TPS_CTX_LINES[$module]"
    # Also remove all providers for this module
    local key
    for key in "${!_TPS_CTX_PROVIDERS[@]}"; do
        [[ "$key" == "$module:"* ]] && unset "_TPS_CTX_PROVIDERS[$key]"
    done
}

# Register a context provider for a module's slot
# Usage: tps_register_context <slot> <function> [module]
# Module defaults to "default" for backward compat
tps_register_context() {
    local slot="$1"
    local func="$2"
    local module="${3:-default}"

    # Resolve aliases (not hot path, can use subshell)
    local resolved
    _tps_resolve_slot_ref "$slot" resolved

    # Validate slot
    if ! _tps_valid_slot "$resolved"; then
        echo "tps_register_context: unknown slot: $slot" >&2
        echo "  Valid: ${_TPS_CTX_SLOTS[*]}" >&2
        echo "  Aliases: target->project, env->subject" >&2
        return 1
    fi

    _TPS_CTX_PROVIDERS["$module:$resolved"]="$func"

    # Auto-register default context line if not exists
    if [[ "$module" == "default" && -z "${_TPS_CTX_LINES[default]:-}" ]]; then
        _TPS_CTX_LINES[default]=":50:7"  # No prefix for default
    fi
}

# Unregister a context provider
tps_unregister_context() {
    local slot="$1"
    local module="${2:-default}"
    local resolved
    _tps_resolve_slot_ref "$slot" resolved
    unset "_TPS_CTX_PROVIDERS[$module:$resolved]"
}

# Get context value for a module's slot - uses nameref for output
# Usage: tps_get_context_ref <slot> <module> <output_var>
tps_get_context_ref() {
    local slot="$1"
    local module="$2"
    local -n _ctx_out="$3"

    local resolved
    _tps_resolve_slot_ref "$slot" resolved

    local provider="${_TPS_CTX_PROVIDERS[$module:$resolved]:-}"
    if [[ -n "$provider" ]]; then
        # Call provider and capture output (one fork, unavoidable for user providers)
        _ctx_out=$("$provider" 2>/dev/null) || _ctx_out=""
    else
        _ctx_out=""
    fi
}

# Legacy wrapper (for non-hot-path code)
tps_get_context() {
    local slot="$1"
    local module="${2:-default}"
    local result
    tps_get_context_ref "$slot" "$module" result
    [[ -n "$result" ]] && echo "$result"
}

# =============================================================================
# RENDERING (No subshells in hot path)
# =============================================================================

# Build a single context line for a module - uses nameref
# Usage: _tps_build_context_line_for_ref <module> <output_var>
_tps_build_context_line_for_ref() {
    local module="$1"
    local -n _line_out="$2"
    _line_out=""

    local line_def="${_TPS_CTX_LINES[$module]:-}"
    [[ -z "$line_def" ]] && return

    # Parse prefix:priority:color
    local prefix color rest
    prefix="${line_def%%:*}"
    rest="${line_def#*:}"
    rest="${rest#*:}"  # Skip priority
    color="${rest%%:*}"
    [[ -z "$color" ]] && color=7  # Default white

    # Get context values (uses namerefs internally, but providers may fork)
    local org proj subj
    tps_get_context_ref org "$module" org
    tps_get_context_ref project "$module" proj
    tps_get_context_ref subject "$module" subj

    # Nothing to show if all empty
    [[ -z "$org" && -z "$proj" && -z "$subj" ]] && return

    local ctx=""

    # Prefix with color (e.g., DEPLOY in red)
    # NOTE: Colors defined inline because bash cannot export associative arrays
    if [[ -n "$prefix" ]]; then
        local -A _colors=(
            [1]=$'\e[31m' [2]=$'\e[32m' [3]=$'\e[33m' [4]=$'\e[34m'
            [5]=$'\e[35m' [6]=$'\e[36m' [7]=$'\e[37m' [8]=$'\e[1;37m'
        )
        local color_code="${_colors[$color]:-${_colors[7]}}"
        local reset=$'\e[0m'
        # \001 and \002 are PS1 readline markers for non-printing chars
        ctx+=$'\001'"${color_code}"$'\002'"${prefix}"$'\001'"${reset}"$'\002'
    fi

    ctx+="${_TPS_C_BRACKET}[${_TPS_C_RESET}"

    # Org
    if [[ -n "$org" ]]; then
        ctx+="${_TPS_C_ORG}${org}${_TPS_C_RESET}"
    else
        ctx+="${_TPS_C_SEP}?${_TPS_C_RESET}"
    fi

    ctx+="${_TPS_C_SEP}:${_TPS_C_RESET}"

    # Project (was: target)
    if [[ -n "$proj" ]]; then
        ctx+="${_TPS_C_TARGET}${proj}${_TPS_C_RESET}"
    else
        ctx+="${_TPS_C_SEP}?${_TPS_C_RESET}"
    fi

    ctx+="${_TPS_C_SEP}:${_TPS_C_RESET}"

    # Subject (was: env)
    if [[ -n "$subj" ]]; then
        ctx+="${_TPS_C_ENV}${subj}${_TPS_C_RESET}"
    else
        ctx+="${_TPS_C_SEP}?${_TPS_C_RESET}"
    fi

    ctx+="${_TPS_C_BRACKET}]${_TPS_C_RESET}"
    _line_out="$ctx"
}

# Legacy wrapper
_tps_build_context_line_for() {
    local module="$1"
    local result
    _tps_build_context_line_for_ref "$module" result
    [[ -n "$result" ]] && echo "$result"
}

# Build all context lines (sorted by priority) - uses nameref, no external sort
# Usage: _tps_build_all_context_lines_ref <output_var>
_tps_build_all_context_lines_ref() {
    local -n _all_out="$1"
    _all_out=""

    [[ ${#_TPS_CTX_LINES[@]} -eq 0 ]] && return

    # Pure Bash priority sorting: iterate 0-99 buckets
    # Much faster than forking /usr/bin/sort for small sets
    local priority module line_def line
    for priority in {0..99}; do
        for module in "${!_TPS_CTX_LINES[@]}"; do
            line_def="${_TPS_CTX_LINES[$module]}"
            # Extract priority from "prefix:priority:color"
            local mod_priority
            mod_priority="${line_def#*:}"
            mod_priority="${mod_priority%%:*}"
            [[ -z "$mod_priority" ]] && mod_priority=50

            if [[ "$mod_priority" == "$priority" ]]; then
                _tps_build_context_line_for_ref "$module" line
                if [[ -n "$line" ]]; then
                    [[ -n "$_all_out" ]] && _all_out+=$'\n'
                    _all_out+="$line"
                fi
            fi
        done
    done
}

# Legacy wrapper - merges old API (_TPS_CTX_LINES) and new API (tps_ctx_lines)
_tps_build_all_context_lines() {
    local result kv_lines
    _tps_build_all_context_lines_ref result

    # Also include lines from context_kv (new tps_ctx API)
    if type tps_ctx_lines &>/dev/null; then
        kv_lines=$(tps_ctx_lines 2>/dev/null)
        if [[ -n "$kv_lines" ]]; then
            if [[ -n "$result" ]]; then
                result+=$'\n'"$kv_lines"
            else
                result="$kv_lines"
            fi
        fi
    fi

    [[ -n "$result" ]] && echo "$result"
}

# Backward compat: build single context line (for default module)
_tps_build_context_line() {
    _tps_build_context_line_for default
}

# =============================================================================
# STATUS / DEBUG (Not hot path - can use subshells)
# =============================================================================

# Show registered providers
tps_context_providers() {
    echo "Context Providers [org:project:subject]"
    echo "========================================"
    echo ""

    if [[ ${#_TPS_CTX_LINES[@]} -eq 0 ]]; then
        echo "  No context lines registered"
        return
    fi

    local module line_def prefix priority color rest
    for module in "${!_TPS_CTX_LINES[@]}"; do
        line_def="${_TPS_CTX_LINES[$module]}"
        prefix="${line_def%%:*}"
        rest="${line_def#*:}"
        priority="${rest%%:*}"
        rest="${rest#*:}"
        color="${rest%%:*}"

        local color_name
        case "$color" in
            1) color_name="red" ;;
            2) color_name="green" ;;
            3) color_name="yellow" ;;
            4) color_name="blue" ;;
            5) color_name="magenta" ;;
            6) color_name="cyan" ;;
            7) color_name="white" ;;
            8) color_name="bright" ;;
            *) color_name="default" ;;
        esac

        echo "  Module: $module (prefix: ${prefix:-none}, priority: $priority, color: $color_name)"

        local slot provider value
        for slot in "${_TPS_CTX_SLOTS[@]}"; do
            provider="${_TPS_CTX_PROVIDERS[$module:$slot]:-}"
            if [[ -n "$provider" ]]; then
                value=$("$provider" 2>/dev/null)
                printf "    %-10s %-30s %s\n" "$slot" "$provider" "${value:-(empty)}"
            else
                printf "    %-10s %-30s %s\n" "$slot" "(none)" "-"
            fi
        done

        # Preview for this module
        local org proj subj
        tps_get_context_ref org "$module" org
        tps_get_context_ref project "$module" proj
        tps_get_context_ref subject "$module" subj
        if [[ -n "$org" || -n "$proj" || -n "$subj" ]]; then
            echo "    Preview: ${prefix}[${org:-?}:${proj:-?}:${subj:-?}]"
        fi
        echo ""
    done
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f _tps_resolve_slot_ref _tps_resolve_slot _tps_valid_slot
export -f tps_register_context_line tps_unregister_context_line
export -f tps_register_context tps_unregister_context
export -f tps_get_context_ref tps_get_context
export -f _tps_build_context_line_for_ref _tps_build_context_line_for
export -f _tps_build_all_context_lines_ref _tps_build_all_context_lines
export -f _tps_build_context_line
export -f tps_context_providers
