#!/usr/bin/env bash

# MIDI REPL - Interactive MIDI Controller Interface
# Uses Tetra's universal REPL system
#
# Architecture Overview:
#   This REPL is a CLIENT that connects to OSC broadcasts from the midi service.
#   It does NOT start the MIDI service - that's done by TSM.
#
# Service Layer (TSM-managed):
#   midi start → Reads MIDI hardware → Broadcasts OSC on :1983
#
# Client Layer (this file):
#   midi repl → Listens to OSC :1983 → Updates prompt with MIDI state
#
# Multiple clients can connect to the same OSC broadcast simultaneously.
# The REPL can be started/stopped without affecting the midi service.

# Source color module for proper ANSI codes
if [[ -f "$TETRA_SRC/bash/color/color.sh" ]]; then
    source "$TETRA_SRC/bash/color/color.sh"
fi

# Define missing color
export TETRA_DIM='\033[2m'

# Source tcurses for direct keystroke input (TUI mode)
if [[ -f "$TETRA_SRC/bash/tcurses/tcurses_input.sh" ]]; then
    source "$TETRA_SRC/bash/tcurses/tcurses_input.sh"
fi

# REPL configuration
REPL_HISTORY_BASE="${MIDI_DIR}/repl/history"

# REPL state (OSC-based, no more tmc_state_get dependency)
REPL_CONTROLLER=""
REPL_INSTANCE=0
REPL_VARIANT=""
REPL_VARIANT_NAME=""
REPL_LAST_CC=""
REPL_LAST_VAL=""

# OSC connection settings (saved for prompt display)
REPL_OSC_HOST="${REPL_OSC_HOST:-0.0.0.0}"
REPL_OSC_PORT="${REPL_OSC_PORT:-1983}"
REPL_OSC_MULTICAST="${REPL_OSC_MULTICAST:-239.1.1.1}"

# Logging control (default: monitoring OFF)
MIDI_REPL_LOG_MODE="${MIDI_REPL_LOG_MODE:-off}"  # off, raw, semantic, both
MIDI_REPL_SHOW_STATE="${MIDI_REPL_SHOW_STATE:-true}"  # Show state updates in prompt

# TUI Key Bindings - Single keystroke handlers
midi_tui_handle_key() {
    local key="$1"

    case "$key" in
        # Log mode toggle
        l|L)
            local old_mode="$MIDI_REPL_LOG_MODE"
            case "$MIDI_REPL_LOG_MODE" in
                off) MIDI_REPL_LOG_MODE="raw" ;;
                raw) MIDI_REPL_LOG_MODE="semantic" ;;
                semantic) MIDI_REPL_LOG_MODE="both" ;;
                both) MIDI_REPL_LOG_MODE="off" ;;
            esac
            # Show feedback on new line, then prompt will redraw
            printf '\n%bLog: %s → %s%b\n' "${TETRA_YELLOW}" "$old_mode" "$MIDI_REPL_LOG_MODE" "${TETRA_NC}" >&2
            return 0
            ;;

        # Variant switching
        a|A)
            printf '\n%b→ Variant A%b\n' "${TETRA_CYAN}" "${TETRA_NC}" >&2
            midi_osc_send "/midi/control/variant" "a"
            return 0
            ;;
        b|B)
            printf '\n%b→ Variant B%b\n' "${TETRA_CYAN}" "${TETRA_NC}" >&2
            midi_osc_send "/midi/control/variant" "b"
            return 0
            ;;
        c|C)
            printf '\n%b→ Variant C%b\n' "${TETRA_CYAN}" "${TETRA_NC}" >&2
            midi_osc_send "/midi/control/variant" "c"
            return 0
            ;;
        d|D)
            printf '\n%b→ Variant D%b\n' "${TETRA_CYAN}" "${TETRA_NC}" >&2
            midi_osc_send "/midi/control/variant" "d"
            return 0
            ;;

        # Help - clear screen first
        h|H|\?)
            clear >&2
            midi_repl_help >&2
            printf '\n%bPress any key to continue...%b' "${TETRA_DIM}" "${TETRA_NC}" >&2
            # Wait for keypress
            tcurses_input_read_key_blocking >/dev/null 2>&1
            clear >&2
            return 0
            ;;

        # Status
        s|S)
            printf '\n' >&2
            midi_repl_status_display >&2
            return 0
            ;;

        # Quit
        q|Q|$'\x04')
            return 1  # Signal exit
            ;;

        # Ignore other keys silently
        *)
            return 0
            ;;
    esac
}

# Status display - shows current MIDI state
midi_repl_status_display() {
    cat <<EOF
═══ MIDI Status ═══
Controller: ${REPL_CONTROLLER:-none}
${REPL_VARIANT:+Variant: $REPL_VARIANT ($REPL_VARIANT_NAME)}
Log Mode: $MIDI_REPL_LOG_MODE
${REPL_LAST_CC:+Last CC: ${REPL_LAST_CC}=${REPL_LAST_VAL}}
OSC: ${REPL_OSC_MULTICAST}:${REPL_OSC_PORT}

EOF
}

