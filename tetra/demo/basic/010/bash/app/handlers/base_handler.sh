#!/usr/bin/env bash

# TUI Action Handler Base Interface
# Defines the standard interface that all action handlers must implement

# Source handler dependencies
if [[ -f "$(dirname "${BASH_SOURCE[0]}")/handler_deps.sh" ]]; then
    source "$(dirname "${BASH_SOURCE[0]}")/handler_deps.sh"
fi

# Handler interface functions that must be implemented by concrete handlers
# Each handler should source this file and implement these functions

# Validate if this handler can execute the given action
# Returns: 0 if can handle, 1 if cannot
handler_can_execute() {
    local verb="$1"
    local noun="$2"
    local env="$3"
    local mode="$4"

    # Default implementation - should be overridden
    echo "ERROR: handler_can_execute not implemented in handler" >&2
    return 1
}

# Execute the action and return results
# Returns: stdout content, sets HANDLER_RESULT_TYPE
handler_execute() {
    local verb="$1"
    local noun="$2"
    local env="$3"
    local mode="$4"
    shift 4
    local args=("$@")

    # Default implementation - should be overridden
    echo "ERROR: handler_execute not implemented in handler" >&2
    return 1
}

# Get description of what this action does
handler_describe() {
    local verb="$1"
    local noun="$2"
    local env="$3"
    local mode="$4"

    # Default implementation - should be overridden
    echo "No description available for $verb:$noun"
}

# Validate input parameters for this action
handler_validate() {
    local verb="$1"
    local noun="$2"
    local env="$3"
    local mode="$4"
    shift 4
    local args=("$@")

    # Default implementation - basic validation
    if [[ -z "$verb" || -z "$noun" ]]; then
        echo "ERROR: verb and noun are required" >&2
        return 1
    fi
    return 0
}

# Get input requirements for this action
handler_get_input_spec() {
    local verb="$1"
    local noun="$2"
    local env="$3"
    local mode="$4"

    # Default implementation
    echo "input_keyboard"
}

# Get output specification for this action
handler_get_output_spec() {
    local verb="$1"
    local noun="$2"
    local env="$3"
    local mode="$4"

    # Default implementation
    echo "output_display"
}

# Get execution mode (immediate, return, confirm)
handler_get_execution_mode() {
    local verb="$1"
    local noun="$2"
    local env="$3"
    local mode="$4"

    # Default implementation
    case "$verb" in
        "show") echo "immediate" ;;
        "configure") echo "return" ;;
        "test") echo "return" ;;
        *) echo "return" ;;
    esac
}

# Cleanup after action execution
handler_cleanup() {
    local verb="$1"
    local noun="$2"
    local env="$3"
    local mode="$4"

    # Default implementation - no cleanup needed
    return 0
}

# Get handler metadata
handler_get_metadata() {
    local verb="$1"
    local noun="$2"

    cat << EOF
{
    "action": "$verb:$noun",
    "handler": "$(basename "${BASH_SOURCE[0]}")",
    "version": "1.0",
    "interface_version": "1.0",
    "capabilities": ["execute", "describe", "validate"],
    "input_spec": "$(handler_get_input_spec "$verb" "$noun" "" "")",
    "output_spec": "$(handler_get_output_spec "$verb" "$noun" "" "")",
    "execution_mode": "$(handler_get_execution_mode "$verb" "$noun" "" "")"
}
EOF
}

# Helper functions for common handler patterns

# Execute external command with stdout capture
handler_exec_with_capture() {
    local cmd="$1"
    shift
    local args=("$@")

    # Execute and capture both stdout and stderr
    local output
    local exit_code

    if output=$("$cmd" "${args[@]}" 2>&1); then
        exit_code=0
    else
        exit_code=$?
    fi

    # Set global variables for caller
    HANDLER_OUTPUT="$output"
    HANDLER_EXIT_CODE=$exit_code

    return $exit_code
}

# Format output for TUI display
handler_format_for_tui() {
    local raw_output="$1"
    local verb="$2"
    local noun="$3"

    # Add header with action context
    echo "$(render_action_verb_noun "$verb" "$noun") → Output"
    echo "$(generate_section_separator)"
    echo
    echo "$raw_output"
}

# Validate environment compatibility
handler_check_env_compat() {
    local env="$1"
    local required_env="$2"

    case "$required_env" in
        "any") return 0 ;;
        "dev") [[ "$env" == "DEV" ]] ;;
        "app") [[ "$env" == "APP" ]] ;;
        *) [[ "$env" == "$required_env" ]] ;;
    esac
}

# Log handler execution
handler_log() {
    local level="$1"
    local message="$2"
    local verb="${3:-unknown}"
    local noun="${4:-unknown}"

    if command -v log_action >/dev/null 2>&1; then
        log_action "Handler[$level]: $verb:$noun - $message"
    else
        echo "$(date '+%H:%M:%S') Handler[$level]: $verb:$noun - $message" >&2
    fi
}