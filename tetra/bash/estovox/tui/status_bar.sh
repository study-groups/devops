#!/usr/bin/env bash
# Estovox Status Bar
# Display current mode and control hints

estovox_render_status_bar() {
    local mode=$ESTOVOX_MODE
    local bar_y=$((LINES - 8))

    # Mode-specific status
    tput cup "$bar_y" 0
    tput el

    case $mode in
        interactive)
            cat <<EOF
╔══════════════════════════════════════════════════════════════════════════╗
║ MODE: INTERACTIVE                                                        ║
║ WASD: Jaw  |  IJKL: Tongue  |  Q: Round  |  E: Spread  |  R: Reset      ║
║ 1-5: Vowels (i,e,a,o,u)  |  :: Command Mode  |  Ctrl+C: Quit            ║
╚══════════════════════════════════════════════════════════════════════════╝
EOF
            ;;
        command)
            cat <<EOF
╔══════════════════════════════════════════════════════════════════════════╗
║ MODE: COMMAND                                                            ║
║ Enter commands below. Type 'help' for help, 'ipa' for chart             ║
║ ESC: Interactive Mode  |  Ctrl+C: Quit                                   ║
╚══════════════════════════════════════════════════════════════════════════╝
EOF
            ;;
        ipa_chart)
            # IPA chart handles its own rendering
            ;;
    esac
}

estovox_render_mini_status() {
    # Minimal status line
    local status_y=$((LINES - 2))
    tput cup "$status_y" 0
    tput el

    local mode_display="[$ESTOVOX_MODE]"

    if estovox_is_mode "interactive"; then
        echo -n "$mode_display W/S:Jaw I/K:Tongue Q/E:Lips :cmd R:reset"
    elif estovox_is_mode "command"; then
        echo -n "$mode_display Type command (help, ipa, quit, ESC:interactive)"
    fi
}
