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
    REPL_SLASH_COMMANDS+=("/learn")
    REPL_SLASH_HANDLERS["/learn"]="midi_repl_learn"

    REPL_SLASH_COMMANDS+=("/learn-all")
    REPL_SLASH_HANDLERS["/learn-all"]="midi_repl_learn_all"

    REPL_SLASH_COMMANDS+=("/wizard")
    REPL_SLASH_HANDLERS["/wizard"]="midi_repl_wizard"

    REPL_SLASH_COMMANDS+=("/unlearn")
    REPL_SLASH_HANDLERS["/unlearn"]="midi_repl_unlearn"

    REPL_SLASH_COMMANDS+=("/clear")
    REPL_SLASH_HANDLERS["/clear"]="midi_repl_clear"

    # Mapping commands
    REPL_SLASH_COMMANDS+=("/list")
    REPL_SLASH_HANDLERS["/list"]="midi_repl_list"

    REPL_SLASH_COMMANDS+=("/mode")
    REPL_SLASH_HANDLERS["/mode"]="midi_repl_mode"

    # Session commands
    REPL_SLASH_COMMANDS+=("/save")
    REPL_SLASH_HANDLERS["/save"]="midi_repl_save"

    REPL_SLASH_COMMANDS+=("/load")
    REPL_SLASH_HANDLERS["/load"]="midi_repl_load_session"

    # Device commands
    REPL_SLASH_COMMANDS+=("/device")
    REPL_SLASH_HANDLERS["/device"]="midi_repl_device"

    REPL_SLASH_COMMANDS+=("/devices")
    REPL_SLASH_HANDLERS["/devices"]="midi_repl_devices"

    # Service commands
    REPL_SLASH_COMMANDS+=("/start")
    REPL_SLASH_HANDLERS["/start"]="midi_repl_start"

    REPL_SLASH_COMMANDS+=("/stop")
    REPL_SLASH_HANDLERS["/stop"]="midi_repl_stop"

    REPL_SLASH_COMMANDS+=("/status")
    REPL_SLASH_HANDLERS["/status"]="midi_repl_status"

    # Monitor
    REPL_SLASH_COMMANDS+=("/monitor")
    REPL_SLASH_HANDLERS["/monitor"]="midi_repl_monitor"

    # Help
    REPL_SLASH_COMMANDS+=("/help")
    REPL_SLASH_HANDLERS["/help"]="midi_repl_help"
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
MIDI REPL Commands
==================

Learning:
  /learn <semantic> [syntax] [min] [max]
      Learn a mapping. Move/press control when prompted.
      Examples:
        /learn VOLUME p1 0.0 1.0
        /learn TRIGGER_KICK b1a
        /learn PLAY play

  /learn-all <type>
      Batch learn all controls (pots|sliders|buttons|transport)

  /wizard
      Step-by-step learning wizard

  /unlearn <name>
      Remove a mapping

  /clear
      Clear all mappings

Mapping:
  /list
      Show all current mappings

  /mode <mode>
      Set broadcast mode (raw|syntax|semantic|all)

Sessions:
  /save [name]
      Save mappings to session (default: default)

  /load [name]
      Load mappings from session

Devices:
  /device <id>
      Load device configuration

  /devices
      List available MIDI devices

Service:
  /start
      Start TMC service

  /stop
      Stop TMC service

  /status
      Show service status

  /monitor
      Start MIDI event monitor

Help:
  /help
      Show this help

Control Names:
  Pots:      p1-p8         (rotary knobs)
  Sliders:   s1-s8         (faders)
  Buttons:   b1a-b8d       (4 buttons × 8 paths)
  Transport: play, pause, stop, back, fwd, fback, ffwd,
             up, down, left, right

Examples:
  /start
  /learn VOLUME p1 0.0 1.0
  /list
  /save my-setup
  /monitor

EOF
}

# Custom prompt builder
midi_repl_prompt() {
    local status_color="${TETRA_GREEN}"
    local status_text="ready"

    # Check if TMC service is running
    if ! echo "HEALTH" | nc -U "$TSM_PROCESSES_DIR/sockets/tmc.sock" 2>/dev/null >/dev/null; then
        status_color="${TETRA_YELLOW}"
        status_text="no service"
    fi

    # Check if in learning mode
    if [[ $TMC_LEARNING -eq 1 ]]; then
        status_color="${TETRA_CYAN}"
        status_text="learning"
    fi

    # Show current device if loaded
    local device_info=""
    if [[ -n "$TMC_CURRENT_DEVICE" ]]; then
        device_info=" [$TMC_CURRENT_DEVICE]"
    fi

    echo -ne "${TETRA_MAGENTA}midi${TETRA_NC}${device_info} ${status_color}${status_text}${TETRA_NC} > "
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

    echo ""
    echo "TMC - Tetra MIDI Controller REPL"
    echo "================================="
    echo ""
    echo "Type /help for commands, /start to begin, Ctrl+D to exit"
    echo ""

    # Check if service is running
    if ! echo "HEALTH" | nc -U "$TSM_PROCESSES_DIR/sockets/tmc.sock" 2>/dev/null >/dev/null; then
        echo "⚠ TMC service not running. Start with: /start"
        echo ""
    fi

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
