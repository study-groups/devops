#!/usr/bin/env bash
# Estovox - Facial Animation and Articulation System
# Main module entry point for Tetra framework

ESTOVOX_MOD_VERSION="0.1.0"
ESTOVOX_MOD_DIR="${BASH_SOURCE[0]%/*}"

# === MODULE INTERFACE ===

estovox_module_init() {
    # Source core components
    source "$ESTOVOX_MOD_DIR/core/state.sh" || return 1
    source "$ESTOVOX_MOD_DIR/presets/phonemes.sh" || return 1
    source "$ESTOVOX_MOD_DIR/presets/expressions.sh" || return 1
    source "$ESTOVOX_MOD_DIR/tui/renderer.sh" || return 1
    source "$ESTOVOX_MOD_DIR/core/animation.sh" || return 1
    source "$ESTOVOX_MOD_DIR/repl/commands.sh" || return 1

    # Initialize state
    estovox_init_state

    return 0
}

estovox_module_info() {
    cat <<EOF
Module: Estovox
Version: $ESTOVOX_MOD_VERSION
Description: Facial animation and IPA-based articulation system

Features:
  - IPA phoneme articulation
  - Facial expression presets
  - Real-time animation with interpolation
  - TUI rendering with TDS components
  - Interactive REPL interface

Usage:
  estovox              - Start interactive REPL
  estovox demo         - Run demonstration
  estovox help         - Show help

Commands (in REPL):
  ph <ipa>             - Articulate phoneme
  expr <name>          - Show expression
  say <text>           - Simple text-to-speech
  help                 - Full command list
EOF
}

estovox_demo() {
    echo "Starting Estovox demo..."

    # Initialize
    estovox_module_init || return 1
    estovox_init_screen

    trap 'estovox_restore_screen' EXIT

    estovox_start_animation

    # Demo sequence
    local -a demo_sequence=(
        "neutral:500"
        "happy:1000"
        "neutral:300"
        "a:300"
        "i:300"
        "u:300"
        "rest:300"
        "surprised:800"
        "neutral:500"
    )

    estovox_play_sequence "${demo_sequence[@]}"

    estovox_stop_animation
    sleep 1

    estovox_restore_screen
}

# === MAIN ENTRY POINT ===

estovox() {
    local cmd=${1:-repl}
    shift || true

    case $cmd in
        repl)
            source "$ESTOVOX_MOD_DIR/repl/estovox_repl.sh"
            estovox_repl
            ;;
        demo)
            estovox_demo
            ;;
        init)
            estovox_module_init
            ;;
        info)
            estovox_module_info
            ;;
        help|--help|-h)
            estovox_module_info
            ;;
        version|--version|-v)
            echo "Estovox v$ESTOVOX_MOD_VERSION"
            ;;
        *)
            echo "Unknown command: $cmd" >&2
            echo "Try: estovox help" >&2
            return 1
            ;;
    esac
}

# Auto-init when sourced
if [[ "${BASH_SOURCE[0]}" != "${0}" ]]; then
    estovox_module_init
fi

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    estovox "$@"
fi
