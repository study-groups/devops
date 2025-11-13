#!/usr/bin/env bash

# TAU Module - Clean TSM-based Architecture
# Service runs as background daemon managing tau audio engine

# TAU Module Environment
: "${TAU_SRC:=$TETRA_SRC/bash/tau}"
# Default to ~/tau (strong global pattern)
: "${TAU_DIR:=$HOME/tau}"
# TAU engine binary location (C engine)
: "${TAU_ENGINE_DIR:=$HOME/src/mricos/demos/tau}"

# TAU Configuration
TAU_CONFIG="${TAU_CONFIG:-$TAU_DIR/config.toml}"
TAU_RUNTIME_DIR="$TAU_DIR/runtime"
TAU_SOCKET="$TAU_RUNTIME_DIR/tau.sock"
TAU_SAMPLES_DIR="$TAU_DIR/samples"
TAU_SESSIONS_DIR="$TAU_DIR/sessions"
TAU_BINARY="${TAU_ENGINE_DIR}/tau"
TAU_SEND_BINARY="${TAU_ENGINE_DIR}/tau-send"

# Global check
if [[ -z "$TETRA_SRC" ]]; then
    echo "Error: TETRA_SRC must be set" >&2
    return 1
fi

# Helper: Send command to tau service
tau_send() {
    local command="$*"
    if [[ ! -S "$TAU_SOCKET" ]]; then
        echo "Error: tau service not running (socket not found)" >&2
        return 1
    fi

    # Use tau-send binary (from TAU_ENGINE_DIR)
    if [[ -x "$TAU_SEND_BINARY" ]]; then
        "$TAU_SEND_BINARY" "$command"
    else
        echo "Error: tau-send not found at $TAU_SEND_BINARY" >&2
        echo "Set TAU_ENGINE_DIR to the tau C engine directory" >&2
        return 1
    fi
}

