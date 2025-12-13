#!/usr/bin/env bash
# Pulsar Simple REPL - Interactive control with C engine
# Minimal version without complex dependencies

set -euo pipefail

# Source only what we need
if [[ -z "${TETRA_SRC:-}" ]]; then
    echo "Error: TETRA_SRC not set. Run: source ~/tetra/tetra.sh first" >&2
    exit 1
fi

GAME_SRC="${TETRA_SRC}/bash/game"
PULSAR_BIN="${GAME_SRC}/engine/bin/pulsar"

# ============================================================================
# STATE
# ============================================================================

declare -g _PULSAR_PID=""
declare -g PULSAR_FD_IN=""
declare -g PULSAR_FD_OUT=""
declare -A SPRITE_IDS  # name -> id mapping

# ============================================================================
# ENGINE MANAGEMENT
# ============================================================================

pulsar_start_simple() {
    if [[ -n "$_PULSAR_PID" ]] && kill -0 "$_PULSAR_PID" 2>/dev/null; then
        echo "⚠️  Engine already running (PID: $_PULSAR_PID)"
        return 0
    fi

    # Build if needed
    if [[ ! -x "$PULSAR_BIN" ]]; then
        echo "Building Pulsar engine..."
        make -C "${GAME_SRC}/engine" || {
            echo "Failed to build Pulsar"
            return 1
        }
    fi

    # Start engine with bidirectional pipe
    coproc PULSAR { "$PULSAR_BIN"; }
    _PULSAR_PID=$PULSAR_PID
    PULSAR_FD_IN="${PULSAR[1]}"
    PULSAR_FD_OUT="${PULSAR[0]}"

    # Wait for READY
    local response
    read -r -u "$PULSAR_FD_OUT" response
    if [[ "$response" != "OK READY" ]]; then
        echo "❌ Pulsar failed to initialize: $response"
        return 1
    fi

    # Initialize with terminal size
    local cols=$(tput cols)
    local rows=$(tput lines)
    echo "INIT $cols $rows" >&"$PULSAR_FD_IN"
    read -r -u "$PULSAR_FD_OUT" response

    echo ""
    echo "✓ Engine started (PID: $_PULSAR_PID)"
    echo "✓ Grid: ${cols}×${rows}"
    echo ""
}

pulsar_stop_simple() {
    if [[ -n "$_PULSAR_PID" ]] && kill -0 "$_PULSAR_PID" 2>/dev/null; then
        echo "QUIT" >&"$PULSAR_FD_IN" 2>/dev/null || true
        wait "$_PULSAR_PID" 2>/dev/null || true
        echo "✓ Engine stopped"
    fi
    _PULSAR_PID=""
}

pulsar_cmd_simple() {
    local cmd="$1"
    if [[ -z "$_PULSAR_PID" ]] || ! kill -0 "$_PULSAR_PID" 2>/dev/null; then
        echo "❌ Engine not running"
        return 1
    fi
    echo "$cmd" >&"$PULSAR_FD_IN"
}

pulsar_read_response_simple() {
    local response
    read -r -u "$PULSAR_FD_OUT" response
    echo "$response"
}

# ============================================================================
# COMMANDS
# ============================================================================

cmd_spawn() {
    local name="$1"
    shift
    local params=("$@")

    if [[ ${#params[@]} -lt 7 ]]; then
        echo "Usage: spawn <name> <mx> <my> <len0> <amp> <freq> <dtheta> <valence>"
        return 1
    fi

    local cmd="SPAWN_PULSAR ${params[*]}"
    pulsar_cmd_simple "$cmd"
    local response=$(pulsar_read_response_simple)

    if [[ "$response" =~ ^ID[[:space:]]([0-9]+) ]]; then
        local id="${BASH_REMATCH[1]}"
        SPRITE_IDS[$name]=$id
        echo "✓ Spawned '$name' → ID $id"
    else
        echo "❌ $response"
    fi
}

cmd_run() {
    echo ""
    echo "Starting animation (press 'q' to return)..."
    echo ""
    sleep 1

    pulsar_cmd_simple "RUN 60"

    # Wait for completion
    local response
    while read -r -u "$PULSAR_FD_OUT" response; do
        [[ "$response" == "OK RUN_COMPLETE" ]] && break
    done

    echo ""
    echo "✓ Back to REPL"
    echo ""
}

cmd_list() {
    if [[ ${#SPRITE_IDS[@]} -eq 0 ]]; then
        echo "No sprites"
    else
        for name in "${!SPRITE_IDS[@]}"; do
            echo "  $name → ID ${SPRITE_IDS[$name]}"
        done
    fi
}

cmd_help() {
    echo ""
    echo "Commands:"
    echo "  start        - Start the engine"
    echo "  stop         - Stop the engine"
    echo "  spawn <name> <mx> <my> <len0> <amp> <freq> <dtheta> <valence>"
    echo "               - Spawn a pulsar sprite"
    echo "  run          - Start the animation loop"
    echo "  list         - List all sprites"
    echo "  hello        - Quick spawn: single cyan pulsar"
    echo "  trinity      - Quick spawn: three pulsars"
    echo "  dance        - Quick spawn: two counter-rotating pulsars"
    echo "  help         - Show this help"
    echo "  quit         - Exit"
    echo ""
    echo "Parameters:"
    echo "  mx, my       - Position (80, 48 is center)"
    echo "  len0         - Arm length (1-30)"
    echo "  amp          - Pulse amplitude (1-15)"
    echo "  freq         - Pulse rate (0.1-2.0 Hz)"
    echo "  dtheta       - Rotation speed (-2.0 to 2.0)"
    echo "  valence      - Color (0=Cyan 1=Green 2=Yellow 3=Red 4=Magenta 5=Blue)"
    echo ""
}

# ============================================================================
# REPL
# ============================================================================

repl() {
    echo ""
    echo "⚡ PULSAR SIMPLE REPL"
    echo ""
    echo "Type 'help' for commands, 'start' to begin"
    echo ""

    trap 'pulsar_stop_simple 2>/dev/null' EXIT

    while true; do
        read -e -p "pulsar ▶ " input || break

        [[ -z "$input" ]] && continue

        local args=($input)
        local cmd="${args[0]}"

        case "$cmd" in
            start)
                pulsar_start_simple
                ;;
            stop)
                pulsar_stop_simple
                ;;
            spawn)
                cmd_spawn "${args[@]:1}"
                ;;
            run)
                cmd_run
                ;;
            list)
                cmd_list
                ;;
            hello)
                cmd_spawn "hello" 80 48 18 6 0.5 0.6 0
                ;;
            trinity)
                cmd_spawn "left" 40 48 18 6 0.5 0.8 0
                cmd_spawn "center" 80 48 20 8 0.4 -0.3 2
                cmd_spawn "right" 120 48 15 4 0.7 0.6 5
                ;;
            dance)
                cmd_spawn "dancer1" 60 48 20 8 0.8 1.2 0
                cmd_spawn "dancer2" 100 48 20 8 0.8 -1.2 5
                ;;
            help|h|\?)
                cmd_help
                ;;
            quit|exit|q)
                break
                ;;
            *)
                echo "Unknown command: $cmd (type 'help')"
                ;;
        esac
    done

    echo ""
    echo "Goodbye! ⚡"
    echo ""
}

# Run
repl
