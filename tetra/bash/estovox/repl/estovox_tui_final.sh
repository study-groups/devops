#!/usr/bin/env bash
# Estovox TUI - Proper implementation using Tetra patterns
# Single-threaded, double-buffered, modal interface

MOD_SRC="${BASH_SOURCE[0]%/*}/.."

# Source dependencies
source "$MOD_SRC/core/state.sh"
source "$MOD_SRC/presets/phonemes.sh"
source "$MOD_SRC/presets/expressions.sh"
source "$MOD_SRC/core/animation.sh"
source "$MOD_SRC/repl/commands.sh"
source "$MOD_SRC/tui/modes.sh"
source "$MOD_SRC/tui/renderer.sh"
source "$MOD_SRC/tui/ipa_chart.sh"

# Try to use tcurses if available
if [[ -f "$TETRA_SRC/bash/tcurses/tcurses.sh" ]]; then
    source "$TETRA_SRC/bash/tcurses/tcurses.sh"
    source "$TETRA_SRC/bash/tcurses/tcurses_buffer.sh"
    source "$TETRA_SRC/bash/tcurses/tcurses_input.sh"
    ESTOVOX_USE_TCURSES=1
else
    ESTOVOX_USE_TCURSES=0
fi

# === STATE ===

ESTOVOX_TUI_RUNNING=0
ESTOVOX_TUI_SAVED_STTY=""

# === INIT/CLEANUP ===

estovox_tui_init() {
    estovox_init_state
    estovox_set_mode "interactive"

    # Save terminal state
    ESTOVOX_TUI_SAVED_STTY=$(stty -g)

    # Setup screen
    tput smcup
    tput civis
    tput clear

    # Raw input mode
    stty -echo -icanon min 1 time 0

    trap estovox_tui_cleanup INT TERM EXIT

    if (( ESTOVOX_USE_TCURSES )); then
        tcurses_buffer_init
    fi
}

estovox_tui_cleanup() {
    ESTOVOX_TUI_RUNNING=0

    # Restore terminal
    [[ -n "$ESTOVOX_TUI_SAVED_STTY" ]] && stty "$ESTOVOX_TUI_SAVED_STTY"

    tput rmcup
    tput cnorm
}

# === RENDERING ===

estovox_tui_render_face() {
    local center_x=$((COLUMNS / 2))
    local center_y=8

    # Get characters based on state
    local eyebrow_char_l=$(estovox_get_eyebrow_char "$ESTOVOX_EYEBROW_L_ARCH" 1)
    local eyebrow_char_r=$(estovox_get_eyebrow_char "$ESTOVOX_EYEBROW_R_ARCH" 0)
    local eye_char_l=$(estovox_get_eye_char "$ESTOVOX_EYE_L_OPENNESS")
    local eye_char_r=$(estovox_get_eye_char "$ESTOVOX_EYE_R_OPENNESS")
    local mouth_char=$(estovox_get_mouth_shape)

    # Render directly with tput positioning
    # Eyebrows
    tput cup $((center_y - 3)) $((center_x - 12))
    printf "%s%s%s" "$eyebrow_char_l" "$eyebrow_char_l" "$eyebrow_char_l"

    tput cup $((center_y - 3)) $((center_x + 9))
    printf "%s%s%s" "$eyebrow_char_r" "$eyebrow_char_r" "$eyebrow_char_r"

    # Eyes
    tput cup $((center_y)) $((center_x - 10))
    printf "%s" "$eye_char_l"

    tput cup $((center_y)) $((center_x + 10))
    printf "%s" "$eye_char_r"

    # Mouth
    tput cup $((center_y + 4)) $((center_x))
    printf "%s" "$mouth_char"
}

estovox_tui_render_status() {
    tput cup $((LINES - 8)) 0
    tput el
    printf "JAW:%.3f RND:%.3f CRN:%.3f TNG_H:%.3f TNG_F:%.3f" \
        "$ESTOVOX_JAW_OPENNESS" "$ESTOVOX_LIP_ROUNDING" \
        "$ESTOVOX_LIP_CORNER_HEIGHT" "$ESTOVOX_TONGUE_HEIGHT" \
        "$ESTOVOX_TONGUE_FRONTNESS"
}

estovox_tui_render_mode_bar() {
    tput cup $((LINES - 4)) 0
    tput el
    if estovox_is_mode "command"; then
        echo "COMMAND MODE - Type commands ('ipa' chart, 'int' interactive, 'quit')"
    else
        echo "INTERACTIVE - WS:Jaw IK:Tongue JL:TngFB QE:Lips R:Reset ::Cmd"
    fi
}

estovox_tui_render_full() {
    # Don't clear - just update in place
    # Face (top)
    estovox_tui_render_face

    # Status panel
    tput cup $((LINES - 8)) 0
    estovox_tui_render_status

    # Mode bar
    tput cup $((LINES - 4)) 0
    estovox_tui_render_mode_bar

    # Prompt area (if command mode)
    if estovox_is_mode "command"; then
        tput cup $((LINES - 1)) 0
        echo -n "estovox> "
    fi

    # Force output flush
    tput cup $((LINES - 1)) 0
}

