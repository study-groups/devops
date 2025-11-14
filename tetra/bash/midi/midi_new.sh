#!/usr/bin/env bash

# MIDI Module - Clean TSM-based Architecture
# Service runs as background daemon, REPL is pure monitor, CLI manages everything

# MIDI Module Environment
: "${MIDI_SRC:=$TETRA_SRC/bash/midi}"
: "${MIDI_DIR:=$TETRA_DIR/midi}"

# MIDI Configuration
MIDI_CONFIG="${MIDI_CONFIG:-$MIDI_DIR/config.toml}"
MIDI_MAPS_DIR="$MIDI_DIR/maps"

# Global check
if [[ -z "$TETRA_SRC" ]]; then
    echo "Error: TETRA_SRC must be set" >&2
    return 1
fi

# Helper: Send OSC control message
midi_osc_send() {
    local address="$1"
    shift
    node "$MIDI_SRC/osc_send.js" localhost 1983 "$address" "$@" 2>/dev/null
}

# Main MIDI command interface
midi() {
    local action="${1:-}"

    if [[ -z "$action" ]]; then
        cat <<'EOF'
Usage: midi <command> [args]

Service Management:
  start             Start MIDI bridge service (TSM-managed)
  stop              Stop MIDI bridge service
  restart           Restart service
  status            Show service status

Map Management:
  load-map NAME     Load map file (e.g., vmx8[0])
  reload-map        Reload current map
  reload-config     Reload config.toml
  variant LETTER    Switch variant (a/b/c/d)

Monitoring:
  repl [MODE]       Start REPL monitor (raw|semantic|both|silent)
  devices           List available MIDI devices

Configuration:
  config show       Show current configuration
  config edit       Edit config.toml

Quick Start:
  1. midi start                  # Start service (loads default map from config)
  2. midi repl                   # Monitor MIDI events
  3. midi variant b              # Switch to variant 'b'
  4. midi load-map vmx8[0]       # Load different map

Examples:
  midi start                     # Uses config.toml defaults
  midi repl semantic             # Show only semantic values
  midi load-map akai[0]          # Hot-reload different controller map
  midi variant c                 # Switch to variant 'c'
EOF
        return 0
    fi

    shift || true

    case "$action" in
        # Service management
        start)
            echo "Starting MIDI bridge service..."
            if tsm start bash -c "node '$MIDI_SRC/midi.js' -v" midi-bridge; then
                echo "✓ MIDI bridge started"
                sleep 1
                midi status
            else
                echo "✗ Failed to start service"
                return 1
            fi
            ;;

        stop)
            echo "Stopping MIDI bridge..."
            tsm stop midi-bridge
            ;;

        restart)
            echo "Restarting MIDI bridge..."
            tsm stop midi-bridge
            sleep 1
            midi start
            ;;

        status)
            if tsm status midi-bridge 2>/dev/null | grep -q "running"; then
                echo "✓ MIDI bridge: running"
                # Request status broadcast
                midi_osc_send "/midi/control/status"
                sleep 0.2
            else
                echo "✗ MIDI bridge: not running"
                echo "  Start with: midi start"
                return 1
            fi
            ;;

        # Map management
        load-map)
            local map_name="$1"
            if [[ -z "$map_name" ]]; then
                echo "Usage: midi load-map <name>"
                echo "Available maps:"
                ls -1 "$MIDI_MAPS_DIR"/*.json 2>/dev/null | xargs -n1 basename | sed 's/\.json$//'
                return 1
            fi

            echo "Loading map: $map_name"
            midi_osc_send "/midi/control/load-map" "$map_name"
            ;;

        reload-map)
            echo "Reloading current map..."
            midi_osc_send "/midi/control/reload"
            ;;

        reload-config)
            echo "Reloading configuration..."
            midi_osc_send "/midi/control/reload-config"
            ;;

        variant)
            local variant="$1"
            if [[ -z "$variant" ]]; then
                echo "Usage: midi variant <a|b|c|d>"
                return 1
            fi

            if [[ ! "$variant" =~ ^[a-d]$ ]]; then
                echo "Error: Variant must be a, b, c, or d"
                return 1
            fi

            echo "Switching to variant: $variant"
            midi_osc_send "/midi/control/variant" "$variant"
            ;;

        # Monitoring
        repl)
            local mode="${1:-both}"
            source "$MIDI_SRC/core/repl_monitor.sh"
            midi_repl_monitor "$mode"
            ;;

        devices)
            node "$MIDI_SRC/midi.js" -l
            ;;

        # Configuration
        config)
            local config_action="${1:-show}"
            shift || true

            case "$config_action" in
                show)
                    if [[ -f "$MIDI_CONFIG" ]]; then
                        echo "Configuration: $MIDI_CONFIG"
                        echo "---"
                        cat "$MIDI_CONFIG"
                    else
                        echo "No config file found at: $MIDI_CONFIG"
                    fi
                    ;;

                edit)
                    ${EDITOR:-vi} "$MIDI_CONFIG"
                    echo "Config saved. Reload with: midi reload-config"
                    ;;

                *)
                    echo "Unknown config action: $config_action"
                    echo "Use: show|edit"
                    return 1
                    ;;
            esac
            ;;

        # Help
        help|--help|-h)
            midi
            ;;

        *)
            echo "Unknown command: $action"
            echo "Use 'midi help' for usage"
            return 1
            ;;
    esac
}

# Initialize module when sourced
if [[ -z "$MIDI_INITIALIZED" ]]; then
    mkdir -p "$MIDI_DIR" "$MIDI_MAPS_DIR"
    MIDI_INITIALIZED=1
fi

# Export functions
export -f midi
export -f midi_osc_send
