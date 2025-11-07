#!/usr/bin/env bash

# MIDI REPL - Interactive MIDI Controller Interface
# Uses Tetra's universal REPL system
#
# Architecture Overview:
#   This REPL is a CLIENT that connects to OSC broadcasts from midi-bridge.
#   It does NOT start the MIDI service - that's done by TSM.
#
# Service Layer (TSM-managed):
#   tsm start midi-bridge → Reads MIDI hardware → Broadcasts OSC on :1983
#
# Client Layer (this file):
#   midi repl → Listens to OSC :1983 → Updates prompt with MIDI state
#
# Multiple clients can connect to the same OSC broadcast simultaneously.
# The REPL can be started/stopped without affecting the midi-bridge service.

# Source REPL library if not already loaded
if ! declare -f repl_run >/dev/null; then
    source "$TETRA_SRC/bash/repl/repl.sh"
fi

# REPL configuration
REPL_HISTORY_BASE="${MIDI_DIR}/repl/history"

# REPL state (OSC-based, no more tmc_state_get dependency)
REPL_CONTROLLER=""
REPL_INSTANCE=0
REPL_VARIANT=""
REPL_VARIANT_NAME=""
REPL_LAST_CC=""
REPL_LAST_VAL=""

# OSC connection settings
REPL_OSC_HOST="${REPL_OSC_HOST:-0.0.0.0}"
REPL_OSC_PORT="${REPL_OSC_PORT:-1983}"

# Register slash commands
midi_register_repl_commands() {
    # Variant control (NEW - OSC-based)
    repl_register_slash_command "variant" "midi_repl_variant"

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

    # Service commands (DEPRECATED - for Unix socket mode)
    repl_register_slash_command "start" "midi_repl_start"
    repl_register_slash_command "stop" "midi_repl_stop"
    repl_register_slash_command "status" "midi_repl_status"

    # Monitor
    repl_register_slash_command "monitor" "midi_repl_monitor"

    # Help
    repl_register_slash_command "help" "midi_repl_help"
}

# Command handlers

midi_repl_variant() {
    local variant="$1"

    if [[ -z "$variant" ]]; then
        echo "Current variant: ${REPL_VARIANT} (${REPL_VARIANT_NAME})"
        echo "Usage: /variant <a|b|c|d>"
        return 0
    fi

    # Send OSC control message to switch variant
    # We need a simple OSC sender tool for this
    if command -v oscsend >/dev/null 2>&1; then
        oscsend localhost "$REPL_OSC_PORT" /midi/control/variant s "$variant"
        echo "Variant switch requested: $variant"
    elif [[ -f "$MIDI_SRC/osc_send.js" ]]; then
        node "$MIDI_SRC/osc_send.js" localhost "$REPL_OSC_PORT" /midi/control/variant "$variant"
        echo "Variant switch requested: $variant"
    else
        echo "ERROR: No OSC sender available"
        echo "Install oscsend or create osc_send.js helper"
        return 1
    fi
}

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
    elif [[ -x "$MIDI_SRC/midi.js" ]]; then
        node "$MIDI_SRC/midi.js" -l
    else
        echo "midi binary not found. Build with: midi build"
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
MIDI REPL - Interactive MIDI Controller Interface

Architecture:
  This REPL connects to OSC broadcasts from the midi-bridge service.
  The midi-bridge service reads from MIDI hardware and broadcasts events.
  Multiple clients (REPLs, games, visualizers) can listen simultaneously.

Service Management:
  tsm start midi-bridge        - Start MIDI broadcast service (port 1983)
  tsm stop midi-bridge         - Stop MIDI broadcast service
  tsm status midi-bridge       - Check service status

REPL Commands:
  /variant <a|b|c|d>           - Switch device variant/preset
  /learn <name> [syntax]       - Map control (e.g., /learn VOLUME p1)
  /list /mode <raw|all>        - View/set mappings
  /save [name] /load [name]    - Save/load mapping sessions
  /device <id> /devices        - Select/list device configurations
  /monitor                     - Start event monitor

Controls: p1-p8 (pots), s1-s8 (sliders), b1a-b8d (buttons)

Example Workflow:
  1. tsm start midi-bridge     # Start service once
  2. midi repl                 # Connect REPL (can restart anytime)
  3. /learn VOLUME p1          # Map a control
  4. Move physical knob        # See it mapped
  5. /list                     # View all mappings

Press Ctrl+D to exit REPL
EOF
}

