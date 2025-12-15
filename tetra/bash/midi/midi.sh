#!/usr/bin/env bash

# MIDI Module - Clean TSM-based Architecture
# Service runs as background daemon, REPL is pure monitor, CLI manages everything

# MIDI Module Environment
: "${MIDI_SRC:=$TETRA_SRC/bash/midi}"
: "${MIDI_DIR:=$TETRA_DIR/midi}"

# MIDI Configuration
MIDI_CONFIG="${MIDI_CONFIG:-$MIDI_DIR/config.toml}"
MIDI_MAPS_DIR="$MIDI_DIR/maps"

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

Gamepad:
  gamepad start     Start gamepad bridge (broadcasts to same OSC)
  gamepad stop      Stop gamepad bridge
  gamepad status    Show gamepad status
  gamepad list      List available gamepad devices

Map Management:
  load-map NAME     Load map file (e.g., vmx8[0])
  reload-map        Reload current map
  reload-config     Reload config.toml
  variant LETTER    Switch variant (a/b/c/d)

Monitoring:
  repl              Start interactive REPL (CLI + Key mode)
  devices           List available MIDI devices

Configuration:
  config show       Show current configuration
  config edit       Edit config.toml

Quick Start:
  1. midi start                  # Start MIDI service
  2. midi gamepad start          # Start gamepad bridge (optional)
  3. midi repl                   # Open TUI REPL
  4. midi variant b              # Switch to variant 'b'

Both MIDI and Gamepad broadcast to OSC 239.1.1.1:1983
Gamepad axes appear as virtual CC 100-105 on channel 16

Examples:
  midi start && midi gamepad start   # Both inputs active
  midi repl                          # Monitor all input
  midi load-map akai[0]              # Hot-reload controller map
EOF
        return 0
    fi

    shift || true

    case "$action" in
        # Service management
        start)
            echo "Starting MIDI bridge service..."
            # Build command args
            local config_arg=""
            if [[ -f "$MIDI_CONFIG" ]]; then
                config_arg="-c $MIDI_CONFIG"
            fi
            # Use TSM with explicit port 1983 (OSC multicast port)
            if tsm start --name midi --port 1983 node "$MIDI_SRC/midi.js" -v $config_arg; then
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

        # Gamepad management
        gamepad)
            local gp_action="${1:-status}"
            shift || true

            case "$gp_action" in
                start)
                    echo "Starting gamepad bridge..."
                    if tsm start --name gamepad --port 1983 node "$MIDI_SRC/gamepad.js" -v; then
                        echo "✓ Gamepad bridge started"
                        sleep 1
                        midi gamepad status
                    else
                        echo "✗ Failed to start gamepad bridge"
                        return 1
                    fi
                    ;;

                stop)
                    echo "Stopping gamepad bridge..."
                    local gp_id=$(tsm ls 2>/dev/null | grep "gamepad-1983" | awk '{print $1}')
                    if [[ -n "$gp_id" ]]; then
                        tsm stop "$gp_id"
                        echo "✓ Gamepad bridge stopped"
                    else
                        echo "✗ Gamepad bridge not found"
                        return 1
                    fi
                    ;;

                status)
                    if tsm ls 2>/dev/null | grep -q "gamepad-1983"; then
                        echo "✓ Gamepad bridge: running"
                        tsm ls | grep "gamepad-1983"
                        echo ""
                        echo "Virtual CC mapping (channel 16):"
                        echo "  CC 100 = Left stick X"
                        echo "  CC 101 = Left stick Y"
                        echo "  CC 102 = Right stick X"
                        echo "  CC 103 = Right stick Y"
                        echo "  CC 104 = Left trigger"
                        echo "  CC 105 = Right trigger"
                    else
                        echo "✗ Gamepad bridge: not running"
                        echo "  Start with: midi gamepad start"
                    fi
                    ;;

                list)
                    node "$MIDI_SRC/gamepad.js" -l
                    ;;

                bridge)
                    local socket_path="${1:-/tmp/estoface_gamepad.sock}"
                    echo "Starting OSC → gamepad socket bridge..."
                    echo "  Socket: $socket_path"
                    echo "  Mode: OSC multicast (higher latency)"
                    node "$MIDI_SRC/osc_to_gamepad.js" "$socket_path"
                    ;;

                direct)
                    local socket_path="${1:-/tmp/estoface_gamepad.sock}"
                    local sender="$TETRA_SRC/bash/games/tools/sender"
                    if [[ ! -x "$sender" ]]; then
                        echo "✗ Sender binary not found: $sender"
                        echo "  Build with: cd bash/games/tools && make sender"
                        return 1
                    fi
                    echo "Starting direct gamepad → socket..."
                    echo "  Socket: $socket_path"
                    echo "  Mode: Direct SDL2 (lowest latency)"
                    "$sender" "$socket_path"
                    ;;

                latency)
                    echo "Latency test modes:"
                    echo ""
                    echo "  Fast (C bridge, recommended):"
                    echo "    midi gamepad fast"
                    echo "    Gamepad+MIDI → C binary → OSC + Socket"
                    echo "    Expected: ~2-3ms"
                    echo ""
                    echo "  Direct (SDL sender):"
                    echo "    midi gamepad direct"
                    echo "    Gamepad → SDL2 → Unix socket"
                    echo "    Expected: ~2-5ms"
                    echo ""
                    echo "  OSC bridge (Node.js):"
                    echo "    midi gamepad start + midi gamepad bridge"
                    echo "    Expected: ~20-50ms"
                    echo ""
                    echo "  To measure, run game with ESTOFACE_LATENCY=1:"
                    echo "    ESTOFACE_LATENCY=1 estoface"
                    ;;

                fast)
                    local bridge="$MIDI_SRC/midi_bridge"
                    if [[ ! -x "$bridge" ]]; then
                        echo "Building midi_bridge..."
                        (cd "$MIDI_SRC" && make midi_bridge) || {
                            echo "✗ Build failed. Need SDL2: brew install sdl2"
                            return 1
                        }
                    fi
                    echo "Starting fast C bridge..."
                    echo "  Mode: C binary (lowest latency, ~2-3ms)"
                    "$bridge" -g -M -v
                    ;;

                *)
                    echo "Unknown gamepad action: $gp_action"
                    echo "Use: start|stop|status|list|fast|direct|bridge|latency"
                    return 1
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
