#!/usr/bin/env bash
# Estovox REPL - Main Interface
# Interactive Read-Eval-Print Loop for facial animation control

# === INITIALIZATION ===

estovox_repl_init() {
    # Source dependencies
    local mod_src="${BASH_SOURCE[0]%/*}/.."

    source "$mod_src/core/state.sh" || return 1
    source "$mod_src/presets/phonemes.sh" || return 1
    source "$mod_src/presets/expressions.sh" || return 1
    source "$mod_src/tui/renderer.sh" || return 1
    source "$mod_src/core/animation.sh" || return 1
    source "$mod_src/repl/commands.sh" || return 1

    # Initialize state
    estovox_init_state

    # Setup terminal
    estovox_init_screen

    # Trap cleanup
    trap estovox_repl_cleanup INT TERM EXIT

    return 0
}

estovox_repl_cleanup() {
    estovox_stop_animation
    sleep 0.1
    estovox_restore_screen
}

# === REPL PROMPT ===

estovox_repl_prompt() {
    local prompt_y=$((LINES - 2))
    tput cup "$prompt_y" 0
    tput el  # Clear line
    echo -n "estovox> "
}

estovox_repl_show_result() {
    local result=$1
    local is_error=${2:-0}

    if [[ -n "$result" ]]; then
        local result_y=$((LINES - 1))
        tput cup "$result_y" 0
        tput el

        if (( is_error )); then
            echo -n "ERROR: $result"
        else
            echo -n "$result"
        fi

        sleep 2
        tput cup "$result_y" 0
        tput el
    fi
}

# === MAIN LOOP ===

estovox_repl_main() {
    # Start animation loop
    estovox_start_animation

    # Initial render
    sleep 0.1
    estovox_repl_prompt

    # Command loop
    while true; do
        # Read command with readline support
        local line
        if IFS= read -e -r line 2>/dev/null; then
            if [[ -n "$line" ]]; then
                # Parse command
                read -ra cmd_array <<< "$line"

                # Process command
                local output
                output=$(estovox_process_command "${cmd_array[@]}" 2>&1)
                local exit_code=$?

                # Check for exit
                if (( exit_code == 99 )); then
                    break
                fi

                # Show result
                if (( exit_code != 0 )); then
                    estovox_repl_show_result "$output" 1
                elif [[ -n "$output" ]]; then
                    estovox_repl_show_result "$output" 0
                fi
            fi
        else
            # EOF or read error
            break
        fi

        # Re-display prompt
        estovox_repl_prompt
    done

    # Cleanup
    estovox_stop_animation
}

# === ENTRY POINT ===

estovox_repl() {
    if ! estovox_repl_init; then
        echo "Failed to initialize Estovox REPL" >&2
        return 1
    fi

    estovox_repl_main

    return 0
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    estovox_repl
fi
