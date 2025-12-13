#!/usr/bin/env bash
# Estovox TUI v2 - Simplified and robust
# Single-threaded with better terminal handling

# === INITIALIZATION ===

estovox_tui_init() {
    local mod_src="${BASH_SOURCE[0]%/*}/.."

    source "$mod_src/core/state.sh" || return 1
    source "$mod_src/presets/phonemes.sh" || return 1
    source "$mod_src/presets/expressions.sh" || return 1
    source "$mod_src/tui/renderer.sh" || return 1
    source "$mod_src/tui/modes.sh" || return 1
    source "$mod_src/tui/ipa_chart.sh" || return 1
    source "$mod_src/core/animation.sh" || return 1
    source "$mod_src/repl/commands.sh" || return 1

    estovox_init_state
    estovox_set_mode "command"

    # Save terminal state
    ESTOVOX_SAVED_STTY=$(stty -g)

    # Setup terminal for raw input
    estovox_init_screen
    stty -echo -icanon time 0 min 0

    trap estovox_tui_cleanup INT TERM EXIT

    return 0
}

estovox_tui_cleanup() {
    ESTOVOX_RUNNING=0
    sleep 0.05

    # Restore terminal
    [[ -n "$ESTOVOX_SAVED_STTY" ]] && stty "$ESTOVOX_SAVED_STTY"
    estovox_restore_screen
}

# === RENDERING ===

estovox_tui_render() {
    # Update animation
    estovox_update_frame

    # Render face
    estovox_render_frame

    # Render status based on mode
    local status_y=$((LINES - 7))
    tput cup "$status_y" 0

    if estovox_is_mode "command"; then
        cat <<'EOF'
╔══════════════════════════════════════════════════════════╗
║ COMMAND MODE - Type commands (ipa, help, quit, int)     ║
╚══════════════════════════════════════════════════════════╝
EOF
    else
        cat <<'EOF'
╔══════════════════════════════════════════════════════════╗
║ INTERACTIVE - W/S:Jaw I/K:Tongue Q/E:Lips R:Reset ::Cmd  ║
╚══════════════════════════════════════════════════════════╝
EOF
    fi
}

# === COMMAND MODE ===

estovox_command_prompt() {
    tput cup $((LINES - 1)) 0
    tput el
    echo -n "estovox> "
    stty echo icanon  # Enable echo for typing
}

estovox_command_read() {
    local line=""
    estovox_command_prompt

    if read -r line; then
        stty -echo -icanon  # Back to raw mode
        echo "$line"
        return 0
    else
        stty -echo -icanon
        return 1
    fi
}

# === MAIN LOOP ===

estovox_tui_main() {
    ESTOVOX_RUNNING=1
    local last_render=0
    local render_interval=0.05  # 20fps

    tput clear

    while (( ESTOVOX_RUNNING )); do
        local now=$(date +%s%N)
        local elapsed=$(( (now - last_render) / 1000000 ))  # Convert to ms

        # Render at fixed interval
        if (( elapsed > 50 )); then
            estovox_tui_render
            last_render=$now
        fi

        if estovox_is_mode "command"; then
            # Command mode - blocking read with timeout
            tput cup $((LINES - 1)) 0
            tput el
            echo -n "estovox> "
            stty echo icanon

            if read -t 0.1 -r line 2>/dev/null; then
                stty -echo -icanon

                if [[ -n "$line" ]]; then
                    case "$line" in
                        ipa|chart)
                            estovox_render_ipa_chart
                            tput clear
                            ;;
                        int|interactive)
                            estovox_set_mode "interactive"
                            tput clear
                            ;;
                        help|controls)
                            estovox_render_controls_help
                            tput clear
                            ;;
                        quit|exit|q)
                            ESTOVOX_RUNNING=0
                            ;;
                        "")
                            # Empty line, ignore
                            ;;
                        *)
                            # Execute command
                            read -ra cmd_array <<< "$line"
                            local output
                            output=$(estovox_process_command "${cmd_array[@]}" 2>&1)
                            local code=$?

                            if (( code == 99 )); then
                                ESTOVOX_RUNNING=0
                            elif [[ -n "$output" ]]; then
                                tput cup $((LINES - 2)) 0
                                tput el
                                echo -n "$output"
                                sleep 1
                            fi
                            ;;
                    esac
                fi
            else
                stty -echo -icanon
            fi

        else
            # Interactive mode - non-blocking key read
            local key=""
            if read -rsn1 -t 0.01 key 2>/dev/null; then
                case "$key" in
                    w|W)
                        local val=$(bc -l <<< "$(estovox_get_param ESTOVOX_JAW_OPENNESS) - 0.05")
                        estovox_set_param ESTOVOX_JAW_OPENNESS "$val"
                        ;;
                    s|S)
                        local val=$(bc -l <<< "$(estovox_get_param ESTOVOX_JAW_OPENNESS) + 0.05")
                        estovox_set_param ESTOVOX_JAW_OPENNESS "$val"
                        ;;
                    i|I)
                        local val=$(bc -l <<< "$(estovox_get_param ESTOVOX_TONGUE_HEIGHT) + 0.05")
                        estovox_set_param ESTOVOX_TONGUE_HEIGHT "$val"
                        ;;
                    k|K)
                        local val=$(bc -l <<< "$(estovox_get_param ESTOVOX_TONGUE_HEIGHT) - 0.05")
                        estovox_set_param ESTOVOX_TONGUE_HEIGHT "$val"
                        ;;
                    j|J)
                        local val=$(bc -l <<< "$(estovox_get_param ESTOVOX_TONGUE_FRONTNESS) - 0.05")
                        estovox_set_param ESTOVOX_TONGUE_FRONTNESS "$val"
                        ;;
                    l|L)
                        local val=$(bc -l <<< "$(estovox_get_param ESTOVOX_TONGUE_FRONTNESS) + 0.05")
                        estovox_set_param ESTOVOX_TONGUE_FRONTNESS "$val"
                        ;;
                    q|Q)
                        local val=$(bc -l <<< "$(estovox_get_param ESTOVOX_LIP_ROUNDING) + 0.05")
                        estovox_set_param ESTOVOX_LIP_ROUNDING "$val"
                        ;;
                    e|E)
                        local val=$(bc -l <<< "$(estovox_get_param ESTOVOX_LIP_CORNER_HEIGHT) + 0.05")
                        estovox_set_param ESTOVOX_LIP_CORNER_HEIGHT "$val"
                        ;;
                    r|R)
                        estovox_reset_state
                        ;;
                    1) estovox_apply_preset "i" 0.3 ;;
                    2) estovox_apply_preset "e" 0.3 ;;
                    3) estovox_apply_preset "a" 0.3 ;;
                    4) estovox_apply_preset "o" 0.3 ;;
                    5) estovox_apply_preset "u" 0.3 ;;
                    :)
                        estovox_set_mode "command"
                        ;;
                    $'\x03')  # Ctrl+C
                        ESTOVOX_RUNNING=0
                        ;;
                esac
            fi
        fi

        # Small sleep to prevent CPU spinning
        sleep 0.01
    done
}

# === ENTRY POINT ===

estovox_tui() {
    estovox_tui_init || return 1
    estovox_tui_main
    return 0
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    estovox_tui
fi
