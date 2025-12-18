#!/usr/bin/env bash

# Games Engine Module - Archived TUI Game Engine
# This is the original bash game engine, now archived.
# Source this file to use TUI game functionality.
#
# Usage:
#   source "$GAMES_SRC/engine/bash/engine.sh"
#   games_engine quadrapole

# Global check
if [[ -z "$TETRA_SRC" ]]; then
    echo "Error: TETRA_SRC must be set" >&2
    return 1
fi

if [[ -z "$GAMES_SRC" ]]; then
    echo "Error: GAMES_SRC must be set (load games module first)" >&2
    return 1
fi

ENGINE_SRC="$GAMES_SRC/engine/bash"
export ENGINE_SRC

# Entity system globals (GAME_ prefix to match entities.sh)
declare -g -a GAME_ENTITIES
declare -g -A GAME_ENTITY_DATA
declare -g -A GAME_ENTITY_UPDATE_FN
declare -g -A GAME_ENTITY_RENDER_FN
declare -g GAME_ENTITY_NEXT_ID=1

# Screen buffer globals (GAME_ prefix to match rendering modules)
declare -g -A GAME_SCREEN_CELLS
declare -g GAME_SCREEN_WIDTH=80
declare -g GAME_SCREEN_HEIGHT=24

# Source dependencies from tetra modules
if [[ -f "$TETRA_SRC/bash/color/color.sh" ]]; then
    source "$TETRA_SRC/bash/color/color.sh"
fi

if [[ -f "$TETRA_SRC/bash/tds/tds.sh" ]]; then
    source "$TETRA_SRC/bash/tds/tds.sh"
fi

if [[ -f "$TETRA_SRC/bash/tcurses/tcurses_input.sh" ]]; then
    source "$TETRA_SRC/bash/tcurses/tcurses_input.sh"
fi

# Source game engine components
source "$ENGINE_SRC/core/timing.sh"
source "$ENGINE_SRC/core/entities.sh"
source "$ENGINE_SRC/core/game_loop.sh"
source "$ENGINE_SRC/animation/tweening.sh"
source "$ENGINE_SRC/animation/pulsar.sh"
source "$ENGINE_SRC/rendering/screen.sh"
source "$ENGINE_SRC/rendering/draw.sh"

# Source diagnostics and input detection
source "$ENGINE_SRC/core/input_detect.sh"
source "$ENGINE_SRC/core/doctor.sh"

# Pulsar engine flag
export GAMES_PULSAR_AVAILABLE=false

# Source demos
source "$ENGINE_SRC/demos/quadrapole.sh"

# Source Pulsar demos (if available)
if [[ "$GAMES_PULSAR_AVAILABLE" == "true" ]]; then
    source "$ENGINE_SRC/demos/quadrapole_3d.sh"
fi

# Engine module initialized
export GAMES_ENGINE_LOADED=true
export GAMES_ENGINE_VERSION="1.0.0"

# =============================================================================
# ENGINE COMMAND INTERFACE
# =============================================================================

games_engine() {
    local cmd="${1:-help}"
    shift

    case "$cmd" in
        "quadrapole-bash"|"quadrapole")
            quadrapole_run "$@"
            ;;
        "quadrapole-gfx")
            if [[ "$GAMES_PULSAR_AVAILABLE" == "true" ]]; then
                quadrapole_3d_run "$@"
            else
                echo "ERROR: Pulsar engine not available. Build the C engine first:" >&2
                echo "  cd $GAMES_SRC/engine && make" >&2
                return 1
            fi
            ;;
        "repl")
            source "$ENGINE_SRC/games_repl.sh"
            games_repl_run "$@"
            ;;
        "doctor"|"status"|"check")
            games_doctor
            ;;
        "help"|"-h"|"--help")
            games_engine_help
            ;;
        *)
            echo "Unknown engine command: $cmd" >&2
            echo "Run 'games_engine help' for available commands" >&2
            return 1
            ;;
    esac
}

games_engine_help() {
    cat << EOF
Games Engine - TUI Game Engine (Archived)
==========================================

Usage: games_engine <command> [options]

Commands:
  quadrapole          Run the Quadrapole demo (bash renderer)
  quadrapole-gfx      Run Quadrapole with Pulsar C engine
  repl                Launch game selector REPL
  doctor              Run system diagnostics
  help                Show this help message

This engine is archived. For game administration, use:
  games <deploy-string>

Engine Info:
  ENGINE_SRC:    $ENGINE_SRC
  ENGINE_VERSION: $GAMES_ENGINE_VERSION
EOF
}

export -f games_engine
export -f games_engine_help

echo "Games engine loaded (v$GAMES_ENGINE_VERSION)" >&2
