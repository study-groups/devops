#!/usr/bin/env bash

# Games Module - Entry Point
# Tetra game engine for terminal-based games

# Global check
if [[ -z "$TETRA_SRC" ]]; then
    echo "Error: TETRA_SRC must be set" >&2
    return 1
fi

# Module paths
GAMES_SRC="${GAMES_SRC:-$TETRA_SRC/bash/games}"
export GAMES_SRC

# Context system (like deploy)
export GAMES_CTX_ORG=""
export GAMES_CTX_GAME=""
export GAMES_CTX_ENV=""

# Global state - declare before sourcing components
# Entity system globals
declare -g -a GAMES_ENTITIES
declare -g -A GAMES_ENTITY_DATA
declare -g -A GAMES_ENTITY_UPDATE_FN
declare -g -A GAMES_ENTITY_RENDER_FN
declare -g GAMES_ENTITY_NEXT_ID=1

# Screen buffer globals
declare -g -A GAMES_SCREEN_CELLS
declare -g GAMES_SCREEN_WIDTH=80
declare -g GAMES_SCREEN_HEIGHT=24

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
source "$GAMES_SRC/core/timing.sh"
source "$GAMES_SRC/core/entities.sh"
source "$GAMES_SRC/core/games_loop.sh"
source "$GAMES_SRC/animation/tweening.sh"
source "$GAMES_SRC/animation/pulsar.sh"
source "$GAMES_SRC/rendering/screen.sh"
source "$GAMES_SRC/rendering/draw.sh"

# Source diagnostics and input detection
source "$GAMES_SRC/core/input_detect.sh"
source "$GAMES_SRC/core/doctor.sh"

# Pulsar is now a separate module at $TETRA_SRC/bash/pulsar
# Set flag to false - load pulsar module separately if needed
export GAMES_PULSAR_AVAILABLE=false

# Source games REPL (launcher for all games)
source "$GAMES_SRC/games_repl.sh"

# Source demos
source "$GAMES_SRC/demos/quadrapole.sh"

# Source Pulsar demos (if available)
if [[ "$GAMES_PULSAR_AVAILABLE" == "true" ]]; then
    source "$GAMES_SRC/demos/quadrapole_3d.sh"
fi

# Games module initialized
export GAMES_LOADED=true
export GAMES_VERSION="1.0.0"

# =============================================================================
# CONTEXT SYSTEM
# =============================================================================

# Set organization context
games_org_set() {
    local org="$1"
    if [[ -z "$org" ]]; then
        echo "Usage: games_org_set <org>" >&2
        return 1
    fi
    export GAMES_CTX_ORG="$org"
}

# Set game context
games_game_set() {
    local game="$1"
    if [[ -z "$game" ]]; then
        echo "Usage: games_game_set <game>" >&2
        return 1
    fi
    export GAMES_CTX_GAME="$game"
}

# Set environment context
games_env_set() {
    local env="$1"
    if [[ -z "$env" ]]; then
        echo "Usage: games_env_set <env>" >&2
        return 1
    fi
    export GAMES_CTX_ENV="$env"
}

# Clear all context
games_clear_context() {
    export GAMES_CTX_ORG=""
    export GAMES_CTX_GAME=""
    export GAMES_CTX_ENV=""
}

# Show current context info
games_info() {
    echo "Games Context"
    echo "============="
    echo "  Org:  ${GAMES_CTX_ORG:-<none>}"
    echo "  Game: ${GAMES_CTX_GAME:-<none>}"
    echo "  Env:  ${GAMES_CTX_ENV:-<none>}"
    echo ""
    echo "Module Info"
    echo "==========="
    echo "  GAMES_SRC:     $GAMES_SRC"
    echo "  GAMES_VERSION: $GAMES_VERSION"
    echo "  PULSAR:        $GAMES_PULSAR_AVAILABLE"
}

# Returns org:game:env for prompt integration
_tetra_games_info() {
    local parts=()
    [[ -n "$GAMES_CTX_ORG" ]] && parts+=("$GAMES_CTX_ORG")
    [[ -n "$GAMES_CTX_GAME" ]] && parts+=("$GAMES_CTX_GAME")
    [[ -n "$GAMES_CTX_ENV" ]] && parts+=("$GAMES_CTX_ENV")

    [[ ${#parts[@]} -eq 0 ]] && return

    local IFS=":"
    echo "${parts[*]}"
}

# =============================================================================
# MAIN COMMAND INTERFACE
# =============================================================================

# Main games command interface
games() {
    local cmd="${1:-help}"
    shift

    case "$cmd" in
        "quadrapole-bash")
            quadrapole_run "$@"
            ;;
        "quadrapole"|"quadrapole-gfx")
            if [[ "$GAMES_PULSAR_AVAILABLE" == "true" ]]; then
                quadrapole_3d_run "$@"
            else
                echo "ERROR: Pulsar engine not available. Build the C engine first:" >&2
                echo "  cd $GAMES_SRC/engine && make" >&2
                return 1
            fi
            ;;
        "repl")
            # Launch main games launcher REPL
            games_repl_run "$@"
            ;;
        "doctor"|"status"|"check")
            games_doctor
            ;;
        "info")
            games_info
            ;;
        "help"|"-h"|"--help")
            games_help
            ;;
        "version")
            games_version
            ;;
        *)
            echo "Unknown games command: $cmd" >&2
            echo "Run 'games help' for available commands" >&2
            return 1
            ;;
    esac
}

# Show help
games_help() {
    cat << EOF
Games Module - Tetra Game Engine
================================

Usage: games <command> [options]

Commands:
  repl                    Launch game selector (interactive launcher)
  quadrapole              Run the Quadrapole demo (CURRENT - with NEW mechanics!)
  quadrapole-bash         Run the Quadrapole demo (original bash renderer, for posterity)
  doctor                  Run system diagnostics (engine, terminal, gamepad, dependencies)
  info                    Show current context and module info
  help                    Show this help message
  version                 Show version information

Examples:
  games repl              # Launch game selector (recommended)
  games quadrapole        # Launch Quadrapole directly (NEW mechanics with Pulsar C engine)
  games quadrapole-bash   # Launch original Quadrapole (bash renderer, legacy)
  games help              # Show help

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
  GAMES_SRC:              $GAMES_SRC
  GAMES_VERSION:          $GAMES_VERSION
  PULSAR_AVAILABLE:       $GAMES_PULSAR_AVAILABLE

Dependencies:
  - bash/color            Color system
  - bash/tds              Display system
  - bash/tcurses          Input handling

Optional (Pulsar Engine):
  - engine/bin/pulsar     C game engine (build with 'make -C $GAMES_SRC/engine')
EOF
}

# Show version
games_version() {
    echo "Games Module v$GAMES_VERSION"
    echo "GAMES_SRC: $GAMES_SRC"
    echo "TETRA_SRC: $TETRA_SRC"
}

# Export main command
export -f games
export -f games_help
export -f games_version
export -f games_info
export -f games_org_set
export -f games_game_set
export -f games_env_set
export -f games_clear_context
export -f _tetra_games_info

# Module complete message
echo "Games module loaded (v$GAMES_VERSION)" >&2
