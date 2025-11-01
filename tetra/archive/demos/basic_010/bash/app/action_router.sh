#!/usr/bin/env bash

# TUI Action Router - Input/Output Type System
# Determines "what and where" based on action signatures

# Source handler registry for action execution
if [[ -f "$(dirname "${BASH_SOURCE[0]}")/handlers/registry.sh" ]]; then
    source "$(dirname "${BASH_SOURCE[0]}")/handlers/registry.sh"
fi

# Execute action using the handler system
execute_action_with_handlers() {
    local verb="$1"
    local noun="$2"
    local env="${ENVIRONMENTS[$ENV_INDEX]:-APP}"
    local current_modes=($(get_current_modes))
    local mode="${current_modes[$MODE_INDEX]:-Learn}"

    # Initialize handler registry if not already done
    if [[ ${#HANDLER_REGISTRY[@]} -eq 0 ]]; then
        init_handler_registry
    fi

    # Execute using handler system
    local result
    if result=$(execute_action_with_handler "$verb" "$noun" "$env" "$mode"); then
        CONTENT="$result"
        return 0
    else
        CONTENT="Error executing action $verb:$noun"
        return 1
    fi
}

# Action type registry with routing information
declare -A TUI_ACTION_TYPES=(
    # Input Types (where actions come from)
    [input_keyboard]="keyboard navigation and shortcuts"
    [input_repl]="command-line interface"
    [input_config]="configuration files"
    [input_api]="external API calls"

    # Output Types (where results go)
    [output_display]="main content area"
    [output_overlay]="temporary overlay"
    [output_footer]="status bar area"
    [output_modal]="modal dialog"
    [output_log]="log file"
    [output_export]="external file"
)

# Action routing rules
declare -A TUI_ROUTING_RULES=(
    # Show actions → display in main content
    [show:demo]="input_keyboard → output_display"
    [show:colors]="input_keyboard → output_display"
    [show:input]="input_keyboard → output_display"
    [show:tui]="input_keyboard → output_display"

    # Configure actions → input modal → update display
    [configure:demo]="input_modal → output_display + output_log"
    [configure:colors]="input_modal → output_display + output_config"
    [configure:input]="input_modal → output_display + output_config"
    [configure:tui]="input_modal → output_display + output_config"

    # Test actions → validation → multiple outputs
    [test:demo]="input_keyboard → output_display + output_log"
    [test:colors]="input_keyboard → output_display + output_log"
    [test:input]="input_keyboard → output_display + output_log"
    [test:tui]="input_keyboard → output_display + output_log"
)

# Get action routing for verb:noun combination
get_action_routing() {
    local verb="$1"
    local noun="$2"
    local action="$verb:$noun"

    if [[ -n "${TUI_ROUTING_RULES[$action]}" ]]; then
        echo "${TUI_ROUTING_RULES[$action]}"
    else
        # Default routing based on verb type
        case "$verb" in
            "show")
                echo "input_keyboard → output_display"
                ;;
            "configure")
                echo "input_modal → output_display + output_config"
                ;;
            "test")
                echo "input_keyboard → output_display + output_log"
                ;;
            *)
                echo "input_keyboard → output_display"
                ;;
        esac
    fi
}

# Route action execution based on type
route_action_execution() {
    local verb="$1"
    local noun="$2"
    local routing=$(get_action_routing "$verb" "$noun")

    # Parse routing rule
    local input_type="${routing%% →*}"
    local output_spec="${routing##*→ }"

    log_action "Router: $verb:$noun | $input_type → $output_spec"

    # Handle input routing
    case "$input_type" in
        "input_keyboard")
            # Already handled by keyboard input system
            ;;
        "input_modal")
            # Switch to modal input mode
            show_configuration_modal "$verb" "$noun"
            return $?
            ;;
        "input_repl")
            # Switch to REPL mode
            switch_view_mode "$VIEW_REPL"
            return $?
            ;;
    esac

    # Handle output routing
    if [[ "$output_spec" == *"+"* ]]; then
        # Multiple outputs
        IFS=" + " read -ra outputs <<< "$output_spec"
        for output in "${outputs[@]}"; do
            route_single_output "$verb" "$noun" "$output"
        done
    else
        # Single output
        route_single_output "$verb" "$noun" "$output_spec"
    fi
}

