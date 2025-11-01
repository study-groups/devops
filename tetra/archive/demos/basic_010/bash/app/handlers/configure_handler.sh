#!/usr/bin/env bash

# Configure Action Handler - Handles configure:* actions
# Sources the base handler interface

source "$(dirname "${BASH_SOURCE[0]}")/base_handler.sh"

# Validate if this handler can execute the given action
handler_can_execute() {
    local verb="$1"
    local noun="$2"
    local env="$3"
    local mode="$4"

    [[ "$verb" == "configure" ]]
}

# Execute the configure action and return results
handler_execute() {
    local verb="$1"
    local noun="$2"
    local env="$3"
    local mode="$4"
    shift 4
    local args=("$@")

    if [[ "$verb" != "configure" ]]; then
        echo "ERROR: configure_handler cannot handle $verb actions" >&2
        return 1
    fi

    # Configure actions are typically routed to modals by action_router.sh
    # This handler provides the configuration interface content

    local content="⚙️  Configuration: $verb × $noun
$(generate_section_separator)

Configure $noun settings:
"

    case "$noun" in
        "demo")
            content+="• Auto-execute show actions: [enabled]
• Display mode: [enhanced]
• Color theme: [default]
• Animation speed: [normal]

Available Options:
- Auto-execute: enabled/disabled
- Display: basic/enhanced/debug
- Theme: default/dark/light
- Speed: slow/normal/fast

Press Enter to apply changes
Press ESC to cancel"
            ;;

        "colors")
            content+="• Palette mode: [semantic]
• Brightness: [50%]
• Contrast: [normal]
• Color-blind mode: [disabled]

Available Options:
- Palette: semantic/rainbow/monochrome
- Brightness: 25%/50%/75%/100%
- Contrast: low/normal/high
- Color-blind: disabled/protanopia/deuteranopia/tritanopia

Press Enter to apply changes
Press ESC to cancel"
            ;;

        "input")
            content+="• Navigation mode: [gamepad]
• Auto-execute: [show actions only]
• Key repeat: [enabled]
• Mouse support: [disabled]

Available Options:
- Navigation: gamepad/keyboard/hybrid
- Auto-execute: none/show only/all actions
- Key repeat: enabled/disabled
- Mouse: enabled/disabled

Press Enter to apply changes
Press ESC to cancel"
            ;;

        "tui")
            content+="• Rendering mode: [double-buffer]
• Component lifecycle: [enabled]
• Debug mode: [disabled]
• Performance tracking: [enabled]

Available Options:
- Rendering: single-buffer/double-buffer/adaptive
- Lifecycle: enabled/disabled
- Debug: enabled/disabled
- Performance: enabled/disabled

Press Enter to apply changes
Press ESC to cancel"
            ;;

        *)
            content+="Configuration for '$noun' - settings to be defined

General configuration options:
• Setting 1: [current value]
• Setting 2: [current value]
• Setting 3: [current value]

Press Enter to apply changes
Press ESC to cancel"
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
        "demo") echo "Configure demo application behavior and display" ;;
        "colors") echo "Adjust color palettes, themes, and accessibility" ;;
        "input") echo "Customize keyboard navigation and input handling" ;;
        "tui") echo "Configure TUI framework rendering and performance" ;;
        *) echo "Configure $noun settings and preferences" ;;
    esac
}

# Get input requirements for this action
handler_get_input_spec() {
    echo "input_modal"
}

# Get output specification for this action
handler_get_output_spec() {
    echo "output_display + output_config"
}

# Get execution mode (configure actions require confirmation)
handler_get_execution_mode() {
    echo "return"
}

# Validate input parameters
handler_validate() {
    local verb="$1"
    local noun="$2"
    local env="$3"
    local mode="$4"

    if [[ "$verb" != "configure" ]]; then
        echo "ERROR: configure_handler requires verb 'configure', got '$verb'" >&2
        return 1
    fi

    if [[ -z "$noun" ]]; then
        echo "ERROR: configure_handler requires a noun" >&2
        return 1
    fi

    return 0
}

# Apply configuration changes (called after user confirmation)
handler_apply_config() {
    local verb="$1"
    local noun="$2"
    local env="$3"
    local mode="$4"
    shift 4
    local config_changes=("$@")

    handler_log "INFO" "Applying configuration for $noun" "$verb" "$noun"

    case "$noun" in
        "demo")
            # Apply demo configuration changes
            handler_log "INFO" "Demo configuration updated" "$verb" "$noun"
            ;;
        "colors")
            # Apply color configuration changes
            handler_log "INFO" "Color configuration updated" "$verb" "$noun"
            ;;
        "input")
            # Apply input configuration changes
            handler_log "INFO" "Input configuration updated" "$verb" "$noun"
            ;;
        "tui")
            # Apply TUI configuration changes
            handler_log "INFO" "TUI configuration updated" "$verb" "$noun"
            ;;
        *)
            handler_log "WARNING" "Unknown configuration noun: $noun" "$verb" "$noun"
            return 1
            ;;
    esac

    return 0
}