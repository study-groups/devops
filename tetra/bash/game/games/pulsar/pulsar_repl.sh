#!/usr/bin/env bash
# Pulsar REPL - Interactive Engine Protocol Shell
# Integrates with bash/repl, TSM, and TDS

# Source dependencies (follow module hierarchy)
# bash/repl - Universal REPL system
source "$TETRA_SRC/bash/repl/repl.sh"

# bash/color - Color system (loaded by repl.sh, but explicit for clarity)
source "$TETRA_SRC/bash/color/repl_colors.sh"

# bash/tds - Display system (borders and layout only)
TDS_SRC="${TETRA_SRC}/bash/tds"
if [[ -f "$TDS_SRC/layout/borders.sh" ]]; then
    # Load only what we need: ANSI utilities and borders
    source "$TDS_SRC/core/ansi.sh"
    source "$TDS_SRC/layout/borders.sh"
else
    echo "Warning: TDS borders not found, layout may not align" >&2
fi

# Game-specific modules
PULSAR_GAME_SRC="$GAME_SRC/games/pulsar"
source "$PULSAR_GAME_SRC/pulsar.sh"
source "$PULSAR_GAME_SRC/pulsar_help.sh"

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
    text_color "66FFFF"
    echo "⚡ PULSAR ENGINE v1.0"
    reset_color
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
# HELP SYSTEM (using bash/tree via pulsar_help.sh)
# ============================================================================

pulsar_repl_show_help() {
    local topic="${1:-pulsar}"
    # Delegate to pulsar_help (uses bash/tree for 18-line pagination)
    pulsar_help "$topic"
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
        help\ *|h\ *)
            # Help with topic: "help engine", "help sprite", etc.
            local topic="${input#help }"
            topic="${topic#h }"
            pulsar_repl_show_help "$topic"
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

pulsar_game_repl_run() {
    # Register module
    repl_register_module "pulsar" "start stop restart status spawn set kill list hello trinity dance load" "help.game.pulsar"
    repl_set_module_context "pulsar"

    echo ""
    text_color "66FFFF"
    echo "⚡ PULSAR REPL v1.0"
    reset_color
    echo ""
    echo "Type 'help' for commands, 'start' to begin"
    echo ""

    # Set cleanup handler
    trap 'pulsar_repl_stop_engine 2>/dev/null' EXIT

    # Override REPL callbacks with pulsar-specific implementations
    repl_build_prompt() { _pulsar_repl_build_prompt "$@"; }
    repl_process_input() { _pulsar_repl_process_input "$@"; }
    export -f repl_build_prompt repl_process_input

    # Run unified REPL loop (provides /help, /theme, /mode, /exit commands)
    repl_run

    # Cleanup
    unset -f repl_build_prompt repl_process_input

    echo ""
    echo "Goodbye! ⚡"
    echo ""
}

# Export main function
export -f pulsar_game_repl_run
