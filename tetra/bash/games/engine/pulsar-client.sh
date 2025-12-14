#!/usr/bin/env bash
# Pulsar REPL Client - Connects to running server
# Usage: ./pulsar-client.sh [socket_path]

CONTROL_SOCKET="${1:-/tmp/pulsar_control.sock}"

# Check if socket exists
if [[ ! -p "$CONTROL_SOCKET" ]]; then
    echo "❌ Control socket not found: $CONTROL_SOCKET"
    echo ""
    echo "Start the server first:"
    echo "  Terminal 1: ./pulsar-server.sh"
    echo "  Terminal 2: ./pulsar-client.sh"
    echo ""
    exit 1
fi

# Simple REPL that writes to the socket
echo ""
echo "╔═══════════════════════════════════════╗"
echo "║   ⚡ PULSAR CLIENT                   ║"
echo "║   Connected to Visual Server         ║"
echo "╚═══════════════════════════════════════╝"
echo ""
echo "  ✓ Connected to: $CONTROL_SOCKET"
echo ""
echo "  💡 Workflow:"
echo "    1. Spawn some pulsars (hello, trinity, etc.)"
echo "    2. Type 'run' to start animation"
echo "    3. Watch SERVER terminal for live animation!"
echo ""
echo "  Quick commands:"
echo "    hello      - Spawn single pulsar"
echo "    trinity    - Spawn 3 pulsars"
echo "    run        - Start animation (RUN 60)"
echo "    help       - Full command reference"
echo "    quit       - Exit client"
echo ""

# Command history
declare -a HISTORY=()
HISTORY_INDEX=0

# Send command to server
send_command() {
    local cmd="$1"
    [[ -z "$cmd" ]] && return

    # Add to history
    HISTORY+=("$cmd")
    HISTORY_INDEX=${#HISTORY[@]}

    # Write to socket (non-blocking)
    echo "$cmd" > "$CONTROL_SOCKET" &
}

# Show help
show_help() {
    cat <<'HELP'

QUICK REFERENCE:

Engine Protocol Commands:
  SPAWN_PULSAR <mx> <my> <len0> <amp> <freq> <dtheta> <valence>
  SET <id> <key> <value>
  KILL <id>
  LIST_PULSARS

Quick Spawns:
  hello          SPAWN_PULSAR 80 48 18 6 0.5 0.6 0
  trinity        Spawn 3 pulsars in formation

Parameters:
  mx,my      Position (microgrid)
  len0       Arm length (8-30)
  amp        Amplitude (2-12)
  freq       Frequency (0.1-1.2)
  dtheta     Rotation (-3.14 to 3.14)
  valence    Color (0-5)

Examples:
  SPAWN_PULSAR 80 48 18 6 0.5 0.6 0
  SET 1 dtheta 1.5
  hello
  trinity

HELP
}

# Process shortcuts
process_command() {
    local input="$1"

    case "$input" in
        help|h|\?)
            show_help
            return
            ;;
        quit|exit|q)
            echo ""
            echo "Goodbye! (Server still running)"
            echo ""
            exit 0
            ;;
        hello)
            send_command "SPAWN_PULSAR 80 48 18 6 0.5 0.6 0"
            echo "  → Spawned hello pulsar"
            ;;
        trinity)
            send_command "SPAWN_PULSAR 40 48 18 6 0.5 0.8 0"
            send_command "SPAWN_PULSAR 80 48 20 8 0.4 -0.3 2"
            send_command "SPAWN_PULSAR 120 48 15 4 0.7 0.6 5"
            echo "  → Spawned trinity formation"
            ;;
        dance)
            send_command "SPAWN_PULSAR 60 48 20 8 0.8 1.2 0"
            send_command "SPAWN_PULSAR 100 48 20 8 0.8 -1.2 5"
            echo "  → Spawned dance pair"
            ;;
        run)
            send_command "RUN 60"
            echo "  → Starting animation at 60 FPS"
            echo "  → Watch SERVER terminal now!"
            ;;
        *)
            # Send raw command
            send_command "$input"
            echo "  → $input"
            ;;
    esac
}

# Main REPL loop
while true; do
    read -e -p "⚡ client ▶ " input

    # Skip empty
    [[ -z "$input" ]] && continue

    # Add to bash history
    history -s "$input"

    # Process command
    process_command "$input"

    echo ""
done
