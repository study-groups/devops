#!/usr/bin/env bash
# Tetra CMD Interface
# Direct command mode: tetra <action> <args>
# Executes a single action and exits

# Main cmd handler
tetra_cmd() {
    local action="$1"
    shift
    local args=("$@")

    # Check for stdin (for piping support)
    local stdin_data=""
    if [[ ! -t 0 ]]; then
        # stdin is not a terminal - capture it
        stdin_data="$(cat)"
    fi

    # If stdin provided and last arg is "-", replace with stdin
    if [[ -n "$stdin_data" ]]; then
        local new_args=()
        for arg in "${args[@]}"; do
            if [[ "$arg" == "-" ]]; then
                # Replace "-" with stdin data
                new_args+=("$stdin_data")
            else
                new_args+=("$arg")
            fi
        done
        args=("${new_args[@]}")

        # If no args and stdin provided, pass stdin as first arg
        if [[ ${#args[@]} -eq 0 ]]; then
            args=("$stdin_data")
        fi
    fi

    # Dispatch action
    tetra_dispatch_action "$action" "${args[@]}"
    local exit_code=$?

    # Exit with action's return code
    return $exit_code
}

# Export function
export -f tetra_cmd
