#!/usr/bin/env bash
# tps/core/hooks.sh - Event hook registry
#
# Events:
#   pre_prompt    - Before PS1 computed, modules update state
#   post_command  - After command execution, before prompt

# Hook registries (associative arrays: func_name -> priority)
declare -gA _TPS_HOOKS_PRE_PROMPT=()
declare -gA _TPS_HOOKS_POST_COMMAND=()

# Register a hook for an event
# Usage: tps_hook_register <event> <function_name> [priority]
# Priority: 0-99, default 50, lower runs first
tps_hook_register() {
    local event="$1"
    local func="$2"
    local priority="${3:-50}"

    # Validate function exists
    if ! declare -f "$func" &>/dev/null; then
        echo "tps_hook_register: function not found: $func" >&2
        return 1
    fi

    case "$event" in
        pre_prompt)
            _TPS_HOOKS_PRE_PROMPT["$func"]="$priority"
            ;;
        post_command)
            _TPS_HOOKS_POST_COMMAND["$func"]="$priority"
            ;;
        *)
            echo "tps_hook_register: unknown event: $event" >&2
            echo "  Valid: pre_prompt, post_command" >&2
            return 1
            ;;
    esac
}

# Unregister a hook
# Usage: tps_hook_unregister <event> <function_name>
tps_hook_unregister() {
    local event="$1"
    local func="$2"

    case "$event" in
        pre_prompt)   unset "_TPS_HOOKS_PRE_PROMPT[$func]" ;;
        post_command) unset "_TPS_HOOKS_POST_COMMAND[$func]" ;;
        *)            return 1 ;;
    esac
}

# Run all hooks for an event (sorted by priority)
# Usage: tps_hook_run <event>
tps_hook_run() {
    local event="$1"
    local -n hooks_ref

    case "$event" in
        pre_prompt)   hooks_ref=_TPS_HOOKS_PRE_PROMPT ;;
        post_command) hooks_ref=_TPS_HOOKS_POST_COMMAND ;;
        *)            return 1 ;;
    esac

    # Return early if no hooks
    [[ ${#hooks_ref[@]} -eq 0 ]] && return 0

    # Sort by priority and execute
    local sorted=()
    local func priority
    for func in "${!hooks_ref[@]}"; do
        priority="${hooks_ref[$func]}"
        sorted+=("$priority:$func")
    done

    while IFS=: read -r _ func; do
        "$func" 2>/dev/null
    done < <(printf '%s\n' "${sorted[@]}" | sort -t: -k1 -n)
}

# List registered hooks (for debugging/status)
tps_hook_list() {
    echo "TPS Hooks"
    echo "========="
    echo ""
    echo "pre_prompt:"
    if [[ ${#_TPS_HOOKS_PRE_PROMPT[@]} -eq 0 ]]; then
        echo "  (none)"
    else
        for func in "${!_TPS_HOOKS_PRE_PROMPT[@]}"; do
            printf "  [%2d] %s\n" "${_TPS_HOOKS_PRE_PROMPT[$func]}" "$func"
        done
    fi
    echo ""
    echo "post_command:"
    if [[ ${#_TPS_HOOKS_POST_COMMAND[@]} -eq 0 ]]; then
        echo "  (none)"
    else
        for func in "${!_TPS_HOOKS_POST_COMMAND[@]}"; do
            printf "  [%2d] %s\n" "${_TPS_HOOKS_POST_COMMAND[$func]}" "$func"
        done
    fi
}

export -f tps_hook_register tps_hook_unregister tps_hook_run tps_hook_list
