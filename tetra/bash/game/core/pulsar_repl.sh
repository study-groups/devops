#!/usr/bin/env bash
# Pulsar REPL - Interactive Engine Protocol Shell
# Integrates with bash/repl, TSM, and TDS

# Source dependencies
source "$TETRA_SRC/bash/repl/repl.sh"
source "$TETRA_SRC/bash/color/repl_colors.sh"
source "$GAME_SRC/core/pulsar.sh"

# REPL Configuration
REPL_HISTORY_BASE="${TETRA_DIR}/game/pulsar_repl_history"
PULSAR_REPL_OUTPUT_LOG="$TETRA_DIR/game/pulsar_repl_output.log"

# REPL State
PULSAR_REPL_GRID_W=160
PULSAR_REPL_GRID_H=96
PULSAR_REPL_ENGINE_RUNNING=0
PULSAR_REPL_LAST_ID=""
declare -A PULSAR_REPL_SPRITE_IDS  # name -> id mapping

# ============================================================================
# ENGINE MANAGEMENT (TSM-integrated)
# ============================================================================

pulsar_repl_start_engine() {
    if [[ "$PULSAR_REPL_ENGINE_RUNNING" == "1" ]]; then
        echo "⚠️  Engine already running (PID: $_PULSAR_PID)"
        return 0
    fi

    echo ""
    echo "  ╔═══════════════════════════════════════╗"
    echo "  ║   ⚡ PULSAR ENGINE v1.0              ║"
    echo "  ║   Terminal Sprite Animation System   ║"
    echo "  ╚═══════════════════════════════════════╝"
    echo ""
    echo "  Starting engine..."

    pulsar_start "$PULSAR_REPL_GRID_W" "$PULSAR_REPL_GRID_H" 2>/dev/null || {
        echo ""
        echo "  ❌ Failed to start engine"
        return 1
    }

    PULSAR_REPL_ENGINE_RUNNING=1
    echo "  ✓ Engine running (PID: $_PULSAR_PID)"
    echo "  ✓ Grid initialized: ${PULSAR_REPL_GRID_W}×${PULSAR_REPL_GRID_H}"
    echo ""
}

pulsar_repl_stop_engine() {
    if [[ "$PULSAR_REPL_ENGINE_RUNNING" != "1" ]]; then
        echo "⚠️  Engine not running"
        return 0
    fi

    echo ""
    echo "  🛑 Stopping engine (PID: $_PULSAR_PID)..."

    pulsar_stop 2>/dev/null || {
        echo "  ⚠️  Error during shutdown"
    }

    PULSAR_REPL_ENGINE_RUNNING=0
    PULSAR_REPL_SPRITE_IDS=()
    echo "  ✓ Engine stopped"
    echo "  ✓ Cleaned up ${#PULSAR_REPL_SPRITE_IDS[@]} sprite references"
    echo ""
}