# === INPUT HANDLING ===

estovox_tui_read_key() {
    local key=""
    if read -rsn1 -t 0.01 key 2>/dev/null; then
        echo "$key"
    fi
}

estovox_tui_handle_interactive_key() {
    local key=$1
    local step=0.1

    case "$key" in
        w) estovox_set_param "ESTOVOX_JAW_OPENNESS" "$(bc -l <<< "$ESTOVOX_JAW_OPENNESS - $step")" ;;
        s) estovox_set_param "ESTOVOX_JAW_OPENNESS" "$(bc -l <<< "$ESTOVOX_JAW_OPENNESS + $step")" ;;
        i) estovox_set_param "ESTOVOX_TONGUE_HEIGHT" "$(bc -l <<< "$ESTOVOX_TONGUE_HEIGHT + $step")" ;;
        k) estovox_set_param "ESTOVOX_TONGUE_HEIGHT" "$(bc -l <<< "$ESTOVOX_TONGUE_HEIGHT - $step")" ;;
        j) estovox_set_param "ESTOVOX_TONGUE_FRONTNESS" "$(bc -l <<< "$ESTOVOX_TONGUE_FRONTNESS - $step")" ;;
        l) estovox_set_param "ESTOVOX_TONGUE_FRONTNESS" "$(bc -l <<< "$ESTOVOX_TONGUE_FRONTNESS + $step")" ;;
        q) estovox_set_param "ESTOVOX_LIP_ROUNDING" "$(bc -l <<< "$ESTOVOX_LIP_ROUNDING + $step")" ;;
        e) estovox_set_param "ESTOVOX_LIP_CORNER_HEIGHT" "$(bc -l <<< "$ESTOVOX_LIP_CORNER_HEIGHT + $step")" ;;
        r) estovox_reset_state ;;
        1) estovox_apply_preset "i" 0.3 ;;
        2) estovox_apply_preset "e" 0.3 ;;
        3) estovox_apply_preset "a" 0.3 ;;
        4) estovox_apply_preset "o" 0.3 ;;
        5) estovox_apply_preset "u" 0.3 ;;
        :) estovox_set_mode "command"; return 1 ;;
    esac
    return 0
}

# === MAIN LOOP ===

estovox_tui_loop() {
    ESTOVOX_TUI_RUNNING=1

    # Initial render
    estovox_tui_render_full

    local last_update=0

    while (( ESTOVOX_TUI_RUNNING )); do
        # Render every iteration (already throttled by sleep)
        estovox_update_frame
        estovox_tui_render_full

        if estovox_is_mode "interactive"; then
            # Interactive mode - ensure raw mode
            stty -echo -icanon min 0 time 0 2>/dev/null

            # Process single keys
            local key=$(estovox_tui_read_key)
            if [[ -n "$key" ]]; then
                # Debug: log keypresses
                echo "KEY:$key JAW:$ESTOVOX_JAW_OPENNESS" >> /tmp/estovox_debug.log
                estovox_tui_handle_interactive_key "$key"
                echo "AFTER JAW:$ESTOVOX_JAW_OPENNESS" >> /tmp/estovox_debug.log
                if ! estovox_is_mode "interactive"; then
                    # Switched modes, full redraw
                    estovox_tui_render_full
                fi
            fi

        else
            # Command mode - show prompt
            tput cup $((LINES - 1)) 0
            tput el
            echo -n "estovox> "

            # Enable echo for typing
            stty echo icanon 2>/dev/null
            local line=""
            if read -t 0.1 -r line 2>/dev/null; then
                # Back to raw mode
                stty -echo -icanon 2>/dev/null

                case "$line" in
                    ""|" ") ;;
                    ipa|chart)
                        estovox_render_ipa_chart
                        tput clear
                        estovox_tui_render_full
                        ;;
                    int|interactive)
                        estovox_set_mode "interactive"
                        stty -echo -icanon min 0 time 0 2>/dev/null
                        estovox_tui_render_full
                        ;;
                    help|controls)
                        estovox_render_controls_help
                        tput clear
                        estovox_tui_render_full
                        ;;
                    quit|exit|q)
                        ESTOVOX_TUI_RUNNING=0
                        ;;
                    *)
                        read -ra cmd <<< "$line"
                        local out=$(estovox_process_command "${cmd[@]}" 2>&1)
                        local code=$?
                        if (( code == 99 )); then
                            ESTOVOX_TUI_RUNNING=0
                        elif [[ -n "$out" ]]; then
                            tput cup $((LINES - 2)) 0
                            tput el
                            echo -n "$out"
                            sleep 1
                        fi
                        ;;
                esac
            else
                # Timeout - back to raw mode
                stty -echo -icanon 2>/dev/null
            fi
        fi

        sleep 0.01
    done
}

# === ENTRY POINT ===

estovox_tui() {
    estovox_tui_init
    estovox_tui_loop
    return 0
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    estovox_tui
fi
