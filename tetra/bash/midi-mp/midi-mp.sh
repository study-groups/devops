#!/usr/bin/env bash

# MIDI-MP Module - MIDI Multiplayer Protocol Router
# Main entry point loaded by tmod

# MIDI-MP Module Environment Variables with proper override guards
: "${MIDI_MP_SRC:=$TETRA_SRC/bash/midi-mp}"
: "${MIDI_MP_DIR:=$TETRA_DIR/midi-mp}"

# MIDI-MP Directory Convention under TETRA_DIR
MIDI_MP_CONFIG_DIR="${MIDI_MP_DIR}/config"
MIDI_MP_LOGS_DIR="${MIDI_MP_DIR}/logs"
MIDI_MP_EXAMPLES_DIR="${MIDI_MP_SRC}/examples"

# Default port: 2020 (symbolizing MIDI 2.0 introduction)
: "${MIDI_MP_PORT:=2020}"

# MIDI-MP Module Management
MIDI_MP_MODULE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Global check
if [[ -z "$TETRA_SRC" ]]; then
    echo "Error: TETRA_SRC must be set" >&2
    echo "Source ~/tetra/tetra.sh first" >&2
    return 1
fi

# Initialize MIDI-MP environment
midi_mp_init() {
    # Validate TETRA_DIR first
    if [[ -z "$TETRA_DIR" ]]; then
        echo "❌ Error: TETRA_DIR environment variable not set" >&2
        return 1
    fi

    # Create necessary directories
    mkdir -p "$MIDI_MP_CONFIG_DIR" "$MIDI_MP_LOGS_DIR"

    # Check for node dependencies
    if [[ ! -d "$MIDI_MP_SRC/node_modules" ]]; then
        echo "⚠ Node modules not found. Run 'midi-mp build' to install dependencies" >&2
    fi
}

