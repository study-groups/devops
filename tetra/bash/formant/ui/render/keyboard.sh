#!/usr/bin/env bash
# Estovox Keyboard Input Handler
# Real-time keyboard controls for interactive mode

# Control sensitivity
ESTOVOX_CONTROL_STEP=0.05
ESTOVOX_CONTROL_FAST_STEP=0.1

# === KEYBOARD INPUT ===

estovox_read_key() {
    local key=""

    # Read single character with timeout
    if IFS= read -rsn1 -t 0.05 key 2>/dev/null; then
        # Handle escape sequences for arrow keys
        if [[ "$key" == $'\x1b' ]]; then
            read -rsn2 -t 0.01 key2
            echo "ESC${key2}"
        else
            echo "$key"
        fi
    fi
}

# === CONTROL MAPPING ===

estovox_process_interactive_key() {
    local key=$1
    local step=${2:-$ESTOVOX_CONTROL_STEP}

    case $key in
        # JAW CONTROL (WASD)
        w|W)
            # Jaw up (close)
            local current=$(estovox_get_param "ESTOVOX_JAW_OPENNESS")
            local new_value=$(bc -l <<< "$current - $step")
            estovox_set_param "ESTOVOX_JAW_OPENNESS" "$new_value"
            return 0
            ;;
        s|S)
            # Jaw down (open)
            local current=$(estovox_get_param "ESTOVOX_JAW_OPENNESS")
            local new_value=$(bc -l <<< "$current + $step")
            estovox_set_param "ESTOVOX_JAW_OPENNESS" "$new_value"
            return 0
            ;;

        # TONGUE CONTROL (IJKL)
        i|I)
            # Tongue up
            local current=$(estovox_get_param "ESTOVOX_TONGUE_HEIGHT")
            local new_value=$(bc -l <<< "$current + $step")
            estovox_set_param "ESTOVOX_TONGUE_HEIGHT" "$new_value"
            return 0
            ;;
        k|K)
            # Tongue down
            local current=$(estovox_get_param "ESTOVOX_TONGUE_HEIGHT")
            local new_value=$(bc -l <<< "$current - $step")
            estovox_set_param "ESTOVOX_TONGUE_HEIGHT" "$new_value"
            return 0
            ;;
        j|J)
            # Tongue back
            local current=$(estovox_get_param "ESTOVOX_TONGUE_FRONTNESS")
            local new_value=$(bc -l <<< "$current - $step")
            estovox_set_param "ESTOVOX_TONGUE_FRONTNESS" "$new_value"
            return 0
            ;;
        l|L)
            # Tongue forward
            local current=$(estovox_get_param "ESTOVOX_TONGUE_FRONTNESS")
            local new_value=$(bc -l <<< "$current + $step")
            estovox_set_param "ESTOVOX_TONGUE_FRONTNESS" "$new_value"
            return 0
            ;;

        # LIP CONTROL (QE)
        q|Q)
            # Lip round
            local current=$(estovox_get_param "ESTOVOX_LIP_ROUNDING")
            local new_value=$(bc -l <<< "$current + $step")
            estovox_set_param "ESTOVOX_LIP_ROUNDING" "$new_value"
            return 0
            ;;
        e|E)
            # Lip spread (smile)
            local current=$(estovox_get_param "ESTOVOX_LIP_CORNER_HEIGHT")
            local new_value=$(bc -l <<< "$current + $step")
            estovox_set_param "ESTOVOX_LIP_CORNER_HEIGHT" "$new_value"
            return 0
            ;;

        # SPECIAL CONTROLS
        r|R)
            # Reset
            estovox_reset_state
            return 0
            ;;

        # MODE SWITCHING
        :)
            # Enter command mode
            estovox_set_mode "command"
            return 1
            ;;

        ESC|$'\x1b')
            # ESC key - return to interactive
            if estovox_is_mode "command"; then
                estovox_set_mode "interactive"
                return 1
            fi
            ;;

        # QUICK PHONEMES (number keys)
        1) estovox_apply_preset "i" 0.3; return 0 ;;
        2) estovox_apply_preset "e" 0.3; return 0 ;;
        3) estovox_apply_preset "a" 0.3; return 0 ;;
        4) estovox_apply_preset "o" 0.3; return 0 ;;
        5) estovox_apply_preset "u" 0.3; return 0 ;;

        # EXPRESSIONS (F keys would be here if we could detect them)

        *)
            # Unknown key
            return 2
            ;;
    esac
}

# === INPUT LOOP ===

estovox_keyboard_loop() {
    while (( ESTOVOX_RUNNING )); do
        local key=$(estovox_read_key)

        if [[ -n "$key" ]]; then
            if estovox_is_mode "interactive"; then
                estovox_process_interactive_key "$key"
            fi
        fi
    done
}
