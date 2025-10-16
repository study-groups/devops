#!/usr/bin/env bash
# Pre-flight check before sourcing tetra
# Run this to see current shell state and potential conflicts

LOG="/tmp/tetra_preflight_$(date +%Y%m%d_%H%M%S).log"

echo "=== Tetra Pre-flight Check ===" | tee "$LOG"
echo "Time: $(date)" | tee -a "$LOG"
echo "" | tee -a "$LOG"

echo "--- Shell Information ---" | tee -a "$LOG"
echo "Shell: $SHELL" | tee -a "$LOG"
echo "Bash Version: $BASH_VERSION" | tee -a "$LOG"
echo "Interactive: [[ \$- == *i* ]] = $([[ "$-" == *i* ]] && echo YES || echo NO)" | tee -a "$LOG"
echo "Shell options: $-" | tee -a "$LOG"
echo "" | tee -a "$LOG"

echo "--- Current Environment ---" | tee -a "$LOG"
echo "TETRA_DIR=${TETRA_DIR:-unset}" | tee -a "$LOG"
echo "TETRA_SRC=${TETRA_SRC:-unset}" | tee -a "$LOG"
echo "TETRA_BOOTLOADER_LOADED=${TETRA_BOOTLOADER_LOADED:-unset}" | tee -a "$LOG"
echo "PROMPT_COMMAND=${PROMPT_COMMAND:-unset}" | tee -a "$LOG"
echo "PS1=${PS1:-unset}" | tee -a "$LOG"
echo "" | tee -a "$LOG"

echo "--- Function Conflicts ---" | tee -a "$LOG"
if declare -F | grep -E 'tetra|tmod|rag|tsm' >/dev/null; then
    echo "⚠ Existing tetra-related functions found:" | tee -a "$LOG"
    declare -F | grep -E 'tetra|tmod|rag|tsm' | tee -a "$LOG"
else
    echo "✓ No tetra function conflicts" | tee -a "$LOG"
fi
echo "" | tee -a "$LOG"

echo "--- Alias Conflicts ---" | tee -a "$LOG"
if alias | grep -E 'tetra|tmod|rag|tsm|ttr' >/dev/null 2>&1; then
    echo "⚠ Existing tetra-related aliases found:" | tee -a "$LOG"
    alias | grep -E 'tetra|tmod|rag|tsm|ttr' | tee -a "$LOG"
else
    echo "✓ No alias conflicts" | tee -a "$LOG"
fi
echo "" | tee -a "$LOG"

echo "--- Environment Variable Pollution ---" | tee -a "$LOG"
if env | grep -E '^TETRA_' | grep -v 'TETRA_DIR\|TETRA_SRC' >/dev/null; then
    echo "⚠ Other TETRA_* variables found:" | tee -a "$LOG"
    env | grep '^TETRA_' | grep -v 'TETRA_DIR\|TETRA_SRC' | tee -a "$LOG"
else
    echo "✓ No variable pollution" | tee -a "$LOG"
fi
echo "" | tee -a "$LOG"

echo "--- File Checks ---" | tee -a "$LOG"
if [[ ! -d "$HOME/tetra" ]]; then
    echo "✗ Missing: ~/tetra directory" | tee -a "$LOG"
elif [[ ! -f "$HOME/tetra/tetra.sh" ]]; then
    echo "✗ Missing: ~/tetra/tetra.sh" | tee -a "$LOG"
else
    echo "✓ Found: ~/tetra/tetra.sh" | tee -a "$LOG"
fi

if [[ ! -d "$HOME/src/devops/tetra" ]]; then
    echo "✗ Missing: ~/src/devops/tetra" | tee -a "$LOG"
else
    echo "✓ Found: ~/src/devops/tetra" | tee -a "$LOG"
fi
echo "" | tee -a "$LOG"

echo "--- Recommendations ---" | tee -a "$LOG"
if [[ "${TETRA_BOOTLOADER_LOADED:-}" != "" ]]; then
    echo "⚠ Tetra already loaded in this shell (PID ${TETRA_BOOTLOADER_LOADED})" | tee -a "$LOG"
    echo "  Consider using: tetra_reload (or ttr)" | tee -a "$LOG"
    echo "  Or start a fresh shell" | tee -a "$LOG"
fi

if [[ "${PROMPT_COMMAND:-}" != "" ]] && [[ "${PROMPT_COMMAND}" != "tetra_prompt" ]]; then
    echo "⚠ Existing PROMPT_COMMAND: $PROMPT_COMMAND" | tee -a "$LOG"
    echo "  This might conflict with tetra's prompt" | tee -a "$LOG"
    echo "  Tetra will override this" | tee -a "$LOG"
fi

echo "" | tee -a "$LOG"
echo "=== Check Complete ===" | tee -a "$LOG"
echo "Log saved to: $LOG"
echo ""
echo "Next steps:"
echo "1. If conflicts found, start a fresh shell"
echo "2. Try: source ~/tetra/safe_source_tetra.sh --debug"
echo "3. If still crashes, check: $LOG"