midi_repl_help() {
    cat <<'EOF'
═══════════════════════════════════════════════
  MIDI REPL - Pure TUI (Instant Key Capture)
═══════════════════════════════════════════════

Key Bindings:

  a b c d    Switch variant
  l          Cycle log mode (off/raw/semantic/both)
  s          Show status
  h ?        This help
  q Ctrl+D   Quit

Prompt Shows:
  [device:variant] [CC#=val] [log:mode] host:port >

Color-Coded CC Values:
  Green   = Low (0-42)
  Yellow  = Mid (43-84)
  Red     = High (85-127)

Log Modes (press 'l' to cycle):
  off      - Clean (default)
  raw      - MIDI events
  semantic - Mapped values
  both     - All events

Example:
  Press 'b'  → variant B
  Press 'l'  → enable logging
  Move knob  → see CC in prompt
  Press 'q'  → quit

Pure TUI - instant feedback!
EOF
}

# Custom prompt builder - outputs to stderr
midi_repl_prompt() {
    # Clear current line
    printf '\r\033[K' >&2

    # Build prompt components
    local ctrl_part variant_part cc_part log_part conn_part

    # Controller and variant
    if [[ -n "$REPL_CONTROLLER" && -n "$REPL_VARIANT" ]]; then
        ctrl_part="${TETRA_CYAN}[${REPL_CONTROLLER}"
        [[ "$REPL_INSTANCE" != "0" ]] && ctrl_part+="[$REPL_INSTANCE]"
        ctrl_part+=":${REPL_VARIANT}"
        [[ -n "$REPL_VARIANT_NAME" ]] && ctrl_part+=" ${REPL_VARIANT_NAME}"
        ctrl_part+="]${TETRA_NC}"
    else
        ctrl_part="${TETRA_DIM}[no-device]${TETRA_NC}"
    fi

    # Last CC value
    if [[ -n "$REPL_LAST_CC" && -n "$REPL_LAST_VAL" ]]; then
        local val_color="${TETRA_YELLOW}"
        [[ "$REPL_LAST_VAL" -lt 43 ]] && val_color="${TETRA_GREEN}"
        [[ "$REPL_LAST_VAL" -gt 84 ]] && val_color="${TETRA_RED}"
        cc_part="${TETRA_YELLOW}[${REPL_LAST_CC}${TETRA_NC}=${val_color}${REPL_LAST_VAL}${TETRA_NC}${TETRA_YELLOW}]${TETRA_NC}"
    else
        cc_part="${TETRA_DIM}[--]${TETRA_NC}"
    fi

    # Log mode
    if [[ "$MIDI_REPL_LOG_MODE" != "off" ]]; then
        log_part="${TETRA_GREEN}[log:${MIDI_REPL_LOG_MODE}]${TETRA_NC}"
    else
        log_part="${TETRA_DIM}[log:off]${TETRA_NC}"
    fi

    # Connection (dim)
    conn_part="${TETRA_DIM}${REPL_OSC_MULTICAST}:${REPL_OSC_PORT}${TETRA_NC}"

    # Print complete prompt
    printf '%b %b %b %b %b ' "$ctrl_part" "$cc_part" "$log_part" "$conn_part" "${TETRA_MAGENTA}>${TETRA_NC}" >&2
}

# TUI main loop - captures keystrokes directly
midi_repl_tui_loop() {
    local listener_pid="$1"

    # Setup terminal for raw input
    local saved_stty
    saved_stty=$(stty -g 2>/dev/null)
    stty raw -echo 2>/dev/null

    # Hide cursor for cleaner look
    tput civis 2>/dev/null || printf '\033[?25l' >&2

    # Show initial prompt
    midi_repl_prompt

    # Main input loop
    while true; do
        # Read a single keystroke
        local key
        if ! key=$(tcurses_input_read_key_blocking 2>/dev/null); then
            break
        fi

        # Handle Ctrl+C
        if [[ "$key" == $'\x03' ]]; then
            echo "" >&2
            break
        fi

        # Process the key
        if ! midi_tui_handle_key "$key"; then
            # Key handler returned non-zero = exit requested
            echo "" >&2
            break
        fi

        # Redraw prompt (state may have changed)
        midi_repl_prompt
    done

    # Restore terminal
    stty "$saved_stty" 2>/dev/null
    tput cnorm 2>/dev/null || printf '\033[?25h' >&2
}

# Background OSC event listener
midi_repl_osc_listener() {
    local osc_host="$1"
    local osc_port="$2"

    # Start Node.js OSC listener
    node "$MIDI_SRC/osc_repl_listener.js" -h "$osc_host" -p "$osc_port" 2>&1 | while IFS= read -r line; do
        case "$line" in
            __STATE__*)
                # Parse state: __STATE__ controller=vmx8 instance=0 variant=a ...
                local state_str="${line#__STATE__ }"

                # Parse key=value pairs
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
                # Parse event: __EVENT__ id delta_ms elapsed_ms type ...
                # Example: __EVENT__ 42 15 1523 raw CC 1 7 64
                local event_str="${line#__EVENT__ }"

                # Extract timing info
                local id delta elapsed rest
                read -r id delta elapsed rest <<< "$event_str"

                # Determine type (4th field after timing)
                local event_type="${rest%% *}"  # raw or mapped

                # Display based on subscription mode
                case "$MIDI_REPL_LOG_MODE" in
                    off)
                        # Don't display events
                        ;;
                    raw)
                        if [[ "$event_type" == "raw" ]]; then
                            # Format: [id] Δdelta event_details
                            printf '[%d] Δ%dms: %s\n' "$id" "$delta" "$rest" >&2
                        fi
                        ;;
                    semantic)
                        if [[ "$event_type" == "mapped" ]]; then
                            printf '[%d] Δ%dms: %s\n' "$id" "$delta" "$rest" >&2
                        fi
                        ;;
                    both)
                        printf '[%d] Δ%dms %s: %s\n' "$id" "$delta" "$event_type" "$rest" >&2
                        ;;
                esac
                ;;

            *)
                # Filter out startup messages, only show actual errors
                if [[ -n "$line" && ! "$line" =~ ^✓ ]]; then
                    # Only show if it looks like an error (has ERROR, Failed, etc)
                    if [[ "$line" =~ ERROR|Error|Failed|failed ]]; then
                        echo "$line" >&2
                    fi
                fi
                ;;
        esac
    done
}

