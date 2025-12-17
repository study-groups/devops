#!/usr/bin/env bash

# MIDI Module - Clean TSM-based Architecture
# Service runs as background daemon, REPL is pure monitor, CLI manages everything

# MIDI Module Environment
: "${MIDI_SRC:=$TETRA_SRC/bash/midi}"
: "${MIDI_DIR:=$TETRA_DIR/midi}"

# MIDI Configuration
MIDI_CONFIG="${MIDI_CONFIG:-$MIDI_DIR/config.toml}"
MIDI_MAPS_DIR="$MIDI_DIR/maps"
MIDI_SOCKET="${MIDI_SOCKET:-/tmp/midi_gamepad.sock}"

# Bash 5.2+ required
if [[ "${BASH_VERSINFO[0]}" -lt 5 ]] || [[ "${BASH_VERSINFO[0]}" -eq 5 && "${BASH_VERSINFO[1]}" -lt 2 ]]; then
    echo "Error: midi module requires bash 5.2+ (current: ${BASH_VERSION})" >&2
    return 1
fi

# Global check
if [[ -z "$TETRA_SRC" ]]; then
    echo "Error: TETRA_SRC must be set" >&2
    return 1
fi

# Source tree help registration
[[ -f "$MIDI_SRC/midi_help_tree.sh" ]] && source "$MIDI_SRC/midi_help_tree.sh"

# Helper: Read value from TOML config
midi_config_get() {
    local key="$1"
    local default="$2"
    if [[ -f "$MIDI_CONFIG" ]]; then
        local val=$(grep "^${key}[[:space:]]*=" "$MIDI_CONFIG" 2>/dev/null | head -1 | sed 's/.*=[[:space:]]*"\{0,1\}\([^"]*\)"\{0,1\}/\1/')
        [[ -n "$val" ]] && echo "$val" || echo "$default"
    else
        echo "$default"
    fi
}

# Helper: Send OSC control message
midi_osc_send() {
    local address="$1"
    shift
    node "$MIDI_SRC/osc_send.js" localhost 1983 "$address" "$@" 2>/dev/null
}

# Helper: Build and get C bridge path
midi_get_bridge() {
    local bridge="$MIDI_SRC/midi_bridge"
    if [[ ! -x "$bridge" ]]; then
        echo "Building midi_bridge..." >&2
        (cd "$MIDI_SRC" && make midi_bridge) || {
            echo "✗ Build failed. Need SDL2: brew install sdl2" >&2
            return 1
        }
    fi
    echo "$bridge"
}

# Main MIDI command interface
midi() {
    local action="${1:-}"

    if [[ -z "$action" ]]; then
        cat <<'EOF'
Usage: midi <command> [args]

Service Management:
  start [--node]    Start MIDI+Gamepad bridge (C binary, ~2-3ms latency)
                    --node: Use Node.js (slower, but has map/variant support)
  stop              Stop bridge service
  restart           Restart service
  status            Show service status

Monitoring:
  repl              Start interactive REPL
  devices           List available MIDI devices

Configuration:
  config show       Show current configuration
  config edit       Edit config.toml

Map Management (Node.js mode only):
  load-map NAME     Load map file (e.g., vmx8[0])
  variant LETTER    Switch variant (a/b/c/d)

OSC Output:
  /midi/raw/cc/{ch}/{cc}  {int}     MIDI CC (0-127)
  /gamepad/axis/{0-5}     {float}   Gamepad (-1.0 to 1.0)

Quick Start:
  midi start        # Start fast C bridge (MIDI + Gamepad)
  midi repl         # Monitor input

Examples:
  midi start                 # Fast C bridge (recommended)
  midi start --node          # Node.js with semantic maps
EOF
        return 0
    fi

    shift || true

    case "$action" in
        # Service management
        start)
            local use_node=false
            [[ "$1" == "--node" ]] && use_node=true

            if $use_node; then
                # Node.js mode (supports maps/variants)
                echo "Starting MIDI bridge (Node.js mode)..."
                local config_arg=""
                [[ -f "$MIDI_CONFIG" ]] && config_arg="-c $MIDI_CONFIG"
                if tsm start --name midi --port 1983 node "$MIDI_SRC/midi.js" -v $config_arg; then
                    echo "✓ MIDI bridge started (Node.js)"
                    sleep 1
                    midi status
                else
                    echo "✗ Failed to start service"
                    return 1
                fi
            else
                # Fast C bridge (default) - MIDI + Gamepad
                echo "Starting MIDI bridge (C, fast mode)..."
                local bridge
                bridge=$(midi_get_bridge) || return 1

                # Read config for device names
                local device_in=$(midi_config_get "device_input" "")
                local device_out=$(midi_config_get "device_output" "")
                local osc_port=$(midi_config_get "osc_port" "1983")
                local osc_group=$(midi_config_get "osc_multicast" "239.1.1.1")

                # Build args
                local args="-g -M -v"  # gamepad + MIDI + verbose
                args="$args -p $osc_port -m $osc_group"
                args="$args -s $MIDI_SOCKET"
                # Note: C bridge auto-detects devices, config names are for Node.js

                if tsm start --name midi --port "$osc_port" "$bridge" $args; then
                    echo "✓ MIDI bridge started (C)"
                    echo "  OSC: $osc_group:$osc_port"
                    echo "  Socket: $MIDI_SOCKET"
                    sleep 1
                    midi status
                else
                    echo "✗ Failed to start service"
                    return 1
                fi
            fi
            ;;

        stop)
            echo "Stopping MIDI bridge..."
            # Find and stop by pattern
            local service_id=$(tsm ls 2>/dev/null | grep "midi-1983" | awk '{print $1}')
            if [[ -n "$service_id" ]]; then
                tsm stop "$service_id"
            else
                echo "✗ MIDI bridge not found"
                return 1
            fi
            ;;

        restart)
            echo "Restarting MIDI bridge..."
            tsm stop midi-broadcast
            sleep 1
            midi start
            ;;

        status)
            # Find the service by pattern (TSM may add port suffix)
            if tsm ls 2>/dev/null | grep -q "midi-1983"; then
                echo "✓ MIDI bridge: running"
                tsm ls | grep "midi-1983"
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
            # Source the REPL
            source "$MIDI_SRC/core/repl.sh"
            midi_repl "$@"
            ;;

        devices)
            node "$MIDI_SRC/midi.js" -l
            ;;

        # Gamepad info (now integrated into midi start)
        gamepad)
            local gp_action="${1:-list}"
            case "$gp_action" in
                list)
                    local bridge
                    bridge=$(midi_get_bridge) || return 1
                    "$bridge" -l
                    ;;
                *)
                    echo "Gamepad is now integrated into 'midi start'"
                    echo ""
                    echo "  midi start       # Starts MIDI + Gamepad (C bridge)"
                    echo "  midi gamepad list  # List connected gamepads"
                    ;;
            esac
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
