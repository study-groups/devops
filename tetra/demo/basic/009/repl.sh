#!/usr/bin/env bash

# TUI REPL System - Bottom CLI Interface
# Responsibility: CLI positioning at bottom, input handling, line length control
# Never clears screen - only uses bottom region

# REPL state
REPL_HISTORY=()
REPL_HISTORY_INDEX=-1
REPL_INPUT=""
REPL_CURSOR_VISIBLE=true

# Get dynamic prompt based on current context
get_repl_prompt() {
    local env="${ENVIRONMENTS[$ENV_INDEX],,}"
    local mode="${MODES[$MODE_INDEX],,}"
    echo "${env}:${mode}> "
}

# Show REPL prompt left-aligned above footer with solid cursor
show_repl_prompt() {
    local prompt=$(get_repl_prompt)

    # Position at REPL line (left-aligned)
    position_repl_input
    printf "%s%s" "$prompt" "$REPL_INPUT"

    # Show solid cursor
    if [[ "$REPL_CURSOR_VISIBLE" == "true" ]]; then
        printf "█"
    fi

    # Clear rest of line
    tput el
}

# Execute REPL command
execute_repl_command() {
    local input="$1"

    # Add to history
    REPL_HISTORY+=("$input")
    REPL_HISTORY_INDEX=${#REPL_HISTORY[@]}

    # Move to next line for output
    printf "\n"

    # Process command
    case "$input" in
        "exit"|"q"|"quit")
            return 1  # Signal to exit REPL
            ;;
        "help"|"h")
            show_repl_help
            ;;
        "clear"|"c")
            clear_cli_region
            update_content_region
            ;;
        "ls"|"list")
            show_actions_list
            ;;
        env*)
            local env_name="${input#env }"
            switch_environment "$env_name"
            ;;
        mode*)
            local mode_name="${input#mode }"
            switch_mode "$mode_name"
            ;;
        fire*)
            local action_name="${input#fire }"
            fire_action "$action_name"
            ;;
        *)
            printf "Unknown command: %s (type 'help' for commands)\n" "$input"
            ;;
    esac

    return 0
}

# Show REPL help in content area (not CLI area)
show_repl_help() {
    CONTENT="🎮 REPL Commands:"$'\n'
    CONTENT+="  env <name>    - Switch environment (demo, local, remote)"$'\n'
    CONTENT+="  mode <name>   - Switch mode (learn, build, test)"$'\n'
    CONTENT+="  fire <action> - Execute action"$'\n'
    CONTENT+="  ls            - List current actions"$'\n'
    CONTENT+="  clear         - Clear content"$'\n'
    CONTENT+="  help          - Show this help"$'\n'
    CONTENT+="  exit          - Return to gamepad mode"

    update_content_region
}

# Show actions list in content area
show_actions_list() {
    CONTENT="📋 Available actions for ${ENVIRONMENTS[$ENV_INDEX]}:${MODES[$MODE_INDEX]}:"$'\n'
    local actions=($(get_actions))
    for action in "${actions[@]}"; do
        CONTENT+="  • $action"$'\n'
    done

    update_content_region
}

# Switch environment via REPL
switch_environment() {
    local env_name="${1,,}"  # lowercase
    for i in "${!ENVIRONMENTS[@]}"; do
        if [[ "${ENVIRONMENTS[$i],,}" == "$env_name" ]]; then
            ENV_INDEX=$i
            ACTION_INDEX=0
            printf "Environment switched to: %s\n" "${ENVIRONMENTS[$ENV_INDEX]}"
            update_content_region
            return
        fi
    done
    printf "Unknown environment: %s\n" "$env_name"
}

# Switch mode via REPL
switch_mode() {
    local mode_name="${1,,}"  # lowercase
    for i in "${!MODES[@]}"; do
        if [[ "${MODES[$i],,}" == "$mode_name" ]]; then
            MODE_INDEX=$i
            ACTION_INDEX=0
            printf "Mode switched to: %s\n" "${MODES[$MODE_INDEX]}"
            update_content_region
            return
        fi
    done
    printf "Unknown mode: %s\n" "$mode_name"
}

# Fire action via REPL
fire_action() {
    local action_name="$1"
    local actions=($(get_actions))
    for i in "${!actions[@]}"; do
        if [[ "${actions[$i]}" == "$action_name" ]]; then
            ACTION_INDEX=$i
            printf "Executing: %s\n" "$action_name"
            execute_current_action
            return
        fi
    done
    printf "Unknown action: %s\n" "$action_name"
}

