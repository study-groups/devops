#!/usr/bin/env bash
# REPL Mode Detection
# Determines input mode (simple/readline) - execution mode is always hybrid

# Input mode: how input is read
repl_detect_mode() {
    # Readline mode if tcurses available and interactive terminal
    if [[ -t 0 && -e /dev/tty ]] && command -v tcurses_input_read_line >/dev/null 2>&1; then
        echo "readline"
        return
    fi

    # Fallback to simple
    echo "simple"
}

# Execution mode is always hybrid (shell by default, /slash for module)
# This function exists for compatibility but always returns "hybrid"
repl_get_execution_mode() {
    echo "hybrid"
}

# Check if in hybrid mode (always true)
repl_is_hybrid() {
    return 0
}

# Legacy compatibility - deprecated but kept for gradual migration
repl_is_augment() {
    return 0
}

export -f repl_detect_mode
export -f repl_get_execution_mode
export -f repl_is_hybrid
export -f repl_is_augment
