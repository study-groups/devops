#!/usr/bin/env bash
# REPL Main Loop
# Core read-eval-print loop

repl_main_loop() {
    # Handle Ctrl-C gracefully - just print newline and continue
    trap 'printf "\n"; continue' INT

    while true; do
        # Update active history file based on current mode
        REPL_HISTORY_FILE=$(repl_get_history_file)

        # Build dynamic prompt
        # NOTE: Call prompt builder which sets global REPL_PROMPT (not via command substitution)
        # to preserve access to associative arrays like TDS_COLOR_TOKENS
        local prompt
        if command -v repl_build_prompt >/dev/null 2>&1; then
            REPL_PROMPT="> "  # Default
            repl_build_prompt  # Sets REPL_PROMPT global
            prompt="$REPL_PROMPT"
        else
            prompt="> "
        fi

        # Read input (mode-specific)
        local input
        input=$(repl_read_input "$prompt")
        local read_status=$?

        # Handle EOF (Ctrl-D) or read error
        if [[ $read_status -eq 130 ]]; then
            # 130 = interrupted by SIGINT (Ctrl-C)
            # Just continue to next iteration (trap already printed newline)
            continue
        elif [[ $read_status -ne 0 ]]; then
            # Other error or EOF (Ctrl-D)
            printf '\n'
            break
        fi

        # Skip empty input
        [[ -z "$input" ]] && continue

        # History is saved by tcurses_input_read_line in enhanced mode
        # For basic mode, we save manually to current mode's history file
        if [[ "$REPL_MODE" == "basic" && -n "$input" && -n "$REPL_HISTORY_FILE" ]]; then
            echo "$input" >> "$REPL_HISTORY_FILE"
        fi

        # Process input
        repl_process_input "$input"
        local process_status=$?

        # Handle return codes
        case $process_status in
            0)  # Continue
                continue
                ;;
            1)  # Exit
                break
                ;;
            2)  # Prompt changed (mode switch, theme change, etc), rebuild
                continue
                ;;
            *)  # Unknown status
                continue
                ;;
        esac
    done
}

export -f repl_main_loop
