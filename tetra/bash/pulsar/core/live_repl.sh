#!/usr/bin/env bash
# Pulsar Live REPL - REPL with real-time C engine rendering
# The C engine runs and renders continuously while you interact via REPL

set -euo pipefail

# Source dependencies
source ~/tetra/tetra.sh
source "$TETRA_SRC/bash/color/repl_colors.sh"

# Game-specific modules
PULSAR_GAME_SRC="$GAME_SRC/games/pulsar"
source "$PULSAR_GAME_SRC/pulsar.sh"
source "$PULSAR_GAME_SRC/pulsar_help.sh"

# ============================================================================
# STATE
# ============================================================================

declare -g PULSAR_LIVE_ENGINE_STARTED=0
declare -g PULSAR_LIVE_GRID_W=160
declare -g PULSAR_LIVE_GRID_H=96
declare -A PULSAR_LIVE_SPRITE_IDS  # name -> id mapping

# ============================================================================
# ENGINE MANAGEMENT
# ============================================================================

start_live_engine() {
    if pulsar_running; then
        echo "⚠️  Engine already running (PID: $_PULSAR_PID)"
        return 0
    fi

    echo ""
    text_color "66FFFF"
    echo "⚡ PULSAR ENGINE v1.0"
    reset_color
    echo ""
    echo "  Starting engine..."

    # Start engine
    pulsar_start "$PULSAR_LIVE_GRID_W" "$PULSAR_LIVE_GRID_H" 2>/dev/null || {
        echo ""
        echo "  ❌ Failed to start engine"
        return 1
    }

    PULSAR_LIVE_ENGINE_STARTED=1
    echo "  ✓ Engine running (PID: $_PULSAR_PID)"
    echo "  ✓ Grid initialized: ${PULSAR_LIVE_GRID_W}×${PULSAR_LIVE_GRID_H}"
    echo ""
    echo "  The engine is now accepting commands while idle."
    echo "  Type 'run' to start the visual animation."
    echo ""
}

stop_live_engine() {
    if [[ "$PULSAR_LIVE_ENGINE_STARTED" != "1" ]]; then
        echo "⚠️  Engine not running"
        return 0
    fi

    echo ""
    echo "  🛑 Stopping engine (PID: $_PULSAR_PID)..."

    pulsar_stop 2>/dev/null || {
        echo "  ⚠️  Error during shutdown"
    }

    PULSAR_LIVE_ENGINE_STARTED=0
    PULSAR_LIVE_SPRITE_IDS=()
    echo "  ✓ Engine stopped"
    echo ""
}

# ============================================================================
# COMMAND PROCESSOR
# ============================================================================

