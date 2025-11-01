#!/usr/bin/env bash

# Default Action Handler - Fallback handler for unmapped actions
# Sources the base handler interface

source "$(dirname "${BASH_SOURCE[0]}")/base_handler.sh"

# Validate if this handler can execute the given action
# Default handler accepts any action as fallback
handler_can_execute() {
    local verb="$1"
    local noun="$2"
    local env="$3"
    local mode="$4"

    # Default handler can handle anything (fallback)
    return 0
}

# Execute the action and return results
handler_execute() {
    local verb="$1"
    local noun="$2"
    local env="$3"
    local mode="$4"
    shift 4
    local args=("$@")

    # Log that we're using the default handler
    handler_log "INFO" "Using default handler" "$verb" "$noun"

    # Refresh color state for current verb/noun (cached)
    if command -v refresh_color_state_cached >/dev/null 2>&1; then
        refresh_color_state_cached "$verb" "$noun"
    fi

    # Build result header with routing info
    local routing
    if command -v get_action_routing >/dev/null 2>&1; then
        routing=$(get_action_routing "$verb" "$noun")
    else
        routing="input_keyboard → output_display"
    fi

    local content
    if command -v render_action_verb_noun >/dev/null 2>&1 && command -v render_response_type >/dev/null 2>&1; then
        content="$(render_action_verb_noun "$verb" "$noun")$(render_response_type "$verb" "$noun") → $env:$mode
tui::routing :: $routing"
    else
        content="$verb:$noun → $env:$mode
tui::routing :: $routing"
    fi

    if command -v generate_section_separator >/dev/null 2>&1; then
        content+="
$(generate_section_separator)"
    else
        content+="
=========================================="
    fi

    # Get description from nouns_verbs system if available
    local description
    if command -v get_action_description >/dev/null 2>&1; then
        description=$(get_action_description "$verb" "$noun")
        if [[ -n "$description" && "$description" != "No description available" ]]; then
            content+="
$description

"
        fi
    fi

    content+="
⚠️  Default Handler Response
============================

Action: $verb:$noun
Environment: $env
Mode: $mode
Handler: default_handler.sh

This action was processed by the default fallback handler.
No specific handler was found for '$verb' actions.

Suggested Actions:
• Create a specific handler for '$verb' actions
• Add routing rules to config/tui_actions.conf
• Implement $verb:$noun functionality

Status: ✅ Action processed (default behavior)"

    # Add any arguments passed
    if [[ ${#args[@]} -gt 0 ]]; then
        content+="

Arguments provided: ${args[*]}"
    fi

    echo "$content"
    return 0
}

# Get description of what this action does
handler_describe() {
    local verb="$1"
    local noun="$2"
    local env="$3"
    local mode="$4"

    echo "Default fallback handler for $verb:$noun (no specific handler found)"
}

# Get input requirements for this action
handler_get_input_spec() {
    echo "input_keyboard"
}

# Get output specification for this action
handler_get_output_spec() {
    echo "output_display"
}

# Get execution mode (default to return for safety)
handler_get_execution_mode() {
    local verb="$1"
    local noun="$2"

    # Try to use existing action execution mode if available
    if command -v get_action_execution_mode >/dev/null 2>&1; then
        get_action_execution_mode "$verb" "$noun"
    else
        # Safe default
        echo "return"
    fi
}

# Validate input parameters
handler_validate() {
    local verb="$1"
    local noun="$2"
    local env="$3"
    local mode="$4"

    if [[ -z "$verb" ]]; then
        echo "ERROR: default_handler requires a verb" >&2
        return 1
    fi

    if [[ -z "$noun" ]]; then
        echo "ERROR: default_handler requires a noun" >&2
        return 1
    fi

    # Default handler is permissive - accepts any valid verb:noun
    return 0
}

# Additional helper for suggesting specific handlers
handler_suggest_specific_handler() {
    local verb="$1"

    case "$verb" in
        "show") echo "show_handler.sh" ;;
        "configure") echo "configure_handler.sh" ;;
        "test") echo "test_handler.sh" ;;
        "cycle") echo "cycle_handler.sh" ;;
        "toggle") echo "toggle_handler.sh" ;;
        "reset") echo "reset_handler.sh" ;;
        *) echo "${verb}_handler.sh" ;;
    esac
}