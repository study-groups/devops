#!/usr/bin/env bash

# MIDI REPL Prompt Rendering
# Extracted from repl.sh for maintainability

# ============================================================================
# PROMPT RENDERING
# ============================================================================

# Build prompt string - returns the prompt for use by readline or rendering
input_mode_build_prompt() {
    # Position cursor at the prompt line (one line above status display)
    local term_height=$(tput lines 2>/dev/null || echo 24)
    local prompt_line=$((term_height - STATUS_DISPLAY_HEIGHT - 1))
    tput cup $prompt_line 0 2>/dev/null || true
    tput el 2>/dev/null || printf '\033[K'  # Clear the line

    # Read latest state from file
    if [[ -f "$REPL_STATE_FILE" ]]; then
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
                last_semantic) REPL_LAST_SEMANTIC="$value" ;;
                last_semantic_val) REPL_LAST_SEMANTIC_VAL="$value" ;;
                input_device) REPL_INPUT_DEVICE="$value" ;;
                output_device) REPL_OUTPUT_DEVICE="$value" ;;
            esac
        done < <(tr ' ' '\n' < "$REPL_STATE_FILE")
    fi

    # Build prompt components
    local ctrl_part cc_part sem_part log_part conn_part mode_indicator

    # Controller and variant - show device info when available
    if [[ -n "$REPL_CONTROLLER" && -n "$REPL_VARIANT" ]]; then
        ctrl_part="${TETRA_CYAN}[${REPL_CONTROLLER}"
        [[ "$REPL_INSTANCE" != "0" ]] && ctrl_part+="[$REPL_INSTANCE]"
        ctrl_part+=":${REPL_VARIANT}"
        [[ -n "$REPL_VARIANT_NAME" ]] && ctrl_part+=" ${REPL_VARIANT_NAME}"
        ctrl_part+="]${TETRA_NC}"
    elif [[ -n "$REPL_INPUT_DEVICE" && "$REPL_INPUT_DEVICE" != "none" ]]; then
        # Have device but no map loaded - show device name
        ctrl_part="${TETRA_YELLOW}[${REPL_INPUT_DEVICE}]${TETRA_NC}"
    else
        ctrl_part="${TETRA_DIM}[no-device]${TETRA_NC}"
    fi

    # Last CC value - show as raw MIDI data: CC40=50
    if [[ -n "$REPL_LAST_CC" && -n "$REPL_LAST_VAL" ]]; then
        local val_color="${TETRA_YELLOW}"
        [[ "$REPL_LAST_VAL" -lt 43 ]] && val_color="${TETRA_GREEN}"
        [[ "$REPL_LAST_VAL" -gt 84 ]] && val_color="${TETRA_RED}"
        cc_part="${TETRA_DIM}[CC${REPL_LAST_CC}${TETRA_NC}=${val_color}${REPL_LAST_VAL}${TETRA_NC}${TETRA_DIM}]${TETRA_NC}"
    else
        cc_part="${TETRA_DIM}[--]${TETRA_NC}"
    fi

    # Semantic mapping - dedicated magenta color for semantic names
    if [[ -n "$REPL_LAST_SEMANTIC" && -n "$REPL_LAST_SEMANTIC_VAL" ]]; then
        sem_part="${TETRA_MAGENTA}[${REPL_LAST_SEMANTIC}${TETRA_NC}=${TETRA_YELLOW}${REPL_LAST_SEMANTIC_VAL}${TETRA_NC}${TETRA_MAGENTA}]${TETRA_NC}"
    else
        sem_part=""
    fi

    # Log mode
    if [[ "$MIDI_REPL_LOG_MODE" != "off" ]]; then
        log_part="${TETRA_GREEN}[log:${MIDI_REPL_LOG_MODE}]${TETRA_NC}"
    else
        log_part="${TETRA_DIM}[log:off]${TETRA_NC}"
    fi

    # Connection (dim)
    conn_part="${TETRA_DIM}${REPL_OSC_MULTICAST}:${REPL_OSC_PORT}${TETRA_NC}"

    # Mode indicator
    mode_indicator=$(input_mode_get_indicator "bracket")
    [[ -n "$mode_indicator" ]] && mode_indicator=" $mode_indicator"

    # Return complete prompt string
    printf '%b %b %b%b %b%b %b ' \
        "$ctrl_part" "$cc_part" \
        "${sem_part:+ }${sem_part}" \
        "$log_part" "$conn_part" \
        "$mode_indicator" \
        "${TETRA_MAGENTA}>${TETRA_NC}"
}

# Render prompt - called by input mode system (for key mode)
input_mode_render_prompt() {
    # Clear current line
    printf '\r\033[K' >&2
    # Print the prompt
    input_mode_build_prompt >&2
}

# Export functions
export -f input_mode_build_prompt
export -f input_mode_render_prompt