spawn_sprite() {
    local name="$1"
    shift
    local params=("$@")

    if [[ "$PULSAR_LIVE_ENGINE_STARTED" != "1" ]]; then
        echo ""
        echo "  ❌ Engine not running. Use 'start' first."
        echo ""
        return 1
    fi

    if [[ ${#params[@]} -lt 7 ]]; then
        echo ""
        echo "  ❌ Usage: spawn <name> <mx> <my> <len0> <amp> <freq> <dtheta> <valence>"
        echo ""
        return 1
    fi

    local cmd="SPAWN_PULSAR ${params[*]}"
    echo ""
    echo "  → $cmd"

    pulsar_cmd "$cmd"
    local response=$(pulsar_read_response)

    if [[ "$response" =~ ^ID[[:space:]]([0-9]+) ]]; then
        local id="${BASH_REMATCH[1]}"
        PULSAR_LIVE_SPRITE_IDS[$name]=$id
        echo "  ✓ Spawned '$name' → ID $id"
    else
        echo "  ❌ $response"
        return 1
    fi
    echo ""
}

run_animation() {
    if [[ "$PULSAR_LIVE_ENGINE_STARTED" != "1" ]]; then
        echo ""
        echo "  ❌ Engine not running. Use 'start' first."
        echo ""
        return 1
    fi

    echo ""
    text_color "66FFFF"
    echo "⚡ Starting Animation Loop"
    reset_color
    echo ""
    echo "  The C engine will now take over your terminal."
    echo "  Press 'q' in the animation to return to REPL."
    echo ""
    echo "  Starting in 2 seconds..."
    sleep 2

    # Send RUN command - this will block until user presses 'q' in the animation
    pulsar_cmd "RUN 60"

    # Wait for RUN to complete
    local response
    while read -r -u "$PULSAR_FD_OUT" response; do
        if [[ "$response" == "OK RUN_COMPLETE" ]]; then
            break
        fi
    done

    echo ""
    echo "  ✓ Animation stopped, back to REPL"
    echo ""
}

process_command() {
    local input="$1"

    # Empty input
    [[ -z "$input" ]] && return 0

    # Parse command
    local cmd_args=($input)
    local cmd="${cmd_args[0]}"

    case "$cmd" in
        start)
            start_live_engine
            ;;
        stop)
            stop_live_engine
            ;;
        restart)
            stop_live_engine
            start_live_engine
            ;;
        status)
            echo ""
            if [[ "$PULSAR_LIVE_ENGINE_STARTED" == "1" ]]; then
                echo "  ⚡ Engine Status: Running"
                echo "  ├─ PID: $_PULSAR_PID"
                echo "  ├─ Grid: ${PULSAR_LIVE_GRID_W}×${PULSAR_LIVE_GRID_H}"
                echo "  └─ Sprites: ${#PULSAR_LIVE_SPRITE_IDS[@]} active"

                if [[ ${#PULSAR_LIVE_SPRITE_IDS[@]} -gt 0 ]]; then
                    echo ""
                    echo "  Active sprites:"
                    for name in "${!PULSAR_LIVE_SPRITE_IDS[@]}"; do
                        echo "    • $name → ID ${PULSAR_LIVE_SPRITE_IDS[$name]}"
                    done
                fi
            else
                echo "  💤 Engine Status: Stopped"
                echo "  └─ Use 'start' to launch engine"
            fi
            echo ""
            ;;
        spawn)
            spawn_sprite "${cmd_args[@]:1}"
            ;;
        set)
            if [[ "$PULSAR_LIVE_ENGINE_STARTED" != "1" ]]; then
                echo "❌ Engine not running. Use 'start' first."
                return 1
            fi

            local target="${cmd_args[1]}"
            local key="${cmd_args[2]}"
            local value="${cmd_args[3]}"

            # Resolve name to ID
            local id="$target"
            if [[ -n "${PULSAR_LIVE_SPRITE_IDS[$target]:-}" ]]; then
                id="${PULSAR_LIVE_SPRITE_IDS[$target]}"
            fi

            local set_cmd="SET $id $key $value"
            echo "→ $set_cmd"
            pulsar_cmd "$set_cmd"
            local response=$(pulsar_read_response)
            echo "$response"
            ;;
        kill)
            if [[ "$PULSAR_LIVE_ENGINE_STARTED" != "1" ]]; then
                echo "❌ Engine not running. Use 'start' first."
                return 1
            fi

            local target="${cmd_args[1]}"
            local id="$target"
            local name=""

            if [[ -n "${PULSAR_LIVE_SPRITE_IDS[$target]:-}" ]]; then
                id="${PULSAR_LIVE_SPRITE_IDS[$target]}"
                name="$target"
            fi

            local kill_cmd="KILL $id"
            echo "→ $kill_cmd"
            pulsar_cmd "$kill_cmd"
            local response=$(pulsar_read_response)
            echo "$response"

            if [[ -n "$name" ]]; then
                unset PULSAR_LIVE_SPRITE_IDS[$name]
                echo "✓ Removed '$name' from tracking"
            fi
            ;;
        list)
            if [[ ${#PULSAR_LIVE_SPRITE_IDS[@]} -eq 0 ]]; then
                echo "No named sprites"
            else
                for name in "${!PULSAR_LIVE_SPRITE_IDS[@]}"; do
                    echo "$name → ID ${PULSAR_LIVE_SPRITE_IDS[$name]}"
                done
            fi
            ;;
        run)
            run_animation
            ;;
        hello)
            spawn_sprite "hello" 80 48 18 6 0.5 0.6 0
            ;;
        trinity)
            spawn_sprite "left" 40 48 18 6 0.5 0.8 0
            spawn_sprite "center" 80 48 20 8 0.4 -0.3 2
            spawn_sprite "right" 120 48 15 4 0.7 0.6 5
            ;;
        dance)
            spawn_sprite "dancer1" 60 48 20 8 0.8 1.2 0
            spawn_sprite "dancer2" 100 48 20 8 0.8 -1.2 5
            ;;
        help|h|\?)
            echo ""
            echo "Commands:"
            echo "  start      - Start the Pulsar engine"
            echo "  stop       - Stop the engine"
            echo "  status     - Show engine status"
            echo "  spawn      - Spawn a pulsar sprite"
            echo "  set        - Set sprite property"
            echo "  kill       - Kill a sprite"
            echo "  list       - List all named sprites"
            echo "  run        - Start the animation loop"
            echo "  hello      - Quick spawn: single cyan pulsar"
            echo "  trinity    - Quick spawn: three pulsars"
            echo "  dance      - Quick spawn: two counter-rotating pulsars"
            echo "  help       - Show this help"
            echo "  quit       - Exit REPL"
            echo ""
            ;;
        quit|exit|q)
            return 1
            ;;
        *)
            echo "❌ Unknown command: $cmd"
            echo "   Type 'help' for available commands"
            ;;
    esac

    return 0
}

# ============================================================================
# REPL LOOP
# ============================================================================

repl_loop() {
    echo ""
    text_color "66FFFF"
    echo "⚡ PULSAR LIVE REPL v1.0"
    reset_color
    echo ""
    echo "Interactive REPL with real-time C engine rendering"
    echo "Type 'help' for commands, 'start' to begin"
    echo ""

    # Set cleanup handler
    trap 'stop_live_engine 2>/dev/null' EXIT

    while true; do
        # Build prompt
        local status_symbol="💤"
        local sprite_count="${#PULSAR_LIVE_SPRITE_IDS[@]}"

        if [[ "$PULSAR_LIVE_ENGINE_STARTED" == "1" ]]; then
            status_symbol="⚡"
        fi

        local prompt="$status_symbol pulsar"
        if [[ "$PULSAR_LIVE_ENGINE_STARTED" == "1" ]]; then
            prompt+="[$sprite_count]"
        fi
        prompt+=" ▶ "

        # Read input
        read -e -p "$prompt" input

        # Process command
        if ! process_command "$input"; then
            break
        fi
    done

    echo ""
    echo "Goodbye! ⚡"
    echo ""
}

# ============================================================================
# ENTRY POINT
# ============================================================================

pulsar_live_repl_run() {
    repl_loop
}

# Export
export -f pulsar_live_repl_run

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    pulsar_live_repl_run
fi