# Truncate input to prevent line wrapping
truncate_input() {
    local input="$1"
    local max_length="$2"

    if [[ ${#input} -gt $max_length ]]; then
        echo "${input:0:$max_length}"
    else
        echo "$input"
    fi
}

# Handle character input for REPL
handle_repl_char() {
    local key="$1"
    local term_width=${COLUMNS:-80}

    case "$key" in
        $'\n'|$'\r')  # Enter - execute command
            if [[ -n "$REPL_INPUT" ]]; then
                # Add to history
                REPL_HISTORY+=("$REPL_INPUT")
                REPL_HISTORY_INDEX=${#REPL_HISTORY[@]}

                # Execute command
                local cmd="$REPL_INPUT"
                REPL_INPUT=""

                # Clear prompt line before execution
                clear_repl_region

                if ! execute_repl_command "$cmd"; then
                    return 1  # Exit REPL
                fi
            fi
            ;;
        $'\177'|$'\b')  # Backspace
            if [[ ${#REPL_INPUT} -gt 0 ]]; then
                REPL_INPUT="${REPL_INPUT%?}"
            fi
            ;;
        $'\033')  # ESC - exit REPL
            return 1
            ;;
        *)  # Regular character
            if [[ -n "$key" ]] && [[ ${#key} -eq 1 ]]; then
                # Prevent wrapping by limiting input length
                local prompt=$(get_repl_prompt)
                local max_input_len=$((term_width - ${#prompt} - 10))  # Safety margin
                if [[ ${#REPL_INPUT} -lt $max_input_len ]]; then
                    REPL_INPUT+="$key"
                fi
            fi
            ;;
    esac

    return 0
}

# Main REPL loop for TUI mode
run_repl_loop() {
    # Show initial content update to reflect REPL mode
    CONTENT="🎯 REPL Mode Active
Type commands below, ESC to return to gamepad"
    update_content_region

    while true; do
        local prompt=$(get_repl_prompt)
        local input

        # Position at REPL line and get input
        position_repl_input

        # Use simple read with prompt
        if ! read -r -p "$prompt" input; then
            break
        fi

        # Handle ESC or empty input
        if [[ -z "$input" ]]; then
            continue
        fi

        # Check for ESC sequence (if user types 'esc' or similar)
        if [[ "$input" == "esc" || "$input" == "exit" || "$input" == "q" ]]; then
            break
        fi

        # Execute REPL commands (reuse standalone REPL logic)
        case "$input" in
            "/help")
                CONTENT="🎮 REPL Commands:
  env [name]    - Switch environment or list all
  mode [name]   - Switch mode or list all
  fire <action> - Execute action
  ls            - List current actions

🔧 Meta Commands:
  /help         - Show this help
  /status       - Show system status
  /commands     - List all available commands
  exit/esc      - Return to gamepad mode"
                ;;
            "/status")
                CONTENT="📊 System Status:
  Environment: ${ENVIRONMENTS[$ENV_INDEX]}
  Mode: ${MODES[$MODE_INDEX]}
  Module: module/tview/$(echo "${MODES[$MODE_INDEX]}" | tr '[:upper:]' '[:lower:]')
  Actions: $(get_actions | wc -w) available
  REPL: v009 TUI mode"
                ;;
            "env")
                CONTENT="🌍 Available environments:"
                for i in "${!ENVIRONMENTS[@]}"; do
                    if [[ $i -eq $ENV_INDEX ]]; then
                        CONTENT+="
  • ${ENVIRONMENTS[$i]} (current)"
                    else
                        CONTENT+="
  • ${ENVIRONMENTS[$i]}"
                    fi
                done
                CONTENT+="
Usage: env <name>"
                ;;
            env*)
                local env_name="${input#env }"
                env_name="${env_name// /}"
                env_name="${env_name,,}"
                local found=false
                for i in "${!ENVIRONMENTS[@]}"; do
                    if [[ "${ENVIRONMENTS[$i],,}" == "$env_name" ]]; then
                        ENV_INDEX=$i
                        ACTION_INDEX=0
                        CONTENT="Environment switched to: ${ENVIRONMENTS[$ENV_INDEX]}"
                        found=true
                        break
                    fi
                done
                if [[ "$found" == "false" ]]; then
                    CONTENT="Unknown environment: $env_name
Available: ${ENVIRONMENTS[*],,}"
                fi
                ;;
            "mode")
                CONTENT="🔧 Available modes:"
                for i in "${!MODES[@]}"; do
                    if [[ $i -eq $MODE_INDEX ]]; then
                        CONTENT+="
  • ${MODES[$i]} (current)"
                    else
                        CONTENT+="
  • ${MODES[$i]}"
                    fi
                done
                CONTENT+="
Usage: mode <name>"
                ;;
            mode*)
                local mode_name="${input#mode }"
                mode_name="${mode_name// /}"
                mode_name="${mode_name,,}"
                local found=false
                for i in "${!MODES[@]}"; do
                    if [[ "${MODES[$i],,}" == "$mode_name" ]]; then
                        MODE_INDEX=$i
                        ACTION_INDEX=0
                        CONTENT="Mode switched to: ${MODES[$MODE_INDEX]}"
                        found=true
                        break
                    fi
                done
                if [[ "$found" == "false" ]]; then
                    CONTENT="Unknown mode: $mode_name
Available: ${MODES[*],,}"
                fi
                ;;
            "ls")
                CONTENT="📋 Available actions for ${ENVIRONMENTS[$ENV_INDEX]}:${MODES[$MODE_INDEX]}:"
                local actions=($(get_actions))
                for action in "${actions[@]}"; do
                    CONTENT+="
  • $action"
                done
                ;;
            fire*)
                local action_name="${input#fire }"
                local actions=($(get_actions))
                local found=false
                for i in "${!actions[@]}"; do
                    if [[ "${actions[$i]}" == "$action_name" ]]; then
                        ACTION_INDEX=$i
                        execute_current_action
                        found=true
                        break
                    fi
                done
                if [[ "$found" == "false" ]]; then
                    CONTENT="Unknown action: $action_name
Available: ${actions[*]}"
                fi
                ;;
            *)
                CONTENT="Unknown command: $input
Type '/help' for commands, 'exit' to return to gamepad"
                ;;
        esac

        # Update content region with results
        update_content_region
    done

    # Clean up and return to gamepad mode
    switch_to_gamepad_mode
    clear_repl_region
}