#!/usr/bin/env bash
# This script must be SOURCED in your interactive terminal
# It will capture state before attempting to source tetra
# Usage: source ~/tetra/capture_terminal_state.sh

LOG="/tmp/tetra_terminal_state_$(date +%Y%m%d_%H%M%S).log"

{
    echo "=== Terminal State Capture ==="
    echo "Time: $(date)"
    echo ""

    echo "--- Shell State ---"
    echo "Shell: $SHELL"
    echo "Bash Version: $BASH_VERSION"
    echo "Interactive: $([[ "$-" == *i* ]] && echo YES || echo NO)"
    echo "Shell options: $-"
    echo "PID: $$"
    echo "PPID: $PPID"
    echo ""

    echo "--- Terminal Info ---"
    echo "TERM: ${TERM:-unset}"
    echo "TTY: $(tty 2>/dev/null || echo 'not a tty')"
    echo "Columns x Rows: ${COLUMNS:-?} x ${LINES:-?}"
    echo ""

    echo "--- Current Prompt State ---"
    echo "PROMPT_COMMAND: ${PROMPT_COMMAND:-unset}"
    echo "PS1: ${PS1:-unset}"
    echo "PS2: ${PS2:-unset}"
    echo ""

    echo "--- Tetra State ---"
    echo "TETRA_DIR: ${TETRA_DIR:-unset}"
    echo "TETRA_SRC: ${TETRA_SRC:-unset}"
    echo "TETRA_BOOTLOADER_LOADED: ${TETRA_BOOTLOADER_LOADED:-unset}"
    echo ""

    echo "--- Existing Functions (tetra-related) ---"
    declare -F | grep -E 'tetra|tmod|rag|tsm' || echo "None"
    echo ""

    echo "--- Set Options (relevant) ---"
    shopt | grep -E 'extdebug|promptvars|histappend|checkwinsize'
    echo ""

    echo "--- Trap Handlers ---"
    trap -p DEBUG || echo "No DEBUG trap"
    trap -p RETURN || echo "No RETURN trap"
    trap -p ERR || echo "No ERR trap"
    echo ""

} | tee "$LOG"

echo "State captured to: $LOG"
echo ""
echo "Now try ONE of these options:"
echo ""
echo "Option A - Test with trace (may produce lots of output):"
echo "  set -x"
echo "  source ~/tetra/tetra.sh"
echo "  # If it crashes, the trace will be in your terminal scrollback"
echo ""
echo "Option B - Test with error capture:"
echo "  source ~/tetra/tetra.sh 2>&1 | tee /tmp/tetra_crash.log"
echo ""
echo "Option C - Test with timeout safety:"
echo "  (source ~/tetra/tetra.sh && echo 'SUCCESS') &"
echo "  SPID=\$!"
echo "  sleep 2"
echo "  if kill -0 \$SPID 2>/dev/null; then"
echo "    echo 'Still running after 2s, may be hung'"
echo "    kill \$SPID"
echo "  fi"
echo ""
echo "Option D - Just try it (but it will close your terminal!):"
echo "  source ~/tetra/tetra.sh"
