#!/usr/bin/env bash

# TMC Socket Server
# Runs as TSM-managed service, bridges tmc binary and subscribers

set -euo pipefail

# Source tetra environment
if [[ -n "${TETRA_SRC:-}" ]]; then
    source "$TETRA_SRC/bash/tsm/system/socket.sh" 2>/dev/null || true
fi

# Source TMC components
MIDI_SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$MIDI_SRC/core/mapper.sh"
source "$MIDI_SRC/core/learn.sh"

# Service configuration
SERVICE_NAME="${1:-tmc}"
SOCKET_PATH="${TSM_PROCESSES_DIR}/sockets/${SERVICE_NAME}.sock"
SUBSCRIBERS_FILE="${TSM_PROCESSES_DIR}/${SERVICE_NAME}/subscribers.txt"
MIDI_BRIDGE="${MIDI_SRC}/midi.js"
TMC_BRIDGE_PIPE="/tmp/tmc_bridge_$$.pipe"

# Ensure directories exist
mkdir -p "$(dirname "$SOCKET_PATH")"
mkdir -p "$(dirname "$SUBSCRIBERS_FILE")"
touch "$SUBSCRIBERS_FILE"

# Initialize mapper
tmc_mapper_init

# TMC bridge process ID
TMC_BRIDGE_PID=""

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >&2
}

# Add a subscriber socket
add_subscriber() {
    local sub_socket="$1"
    if [[ -S "$sub_socket" ]]; then
        echo "$sub_socket" >> "$SUBSCRIBERS_FILE"
        log "Added subscriber: $sub_socket"
        echo "OK: Subscribed"
    else
        echo "ERROR: Socket not found: $sub_socket"
    fi
}

# Remove a subscriber
remove_subscriber() {
    local sub_socket="$1"
    if grep -q "^${sub_socket}$" "$SUBSCRIBERS_FILE" 2>/dev/null; then
        grep -v "^${sub_socket}$" "$SUBSCRIBERS_FILE" > "${SUBSCRIBERS_FILE}.tmp"
        mv "${SUBSCRIBERS_FILE}.tmp" "$SUBSCRIBERS_FILE"
        log "Removed subscriber: $sub_socket"
        echo "OK: Unsubscribed"
    else
        echo "ERROR: Not subscribed"
    fi
}