# Custom prompt builder
# Format: [controller[instance]:variant name][CC#][val]>
# Example: [vmx8[0]:a mixer][CC7][64]>
midi_repl_prompt() {
    # Build first bracket: [controller[instance]:variant variant_name]
    local bracket1=""
    if [[ -n "$REPL_CONTROLLER" && -n "$REPL_VARIANT" ]]; then
        bracket1="${TETRA_CYAN}[${REPL_CONTROLLER}[${REPL_INSTANCE}]:${REPL_VARIANT}"
        if [[ -n "$REPL_VARIANT_NAME" ]]; then
            bracket1+=" ${TETRA_DIM}${REPL_VARIANT_NAME}${TETRA_NC}${TETRA_CYAN}]${TETRA_NC}"
        else
            bracket1+="]${TETRA_NC}"
        fi
    elif [[ -n "$REPL_CONTROLLER" ]]; then
        bracket1="${TETRA_CYAN}[${REPL_CONTROLLER}[${REPL_INSTANCE}]]${TETRA_NC}"
    else
        bracket1="${TETRA_DIM}[no map]${TETRA_NC}"
    fi

    # Build second bracket: [CC#]
    local bracket2=""
    if [[ -n "$REPL_LAST_CC" ]]; then
        bracket2="${TETRA_YELLOW}[CC${REPL_LAST_CC}]${TETRA_NC}"
    else
        bracket2="${TETRA_DIM}[--]${TETRA_NC}"
    fi

    # Build third bracket: [val]
    local bracket3=""
    if [[ -n "$REPL_LAST_VAL" ]]; then
        bracket3="${TETRA_GREEN}[${REPL_LAST_VAL}]${TETRA_NC}"
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

# Background OSC event listener
midi_repl_osc_listener() {
    local osc_host="$1"
    local osc_port="$2"

    # Start Node.js OSC listener
    node "$MIDI_SRC/osc_repl_listener.js" -h "$osc_host" -p "$osc_port" 2>&1 | while IFS= read -r line; do
        case "$line" in
            __STATE__*)
                # Parse state: __STATE__ controller=vmx8 instance=0 variant=a ...
                local state_str="${line#__STATE__ }"

                # Parse key=value pairs
                while IFS= read -r pair; do
                    local key="${pair%%=*}"
                    local value="${pair#*=}"

                    case "$key" in
                        controller) REPL_CONTROLLER="$value" ;;
                        instance) REPL_INSTANCE="$value" ;;
                        variant) REPL_VARIANT="$value" ;;
                        variant_name) REPL_VARIANT_NAME="$value" ;;
                        last_cc) REPL_LAST_CC="$value" ;;
                        last_val) REPL_LAST_VAL="$value" ;;
                    esac
                done < <(echo "$state_str" | tr ' ' '\n')
                ;;

            __EVENT__*)
                # Parse event: __EVENT__ raw CC 1 7 64
                local event_str="${line#__EVENT__ }"
                # Display event to user (optional, can be customized)
                # echo "$event_str"
                ;;

            *)
                # Regular output from OSC listener (errors, status messages)
                if [[ -n "$line" ]]; then
                    echo "$line" >&2
                fi
                ;;
        esac
    done
}

# Main REPL entry point
midi_repl() {
    local osc_host="${1:-$REPL_OSC_HOST}"
    local osc_port="${2:-$REPL_OSC_PORT}"

    # Ensure MIDI is initialized
    midi_init 2>/dev/null || true

    # Register REPL commands
    midi_register_repl_commands

    # Register prompt builder
    REPL_PROMPT_BUILDERS+=("midi_repl_prompt")

    # Set history base
    REPL_HISTORY_BASE="${MIDI_DIR}/repl/history"

    # Check if midi-bridge service is running (optional check)
    # This is informational only - the REPL will still start even if service is not running
    if ! tsm status midi-bridge &>/dev/null; then
        echo "${TETRA_YELLOW}⚠ midi-bridge service not detected${TETRA_NC}"
        echo "  Start with: ${TETRA_CYAN}tsm start midi-bridge${TETRA_NC}"
        echo "  REPL will connect when service starts..."
        echo ""
    fi

    # Start background OSC listener (connects to midi-bridge broadcast)
    # This is a CLIENT that listens to OSC broadcasts from midi-bridge
    # Multiple clients can listen to the same broadcast simultaneously
    midi_repl_osc_listener "$osc_host" "$osc_port" &
    local listener_pid=$!

    # Cleanup on exit
    trap "kill $listener_pid 2>/dev/null; wait $listener_pid 2>/dev/null || true" EXIT

    echo "${TETRA_GREEN}✓${TETRA_NC} MIDI REPL started"
    echo "  Listening for OSC broadcasts on ${TETRA_CYAN}${osc_host}:${osc_port}${TETRA_NC}"
    echo "  Type ${TETRA_DIM}/help${TETRA_NC} for commands | ${TETRA_DIM}Ctrl+D${TETRA_NC} to exit"
    echo ""

    # Run REPL
    repl_run

    # Cleanup
    kill $listener_pid 2>/dev/null || true
    wait $listener_pid 2>/dev/null || true
}

# Export functions
export -f midi_repl
export -f midi_register_repl_commands
export -f midi_repl_prompt
export -f midi_repl_input
export -f midi_repl_learn
export -f midi_repl_list
export -f midi_repl_help
