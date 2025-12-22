#!/usr/bin/env bash
# tps/core/hooks.sh - Event hook registry
#
# Events:
#   pre_prompt    - Before PS1 computed, modules update state
#   post_command  - After command execution, before prompt
#
# Debug mode:
#   TPS_HOOK_DEBUG=true    Enable hook timing and error logging
#   tps hook log           View the hook debug log
#   tps hook log clear     Clear the log

# =============================================================================
# CONFIGURATION
# =============================================================================

# Debug mode (set TPS_HOOK_DEBUG=true to enable)
export TPS_HOOK_DEBUG="${TPS_HOOK_DEBUG:-false}"

# Log file location
TPS_HOOK_LOG="${TPS_HOOK_LOG:-${TETRA_DIR:-$HOME}/logs/tps_hooks.log}"

# =============================================================================
# REGISTRIES
# =============================================================================

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
#
# PERFORMANCE: Uses pure Bash priority sorting (0-99 buckets)
# instead of forking /usr/bin/sort. This is in the hot path.
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

    # Pure Bash priority sorting: iterate 0-99 buckets
    # Much faster than forking /usr/bin/sort for small sets
    local priority func func_priority
    for priority in {0..99}; do
        for func in "${!hooks_ref[@]}"; do
            func_priority="${hooks_ref[$func]}"
            if [[ "$func_priority" == "$priority" ]]; then
                if [[ "$TPS_HOOK_DEBUG" == "true" ]]; then
                    _tps_hook_run_debug "$event" "$func"
                else
                    "$func" 2>/dev/null
                fi
            fi
        done
    done
}

# Run a single hook with debug logging
_tps_hook_run_debug() {
    local event="$1"
    local func="$2"
    local start_time end_time duration_ms exit_code output

    # Ensure log directory exists
    mkdir -p "$(dirname "$TPS_HOOK_LOG")" 2>/dev/null

    # Capture start time (microseconds on macOS, nanoseconds on Linux)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        start_time=$(python3 -c 'import time; print(int(time.time() * 1000000))' 2>/dev/null || date +%s)
    else
        start_time=$(date +%s%N 2>/dev/null || date +%s)
    fi

    # Run hook and capture output/exit code
    output=$("$func" 2>&1)
    exit_code=$?

    # Capture end time
    if [[ "$OSTYPE" == "darwin"* ]]; then
        end_time=$(python3 -c 'import time; print(int(time.time() * 1000000))' 2>/dev/null || date +%s)
        duration_ms=$(( (end_time - start_time) / 1000 ))
    else
        end_time=$(date +%s%N 2>/dev/null || date +%s)
        duration_ms=$(( (end_time - start_time) / 1000000 ))
    fi

    # Log the result
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    {
        if [[ $exit_code -eq 0 ]]; then
            echo "[$timestamp] OK   ${event}:${func} (${duration_ms}ms)"
        else
            echo "[$timestamp] FAIL ${event}:${func} (${duration_ms}ms) exit=$exit_code"
            [[ -n "$output" ]] && echo "  output: $output"
        fi
    } >> "$TPS_HOOK_LOG"
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
    echo ""
    echo "Debug: $TPS_HOOK_DEBUG"
    [[ "$TPS_HOOK_DEBUG" == "true" ]] && echo "Log:   $TPS_HOOK_LOG"
}

# =============================================================================
# DEBUG LOG MANAGEMENT
# =============================================================================

# View or manage hook debug log
# Usage: tps_hook_log [tail|clear|path]
tps_hook_log() {
    case "${1:-}" in
        clear)
            if [[ -f "$TPS_HOOK_LOG" ]]; then
                rm "$TPS_HOOK_LOG"
                echo "Hook log cleared"
            else
                echo "No log file to clear"
            fi
            ;;
        path)
            echo "$TPS_HOOK_LOG"
            ;;
        tail)
            local lines="${2:-20}"
            if [[ -f "$TPS_HOOK_LOG" ]]; then
                tail -n "$lines" "$TPS_HOOK_LOG"
            else
                echo "No log file yet (enable with TPS_HOOK_DEBUG=true)"
            fi
            ;;
        ""|show)
            if [[ -f "$TPS_HOOK_LOG" ]]; then
                cat "$TPS_HOOK_LOG"
            else
                echo "No log file yet"
                echo "Enable debug mode: export TPS_HOOK_DEBUG=true"
            fi
            ;;
        stats)
            if [[ -f "$TPS_HOOK_LOG" ]]; then
                local total ok fail
                total=$(wc -l < "$TPS_HOOK_LOG" | tr -d ' ')
                ok=$(grep -c "^\\[.*\\] OK" "$TPS_HOOK_LOG" 2>/dev/null || echo 0)
                fail=$(grep -c "^\\[.*\\] FAIL" "$TPS_HOOK_LOG" 2>/dev/null || echo 0)
                echo "Hook Log Stats"
                echo "=============="
                echo "  Total entries: $total"
                echo "  Successful:    $ok"
                echo "  Failed:        $fail"
                echo ""
                echo "Recent failures:"
                grep "FAIL" "$TPS_HOOK_LOG" 2>/dev/null | tail -5 || echo "  (none)"
            else
                echo "No log file yet"
            fi
            ;;
        *)
            cat <<'EOF'
Usage: tps hook log [command]

Commands:
  (none)     Show full log
  tail [n]   Show last n lines (default: 20)
  stats      Show log statistics
  clear      Delete the log file
  path       Show log file path

Enable debug mode:
  export TPS_HOOK_DEBUG=true
EOF
            ;;
    esac
}

# Toggle debug mode
tps_hook_debug() {
    case "${1:-}" in
        on|true|1)
            export TPS_HOOK_DEBUG=true
            echo "Hook debug enabled (logging to $TPS_HOOK_LOG)"
            ;;
        off|false|0)
            export TPS_HOOK_DEBUG=false
            echo "Hook debug disabled"
            ;;
        "")
            if [[ "$TPS_HOOK_DEBUG" == "true" ]]; then
                export TPS_HOOK_DEBUG=false
                echo "Hook debug disabled"
            else
                export TPS_HOOK_DEBUG=true
                echo "Hook debug enabled (logging to $TPS_HOOK_LOG)"
            fi
            ;;
        *)
            echo "Usage: tps hook debug [on|off]"
            ;;
    esac
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f tps_hook_register tps_hook_unregister tps_hook_run tps_hook_list
export -f _tps_hook_run_debug tps_hook_log tps_hook_debug