# Broadcast event to all subscribers
broadcast() {
    local event="$*"
    local count=0

    # Clean up dead subscribers
    local active_subs=""
    while IFS= read -r sub_socket; do
        [[ -z "$sub_socket" ]] && continue
        [[ "$sub_socket" =~ ^# ]] && continue

        if [[ -S "$sub_socket" ]]; then
            active_subs+="${sub_socket}"$'\n'
            # Send to subscriber (non-blocking)
            if command -v nc >/dev/null 2>&1; then
                echo "$event" | timeout 1 nc -U "$sub_socket" 2>/dev/null &
                ((count++)) || true
            fi
        else
            log "Removing dead subscriber: $sub_socket"
        fi
    done < "$SUBSCRIBERS_FILE"

    # Update subscribers file with only active ones
    echo -n "$active_subs" > "$SUBSCRIBERS_FILE"

    if [[ $count -gt 0 ]]; then
        log "Broadcast: $event (to $count subscribers)"
    fi
}

# Process incoming MIDI event from tmc binary
process_midi_event() {
    local line="$1"

    # Parse MIDI message
    # Format: "CC 1 7 127" or "NOTE_ON 1 60 127"
    local type channel controller value

    read -r type channel controller value <<< "$line"

    # If in learning mode, process for learning
    if [[ $TMC_LEARNING -eq 1 ]]; then
        tmc_learn_process_event "$type" "$channel" "$controller" "$value"
        return
    fi

    # Map through layers and broadcast
    local mapped=$(tmc_map_event "$type" "$channel" "$controller" "$value")

    if [[ -n "$mapped" ]]; then
        broadcast "$mapped"
    fi
}

# Handle control commands from users/clients
handle_command() {
    local cmd="$1"
    shift
    local args=("$@")

    case "$cmd" in
        # Learning commands
        LEARN)
            tmc_learn "${args[@]}"
            ;;

        LEARN_ALL)
            tmc_learn_all "${args[0]}"
            ;;

        WIZARD)
            tmc_learn_wizard
            ;;

        UNLEARN)
            tmc_unlearn "${args[0]}"
            ;;

        CLEAR)
            tmc_clear_all
            ;;

        # Mapping commands
        LIST)
            tmc_list_mappings
            ;;

        MODE)
            tmc_set_mode "${args[0]}"
            ;;

        # Session commands
        SAVE)
            local session="${args[0]:-default}"
            tmc_save_session "$session"
            ;;

        LOAD)
            local session="${args[0]:-default}"
            tmc_load_session "$session"
            ;;

        # Device commands
        LOAD_DEVICE)
            tmc_load_device "${args[0]}"
            ;;

        # Subscriber management
        SUBSCRIBE)
            add_subscriber "${args[0]}"
            ;;

        UNSUBSCRIBE)
            remove_subscriber "${args[0]}"
            ;;

        LIST_SUBSCRIBERS)
            local count=0
            while IFS= read -r sub; do
                [[ -z "$sub" ]] && continue
                [[ "$sub" =~ ^# ]] && continue
                echo "$sub"
                ((count++)) || true
            done < "$SUBSCRIBERS_FILE"
            echo "Total: $count subscribers"
            ;;

        # Send MIDI output (to device via tmc binary)
        SEND)
            # Format: SEND CC 1 7 127
            # Forward to tmc binary bridge socket
            if [[ -n "$TMC_BRIDGE_PID" ]] && kill -0 "$TMC_BRIDGE_PID" 2>/dev/null; then
                echo "${args[*]}" | nc -U "$TMC_BRIDGE_SOCKET" 2>/dev/null || true
            fi
            echo "OK"
            ;;

        # Color control (sends CC to device)
        SET_COLOR)
            # Format: SET_COLOR b1a success
            # or: SET_COLOR b1a #FF0000
            local syntax="${args[0]}"
            local color="${args[1]}"

            # Look up hardware mapping
            local key="${TMC_HARDWARE_REV[$syntax]}"
            if [[ -z "$key" ]]; then
                echo "ERROR: Unknown syntax: $syntax"
                return
            fi

            # Look up color in color table
            local color_file="$TMC_CONFIG_DIR/colors/color_table.txt"
            local rgb=""

            if [[ -f "$color_file" ]]; then
                rgb=$(grep "^${color}|" "$color_file" 2>/dev/null | cut -d'|' -f2)
            fi

            if [[ -z "$rgb" ]] && [[ "$color" =~ ^#[0-9A-Fa-f]{6}$ ]]; then
                # Direct hex color
                rgb="$color"
            fi

            if [[ -z "$rgb" ]]; then
                echo "ERROR: Unknown color: $color"
                return
            fi

            # Convert hex to RGB values (simplified - assumes CC-based color)
            # This is device-specific; different controllers use different methods
            # For now, just send the mapped CC
            log "Setting color: $syntax → $color ($rgb)"
            echo "OK"
            ;;

        # Standard socket commands
        STATUS)
            echo "TMC Service: $SERVICE_NAME"
            echo "Device: ${TMC_CURRENT_DEVICE:-none}"
            echo "Broadcast Mode: $TMC_BROADCAST_MODE"
            echo "Hardware Mappings: ${#TMC_HARDWARE_MAP[@]}"
            echo "Semantic Mappings: ${#TMC_SEMANTIC_MAP[@]}"
            local sub_count=$(grep -c . "$SUBSCRIBERS_FILE" 2>/dev/null || echo 0)
            echo "Subscribers: $sub_count"
            echo "Learning: $([ $TMC_LEARNING -eq 1 ] && echo 'active' || echo 'inactive')"
            ;;

        HEALTH)
            echo "OK"
            ;;

        HELP)
            tmc_learn_help
            ;;

        STOP)
            echo "OK: Stopping"
            log "Received STOP command"
            exit 0
            ;;

        *)
            echo "ERROR: Unknown command: $cmd"
            echo "Available: LEARN, LIST, MODE, SAVE, LOAD, SUBSCRIBE, STATUS, HEALTH, HELP, STOP"
            ;;
    esac
}

