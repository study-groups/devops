#!/usr/bin/env bash
# Formant Module - Main Loader
#
# Architecture:
#   formant ui    - Face state management, TUI rendering, IPC sender
#   formant synth - C synthesis engine, IPC receiver, audio output
#
# Structure:
#   ui/           - UI components (formerly estovox)
#   synth/        - Synthesis engine (C code + bash wrapper)

[[ -n "$_FORMANT_MAIN_LOADED" ]] && return 0
_FORMANT_MAIN_LOADED=1

# ============================================================================
# UI LOADER
# ============================================================================

formant_ui_load() {
    source "$FORMANT_SRC/ui/ui.sh"
}

# ============================================================================
# SYNTH LOADER
# ============================================================================

formant_synth_load() {
    source "$FORMANT_SRC/synth/synth.sh"
}

# ============================================================================
# MAIN ENTRY POINT
# ============================================================================

formant() {
    local cmd=${1:-help}
    shift 2>/dev/null || true

    case $cmd in
        ui|tui)
            formant_ui_load
            formant_ui_run "$@"
            ;;
        synth)
            formant_synth_load
            formant_start "$@"
            ;;
        stop)
            formant_stop
            ;;
        demo)
            formant_ui_load
            formant_ui_run demo
            ;;
        help|--help|-h)
            cat <<'EOF'
Formant - Audio-visual synthesis module

Usage: formant <command> [args]

Commands:
  ui, tui     Start face controller TUI
  synth       Start synthesis engine
  stop        Stop synthesis engine
  demo        Run demonstration

UI subcommands (formant ui <cmd>):
  tui         Full TUI with modes (default)
  repl        Simple command-only REPL
  ipa         Show IPA chart
  help        Show UI help

Synth functions (after formant synth):
  formant_phoneme <ipa> [duration] [pitch]
  formant_stop
EOF
            ;;
        *)
            echo "Unknown command: $cmd" >&2
            echo "Try: formant help" >&2
            return 1
            ;;
    esac
}

export -f formant
