#!/usr/bin/env bash
# tps/core/context.sh - Multi-module context system
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

declare -gA _TPS_PREFIX_COLORS=(
    [1]="\e[31m"    # Red
    [2]="\e[32m"    # Green
    [3]="\e[33m"    # Yellow
    [4]="\e[34m"    # Blue
    [5]="\e[35m"    # Magenta
    [6]="\e[36m"    # Cyan
    [7]="\e[37m"    # White
    [8]="\e[1;37m"  # Bright white (bold)
)

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
# SLOT RESOLUTION
# =============================================================================

# Resolve slot name (handle aliases)
_tps_resolve_slot() {
    local slot="$1"
    echo "${_TPS_CTX_SLOT_ALIASES[$slot]:-$slot}"
}

# Validate slot name
_tps_valid_slot() {
    local slot="$1"
    slot=$(_tps_resolve_slot "$slot")
    for s in "${_TPS_CTX_SLOTS[@]}"; do
        [[ "$slot" == "$s" ]] && return 0
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

    # Resolve aliases
    slot=$(_tps_resolve_slot "$slot")

    # Validate slot
    if ! _tps_valid_slot "$slot"; then
        echo "tps_register_context: unknown slot: $slot" >&2
        echo "  Valid: ${_TPS_CTX_SLOTS[*]}" >&2
        echo "  Aliases: target->project, env->subject" >&2
        return 1
    fi

    _TPS_CTX_PROVIDERS["$module:$slot"]="$func"

    # Auto-register default context line if not exists
    if [[ "$module" == "default" && -z "${_TPS_CTX_LINES[default]:-}" ]]; then
        _TPS_CTX_LINES[default]=":50"  # No prefix for default
    fi
}

# Unregister a context provider
tps_unregister_context() {
    local slot="$1"
    local module="${2:-default}"
    slot=$(_tps_resolve_slot "$slot")
    unset "_TPS_CTX_PROVIDERS[$module:$slot]"
}

# Get context value for a module's slot
tps_get_context() {
    local slot="$1"
    local module="${2:-default}"
    slot=$(_tps_resolve_slot "$slot")
    local provider="${_TPS_CTX_PROVIDERS[$module:$slot]:-}"
    [[ -n "$provider" ]] && "$provider" 2>/dev/null
}

# =============================================================================
# RENDERING
# =============================================================================

# Build a single context line for a module
# Returns: prefix[org:project:subject] or empty if no values
_tps_build_context_line_for() {
    local module="$1"
    local line_def="${_TPS_CTX_LINES[$module]:-}"
    [[ -z "$line_def" ]] && return

    # Parse prefix:priority:color
    local prefix color
    prefix="${line_def%%:*}"
    local rest="${line_def#*:}"
    rest="${rest#*:}"  # Skip priority
    color="${rest%%:*}"
    [[ -z "$color" ]] && color=7  # Default white

    local org proj subj
    org=$(tps_get_context org "$module")
    proj=$(tps_get_context project "$module")
    subj=$(tps_get_context subject "$module")

    # Nothing to show if all empty
    [[ -z "$org" && -z "$proj" && -z "$subj" ]] && return

    local ctx=""

    # Prefix with color (e.g., DEPLOY in red)
    if [[ -n "$prefix" ]]; then
        local color_code="${_TPS_PREFIX_COLORS[$color]:-\e[37m}"
        ctx+="\001${color_code}\002${prefix}\001\e[0m\002"
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
    echo "$ctx"
}

# Build all context lines (sorted by priority)
# Returns: newline-separated context lines
_tps_build_all_context_lines() {
    local module priority line
    local -a sorted_modules=()

    # Sort modules by priority
    for module in "${!_TPS_CTX_LINES[@]}"; do
        priority="${_TPS_CTX_LINES[$module]#*:}"
        sorted_modules+=("$priority:$module")
    done

    # Sort and render
    while IFS=: read -r priority module; do
        [[ -z "$module" ]] && continue
        line=$(_tps_build_context_line_for "$module")
        [[ -n "$line" ]] && echo "$line"
    done < <(printf '%s\n' "${sorted_modules[@]}" | sort -t: -k1 -n)
}

# Backward compat: build single context line (for default module)
_tps_build_context_line() {
    _tps_build_context_line_for default
}

# =============================================================================
# STATUS / DEBUG
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
        org=$(tps_get_context org "$module")
        proj=$(tps_get_context project "$module")
        subj=$(tps_get_context subject "$module")
        if [[ -n "$org" || -n "$proj" || -n "$subj" ]]; then
            echo "    Preview: ${prefix}[${org:-?}:${proj:-?}:${subj:-?}]"
        fi
        echo ""
    done
}

# =============================================================================
# BACKWARD COMPATIBILITY
# =============================================================================

tetra_prompt_register() { tps_register_context "$@"; }
tetra_prompt_unregister() { tps_unregister_context "$@"; }
_tetra_prompt_providers() { tps_context_providers; }

# =============================================================================
# EXPORTS
# =============================================================================

export -f _tps_resolve_slot _tps_valid_slot
export -f tps_register_context_line tps_unregister_context_line
export -f tps_register_context tps_unregister_context tps_get_context
export -f _tps_build_context_line_for _tps_build_all_context_lines _tps_build_context_line
export -f tps_context_providers
export -f tetra_prompt_register tetra_prompt_unregister _tetra_prompt_providers
