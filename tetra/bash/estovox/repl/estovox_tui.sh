#!/usr/bin/env bash
# Estovox TUI - Full interactive interface with modes
# Command mode and Interactive mode like org

# === INITIALIZATION ===

estovox_tui_init() {
    # Source dependencies
    local mod_src="${BASH_SOURCE[0]%/*}/.."

    source "$mod_src/core/state.sh" || return 1
    source "$mod_src/presets/phonemes.sh" || return 1
    source "$mod_src/presets/expressions.sh" || return 1
    source "$mod_src/tui/renderer.sh" || return 1
    source "$mod_src/tui/modes.sh" || return 1
    source "$mod_src/tui/ipa_chart.sh" || return 1
    source "$mod_src/tui/keyboard.sh" || return 1
    source "$mod_src/tui/status_bar.sh" || return 1
    source "$mod_src/core/animation.sh" || return 1
    source "$mod_src/repl/commands.sh" || return 1

    # Initialize state
    estovox_init_state

    # Start in command mode
    estovox_set_mode "command"

    # Setup terminal
    estovox_init_screen
    stty -echo  # Disable echo for clean input

    # Trap cleanup
    trap estovox_tui_cleanup INT TERM EXIT

    return 0
}

estovox_tui_cleanup() {
    estovox_stop_animation
    sleep 0.1
    stty echo  # Re-enable echo
    estovox_restore_screen
}

# === COMMAND MODE ===

estovox_command_mode_prompt() {
    local prompt_y=$((LINES - 1))
    tput cup "$prompt_y" 0
    tput el
    echo -n "estovox> "
}

estovox_command_mode_loop() {
    estovox_command_mode_prompt

    while estovox_is_mode "command"; do
        # Read command with timeout to keep rendering
        local line=""
        if IFS= read -e -r -t 0.1 line 2>/dev/null; then
            if [[ -n "$line" ]]; then
                # Handle special TUI commands
                case "$line" in
                    ipa)
                        estovox_render_ipa_chart
                        ;;
                    controls|help)
                        estovox_render_controls_help
                        ;;
                    interactive|int)
                        estovox_set_mode "interactive"
                        break
                        ;;
                    *)
                        # Parse and execute command
                        read -ra cmd_array <<< "$line"
                        local output
                        output=$(estovox_process_command "${cmd_array[@]}" 2>&1)
                        local exit_code=$?

                        # Check for exit
                        if (( exit_code == 99 )); then
                            ESTOVOX_RUNNING=0
                            return 0
                        fi

                        # Show result briefly
                        if (( exit_code != 0 )) || [[ -n "$output" ]]; then
                            local result_y=$((LINES - 2))
                            tput cup "$result_y" 0
                            tput el
                            if (( exit_code != 0 )); then
                                echo -n "ERROR: $output"
                            else
                                echo -n "$output"
                            fi
                            sleep 1
                            tput cup "$result_y" 0
                            tput el
                        fi
                        ;;
                esac
            fi

            estovox_command_mode_prompt
        fi

        # Check for ESC key to switch to interactive
        local key=$(estovox_read_key)
        if [[ "$key" == "ESC"* ]] || [[ "$key" == $'\x1b' ]]; then
            estovox_set_mode "interactive"
            break
        fi
    done
}

# === INTERACTIVE MODE ===

estovox_interactive_mode_loop() {
    # Clear command prompt area
    local prompt_y=$((LINES - 1))
    tput cup "$prompt_y" 0
    tput el

    while estovox_is_mode "interactive"; do
        local key=$(estovox_read_key)

        if [[ -n "$key" ]]; then
            local result=$(estovox_process_interactive_key "$key")

            # Check if switching modes
            if estovox_is_mode "command"; then
                break
            fi
        fi
    done
}

# === MAIN LOOP ===

estovox_tui_render_loop() {
    while (( ESTOVOX_RUNNING )); do
        estovox_update_frame
        estovox_render_frame
        estovox_render_status_bar
        sleep $(bc -l <<< "$ESTOVOX_FRAME_TIME_MS / 1000")
    done
}

estovox_tui_input_loop() {
    while (( ESTOVOX_RUNNING )); do
        if estovox_is_mode "command"; then
            estovox_command_mode_loop
        elif estovox_is_mode "interactive"; then
            estovox_interactive_mode_loop
        fi

        # Small sleep to prevent tight loop
        sleep 0.01
    done
}

estovox_tui_main() {
    # Start rendering loop in background
    estovox_tui_render_loop &
    local render_pid=$!

    # Show welcome message
    local msg_y=$((LINES / 2 + 6))
    tput cup "$msg_y" 0
    echo "Welcome to Estovox! Starting in COMMAND mode."
    echo "Type 'help' for help, 'ipa' for IPA chart, 'interactive' to switch modes"
    sleep 2

    # Clear welcome message
    tput cup "$msg_y" 0
    tput el
    tput cup $((msg_y + 1)) 0
    tput el

    # Run input loop in foreground
    ESTOVOX_RUNNING=1
    estovox_tui_input_loop

    # Cleanup
    ESTOVOX_RUNNING=0
    kill "$render_pid" 2>/dev/null
    wait "$render_pid" 2>/dev/null

    return 0
}

# === ENTRY POINT ===

estovox_tui() {
    if ! estovox_tui_init; then
        echo "Failed to initialize Estovox TUI" >&2
        return 1
    fi

    estovox_tui_main

    return 0
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    estovox_tui
fi