pulsar_repl_status() {
    echo ""
    if [[ "$PULSAR_REPL_ENGINE_RUNNING" == "1" ]]; then
        echo "  ⚡ Engine Status: Running"
        echo "  ├─ PID: $_PULSAR_PID"
        echo "  ├─ Grid: ${PULSAR_REPL_GRID_W}×${PULSAR_REPL_GRID_H}"
        echo "  └─ Sprites: ${#PULSAR_REPL_SPRITE_IDS[@]} active"

        if [[ ${#PULSAR_REPL_SPRITE_IDS[@]} -gt 0 ]]; then
            echo ""
            echo "  Active sprites:"
            for name in "${!PULSAR_REPL_SPRITE_IDS[@]}"; do
                echo "    • $name → ID ${PULSAR_REPL_SPRITE_IDS[$name]}"
            done
        fi
    else
        echo "  💤 Engine Status: Stopped"
        echo "  └─ Use 'start' to launch engine"
    fi
    echo ""
}

# ============================================================================
# COMMAND HELPERS
# ============================================================================

pulsar_repl_send_raw() {
    local cmd="$1"

    if [[ "$PULSAR_REPL_ENGINE_RUNNING" != "1" ]]; then
        echo "❌ Engine not running. Use 'start' first."
        return 1
    fi

    pulsar_cmd "$cmd"
    local response=$(pulsar_read_response)
    echo "$response"

    # Save last ID if response contains one
    if [[ "$response" =~ ^ID[[:space:]]([0-9]+) ]]; then
        PULSAR_REPL_LAST_ID="${BASH_REMATCH[1]}"
    fi

    echo "$response"
}

pulsar_repl_spawn() {
    local name="$1"
    shift
    local params=("$@")

    if [[ "$PULSAR_REPL_ENGINE_RUNNING" != "1" ]]; then
        echo ""
        echo "  ❌ Engine not running. Use 'start' first."
        echo ""
        return 1
    fi

    # Build SPAWN_PULSAR command
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
        PULSAR_REPL_SPRITE_IDS[$name]=$id
        PULSAR_REPL_LAST_ID=$id
        echo "  ✓ Spawned '$name' → ID $id"
    else
        echo "  ❌ $response"
        return 1
    fi
    echo ""
}

pulsar_repl_set() {
    local target="$1"
    local key="$2"
    local value="$3"

    if [[ "$PULSAR_REPL_ENGINE_RUNNING" != "1" ]]; then
        echo "❌ Engine not running. Use 'start' first."
        return 1
    fi

    # Resolve name to ID
    local id="$target"
    if [[ -n "${PULSAR_REPL_SPRITE_IDS[$target]}" ]]; then
        id="${PULSAR_REPL_SPRITE_IDS[$target]}"
    fi

    local cmd="SET $id $key $value"
    echo "→ $cmd"
    pulsar_repl_send_raw "$cmd"
}

pulsar_repl_kill() {
    local target="$1"

    if [[ "$PULSAR_REPL_ENGINE_RUNNING" != "1" ]]; then
        echo "❌ Engine not running. Use 'start' first."
        return 1
    fi

    # Resolve name to ID
    local id="$target"
    local name=""
    if [[ -n "${PULSAR_REPL_SPRITE_IDS[$target]}" ]]; then
        id="${PULSAR_REPL_SPRITE_IDS[$target]}"
        name="$target"
    fi

    local cmd="KILL $id"
    echo "→ $cmd"
    pulsar_repl_send_raw "$cmd"

    # Remove from tracking
    if [[ -n "$name" ]]; then
        unset PULSAR_REPL_SPRITE_IDS[$name]
        echo "✓ Removed '$name' from tracking"
    fi
}

pulsar_repl_load_script() {
    local script_path="$1"

    if [[ ! -f "$script_path" ]]; then
        echo "❌ Script not found: $script_path"
        return 1
    fi

    if [[ "$PULSAR_REPL_ENGINE_RUNNING" != "1" ]]; then
        echo "⚠️  Starting engine first..."
        pulsar_repl_start_engine || return 1
    fi

    echo "📜 Loading script: $script_path"

    while IFS= read -r line; do
        # Skip comments and empty lines
        [[ "$line" =~ ^[[:space:]]*# ]] && continue
        [[ -z "${line// /}" ]] && continue

        # Skip INIT and RUN (engine already initialized)
        [[ "$line" =~ ^INIT ]] && continue
        [[ "$line" =~ ^RUN ]] && continue

        echo "  → $line"
        pulsar_repl_send_raw "$line"
    done < "$script_path"

    echo "✓ Script loaded"
}

# ============================================================================
# PRESET COMMANDS (Quick Spawns)
# ============================================================================

pulsar_repl_preset_hello() {
    pulsar_repl_spawn "hello" 80 48 18 6 0.5 0.6 0
}

pulsar_repl_preset_trinity() {
    pulsar_repl_spawn "left" 40 48 18 6 0.5 0.8 0
    pulsar_repl_spawn "center" 80 48 20 8 0.4 -0.3 2
    pulsar_repl_spawn "right" 120 48 15 4 0.7 0.6 5
}

pulsar_repl_preset_dance() {
    pulsar_repl_spawn "dancer1" 60 48 20 8 0.8 1.2 0
    pulsar_repl_spawn "dancer2" 100 48 20 8 0.8 -1.2 5
}

# ============================================================================
# HELP SYSTEM
# ============================================================================

pulsar_repl_show_help() {
    cat <<'HELP'

╔══════════════════════════════════════════════════════════════════════╗
║  ⚡ PULSAR REPL - Interactive Engine Protocol Shell               ║
╚══════════════════════════════════════════════════════════════════════╝

ENGINE CONTROL:
  start              Start the Pulsar engine
  stop               Stop the engine
  status             Show engine status and active sprites
  restart            Restart the engine

ENGINE PROTOCOL (Raw Commands):
  raw <command>      Send raw Engine Protocol command
  INIT <w> <h>       Initialize grid (auto-sent on start)
  SPAWN_PULSAR <mx> <my> <len0> <amp> <freq> <dtheta> <valence>
  SET <id> <key> <value>
  KILL <id>
  LIST_PULSARS       List all active sprites

HIGH-LEVEL COMMANDS:
  spawn <name> <mx> <my> <len0> <amp> <freq> <dtheta> <valence>
                     Spawn and name a pulsar for easy reference
  set <name> <key> <value>
                     Update sprite by name or ID
  kill <name>        Kill sprite by name or ID
  list               List named sprites

PRESETS (Quick Spawns):
  hello              Single cyan pulsar at center
  trinity            Three pulsars in formation
  dance              Two counter-rotating pulsars

SCRIPTS:
  load <path>        Load and execute .pql script
                     Example: load scripts/hello.pql

UTILITY:
  help, h, ?         Show this help
  status             Show engine status
  last               Show last command output
  quit, exit, q      Exit REPL
  !<cmd>             Execute shell command

EXAMPLES:
  start
  spawn mystar 80 48 18 6 0.5 0.6 0
  set mystar dtheta 1.2
  set mystar freq 0.8
  kill mystar

  trinity
  load scripts/orbit.pql

PARAMETERS:
  mx, my    - Position (microgrid: 2× terminal cells)
  len0      - Base arm length (8-30)
  amp       - Pulse amplitude (2-12)
  freq      - Pulse frequency (0.1-1.2 Hz)
  dtheta    - Rotation speed (-3.14 to 3.14 rad/s)
  valence   - Color: 0=cyan, 1=green, 2=yellow, 3=orange, 4=red, 5=magenta

HELP
}

# ============================================================================
# PROMPT BUILDER
# ============================================================================

_pulsar_repl_build_prompt() {
    local status_symbol="💤"
    local status_color="$COLOR_DIM"

    if [[ "$PULSAR_REPL_ENGINE_RUNNING" == "1" ]]; then
        status_symbol="⚡"
        status_color="$COLOR_CYAN"
    fi

    local sprite_count="${#PULSAR_REPL_SPRITE_IDS[@]}"

    # Build prompt using color system
    local tmpfile
    tmpfile=$(mktemp /tmp/pulsar_repl_prompt.XXXXXX) || return 1

    printf "%s%s%s " "$status_color" "$status_symbol" "$COLOR_RESET" > "$tmpfile"
    printf "%spulsar%s" "$COLOR_BOLD" "$COLOR_RESET" >> "$tmpfile"

    if [[ "$PULSAR_REPL_ENGINE_RUNNING" == "1" ]]; then
        printf "%s[%d]%s" "$COLOR_DIM" "$sprite_count" "$COLOR_RESET" >> "$tmpfile"
    fi

    printf " %s▶%s " "$COLOR_GREEN" "$COLOR_RESET" >> "$tmpfile"

    REPL_PROMPT=$(<"$tmpfile")
    rm -f "$tmpfile"
}

# ============================================================================
# INPUT PROCESSOR
# ============================================================================

_pulsar_repl_process_input() {
    local input="$1"

    # Empty input
    [[ -z "$input" ]] && return 0

    # Shell command
    if [[ "$input" == !* ]]; then
        eval "${input:1}"
        return 0
    fi

    # Exit commands
    case "$input" in
        exit|quit|q)
            pulsar_repl_stop_engine
            return 1
            ;;
        help|h|\?)
            pulsar_repl_show_help
            return 0
            ;;
    esac

    # Parse command
    local cmd_args=($input)
    local cmd="${cmd_args[0]}"

    case "$cmd" in
        # Engine control
        start)
            pulsar_repl_start_engine
            ;;
        stop)
            pulsar_repl_stop_engine
            ;;
        restart)
            pulsar_repl_stop_engine
            pulsar_repl_start_engine
            ;;
        status)
            pulsar_repl_status
            ;;

        # High-level commands
        spawn)
            pulsar_repl_spawn "${cmd_args[@]:1}"
            ;;
        set)
            pulsar_repl_set "${cmd_args[1]}" "${cmd_args[2]}" "${cmd_args[3]}"
            ;;
        kill)
            pulsar_repl_kill "${cmd_args[1]}"
            ;;
        list)
            if [[ ${#PULSAR_REPL_SPRITE_IDS[@]} -eq 0 ]]; then
                echo "No named sprites"
            else
                for name in "${!PULSAR_REPL_SPRITE_IDS[@]}"; do
                    echo "$name → ID ${PULSAR_REPL_SPRITE_IDS[$name]}"
                done
            fi
            ;;

        # Presets
        hello)
            pulsar_repl_preset_hello
            ;;
        trinity)
            pulsar_repl_preset_trinity
            ;;
        dance)
            pulsar_repl_preset_dance
            ;;

        # Scripts
        load)
            pulsar_repl_load_script "${cmd_args[1]}"
            ;;

        # Raw commands
        raw)
            pulsar_repl_send_raw "${input#raw }"
            ;;

        # Direct Engine Protocol commands
        INIT|SPAWN_PULSAR|SET|KILL|LIST_PULSARS|RUN|QUIT)
            pulsar_repl_send_raw "$input"
            ;;

        # Unknown
        *)
            echo "❌ Unknown command: $cmd"
            echo "   Type 'help' for available commands"
            ;;
    esac

    return 0
}

# ============================================================================
# MAIN ENTRY POINT
# ============================================================================

pulsar_repl_run() {
    echo ""
    echo "╔═══════════════════════════════════════╗"
    echo "║   ⚡ PULSAR REPL v1.0                ║"
    echo "║   Interactive Engine Protocol Shell  ║"
    echo "╚═══════════════════════════════════════╝"
    echo ""
    echo "Type 'help' for commands, 'start' to begin"
    echo ""

    # Register prompt builder
    REPL_PROMPT_BUILDERS=(_pulsar_repl_build_prompt)

    # Set cleanup handler
    trap 'pulsar_repl_stop_engine 2>/dev/null' EXIT

    # Run REPL loop
    while true; do
        # Build prompt
        _pulsar_repl_build_prompt

        # Read input
        read -e -p "$REPL_PROMPT" input

        # Add to history
        [[ -n "$input" ]] && history -s "$input"

        # Process input
        _pulsar_repl_process_input "$input" || break

        echo ""
    done

    echo ""
    echo "Goodbye! ⚡"
    echo ""
}

# Export main function
export -f pulsar_repl_run
