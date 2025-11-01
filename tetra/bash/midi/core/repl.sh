#!/usr/bin/env bash

# MIDI REPL - Interactive MIDI Controller Interface
# Uses Tetra's universal REPL system

# Source REPL library if not already loaded
if ! declare -f repl_run >/dev/null; then
    source "$TETRA_SRC/bash/repl/repl.sh"
fi

# REPL configuration
REPL_HISTORY_BASE="${MIDI_DIR}/repl/history"

# Register slash commands
midi_register_repl_commands() {
    # Learning commands
    repl_register_slash_command "learn" "midi_repl_learn"
    repl_register_slash_command "learn-all" "midi_repl_learn_all"
    repl_register_slash_command "wizard" "midi_repl_wizard"
    repl_register_slash_command "unlearn" "midi_repl_unlearn"
    repl_register_slash_command "clear" "midi_repl_clear"

    # Mapping commands
    repl_register_slash_command "list" "midi_repl_list"
    repl_register_slash_command "mode" "midi_repl_mode"

    # Session commands
    repl_register_slash_command "save" "midi_repl_save"
    repl_register_slash_command "load" "midi_repl_load_session"

    # Device commands
    repl_register_slash_command "device" "midi_repl_device"
    repl_register_slash_command "devices" "midi_repl_devices"

    # Service commands
    repl_register_slash_command "start" "midi_repl_start"
    repl_register_slash_command "stop" "midi_repl_stop"
    repl_register_slash_command "status" "midi_repl_status"

    # Monitor
    repl_register_slash_command "monitor" "midi_repl_monitor"

    # Help
    repl_register_slash_command "help" "midi_repl_help"
}

# Command handlers

midi_repl_learn() {
    local args="$*"
    tmc_learn $args
}

midi_repl_learn_all() {
    local type="$1"
    tmc_learn_all "$type"
}

midi_repl_wizard() {
    tmc_learn_wizard
}

midi_repl_unlearn() {
    local name="$1"
    tmc_unlearn "$name"
}

midi_repl_clear() {
    tmc_clear_all
}

midi_repl_list() {
    tmc_list_mappings
}

midi_repl_mode() {
    local mode="$1"
    tmc_set_mode "$mode"
}

midi_repl_save() {
    local session="${1:-default}"
    tmc_save_session "$session"
}

midi_repl_load_session() {
    local session="${1:-default}"
    tmc_load_session "$session"
}

midi_repl_device() {
    local device_id="$1"
    if [[ -z "$device_id" ]]; then
        echo "Usage: /device <device-id>"
        return 1
    fi
    tmc_load_device "$device_id"
}

midi_repl_devices() {
    if [[ -x "$MIDI_SRC/tmc" ]]; then
        "$MIDI_SRC/tmc" -l
    else
        echo "tmc binary not found. Build with: midi build"
    fi
}

midi_repl_start() {
    echo "Starting TMC service..."
    tsm start bash "$MIDI_SRC/core/socket_server.sh" tmc
}

midi_repl_stop() {
    tsm stop tmc
}

midi_repl_status() {
    if echo "STATUS" | nc -U "$TSM_PROCESSES_DIR/sockets/tmc.sock" 2>/dev/null; then
        return 0
    else
        echo "TMC service not running"
        echo "Start with: /start"
        return 1
    fi
}

midi_repl_monitor() {
    echo "Starting MIDI monitor..."
    tsm start bash "$MIDI_SRC/services/midi_monitor.sh" midi-monitor
    echo ""
    echo "View logs: tail -f $MIDI_LOGS_DIR/midi_events.log"
}

midi_repl_help() {
    cat <<'EOF'
MIDI Commands (Ctrl+D to exit)
/start /stop /status         - Service control
/learn <name> [syntax]       - Map control (e.g., /learn VOLUME p1)
/list /mode <raw|all>        - View/set mappings
/save [name] /load [name]    - Sessions
/device <id> /devices        - Device config
/monitor                     - Start event monitor

Controls: p1-p8 (pots), s1-s8 (sliders), b1a-b8d (buttons)
Example: /start → /learn VOLUME p1 0.0 1.0 → move knob → /list
EOF
}

# Custom prompt builder
# Format: [controller x map][CC#][val]>
# Example: [vmx8 x qpong][7][64]>
midi_repl_prompt() {
    # Source state if needed (for state container functions)
    if ! command -v tmc_state_get &>/dev/null; then
        source "$MIDI_SRC/core/state.sh" 2>/dev/null || true
    fi

    # Get controller and map info from state
    local controller=$(tmc_state_get "controller_name" 2>/dev/null || echo "")
    local map=$(tmc_state_get "map_name" 2>/dev/null || echo "")

    # Get last CC info from state
    local last_cc_controller=$(tmc_state_get "last_cc_controller" 2>/dev/null || echo "")
    local last_cc_value=$(tmc_state_get "last_cc_value" 2>/dev/null || echo "")

    # Build first bracket: [controller x map]
    local bracket1=""
    if [[ -n "$controller" && -n "$map" ]]; then
        bracket1="${TETRA_CYAN}[${controller} ${TETRA_DIM}x${TETRA_NC} ${TETRA_CYAN}${map}]${TETRA_NC}"
    elif [[ -n "$controller" ]]; then
        bracket1="${TETRA_CYAN}[${controller}]${TETRA_NC}"
    elif [[ -n "$map" ]]; then
        bracket1="${TETRA_CYAN}[${map}]${TETRA_NC}"
    else
        bracket1="${TETRA_DIM}[no map]${TETRA_NC}"
    fi

    # Build second bracket: [CC#]
    local bracket2=""
    if [[ -n "$last_cc_controller" ]]; then
        bracket2="${TETRA_YELLOW}[CC${last_cc_controller}]${TETRA_NC}"
    else
        bracket2="${TETRA_DIM}[--]${TETRA_NC}"
    fi

    # Build third bracket: [val]
    local bracket3=""
    if [[ -n "$last_cc_value" ]]; then
        bracket3="${TETRA_GREEN}[${last_cc_value}]${TETRA_NC}"
    else
        bracket3="${TETRA_DIM}[--]${TETRA_NC}"
    fi

    # Assemble prompt
    echo -ne "${bracket1}${bracket2}${bracket3}${TETRA_MAGENTA}>${TETRA_NC} "
}

# Custom input handler
midi_repl_input() {
    local input="$1"

    # If starts with /, it's a slash command - let REPL handle it
    if [[ "$input" =~ ^/ ]]; then
        return 1  # Not handled, pass to REPL
    fi

    # Otherwise, treat as direct command to TMC service
    if echo "$input" | nc -U "$TSM_PROCESSES_DIR/sockets/tmc.sock" 2>/dev/null; then
        return 0
    else
        echo "TMC service not running. Start with: /start"
        return 1
    fi
}

# Main REPL entry point
midi_repl() {
    # Ensure MIDI is initialized
    midi_init 2>/dev/null || true

    # Register REPL commands
    midi_register_repl_commands

    # Register prompt builder
    REPL_PROMPT_BUILDERS+=("midi_repl_prompt")

    # Set history base
    REPL_HISTORY_BASE="${MIDI_DIR}/repl/history"

    echo "TMC REPL | Type /help for commands | Ctrl+D to exit"

    # Run REPL
    repl_run
}

# Export functions
export -f midi_repl
export -f midi_register_repl_commands
export -f midi_repl_prompt
export -f midi_repl_input
export -f midi_repl_learn
export -f midi_repl_list
export -f midi_repl_help