# Main MIDI-MP command interface (follows Tetra module pattern)
midi-mp() {
    local action="${1:-}"

    if [[ -z "$action" ]]; then
        cat <<'EOF'
Usage: midi-mp <command> [args]

Service:     start stop restart status logs
Config:      config init build
Examples:    router-cymatica router-broadcast router-vj router-collab
Apps:        cymatica-start cymatica-stop cymatica-logs
Games:       game-start game-stop game-logs game-status

Quick Start:
  midi-mp start               Start router with default config (port 2020)
  midi-mp router-cymatica     Start router with cymatica config
  midi-mp game-start pulsar   Start pulsar game with MIDI control
  midi-mp status              Check router status

Use tab completion to explore commands: midi-mp <tab>
For detailed help: midi-mp help
EOF
        return 0
    fi

    shift || true

    case "$action" in
        # Initialize
        init)
            midi_mp_init
            echo "✓ MIDI-MP module initialized"
            ;;

        # Service management
        start)
            local config="${1:-}"
            local port="${2:-$MIDI_MP_PORT}"
            local name_suffix=""
            local use_port=true

            # Parse options
            while [[ $# -gt 0 ]]; do
                case "$1" in
                    --no-port|--socket)
                        use_port=false
                        shift
                        ;;
                    --port)
                        port="$2"
                        shift 2
                        ;;
                    *)
                        break
                        ;;
                esac
            done

            config="${1:-}"

            # If config provided, determine which example to use
            if [[ -n "$config" ]]; then
                # Check if it's a full path or just a name
                if [[ -f "$config" ]]; then
                    config_file="$config"
                elif [[ -f "$MIDI_MP_EXAMPLES_DIR/${config}.json" ]]; then
                    config_file="$MIDI_MP_EXAMPLES_DIR/${config}.json"
                    name_suffix="-${config}"
                else
                    echo "❌ Config not found: $config" >&2
                    echo "Available examples: broadcast, cymatica, vj-split, collaborative-daw" >&2
                    return 1
                fi
            else
                # Default to broadcast example
                config_file="$MIDI_MP_EXAMPLES_DIR/broadcast.json"
            fi

            echo "Starting MIDI-MP router..."
            echo "  Config: $config_file"

            # Start with TSM - dual mode support
            if [[ "$use_port" == "true" ]]; then
                echo "  Mode: Port-based (UDP :$port)"
                tsm start --port "$port" --name "midi-mp${name_suffix}" \
                    node "$MIDI_MP_SRC/router.js" "$config_file"
            else
                echo "  Mode: Socket-based (no network port)"
                tsm start --name "midi-mp${name_suffix}" \
                    node "$MIDI_MP_SRC/router.js" "$config_file"
            fi
            ;;

        stop)
            local name="${1:-midi-mp}"
            # Try to find by name pattern if port not specified
            if [[ "$name" != *"-"* ]]; then
                # Look for any midi-mp process
                tsm stop "midi-mp*" 2>/dev/null || tsm stop "$name"
            else
                tsm stop "$name"
            fi
            ;;

        restart)
            midi-mp stop "$@"
            sleep 1
            midi-mp start "$@"
            ;;

        status)
            # Find midi-mp processes
            tsm list | grep "midi-mp" || echo "No MIDI-MP processes running"
            ;;

        logs)
            local name="${1:-midi-mp}"
            if [[ "$name" == *"-"* ]]; then
                tsm logs "$name"
            else
                # Find the TSM ID for midi-mp
                local tsm_id=$(tsm list | grep "midi-mp" | awk '{print $1}' | head -1)
                if [[ -n "$tsm_id" ]]; then
                    tsm logs "$tsm_id"
                else
                    echo "No MIDI-MP process found" >&2
                    return 1
                fi
            fi
            ;;

        # Router shortcuts (starts midi-mp router with configs)
        router-cymatica)
            echo "🎵 Starting MIDI-MP router for Cymatica"
            TSM_CONFIG="examples/cymatica.json" tsm start midi-mp
            ;;

        router-broadcast)
            echo "📡 Starting MIDI-MP router in broadcast mode"
            TSM_CONFIG="examples/broadcast.json" tsm start midi-mp
            ;;

        router-vj)
            echo "🎬 Starting MIDI-MP router for VJ split"
            TSM_CONFIG="examples/vj-split.json" tsm start midi-mp
            ;;

        router-collab)
            echo "🎹 Starting MIDI-MP router for collaborative DAW"
            TSM_CONFIG="examples/collaborative-daw.json" tsm start midi-mp
            ;;

        # Consumer app commands
        cymatica-start)
            echo "🌊 Starting Cymatica consumer app..."
            echo "  Listening on: UDP :2020 (midi-mp output)"
            echo "  Receiving transformed events from midi-mp"
            tsm start cymatica
            ;;

        cymatica-stop)
            echo "Stopping Cymatica app..."
            tsm stop cymatica
            ;;

        cymatica-logs)
            local tsm_id=$(tsm list | grep "cymatica" | awk '{print $1}' | head -1)
            if [[ -n "$tsm_id" ]]; then
                tsm logs "$tsm_id"
            else
                echo "Cymatica app not running" >&2
                return 1
            fi
            ;;

        cymatica-status)
            tsm list | grep "cymatica" || echo "Cymatica app not running"
            ;;

        # Game integration commands
        game-start)
            local game="${1:-pulsar}"
            local config="${2:-pulsar-game}"

            # Validate game
            case "$game" in
                pulsar)
                    local game_bin="${GAME_SRC:-$TETRA_SRC/bash/game}/engine/bin/pulsar"
                    local bridge_script="$MIDI_MP_SRC/pulsar-game-bridge.js"
                    ;;
                *)
                    echo "❌ Unknown game: $game" >&2
                    echo "Available games: pulsar" >&2
                    return 1
                    ;;
            esac

            # Validate game binary
            if [[ ! -x "$game_bin" ]]; then
                echo "❌ Game binary not found: $game_bin" >&2
                echo "Build the game engine first:" >&2
                echo "  make -C \$GAME_SRC/engine" >&2
                return 1
            fi

            # Resolve config path
            if [[ -f "$config" ]]; then
                config_file="$config"
            elif [[ -f "$MIDI_MP_EXAMPLES_DIR/${config}.json" ]]; then
                config_file="$MIDI_MP_EXAMPLES_DIR/${config}.json"
            else
                echo "❌ Config not found: $config" >&2
                echo "Available configs:" >&2
                ls -1 "$MIDI_MP_EXAMPLES_DIR"/*.json 2>/dev/null | xargs -n1 basename
                return 1
            fi

            echo "🎮 Starting $game game with MIDI-MP integration..."
            echo "  Config: $config_file"
            echo "  Game: $game_bin"
            echo "  Bridge: $bridge_script"
            echo ""
            echo "💡 This process subscribes to midi-mp router (port 2020)"
            echo "   Make sure the router is running: midi-mp start"
            echo ""

            # Start game bridge with TSM (consumer - no port needed, just name)
            tsm start --name "${game}-game" \
                node "$bridge_script" "$config_file" "$game_bin"
            ;;

        game-stop)
            local game="${1:-pulsar}"
            echo "Stopping ${game} game..."
            tsm stop "${game}-game"
            ;;

        game-logs)
            local game="${1:-pulsar}"
            local tsm_id=$(tsm list | grep "${game}-game" | awk '{print $1}' | head -1)
            if [[ -n "$tsm_id" ]]; then
                tsm logs "$tsm_id"
            else
                echo "${game} game not running" >&2
                return 1
            fi
            ;;

        game-status)
            echo "MIDI-MP Game Instances:"
            tsm list | grep -E "game|^NAME" || echo "No games running"
            ;;

        # Configuration
        config)
            local config_action="${1:-show}"
            shift || true

            case "$config_action" in
                show)
                    echo "MIDI-MP Configuration"
                    echo "===================="
                    echo "Source dir: $MIDI_MP_SRC"
                    echo "Data dir: $MIDI_MP_DIR"
                    echo "Examples: $MIDI_MP_EXAMPLES_DIR"
                    echo "Default port: $MIDI_MP_PORT"
                    echo ""
                    echo "Available example configs:"
                    ls -1 "$MIDI_MP_EXAMPLES_DIR"/*.json 2>/dev/null | xargs -n1 basename
                    ;;

                edit)
                    local config="${1:-broadcast}"
                    local config_file="$MIDI_MP_EXAMPLES_DIR/${config}.json"
                    if [[ -f "$config_file" ]]; then
                        ${EDITOR:-vi} "$config_file"
                    else
                        echo "Config not found: $config_file" >&2
                        return 1
                    fi
                    ;;

                *)
                    echo "Unknown config action: $config_action"
                    echo "Use: show|edit"
                    return 1
                    ;;
            esac
            ;;

        # Install dependencies
        build)
            echo "Installing Node.js dependencies..."
            cd "$MIDI_MP_SRC"
            if npm install; then
                echo "✓ Dependencies installed"
                echo ""
                echo "Test with: node $MIDI_MP_SRC/router.js $MIDI_MP_EXAMPLES_DIR/broadcast.json"
            else
                echo "✗ Installation failed"
                echo ""
                echo "Make sure Node.js and npm are installed"
                return 1
            fi
            ;;

        # Help
        help|--help|-h)
            midi_mp_help
            ;;

        *)
            echo "Unknown command: $action"
            echo "Use 'midi-mp help' for usage"
            return 1
            ;;
    esac
}

# Show help
midi_mp_help() {
    cat <<EOF
MIDI-MP - MIDI Multiplayer Protocol Router
===========================================

A protocol and router for distributing MIDI control to multiple players/consumers.

USAGE
  midi-mp <command> [options]

SERVICE MANAGEMENT
  start [config] [port]
                  Start router with optional config and port (default: 2020)
                  Examples:
                    midi-mp start                    # Default config, port 2020
                    midi-mp start cymatica           # Cymatica config, port 2020
                    midi-mp start broadcast 3000     # Custom port

  stop [name]     Stop MIDI-MP router
  restart         Restart MIDI-MP router
  status          Show router status
  logs [name]     View router logs

EXAMPLE CONFIGS (shortcuts)
  cymatica        Start with cymatica example (cymatics visualizer)
  broadcast       Start in broadcast mode (all messages to all players)
  vj              Start with VJ split routing
  collab          Start for collaborative DAW

CONFIGURATION
  config show     Show configuration paths and available examples
  config edit <name>
                  Edit example config (e.g., config edit cymatica)

BUILD
  build           Install Node.js dependencies

HELP
  help            Show this help

ARCHITECTURE

  MIDI Controller → midi.js (OSC bridge) → midi-mp router → Players/Apps
                           :57121              :2020 (default)
                                                  ↓
                                            Routing rules
                                            Player management
                                            Message filtering

ROUTING MODES

  broadcast       All players get all messages
  split           Route based on control number ranges
  per-player      Each player gets assigned controls
  aggregate       Combine multiple controllers

EXAMPLES

  # Start with default broadcast config
  midi-mp start

  # Start for cymatica visualizer
  midi-mp cymatica

  # Start with custom config
  midi-mp start /path/to/my-config.json

  # Check status
  midi-mp status

  # View logs
  midi-mp logs

INTEGRATION WITH MIDI MODULE

  The midi module (midi.js) broadcasts MIDI messages as OSC to :57121.
  MIDI-MP receives these messages and routes them to configured players.

  Start both:
    midi start              # Start MIDI → OSC bridge
    midi-mp cymatica        # Start MIDI-MP router for cymatica

For more info: https://github.com/tetra/midi-mp

EOF
}

# Initialize module when sourced
midi_mp_init

# Source completion if available
if [[ -f "$MIDI_MP_MODULE_DIR/completion.sh" ]]; then
    source "$MIDI_MP_MODULE_DIR/completion.sh"
fi

# Export functions
export -f midi-mp
export -f midi_mp_init
export -f midi_mp_help
