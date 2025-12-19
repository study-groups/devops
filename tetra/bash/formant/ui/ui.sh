#!/usr/bin/env bash
# Formant UI - Facial Animation and Articulation System
# Flax engine-based TUI

FORMANT_UI_VERSION="1.0.0"
FORMANT_UI_DIR="${BASH_SOURCE[0]%/*}"

# =============================================================================
# ENTRY POINT
# =============================================================================

formant_ui_run() {
    local cmd=${1:-tui}
    shift 2>/dev/null || true

    case $cmd in
        tui|"")
            source "$FORMANT_UI_DIR/flax_ui.sh"
            formant_flax_start
            ;;
        ipa)
            source "$FORMANT_UI_DIR/render/ipa_chart.sh"
            formant_render_ipa_chart
            ;;
        help|--help|-h|info)
            formant_ui_help
            ;;
        version|--version|-v)
            echo "Formant UI v$FORMANT_UI_VERSION (flax-based)"
            ;;
        *)
            echo "Unknown command: $cmd" >&2
            echo "Try: formant ui help" >&2
            return 1
            ;;
    esac
}

formant_ui_help() {
    cat <<EOF
Formant UI v$FORMANT_UI_VERSION
Facial animation and IPA-based articulation system
Engine: Flax (buffer-based terminal rendering)

Usage:
  formant ui           - Start TUI (default)
  formant ui ipa       - Show IPA chart
  formant ui help      - Show this help

Keyboard Controls (Interactive Mode):
  W/S                  - Jaw open/close
  I/K                  - Tongue height up/down
  J/L                  - Tongue front/back
  q                    - Lip rounding
  E                    - Lip corner (smile)
  1-5                  - Quick vowels (i,e,a,o,u)
  R                    - Reset to neutral
  :                    - Enter command mode
  D                    - Toggle debug overlay
  Q (Shift)            - Quit

Commands (: to enter command mode):
  ph <ipa>             - Articulate phoneme
  expr <name>          - Apply expression
  reset                - Reset to neutral
  quit                 - Exit
EOF
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    formant_ui_run "$@"
fi
