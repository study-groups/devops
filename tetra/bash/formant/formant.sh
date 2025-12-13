#!/usr/bin/env bash
# Formant Module - Main Loader
#
# Architecture:
#   formant-ui    - Face state management, TUI rendering, IPC sender
#   formant-synth - C synthesis engine, IPC receiver, audio output
#
# Structure:
#   ui/           - UI components (from estovox)
#   synth/        - Synthesis engine (C code + bash wrapper)

[[ -n "$_FORMANT_MAIN_LOADED" ]] && return 0
_FORMANT_MAIN_LOADED=1

# ============================================================================
# UI LOADER
# ============================================================================

formant_ui_load() {
    source "$FORMANT_SRC/ui/core/state.sh"
    source "$FORMANT_SRC/ui/core/presets/expressions.sh" 2>/dev/null || true
    source "$FORMANT_SRC/ui/core/presets/phonemes.sh" 2>/dev/null || true
    source "$FORMANT_SRC/ui/ui.sh"
}

# ============================================================================
# SYNTH LOADER
# ============================================================================

formant_synth_load() {
    source "$FORMANT_SRC/synth/synth.sh"
}

# ============================================================================
# MAIN ENTRY POINTS
# ============================================================================

# Start UI (face controller)
formant_ui() {
    formant_ui_load
    formant_ui_main "$@"
}

# Start synth engine
formant_synth() {
    formant_synth_load
    formant_synth_main "$@"
}

# Start both (UI spawns synth)
formant_start() {
    formant_ui_load
    formant_synth_load
    formant_ui_main --with-synth "$@"
}

# REPL mode
formant_repl() {
    source "$FORMANT_SRC/synth/formant_repl.sh"
    formant_repl_run "$@"
}

# Export functions
export -f formant_ui formant_synth formant_start formant_repl