# Main TAU command interface
tau() {
    local action="${1:-}"

    if [[ -z "$action" ]]; then
        cat <<'EOF'
Usage: tau <command> [args]

Service Management:
  start             Start tau audio engine service (TSM-managed)
  stop              Stop tau service
  restart           Restart service
  status            Show service status

Audio Control:
  voice <n> <cmd>   Control voice (1-8)
  channel <n> <cmd> Control channel (1-4)
  sample <cmd>      Manage samples
  master <cmd>      Master controls

Monitoring:
  repl              Start interactive REPL
  test              Run audio test (440Hz sine)

Configuration:
  config show       Show current configuration
  config edit       Edit config.toml

Quick Start:
  1. tau start                   # Start audio engine
  2. tau test                    # Test with 440Hz sine wave
  3. tau repl                    # Open interactive REPL
  4. tau voice 1 freq 880        # Set voice 1 to 880Hz
  5. tau voice 1 gain 0.3        # Set volume
  6. tau voice 1 on              # Start voice

Examples:
  tau start                      # Start with default config
  tau voice 1 freq 440           # Set voice 1 frequency
  tau voice 1 gain 0.5           # Set voice 1 gain
  tau voice 1 on                 # Enable voice 1
  tau voice 1 off                # Disable voice 1
  tau channel 1 gain 0.8         # Set channel 1 volume
  tau channel 1 pan 0.5          # Pan channel 1 (0=left, 1=right)
  tau master volume 0.7          # Set master volume
EOF
        return 0
    fi

    shift || true

    case "$action" in
        # Service management
        start)
            echo "Starting tau audio engine service..."

            # Check if tau binary exists
            if [[ ! -x "$TAU_BINARY" ]]; then
                echo "✗ tau binary not found at: $TAU_BINARY"
                echo "  Set TAU_ENGINE_DIR or build: cd $TAU_ENGINE_DIR && ./build.sh"
                return 1
            fi

            # Ensure runtime directory exists
            mkdir -p "$TAU_RUNTIME_DIR"

            # Use TSM to start tau service
            if tsm start --name tau "$TAU_BINARY"; then
                echo "✓ tau audio engine started"
                sleep 1
                tau status
            else
                echo "✗ Failed to start service"
                return 1
            fi
            ;;

        stop)
            echo "Stopping tau audio engine..."
            # Find and stop by pattern
            local service_id=$(tsm ls 2>/dev/null | grep "tau" | grep -v "tau-" | awk '{print $1}')
            if [[ -n "$service_id" ]]; then
                tsm stop "$service_id"
                echo "✓ tau stopped"
            else
                echo "✗ tau service not found"
                return 1
            fi
            ;;

        restart)
            echo "Restarting tau audio engine..."
            tau stop
            sleep 1
            tau start
            ;;

        status)
            # Check if tau is running
            if tsm ls 2>/dev/null | grep -q "tau"; then
                echo "✓ tau audio engine: running"
                tsm ls | grep "tau"

                # Check socket
                if [[ -S "$TAU_SOCKET" ]]; then
                    echo "✓ Socket: $TAU_SOCKET"
                else
                    echo "⚠ Socket not found: $TAU_SOCKET"
                fi
            else
                echo "✗ tau audio engine: not running"
                echo "  Start with: tau start"
                return 1
            fi
            ;;

        # Audio control - Voice
        voice)
            local voice_num="$1"
            local voice_cmd="$2"
            shift 2 || true

            if [[ -z "$voice_num" || -z "$voice_cmd" ]]; then
                echo "Usage: tau voice <1-8> <command> [args]"
                echo "Commands: freq <hz>, gain <0-1>, on, off"
                return 1
            fi

            case "$voice_cmd" in
                freq)
                    tau_send "VOICE $voice_num FREQ $1"
                    ;;
                gain)
                    tau_send "VOICE $voice_num GAIN $1"
                    ;;
                on)
                    tau_send "VOICE $voice_num ON"
                    ;;
                off)
                    tau_send "VOICE $voice_num OFF"
                    ;;
                *)
                    echo "Unknown voice command: $voice_cmd"
                    return 1
                    ;;
            esac
            ;;

        # Audio control - Channel
        channel)
            local chan_num="$1"
            local chan_cmd="$2"
            shift 2 || true

            if [[ -z "$chan_num" || -z "$chan_cmd" ]]; then
                echo "Usage: tau channel <1-4> <command> [args]"
                echo "Commands: gain <0-1>, pan <0-1>"
                return 1
            fi

            case "$chan_cmd" in
                gain|volume)
                    tau_send "CHANNEL $chan_num GAIN $1"
                    ;;
                pan)
                    tau_send "CHANNEL $chan_num PAN $1"
                    ;;
                *)
                    echo "Unknown channel command: $chan_cmd"
                    return 1
                    ;;
            esac
            ;;

        # Master controls
        master)
            local master_cmd="$1"
            shift || true

            case "$master_cmd" in
                volume|gain)
                    tau_send "MASTER GAIN $1"
                    ;;
                *)
                    echo "Usage: tau master volume <0-1>"
                    return 1
                    ;;
            esac
            ;;

        # Quick test
        test)
            echo "Running audio test (440Hz sine wave)..."
            tau_send "VOICE 1 FREQ 440"
            tau_send "VOICE 1 GAIN 0.3"
            tau_send "VOICE 1 ON"
            echo "✓ Voice 1 enabled at 440Hz"
            echo "  Stop with: tau voice 1 off"
            ;;

        # Monitoring
        repl)
            echo "tau REPL not yet implemented"
            echo "Use direct commands: tau voice 1 freq 440"
            return 1
            ;;

        # Configuration
        config)
            local config_action="${1:-show}"
            shift || true

            case "$config_action" in
                show)
                    if [[ -f "$TAU_CONFIG" ]]; then
                        echo "Configuration: $TAU_CONFIG"
                        echo "---"
                        cat "$TAU_CONFIG"
                    else
                        echo "No config file found at: $TAU_CONFIG"
                        echo "Runtime directory: $TAU_RUNTIME_DIR"
                        echo "Socket: $TAU_SOCKET"
                    fi
                    ;;

                edit)
                    ${EDITOR:-vi} "$TAU_CONFIG"
                    echo "Config saved."
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
            tau
            ;;

        *)
            echo "Unknown command: $action"
            echo "Use 'tau help' for usage"
            return 1
            ;;
    esac
}

# Initialize module when sourced
if [[ -z "$TAU_INITIALIZED" ]]; then
    mkdir -p "$TAU_DIR" "$TAU_RUNTIME_DIR" "$TAU_SAMPLES_DIR" "$TAU_SESSIONS_DIR"
    TAU_INITIALIZED=1
fi

# Export functions
export -f tau
export -f tau_send
