#!/usr/bin/env bash

# Show Action Handler - Handles show:* actions
# Sources the base handler interface

source "$(dirname "${BASH_SOURCE[0]}")/base_handler.sh"

# Validate if this handler can execute the given action
handler_can_execute() {
    local verb="$1"
    local noun="$2"
    local env="$3"
    local mode="$4"

    [[ "$verb" == "show" ]]
}

# Execute the show action and return results
handler_execute() {
    local verb="$1"
    local noun="$2"
    local env="$3"
    local mode="$4"
    shift 4
    local args=("$@")

    if [[ "$verb" != "show" ]]; then
        echo "ERROR: show_handler cannot handle $verb actions" >&2
        return 1
    fi

    # Refresh color state for current verb/noun (cached)
    refresh_color_state_cached "$verb" "$noun"

    # Build result header with routing info
    local routing=$(get_action_routing "$verb" "$noun")
    local content="$(render_action_verb_noun "$verb" "$noun")$(render_response_type "$verb" "$noun") → $env:$mode
tui::routing :: $routing
$(generate_section_separator)"

    # Get description from nouns_verbs system
    local description=$(get_action_description "$verb" "$noun")
    if [[ -n "$description" ]]; then
        content+="
$description

Module Output:
"
    fi

    # Handle specific show actions
    case "$noun" in
        "palette")
            content+="🎨 Interactive Color Palette Demonstration
==========================================

"
            if [[ -f "./bash/tui/modules/colors/palette.sh" ]]; then
                content+="$(./bash/tui/modules/colors/palette.sh)"
            else
                content+="Error: palette.sh not found"
            fi
            ;;

        "demo")
            content+="🚀 TUI Demo Application
=======================

"
            content+="Current Environment: $env
Current Mode: $mode
Action System: Active

Demo Components:
• Header Navigation: ✅ Working
• Content Display: ✅ Working
• Footer Status: ✅ Working
• Color System: ✅ Working
• Input Handling: ✅ Working

This demonstrates the complete TUI framework in action."
            ;;

        "colors")
            content+="🎨 Color System Status
=====================

"
            # Show current color configuration
            if command -v show_color_debug >/dev/null 2>&1; then
                content+="$(show_color_debug)"
            else
                content+="Color system loaded: ✅
NOUNS palette: Active
VERBS palette: Active
Current theme: Default"
            fi
            ;;

        "tui")
            content+="🖥️  TUI System Information
=========================

"
            content+="Framework: Tetra TUI Demo v010
Rendering: Double-buffer system
Components: Header, Content, Footer
Input Mode: Game controller navigation
Action System: Handler-based routing

Current State:
• ENV: $env (index: $ENV_INDEX)
• MODE: $mode (index: $MODE_INDEX)
• ACTION: $verb:$noun (index: $ACTION_INDEX)

System Status: ✅ Operational"
            ;;

        "input")
            content+="⌨️  Input System Status
======================

"
            content+="Navigation Mode: Game controller
Key Bindings:
• Arrow Keys: Navigate ENV/MODE/ACTION
• Enter: Execute current action
• ESC: Return to navigation
• Space: Cycle through options

Current Focus: ACTION ($verb:$noun)
Input Buffer: Empty
Last Action: $verb:$noun executed"
            ;;

        "inspect")
            content+="🔍 System Inspection
===================

"
            content+="Available Actions for $env:$mode:
"
            # Get available actions for current context
            if command -v get_env_nouns >/dev/null 2>&1 && command -v get_mode_verbs >/dev/null 2>&1; then
                local env_nouns=($(get_env_nouns "$env"))
                local mode_verbs=($(get_mode_verbs "$mode"))

                for verb in "${mode_verbs[@]}"; do
                    for noun in "${env_nouns[@]}"; do
                        content+="• $verb:$noun
"
                    done
                done
            else
                content+="Action discovery functions not available"
            fi

            content+="
Handler System:
• Registry: $(ls bash/app/handlers/*_handler.sh 2>/dev/null | wc -l) handlers loaded
• Config: $(wc -l < config/tui_actions.conf 2>/dev/null || echo "0") mappings
• Status: ✅ Active"
            ;;

        *)
            content+="Show action for '$noun' - implementation needed"
            ;;
    esac

    echo "$content"
    return 0
}

# Get description of what this action does
handler_describe() {
    local verb="$1"
    local noun="$2"
    local env="$3"
    local mode="$4"

    case "$noun" in
        "palette") echo "Display interactive color palette demonstration" ;;
        "demo") echo "Show complete TUI demo application status" ;;
        "colors") echo "Display current color system configuration" ;;
        "tui") echo "Show TUI framework information and status" ;;
        "input") echo "Display input system status and key bindings" ;;
        *) echo "Display $noun information" ;;
    esac
}

# Get input requirements for this action
handler_get_input_spec() {
    echo "input_keyboard"
}

# Get output specification for this action
handler_get_output_spec() {
    echo "output_display"
}

# Get execution mode (all show actions are immediate)
handler_get_execution_mode() {
    echo "immediate"
}

# Validate input parameters
handler_validate() {
    local verb="$1"
    local noun="$2"
    local env="$3"
    local mode="$4"

    if [[ "$verb" != "show" ]]; then
        echo "ERROR: show_handler requires verb 'show', got '$verb'" >&2
        return 1
    fi

    if [[ -z "$noun" ]]; then
        echo "ERROR: show_handler requires a noun" >&2
        return 1
    fi

    return 0
}