# Route to single output destination
route_single_output() {
    local verb="$1"
    local noun="$2"
    local output="$3"

    case "$output" in
        "output_display")
            # Execute action using handler system and show in main content
            execute_action_with_handlers "$verb" "$noun"
            mark_component_dirty "content"
            ;;
        "output_overlay")
            # Show as temporary overlay
            show_action_overlay "$verb" "$noun"
            ;;
        "output_footer")
            # Show result in footer
            local result=$(execute_action_for_footer "$verb" "$noun")
            FOOTER_CONTENT="$(format_footer_combined "Action Result" "$result")"
            mark_component_dirty "footer"
            ;;
        "output_modal")
            # Show as modal dialog
            show_action_modal "$verb" "$noun"
            ;;
        "output_log")
            # Log to file
            log_action "Action: $verb:$noun executed"
            ;;
        "output_config")
            # Update configuration
            update_config_for_action "$verb" "$noun"
            ;;
        "output_export")
            # Export to external file
            export_action_result "$verb" "$noun"
            ;;
    esac
}

# Configuration modal for configure actions
show_configuration_modal() {
    local verb="$1"
    local noun="$2"

    CONTENT="⚙️  Configuration: $verb × $noun
$(generate_section_separator)

Configure $noun settings:
"

    case "$noun" in
        "demo")
            CONTENT+="• Auto-execute show actions: [enabled]
• Display mode: [enhanced]
• Color theme: [default]
• Animation speed: [normal]

Press Enter to apply changes
Press ESC to cancel"
            ;;
        "colors")
            CONTENT+="• Palette mode: [semantic]
• Brightness: [50%]
• Contrast: [normal]
• Color-blind mode: [disabled]

Press Enter to apply changes
Press ESC to cancel"
            ;;
        "input")
            CONTENT+="• Navigation mode: [gamepad]
• Auto-execute: [show actions only]
• Key repeat: [enabled]
• Mouse support: [disabled]

Press Enter to apply changes
Press ESC to cancel"
            ;;
        "tui")
            CONTENT+="• Rendering mode: [double-buffer]
• Component lifecycle: [enabled]
• Debug mode: [disabled]
• Performance tracking: [enabled]

Press Enter to apply changes
Press ESC to cancel"
            ;;
    esac

    FOOTER_CONTENT="$(format_footer_combined "Configuration Modal" "Enter=apply | ESC=cancel | tui::configure → @input")"
    mark_component_dirty "content"
    mark_component_dirty "footer"
}

# Show enhanced action signatures with routing info
show_action_signature_with_routing() {
    local verb="$1"
    local noun="$2"
    local routing=$(get_action_routing "$verb" "$noun")

    echo "$(render_action_verb_noun "$verb" "$noun") :: $routing"
}

# Get input type for action
get_action_input_type() {
    local verb="$1"
    local noun="$2"
    local routing=$(get_action_routing "$verb" "$noun")
    echo "${routing%% →*}"
}

# Get output type for action
get_action_output_type() {
    local verb="$1"
    local noun="$2"
    local routing=$(get_action_routing "$verb" "$noun")
    echo "${routing##*→ }"
}

# Debug: Show all routing rules
show_routing_debug() {
    echo "TUI Action Routing Rules:"
    echo "========================"
    for action in "${!TUI_ROUTING_RULES[@]}"; do
        echo "$action :: ${TUI_ROUTING_RULES[$action]}"
    done
    echo
    echo "Action Types:"
    echo "============="
    for type in "${!TUI_ACTION_TYPES[@]}"; do
        echo "$type: ${TUI_ACTION_TYPES[$type]}"
    done
}