#!/usr/bin/env bash
# TSM Hooks - post-operation callbacks for extensibility
#
# Usage:
#   tsm_hook_register "post_start" "my_callback_function"
#   tsm_hook_register "post_stop" "my_callback_function"
#
# Callback signature: callback_func <process_name> <port>

# Arrays of registered hook functions
declare -a TSM_HOOKS_POST_START=()
declare -a TSM_HOOKS_POST_STOP=()

# Register a hook function
# Usage: tsm_hook_register <event> <function_name>
tsm_hook_register() {
    local event="$1"
    local func="$2"

    [[ -z "$event" || -z "$func" ]] && return 1

    case "$event" in
        post_start) TSM_HOOKS_POST_START+=("$func") ;;
        post_stop)  TSM_HOOKS_POST_STOP+=("$func") ;;
        *)
            tsm_error "unknown hook event: $event (valid: post_start, post_stop)"
            return 1
            ;;
    esac
}

# Execute all hooks for an event
# Usage: tsm_hooks_run <event> <process_name> <port>
tsm_hooks_run() {
    local event="$1"
    local proc_name="$2"
    local port="${3:-}"

    local -n hooks
    case "$event" in
        post_start) hooks=TSM_HOOKS_POST_START ;;
        post_stop)  hooks=TSM_HOOKS_POST_STOP ;;
        *) return 0 ;;
    esac

    # Execute each registered hook (errors don't propagate)
    for func in "${hooks[@]}"; do
        if declare -F "$func" &>/dev/null; then
            "$func" "$proc_name" "$port" 2>/dev/null || true
        fi
    done
}

# List registered hooks (for debugging)
tsm_hooks_list() {
    echo "Post-start hooks:"
    for func in "${TSM_HOOKS_POST_START[@]}"; do
        echo "  - $func"
    done
    [[ ${#TSM_HOOKS_POST_START[@]} -eq 0 ]] && echo "  (none)"

    echo "Post-stop hooks:"
    for func in "${TSM_HOOKS_POST_STOP[@]}"; do
        echo "  - $func"
    done
    [[ ${#TSM_HOOKS_POST_STOP[@]} -eq 0 ]] && echo "  (none)"
}

export -f tsm_hook_register tsm_hooks_run tsm_hooks_list
