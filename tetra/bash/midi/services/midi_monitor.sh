#!/usr/bin/env bash

# MIDI Monitor Service
# Example subscriber that logs all MIDI events with timestamps

set -euo pipefail

# Service configuration
SERVICE_NAME="${1:-midi-monitor}"
SOCKET_PATH="${TSM_PROCESSES_DIR}/sockets/${SERVICE_NAME}.sock"
TMC_SOCKET="${TSM_PROCESSES_DIR}/sockets/tmc.sock"
LOG_FILE="${TETRA_DIR}/logs/midi_events.log"

# Ensure directories exist
mkdir -p "$(dirname "$SOCKET_PATH")"
mkdir -p "$(dirname "$LOG_FILE")"

# ANSI colors for terminal output
C_RESET='\033[0m'
C_CYAN='\033[0;36m'
C_GREEN='\033[0;32m'
C_YELLOW='\033[1;33m'
C_BLUE='\033[0;34m'
C_MAGENTA='\033[0;35m'

log() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[${timestamp}] $*" >&2
}

log_event() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S.%3N')
    echo "[${timestamp}] $*" >> "$LOG_FILE"
}

# Format and display MIDI event
display_event() {
    local event="$*"
    local timestamp=$(date '+%H:%M:%S.%3N')

    # Parse event type
    local event_type=$(echo "$event" | awk '{print $1}')

    case "$event_type" in
        RAW)
            # RAW CC 1 7 127
            local midi_type=$(echo "$event" | awk '{print $2}')
            local channel=$(echo "$event" | awk '{print $3}')
            local controller=$(echo "$event" | awk '{print $4}')
            local value=$(echo "$event" | awk '{print $5}')

            echo -e "${C_CYAN}${timestamp}${C_RESET} ${C_YELLOW}RAW${C_RESET} ${midi_type} ch${channel} cc${controller} = ${value}"
            ;;

        SYNTAX)
            # SYNTAX p1 127
            local syntax=$(echo "$event" | awk '{print $2}')
            local value=$(echo "$event" | awk '{print $3}')

            echo -e "${C_CYAN}${timestamp}${C_RESET} ${C_BLUE}SYNTAX${C_RESET} ${syntax} = ${value}"
            ;;

        SEMANTIC)
            # SEMANTIC VOLUME 1.0
            local semantic=$(echo "$event" | awk '{print $2}')
            local value=$(echo "$event" | awk '{print $3}')

            echo -e "${C_CYAN}${timestamp}${C_RESET} ${C_GREEN}SEMANTIC${C_RESET} ${semantic} = ${value}"
            ;;

        ALL)
            # ALL CC 1 7 127 p1 VOLUME 1.0
            local parts=($event)
            local midi="${parts[1]} ch${parts[2]} cc${parts[3]}"
            local raw_value="${parts[4]}"
            local syntax="${parts[5]:-}"
            local semantic="${parts[6]:-}"
            local norm_value="${parts[7]:-}"

            echo -e "${C_CYAN}${timestamp}${C_RESET} ${C_MAGENTA}ALL${C_RESET}"
            echo -e "  Raw:      ${midi} = ${raw_value}"
            if [[ -n "$syntax" ]]; then
                echo -e "  Syntax:   ${syntax}"
            fi
            if [[ -n "$semantic" ]]; then
                echo -e "  Semantic: ${semantic} = ${norm_value}"
            fi
            ;;

        NOTE_ON|NOTE_OFF|CC|PROGRAM_CHANGE|PITCH_BEND)
            # Direct from tmc binary (if not mapped)
            echo -e "${C_CYAN}${timestamp}${C_RESET} ${C_YELLOW}UNMAPPED${C_RESET} ${event}"
            ;;

        *)
            echo -e "${C_CYAN}${timestamp}${C_RESET} ${event}"
            ;;
    esac
}

# Subscribe to TMC
subscribe_to_tmc() {
    log "Subscribing to TMC at $TMC_SOCKET"

    if [[ ! -S "$TMC_SOCKET" ]]; then
        log "ERROR: TMC socket not found: $TMC_SOCKET"
        log "Start TMC service first: tsm start bash ~/tetra/bash/midi/core/socket_server.sh tmc"
        exit 1
    fi

    # Send subscribe command
    if ! echo "SUBSCRIBE $SOCKET_PATH" | nc -U "$TMC_SOCKET" 2>/dev/null; then
        log "ERROR: Failed to subscribe to TMC"
        exit 1
    fi

    log "Subscribed to TMC"
}

# Unsubscribe on exit
unsubscribe() {
    log "Unsubscribing from TMC"
    echo "UNSUBSCRIBE $SOCKET_PATH" | nc -U "$TMC_SOCKET" 2>/dev/null || true
}

# Start monitoring
start_monitor() {
    log "Starting MIDI monitor: $SERVICE_NAME"
    log "Socket: $SOCKET_PATH"
    log "Log file: $LOG_FILE"
    echo ""
    echo "MIDI Event Monitor"
    echo "=================="
    echo ""
    echo "Listening for events... (Ctrl+C to stop)"
    echo ""

    # Remove old socket if exists
    [[ -S "$SOCKET_PATH" ]] && rm -f "$SOCKET_PATH"

    # Subscribe to TMC
    subscribe_to_tmc

    # Listen for events
    while true; do
        if nc -l -U "$SOCKET_PATH" 2>/dev/null | while read -r event; do
            if [[ -n "$event" ]]; then
                # Display to terminal
                display_event "$event"

                # Log to file
                log_event "$event"
            fi
        done; then
            # Connection closed normally, wait for next
            sleep 0.1
        else
            # Error, recreate socket
            [[ -S "$SOCKET_PATH" ]] && rm -f "$SOCKET_PATH"
            sleep 1
        fi
    done
}

# Cleanup on exit
cleanup() {
    log "Shutting down MIDI monitor"
    unsubscribe
    [[ -S "$SOCKET_PATH" ]] && rm -f "$SOCKET_PATH"
}

trap cleanup EXIT INT TERM

# Start the monitor
start_monitor