# Start MIDI bridge (pipes stdout to us)
start_tmc_bridge() {
    if [[ ! -f "$MIDI_BRIDGE" ]]; then
        log "ERROR: MIDI bridge not found: $MIDI_BRIDGE"
        return 1
    fi

    if ! command -v node >/dev/null; then
        log "ERROR: Node.js not found. Install Node.js to use MIDI bridge."
        return 1
    fi

    # Get MIDI device configuration
    local input_device="${TMC_INPUT_DEVICE:-0}"
    local output_device="${TMC_OUTPUT_DEVICE:-0}"

    log "Starting MIDI bridge..."
    log "  Bridge: $MIDI_BRIDGE"
    log "  Input device: $input_device"
    log "  Output device: $output_device"

    # Start midi.js bridge, reading its stdout
    node "$MIDI_BRIDGE" -i "$input_device" -o "$output_device" -v 2>&1 | while IFS= read -r line; do
        # Strip "MIDI IN: " prefix if present (from verbose stderr)
        line="${line#MIDI IN: }"

        if [[ "$line" =~ ^(CC|NOTE_ON|NOTE_OFF|PROGRAM_CHANGE|PITCH_BEND) ]]; then
            process_midi_event "$line"
        elif [[ -n "$line" ]]; then
            log "$line"
        fi
    done &
    TMC_BRIDGE_PID=$!

    log "MIDI bridge started (PID: $TMC_BRIDGE_PID)"
}

# Monitor tmc bridge socket for incoming MIDI
monitor_tmc_bridge() {
    if [[ ! -S "$TMC_BRIDGE_SOCKET" ]]; then
        return
    fi

    # Read from bridge socket (tmc binary writes here)
    while IFS= read -r line; do
        if [[ -n "$line" ]]; then
            process_midi_event "$line"
        fi
    done < <(nc -l -U "$TMC_BRIDGE_SOCKET" 2>/dev/null || true)
}

# Start socket server
start_server() {
    log "Starting TMC service: $SERVICE_NAME"
    log "Socket: $SOCKET_PATH"

    # Remove old socket if exists
    [[ -S "$SOCKET_PATH" ]] && rm -f "$SOCKET_PATH"

    # Start tmc bridge (pipes MIDI events to process_midi_event)
    start_tmc_bridge || log "Running without tmc bridge"

    # Use nc or socat to create socket server
    if command -v nc >/dev/null 2>&1; then
        log "Using netcat for socket server"

        while true; do
            # nc -l -U creates a Unix socket server
            # Each connection reads one line, processes it, and closes
            nc -l -U "$SOCKET_PATH" 2>/dev/null | while read -r line; do
                log "Received: $line"
                handle_command $line
            done || {
                # nc died, recreate socket
                sleep 1
                [[ -S "$SOCKET_PATH" ]] || continue
            }
        done
    else
        log "ERROR: netcat not available"
        exit 1
    fi
}

# Cleanup on exit
cleanup() {
    log "Shutting down TMC service"

    # Stop tmc bridge
    if [[ -n "$TMC_BRIDGE_PID" ]]; then
        kill "$TMC_BRIDGE_PID" 2>/dev/null || true
        wait "$TMC_BRIDGE_PID" 2>/dev/null || true
    fi

    # Clean up sockets
    [[ -S "$SOCKET_PATH" ]] && rm -f "$SOCKET_PATH"
    [[ -S "$TMC_BRIDGE_SOCKET" ]] && rm -f "$TMC_BRIDGE_SOCKET"
}

trap cleanup EXIT INT TERM

# Export functions for subprocesses
export -f handle_command
export -f process_midi_event
export -f broadcast
export -f add_subscriber
export -f remove_subscriber
export -f log

# Start the server
start_server
