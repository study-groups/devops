#!/usr/bin/env bash

# Game Module - Entry Point
# Tetra game engine for terminal-based games

# Global check
if [[ -z "$TETRA_SRC" ]]; then
    echo "Error: TETRA_SRC must be set" >&2
    return 1
fi

# Module paths
GAME_SRC="${GAME_SRC:-$TETRA_SRC/bash/game}"
export GAME_SRC

# Global state - declare before sourcing components
# Entity system globals
declare -g -a GAME_ENTITIES
declare -g -A GAME_ENTITY_DATA
declare -g -A GAME_ENTITY_UPDATE_FN
declare -g -A GAME_ENTITY_RENDER_FN
declare -g GAME_ENTITY_NEXT_ID=1

# Screen buffer globals
declare -g -A GAME_SCREEN_CELLS
declare -g GAME_SCREEN_WIDTH=80
declare -g GAME_SCREEN_HEIGHT=24

# Source dependencies from tetra modules
if [[ -f "$TETRA_SRC/bash/color/color.sh" ]]; then
    source "$TETRA_SRC/bash/color/color.sh"
else
    echo "Warning: Color module not found, colors may not work" >&2
fi

if [[ -f "$TETRA_SRC/bash/tds/tds.sh" ]]; then
    source "$TETRA_SRC/bash/tds/tds.sh"
else
    echo "Warning: TDS module not found, some features may not work" >&2
fi

if [[ -f "$TETRA_SRC/bash/tcurses/tcurses_input.sh" ]]; then
    source "$TETRA_SRC/bash/tcurses/tcurses_input.sh"
else
    echo "Warning: tcurses module not found, input may be limited" >&2
fi

# Source game engine components
source "$GAME_SRC/core/timing.sh"
source "$GAME_SRC/core/entities.sh"
source "$GAME_SRC/core/game_loop.sh"
source "$GAME_SRC/animation/tweening.sh"
source "$GAME_SRC/animation/pulsar.sh"
source "$GAME_SRC/rendering/screen.sh"
source "$GAME_SRC/rendering/draw.sh"

# Source diagnostics and input detection
source "$GAME_SRC/core/input_detect.sh"
source "$GAME_SRC/core/doctor.sh"

# Pulsar is now a separate module at $TETRA_SRC/bash/pulsar
# Set flag to false - load pulsar module separately if needed
export GAME_PULSAR_AVAILABLE=false

# Source game REPL (launcher for all games)
source "$GAME_SRC/game_repl.sh"

# Source demos
source "$GAME_SRC/demos/quadrapole.sh"

# Source Pulsar demos (if available)
if [[ "$GAME_PULSAR_AVAILABLE" == "true" ]]; then
    source "$GAME_SRC/demos/quadrapole_3d.sh"
fi

# Game module initialized
export GAME_LOADED=true
export GAME_VERSION="1.0.0"

# Main game command interface
game() {
    local cmd="${1:-help}"
    shift

    case "$cmd" in
        "quadrapole-bash")
            quadrapole_run "$@"
            ;;
        "quadrapole"|"quadrapole-gfx")
            if [[ "$GAME_PULSAR_AVAILABLE" == "true" ]]; then
                quadrapole_3d_run "$@"
            else
                echo "ERROR: Pulsar engine not available. Build the C engine first:" >&2
                echo "  cd $GAME_SRC/engine && make" >&2
                return 1
            fi
            ;;
        "repl")
            # Launch main game launcher REPL
            game_repl_run "$@"
            ;;
        "doctor"|"status"|"check")
            game_doctor
            ;;
        "help"|"-h"|"--help")
            game_help
            ;;
        "version")
            game_version
            ;;
        *)
            echo "Unknown game command: $cmd" >&2
            echo "Run 'game help' for available commands" >&2
            return 1
            ;;
    esac
}

# Show help
game_help() {
    cat << EOF
Game Module - Tetra Game Engine
================================

Usage: game <command> [options]

Commands:
  repl                    Launch game selector (interactive launcher)
  quadrapole              Run the Quadrapole demo (CURRENT - with NEW mechanics!)
  quadrapole-bash         Run the Quadrapole demo (original bash renderer, for posterity)
  doctor                  Run system diagnostics (engine, terminal, gamepad, dependencies)
  help                    Show this help message
  version                 Show version information

Examples:
  game repl               # Launch game selector (recommended)
  game quadrapole         # Launch Quadrapole directly (NEW mechanics with Pulsar C engine)
  game quadrapole-bash    # Launch original Quadrapole (bash renderer, legacy)
  game help               # Show help

Game Controls:
  q                       Quit current game
  p                       Pause/resume
  h                       Toggle help overlay
  1                       Toggle debug panel
  2                       Toggle event log

Quadrapole Mechanics (NEW!):
  WASD                    Left stick (move bonded pair, or pulsar A when split)
  IJKL                    Right stick (triggers split with contrary motion, or pulsar B when split)
  Move sticks OPPOSITE directions for 1.5s to SPLIT the pair

Module Info:
  GAME_SRC:               $GAME_SRC
  GAME_VERSION:           $GAME_VERSION
  PULSAR_AVAILABLE:       $GAME_PULSAR_AVAILABLE

Dependencies:
  - bash/color            Color system
  - bash/tds              Display system
  - bash/tcurses          Input handling

Optional (Pulsar Engine):
  - engine/bin/pulsar     C game engine (build with 'make -C $GAME_SRC/engine')
EOF
}

# Show version
game_version() {
    echo "Game Module v$GAME_VERSION"
    echo "GAME_SRC: $GAME_SRC"
    echo "TETRA_SRC: $TETRA_SRC"
}

# Export main command
export -f game
export -f game_help
export -f game_version

# Module complete message
echo "Game module loaded (v$GAME_VERSION)" >&2
