#!/usr/bin/env bash
# bash/repl/completion.sh - REPL Completion System
# Provides completion registration and dynamic value support for REPLs

# Global completion registry
declare -gA REPL_COMPLETION_STATIC   # Static completions: command→"val1 val2 val3"
declare -gA REPL_COMPLETION_DYNAMIC  # Dynamic completions: command→function_name
declare -ga REPL_COMPLETION_COMMANDS=()  # All registered commands

# Register static completions for a command
# Usage: repl_register_static_completion "command" "value1 value2 value3"
# Example: repl_register_static_completion "play" "pulsar formant estoface"
repl_register_static_completion() {
    local command="$1"
    local values="$2"

    if [[ -z "$command" || -z "$values" ]]; then
        echo "Error: repl_register_static_completion requires command and values" >&2
        return 1
    fi

    REPL_COMPLETION_STATIC["$command"]="$values"

    # Add to commands list if not already present
    if [[ ! " ${REPL_COMPLETION_COMMANDS[*]} " =~ " ${command} " ]]; then
        REPL_COMPLETION_COMMANDS+=("$command")
    fi
}

# Register dynamic completion function for a command
# Usage: repl_register_dynamic_completion "command" "function_name"
# Example: repl_register_dynamic_completion "kill" "get_running_sprite_ids"
#
# Function should output one value per line and return 0 on success
repl_register_dynamic_completion() {
    local command="$1"
    local function_name="$2"

    if [[ -z "$command" || -z "$function_name" ]]; then
        echo "Error: repl_register_dynamic_completion requires command and function" >&2
        return 1
    fi

    if ! command -v "$function_name" >/dev/null 2>&1; then
        echo "Warning: Completion function not found: $function_name" >&2
        return 1
    fi

    REPL_COMPLETION_DYNAMIC["$command"]="$function_name"

    # Add to commands list if not already present
    if [[ ! " ${REPL_COMPLETION_COMMANDS[*]} " ]]; then
        REPL_COMPLETION_COMMANDS+=("$command")
    fi
}

# Get completions for a command
# Usage: repl_get_completions "command" [current_word]
# Returns: space-separated completion values
repl_get_completions() {
    local command="$1"
    local current="${2:-}"
    local completions=""

    # Try dynamic first (higher priority)
    if [[ -n "${REPL_COMPLETION_DYNAMIC[$command]}" ]]; then
        local func="${REPL_COMPLETION_DYNAMIC[$command]}"
        if command -v "$func" >/dev/null 2>&1; then
            completions=$("$func" 2>/dev/null | tr '\n' ' ')
        fi
    fi

    # Fall back to static if no dynamic
    if [[ -z "$completions" && -n "${REPL_COMPLETION_STATIC[$command]}" ]]; then
        completions="${REPL_COMPLETION_STATIC[$command]}"
    fi

    # Filter by current word if provided
    if [[ -n "$current" ]]; then
        local filtered=""
        for val in $completions; do
            if [[ "$val" == "$current"* ]]; then
                filtered="$filtered $val"
            fi
        done
        completions="${filtered# }"
    fi

    echo "$completions"
}

# Show inline completions (for display in REPL)
# Usage: repl_show_completions "command" [current_word]
repl_show_completions() {
    local command="$1"
    local current="${2:-}"

    local completions
    completions=$(repl_get_completions "$command" "$current")

    if [[ -z "$completions" ]]; then
        return 1
    fi

    # Convert to array
    local comp_array=($completions)

    if [[ ${#comp_array[@]} -eq 1 ]]; then
        # Single completion - could auto-complete
        echo "${comp_array[0]}"
    else
        # Multiple completions - show options
        echo ""
        echo "Available options:"
        printf "  %s\n" "${comp_array[@]}"
        echo ""
    fi
}

# Clear all completion registrations
repl_clear_completions() {
    REPL_COMPLETION_STATIC=()
    REPL_COMPLETION_DYNAMIC=()
    REPL_COMPLETION_COMMANDS=()
}

# Export functions
export -f repl_register_static_completion
export -f repl_register_dynamic_completion
export -f repl_get_completions
export -f repl_show_completions
export -f repl_clear_completions
