#!/usr/bin/env bash
# Pulsar TGP REPL - Live game + interactive REPL
# The ultimate: send commands while game runs!

# Source dependencies
source ~/tetra/tetra.sh || { echo "ERROR: Failed to source tetra.sh" >&2; exit 1; }
source "$TETRA_SRC/bash/tgp/tgp.sh" || { echo "ERROR: Failed to source tgp.sh" >&2; exit 1; }
source "$TETRA_SRC/bash/color/repl_colors.sh" || { echo "ERROR: Failed to source repl_colors.sh" >&2; exit 1; }

# Generate unique session ID
SESSION="pulsar_$$"
ENGINE_PID=""
declare -A SPRITE_IDS

# ============================================================================
# ENGINE MANAGEMENT
# ============================================================================

start_engine() {
    if [[ -n "$ENGINE_PID" ]] && kill -0 "$ENGINE_PID" 2>/dev/null; then
        echo "Engine already running (PID: $ENGINE_PID)"
        return 0
    fi

    echo ""
    text_color "66FFFF"
    echo "⚡ PULSAR TGP ENGINE"
    reset_color
    echo ""
    echo "Starting engine (session: $SESSION)..."

    # Start engine in background
    "$TETRA_SRC/bash/game/engine/bin/pulsar" --tgp "$SESSION" 2>/dev/null &
    ENGINE_PID=$!

    # Wait for sockets
    sleep 1

    # Connect TGP client
    if ! tgp_init "$SESSION"; then
        echo "Failed to connect to engine"
        return 1
    fi

    # Initialize grid
    tgp_send_init 160 96 60

    echo "✓ Engine started (PID: $ENGINE_PID)"
    echo "✓ TGP connected"
    echo ""
}

stop_engine() {
    if [[ -n "$ENGINE_PID" ]] && kill -0 "$ENGINE_PID" 2>/dev/null; then
        echo ""
        echo "Stopping engine..."
        tgp_send_quit
        sleep 0.5
        kill $ENGINE_PID 2>/dev/null || true
        wait $ENGINE_PID 2>/dev/null || true
        ENGINE_PID=""
        tgp_cleanup
        echo "✓ Engine stopped"
        echo ""
    fi
}

# ============================================================================
# COMMAND PROCESSOR
# ============================================================================

cmd_spawn() {
    local name="$1"
    local x="${2:-80}"
    local y="${3:-48}"
    local len="${4:-18}"
    local amp="${5:-6}"
    local freq="${6:-0.5}"
    local rot="${7:-0.6}"
    local color="${8:-0}"

    # Convert floats to fixed-point (x1000)
    local freq_fp=$(awk "BEGIN {printf \"%d\", $freq * 1000}")
    local rot_fp=$(awk "BEGIN {printf \"%d\", $rot * 1000}")

    tgp_send_spawn 0 "$color" "$x" "$y" "$len" "$amp" "$freq_fp" "$rot_fp"

    # TODO: Read response to get ID
    # For now, just increment
    local id=$((${#SPRITE_IDS[@]} + 1))
    SPRITE_IDS[$name]=$id

    echo "✓ Spawned '$name'"
}

cmd_run() {
    local fps="${1:-60}"
    tgp_send_run "$fps"
    echo "✓ Engine running at ${fps} FPS"
}

cmd_stop() {
    tgp_send_stop
    echo "✓ Engine stopped"
}

cmd_kill() {
    local name="$1"
    local id="${SPRITE_IDS[$name]:-}"

    if [[ -z "$id" ]]; then
        echo "Unknown sprite: $name"
        return 1
    fi

    tgp_send_kill "$id"
    unset SPRITE_IDS[$name]
    echo "✓ Killed '$name'"
}

cmd_list() {
    if [[ ${#SPRITE_IDS[@]} -eq 0 ]]; then
        echo "No sprites"
    else
        echo "Sprites:"
        for name in "${!SPRITE_IDS[@]}"; do
            echo "  • $name (ID ${SPRITE_IDS[$name]})"
        done
    fi
}

cmd_view() {
    bash "$TETRA_SRC/bash/game/engine/spawn_viewer.sh" "$SESSION"
}

cmd_help() {
    echo ""
    echo "Commands:"
    echo "  spawn <name> [x] [y] [len] [amp] [freq] [rot] [color]"
    echo "  run [fps]     - Start engine"
    echo "  stop          - Stop engine"
    echo "  view          - Open viewer in new terminal window"
    echo "  kill <name>   - Kill sprite"
    echo "  list          - List sprites"
    echo "  hello         - Spawn single cyan pulsar"
    echo "  trinity       - Spawn three pulsars"
    echo "  dance         - Spawn two counter-rotating pulsars"
    echo "  help          - Show this help"
    echo "  quit          - Exit"
    echo ""
    echo "The engine updates in real-time as you type commands!"
    echo ""
}

# ============================================================================
# PRESET COMMANDS
# ============================================================================

cmd_hello() {
    cmd_spawn "hello" 80 48 18 6 0.5 0.6 0
}

cmd_trinity() {
    cmd_spawn "left" 40 48 18 6 0.5 0.8 0
    cmd_spawn "center" 80 48 20 8 0.4 -0.3 2
    cmd_spawn "right" 120 48 15 4 0.7 0.6 5
}

cmd_dance() {
    cmd_spawn "dancer1" 60 48 20 8 0.8 1.2 0
    cmd_spawn "dancer2" 100 48 20 8 0.8 -1.2 5
}

# ============================================================================
# REPL
# ============================================================================

process_command() {
    local input="$1"

    [[ -z "$input" ]] && return 0

    local args=($input)
    local cmd="${args[0]}"

    case "$cmd" in
        spawn)
            cmd_spawn "${args[@]:1}"
            ;;
        run)
            cmd_run "${args[1]:-60}"
            ;;
        stop)
            cmd_stop
            ;;
        view)
            cmd_view
            ;;
        kill)
            cmd_kill "${args[1]}"
            ;;
        list)
            cmd_list
            ;;
        hello)
            cmd_hello
            ;;
        trinity)
            cmd_trinity
            ;;
        dance)
            cmd_dance
            ;;
        help|h|\?)
            cmd_help
            ;;
        quit|exit|q)
            return 1
            ;;
        *)
            echo "Unknown command: $cmd (type 'help')"
            ;;
    esac

    return 0
}

repl_loop() {
    echo ""
    text_color "66FFFF"
    echo "⚡ PULSAR TGP REPL"
    reset_color
    echo ""
    echo "Live game engine with real-time REPL control!"
    echo "Type 'help' for commands"
    echo ""

    trap stop_engine EXIT INT TERM

    while true; do
        local status="💤"
        local count="${#SPRITE_IDS[@]}"

        # Check if engine still running
        if [[ -n "$ENGINE_PID" ]] && kill -0 "$ENGINE_PID" 2>/dev/null; then
            status="⚡"
        fi

        read -e -p "$status pulsar[$count] ▶ " input || break

        if ! process_command "$input"; then
            break
        fi
    done

    echo ""
    echo "Goodbye! ⚡"
    echo ""
}

# ============================================================================
# MAIN
# ============================================================================

main() {
    # Start engine
    start_engine || exit 1

    # Run REPL
    repl_loop
}

main "$@"
