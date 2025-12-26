#!/usr/bin/env bash

# MIDI REPL Monitor - Pure event display, no commands
# Displays OSC MIDI events in configurable formats

# Display modes
MIDI_REPL_MODE="${MIDI_REPL_MODE:-both}"

# OSC connection
MIDI_OSC_MULTICAST="${MIDI_OSC_MULTICAST:-239.1.1.1}"
MIDI_OSC_PORT="${MIDI_OSC_PORT:-1983}"

# State for prompt
REPL_CONTROLLER=""
REPL_INSTANCE=0
REPL_VARIANT=""
REPL_VARIANT_NAME=""
REPL_LAST_CC=""
REPL_LAST_VAL=""
REPL_LAST_SEMANTIC=""

# Colors
C_DIM="\033[2m"
C_CYAN="\033[36m"
C_YELLOW="\033[33m"
C_GREEN="\033[32m"
C_MAGENTA="\033[35m"
C_NC="\033[0m"

# Build prompt
midi_monitor_prompt() {
    local prompt=""

    # OSC connection (dim)
    prompt+="${C_DIM}[${MIDI_OSC_MULTICAST}:${MIDI_OSC_PORT}]${C_NC} "

    # Controller and variant
    if [[ -n "$REPL_CONTROLLER" && -n "$REPL_VARIANT" ]]; then
        prompt+="${C_CYAN}[${REPL_CONTROLLER}"
        if [[ "$REPL_INSTANCE" != "0" ]]; then
            prompt+="[$REPL_INSTANCE]"
        fi
        prompt+=":${REPL_VARIANT}"
        if [[ -n "$REPL_VARIANT_NAME" ]]; then
            prompt+=" ${REPL_VARIANT_NAME}"
        fi
        prompt+="]${C_NC} "
    else
        prompt+="${C_DIM}[no-ctrl]${C_NC} "
    fi

    # Last event
    if [[ -n "$REPL_LAST_CC" && -n "$REPL_LAST_VAL" ]]; then
        prompt+="${C_YELLOW}[${REPL_LAST_CC}=${REPL_LAST_VAL}]${C_NC}"
    else
        prompt+="${C_DIM}[--]${C_NC}"
    fi

    echo -ne "$prompt"
}

# Parse OSC event and update state
midi_parse_osc_event() {
    local line="$1"

    case "$line" in
        __STATE__*)
            # Parse state: __STATE__ controller=vmx8 instance=0 variant=a ...
            local state_str="${line#__STATE__ }"
            while IFS= read -r pair; do
                local key="${pair%%=*}"
                local value="${pair#*=}"
                case "$key" in
                    controller) REPL_CONTROLLER="$value" ;;
                    instance) REPL_INSTANCE="$value" ;;
                    variant) REPL_VARIANT="$value" ;;
                    variant_name) REPL_VARIANT_NAME="$value" ;;
                    last_cc) REPL_LAST_CC="$value" ;;
                    last_val) REPL_LAST_VAL="$value" ;;
                esac
            done < <(echo "$state_str" | tr ' ' '\n')
            ;;

        __EVENT__*)
            # Parse event: __EVENT__ raw CC 1 7 64
            #           or __EVENT__ mapped a VOLUME_1 0.503937
            local event_str="${line#__EVENT__ }"
            local event_type=$(echo "$event_str" | awk '{print $1}')

            if [[ "$event_type" == "raw" ]]; then
                local msg_type=$(echo "$event_str" | awk '{print $2}')
                local channel=$(echo "$event_str" | awk '{print $3}')
                local cc=$(echo "$event_str" | awk '{print $4}')
                local val=$(echo "$event_str" | awk '{print $5}')

                if [[ "$MIDI_REPL_MODE" == "raw" || "$MIDI_REPL_MODE" == "both" ]]; then
                    echo -ne "\r\033[K"  # Clear line
                    echo -e "${C_YELLOW}${msg_type} ${C_CYAN}${channel}${C_NC}.${C_YELLOW}${cc}${C_NC}=${C_GREEN}${val}${C_NC}"
                fi
            elif [[ "$event_type" == "mapped" ]]; then
                local variant=$(echo "$event_str" | awk '{print $2}')
                local semantic=$(echo "$event_str" | awk '{print $3}')
                local val=$(echo "$event_str" | awk '{print $4}')
                REPL_LAST_SEMANTIC="$semantic"

                if [[ "$MIDI_REPL_MODE" == "semantic" || "$MIDI_REPL_MODE" == "both" ]]; then
                    echo -ne "\r\033[K"
                    echo -e "  ${C_MAGENTA}→${C_NC} ${C_CYAN}${semantic}${C_NC}=${C_GREEN}${val}${C_NC}"
                fi
            fi
            ;;
    esac
}

# Main monitor loop
midi_repl_monitor() {
    local mode="${1:-both}"
    MIDI_REPL_MODE="$mode"

    echo "MIDI Monitor | Mode: $mode | OSC: ${MIDI_OSC_MULTICAST}:${MIDI_OSC_PORT}"
    echo "Press Ctrl+C to exit"
    echo ""

    # Use C listener if available, fallback to Node.js
    local osc_cmd
    if [[ -x "$MIDI_SRC/osc_listen" ]]; then
        osc_cmd="$MIDI_SRC/osc_listen -p $MIDI_OSC_PORT -m $MIDI_OSC_MULTICAST"
    else
        osc_cmd="node $MIDI_SRC/osc_repl_listener.js -h 0.0.0.0 -p $MIDI_OSC_PORT -m $MIDI_OSC_MULTICAST"
    fi

    # Start OSC listener
    $osc_cmd 2>&1 | while IFS= read -r line; do
        # Filter out OSC listener status messages
        if [[ "$line" =~ ^"✓ OSC" ]]; then
            echo "$line" >&2
            continue
        fi

        # Parse and display events
        midi_parse_osc_event "$line"

        # Update prompt (only in silent mode)
        if [[ "$MIDI_REPL_MODE" == "silent" ]]; then
            echo -ne "\r\033[K"
            midi_monitor_prompt
        fi
    done

    echo ""
    echo "Monitor stopped"
}

# Export functions
export -f midi_repl_monitor
export -f midi_monitor_prompt
export -f midi_parse_osc_event