# Main REPL entry point
midi_repl() {
    # FIRST THING: Clear the existing shell prompt from the screen
    # Move to start of line and clear it
    printf '\r\033[K'

    local osc_host="${1:-$REPL_OSC_HOST}"
    local osc_port="${2:-$REPL_OSC_PORT}"
    local osc_multicast="${3:-239.1.1.1}"

    # Save OSC settings for prompt display
    REPL_OSC_HOST="$osc_host"
    REPL_OSC_PORT="$osc_port"
    REPL_OSC_MULTICAST="$osc_multicast"

    # Save and clear shell prompt for full takeover - do this EARLY
    local saved_ps1="$PS1"
    local saved_ps2="$PS2"
    local saved_prompt_command="$PROMPT_COMMAND"

    # Disable job control notifications and clear all prompts
    set +m 2>/dev/null

    # Export empty prompts to force bash to use them
    export PS1=""
    export PS2=""
    export PROMPT_COMMAND=""

    # Clear screen FIRST for clean start
    clear

    # Temporarily disable job control notifications while starting background processes
    # This suppresses "[1] 12345" messages without using disown (which would break cleanup)
    set +m

    # Start background OSC listener (connects to midi service broadcast)
    {
        midi_repl_osc_listener "$osc_host" "$osc_port" 2>&1
    } &
    local listener_pid=$!

    # Re-enable job control for proper signal handling
    set -m

    # Wait for listener to be ready
    sleep 0.3

    # Show startup message
    printf '%b✓%b MIDI REPL %b[Pure TUI Mode]%b - %b%s:%s%b\n' \
        "${TETRA_GREEN}" "${TETRA_NC}" \
        "${TETRA_CYAN}" "${TETRA_NC}" \
        "${TETRA_DIM}" "$osc_multicast" "$osc_port" "${TETRA_NC}"
    printf '%b  Press: h=help l=log a-d=variant q=quit%b\n' \
        "${TETRA_DIM}" "${TETRA_NC}"
    printf '\n'

    # Cleanup on exit - restore ALL settings
    trap "set -m 2>/dev/null; export PS1='$saved_ps1'; export PS2='$saved_ps2'; export PROMPT_COMMAND='$saved_prompt_command'; kill $listener_pid 2>/dev/null; wait $listener_pid 2>/dev/null || true; stty sane 2>/dev/null" EXIT

    # Run TUI loop (captures every keystroke)
    midi_repl_tui_loop "$listener_pid"

    # Re-enable job control
    set -m 2>/dev/null || true

    # Restore prompt
    PS1="$saved_ps1"

    # Cleanup
    kill $listener_pid 2>/dev/null || true
    wait $listener_pid 2>/dev/null || true
}

# Export functions
export -f midi_repl
export -f midi_tui_handle_key
export -f midi_repl_tui_loop
export -f midi_repl_prompt
export -f midi_repl_help
export -f midi_repl_status_display
export -f midi_repl_osc_listener
