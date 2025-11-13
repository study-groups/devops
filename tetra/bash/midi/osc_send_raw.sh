#!/usr/bin/env bash

# Quick OSC Sender - Send ad-hoc OSC messages for testing
# Usage: osc_send_raw.sh <address> [args...]
#        osc_send_raw.sh -t <host:port> <address> [args...]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OSC_SEND="$SCRIPT_DIR/osc_send.js"

# Default to MIDI multicast
DEFAULT_HOST="239.1.1.1"
DEFAULT_PORT="1983"

show_usage() {
    cat <<'EOF'
OSC Sender - Send ad-hoc OSC messages

Usage:
  osc_send_raw.sh <address> [args...]
  osc_send_raw.sh -t <host:port> <address> [args...]

Options:
  -t <host:port>   Target host (default: 239.1.1.1:1983)
  -h, --help       Show this help

Arguments are auto-typed:
  - Numbers become floats
  - Strings remain strings

Examples:
  # Send to default multicast (MIDI)
  osc_send_raw.sh /tau/filter/cutoff 0.5
  osc_send_raw.sh /tau/envelope/attack 0.1 0.2
  osc_send_raw.sh /tau/trigger note

  # Send to specific host
  osc_send_raw.sh -t localhost:5000 /tau/filter/cutoff 0.5
  osc_send_raw.sh -t 192.168.1.100:9000 /synth/play 440

  # Send MIDI control messages
  osc_send_raw.sh /midi/control/variant b
  osc_send_raw.sh /midi/control/reload
  osc_send_raw.sh /midi/out/note 1 60 127

EOF
}

# Parse options
target_host="$DEFAULT_HOST"
target_port="$DEFAULT_PORT"

while [[ "$1" =~ ^- ]]; do
    case "$1" in
        -h|--help)
            show_usage
            exit 0
            ;;
        -t|--target)
            if [[ -z "$2" ]]; then
                echo "Error: -t requires host:port argument" >&2
                exit 1
            fi
            # Parse host:port
            if [[ "$2" =~ ^([^:]+):([0-9]+)$ ]]; then
                target_host="${BASH_REMATCH[1]}"
                target_port="${BASH_REMATCH[2]}"
            else
                echo "Error: Invalid target format. Use host:port (e.g., localhost:5000)" >&2
                exit 1
            fi
            shift 2
            ;;
        *)
            echo "Error: Unknown option: $1" >&2
            show_usage >&2
            exit 1
            ;;
    esac
done

# Check for address argument
if [[ -z "$1" ]]; then
    echo "Error: OSC address required" >&2
    show_usage >&2
    exit 1
fi

address="$1"
shift

# Validate OSC address format
if [[ ! "$address" =~ ^/ ]]; then
    echo "Error: OSC address must start with / (e.g., /tau/filter/cutoff)" >&2
    exit 1
fi

# Check if osc_send.js exists
if [[ ! -f "$OSC_SEND" ]]; then
    echo "Error: osc_send.js not found at: $OSC_SEND" >&2
    exit 1
fi

# Send the message
node "$OSC_SEND" "$target_host" "$target_port" "$address" "$@"
