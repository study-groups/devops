#!/usr/bin/env bash

# MIDI REPL - Interactive MIDI Controller Interface
# Supports multiple input modes: CLI mode (commands, history) and Key mode (instant actions)
#
# Architecture Overview:
#   This REPL is a CLIENT that connects to OSC broadcasts from the midi service.
#   It does NOT start the MIDI service - that's done by TSM.
#
# Service Layer (TSM-managed):
#   midi start → Reads MIDI hardware → Broadcasts OSC on :1983
#
# Client Layer (this file):
#   midi repl2 → Listens to OSC :1983 → Updates prompt with MIDI state
#
# Input Modes:
#   - CLI mode (default): Line-oriented, readline, history, tab completion
#   - Key mode: Character-oriented, instant single-keystroke actions
#
# Mode Switching:
#   - Type /key in CLI mode → switch to Key mode
#   - Press ESC in Key mode → return to CLI mode

# Source required modules
if [[ -f "$TETRA_SRC/bash/color/color.sh" ]]; then
    source "$TETRA_SRC/bash/color/color.sh"
fi

if [[ -f "$TETRA_SRC/bash/tcurses/tcurses_input.sh" ]]; then
    source "$TETRA_SRC/bash/tcurses/tcurses_input.sh"
fi

if [[ -f "$TETRA_SRC/bash/tcurses/tcurses_readline.sh" ]]; then
    source "$TETRA_SRC/bash/tcurses/tcurses_readline.sh"
fi

# Source input modes system
if [[ -f "$TETRA_SRC/bash/repl/core/input_modes.sh" ]]; then
    source "$TETRA_SRC/bash/repl/core/input_modes.sh"
else
    echo "Error: Input modes system not found" >&2
    return 1
fi

# Source tree system for completions
if [[ -f "$TETRA_SRC/bash/tree/core.sh" ]]; then
    source "$TETRA_SRC/bash/tree/core.sh"
    source "$TETRA_SRC/bash/tree/complete.sh"
fi

# Source tree completion integration (provides repl_register_tree_completion)
if [[ -f "$TETRA_SRC/bash/repl/tree_completion.sh" ]]; then
    source "$TETRA_SRC/bash/repl/tree_completion.sh"
fi

# Source MIDI help tree
if [[ -f "$MIDI_SRC/midi_help_tree.sh" ]]; then
    source "$MIDI_SRC/midi_help_tree.sh"
fi

# Source status display
if [[ -f "$MIDI_SRC/core/status_display.sh" ]]; then
    source "$MIDI_SRC/core/status_display.sh"
fi

# Define missing color
export TETRA_DIM='\033[2m'

# REPL configuration
REPL_HISTORY_BASE="${MIDI_DIR}/repl/history"
REPL_HISTORY_FILE="${REPL_HISTORY_BASE}.history"
REPL_STATE_FILE="${MIDI_DIR}/repl/state.$$"
REPL_LOG_MODE_FILE="${MIDI_DIR}/repl/log_mode.$$"

# MIDI state (OSC-based)
REPL_CONTROLLER=""
REPL_INSTANCE=0
REPL_VARIANT=""
REPL_VARIANT_NAME=""
REPL_LAST_CC=""
REPL_LAST_VAL=""

# OSC connection settings
REPL_OSC_HOST="${REPL_OSC_HOST:-0.0.0.0}"
REPL_OSC_PORT="${REPL_OSC_PORT:-1983}"
REPL_OSC_MULTICAST="${REPL_OSC_MULTICAST:-239.1.1.1}"

# Logging control
MIDI_REPL_LOG_MODE="${MIDI_REPL_LOG_MODE:-off}"  # off, raw, semantic, both

# OSC listener PID
MIDI_REPL_LISTENER_PID=""

# ============================================================================
# CLI MODE HANDLERS
# ============================================================================

# CLI command handler - processes text commands
input_mode_handle_cli() {
    local input="$1"

    # Empty input - just redraw
    if [[ -z "$input" ]]; then
        return 0
    fi

    # Check for /key command (mode switch handled by multimodal system)
    if [[ "$input" == "/key" ]]; then
        return 0  # Mode switch already processed
    fi

    # Parse command and arguments
    local cmd="${input%% *}"
    local args="${input#* }"
    [[ "$args" == "$cmd" ]] && args=""

    case "$cmd" in
        help|h|\?)
            midi_repl_help_cli
            ;;
        status|s)
            printf '\n' >&2
            midi_repl_status_display >&2
            ;;
        log)
            if [[ -n "$args" ]]; then
                case "$args" in
                    off|raw|semantic|both)
                        MIDI_REPL_LOG_MODE="$args"
                        echo "$MIDI_REPL_LOG_MODE" > "$REPL_LOG_MODE_FILE"
                        echo "Log mode: $MIDI_REPL_LOG_MODE"
                        ;;
                    *)
                        echo "Usage: log [off|raw|semantic|both]"
                        ;;
                esac
            else
                # Toggle through modes
                midi_toggle_log_mode
            fi
            ;;
        variant|v)
            if [[ -z "$args" ]]; then
                echo "Usage: variant <a|b|c|d>"
            elif [[ "$args" =~ ^[a-d]$ ]]; then
                midi_set_variant "$args"
            else
                echo "Error: Variant must be a, b, c, or d"
            fi
            ;;
        load-map|load|map)
            if [[ -z "$args" ]]; then
                echo "Usage: load-map <name>"
                echo "Available maps:"
                ls -1 "$MIDI_MAPS_DIR"/*.json 2>/dev/null | xargs -n1 basename | sed 's/\.json$//' | sed 's/^/  /'
            else
                echo "Loading map: $args"
                midi_osc_send "/midi/control/load-map" "$args"
            fi
            ;;
        reload|r)
            echo "Reloading current map..."
            midi_osc_send "/midi/control/reload"
            ;;
        reload-config|rc)
            echo "Reloading configuration..."
            midi_osc_send "/midi/control/reload-config"
            ;;
        devices|dev)
            echo ""
            node "$MIDI_SRC/midi.js" -l
            echo ""
            ;;
        send)
            if [[ -z "$args" ]]; then
                echo "Usage: send note <note> <velocity>"
                echo "       send cc <controller> <value>"
                echo "       send clear              # Turn off all LEDs (notes 0-127)"
                echo "Example: send note 40 127    # Turn on LED for button at note 40"
                echo "         send note 40 0      # Turn off LED"
                echo "         send cc 7 64        # Send CC message"
            else
                local type="${args%% *}"
                local rest="${args#* }"
                case "$type" in
                    note)
                        local note="${rest%% *}"
                        local velocity="${rest#* }"
                        if [[ -n "$note" && -n "$velocity" ]]; then
                            node "$MIDI_SRC/osc_send.js" 239.1.1.1 1983 "/midi/out/note" 1 "$note" "$velocity"
                            echo "Sent: NOTE ch1 $note vel=$velocity"
                        else
                            echo "Usage: send note <note> <velocity>"
                        fi
                        ;;
                    cc)
                        local controller="${rest%% *}"
                        local value="${rest#* }"
                        if [[ -n "$controller" && -n "$value" ]]; then
                            node "$MIDI_SRC/osc_send.js" 239.1.1.1 1983 "/midi/out/cc" 1 "$controller" "$value"
                            echo "Sent: CC ch1 $controller val=$value"
                        else
                            echo "Usage: send cc <controller> <value>"
                        fi
                        ;;
                    clear)
                        echo "Clearing all LEDs (notes 0-127)..."
                        for note in {0..127}; do
                            node "$MIDI_SRC/osc_send.js" 239.1.1.1 1983 "/midi/out/note" 1 "$note" 0 2>/dev/null
                        done
                        echo "All LEDs cleared"
                        ;;
                    *)
                        echo "Unknown send type: $type"
                        echo "Use: send note <note> <velocity>, send cc <controller> <value>, or send clear"
                        ;;
                esac
            fi
            ;;
        exit|quit|q)
            return 1  # Signal exit
            ;;
        "")
            # Empty - already handled above
            ;;
        *)
            echo "Unknown command: $cmd"
            echo "Type 'help' for available commands"
            ;;
    esac

    return 0
}

# ============================================================================
# KEY MODE HANDLERS
# ============================================================================

# Key command handler - processes single keystrokes
input_mode_handle_key() {
    local key="$1"

    case "$key" in
        $'\x1b')  # ESC - return to CLI mode (handled by multimodal system)
            printf '\n%b→ CLI Mode%b\n' "${TETRA_GREEN}" "${TETRA_NC}" >&2
            return 0
            ;;

        # Log mode toggle
        l|L)
            printf '\n\r' >&2
            midi_toggle_log_mode
            return 0
            ;;

        # Variant switching
        a|A)
            printf '\n\r%b→ Variant A%b\n' "${TETRA_CYAN}" "${TETRA_NC}" >&2
            midi_set_variant "a"
            return 0
            ;;
        b|B)
            printf '\n\r%b→ Variant B%b\n' "${TETRA_CYAN}" "${TETRA_NC}" >&2
            midi_set_variant "b"
            return 0
            ;;
        c|C)
            printf '\n\r%b→ Variant C%b\n' "${TETRA_CYAN}" "${TETRA_NC}" >&2
            midi_set_variant "c"
            return 0
            ;;
        d|D)
            printf '\n\r%b→ Variant D%b\n' "${TETRA_CYAN}" "${TETRA_NC}" >&2
            midi_set_variant "d"
            return 0
            ;;

        # Status
        s|S)
            printf '\n\r' >&2
            midi_repl_status_display >&2
            return 0
            ;;

        # Help
        h|H|\?)
            clear >&2
            midi_repl_help_key >&2
            printf '\n%bPress any key to continue...%b' "${TETRA_DIM}" "${TETRA_NC}" >&2
            tcurses_input_read_key_blocking >/dev/null 2>&1
            clear >&2
            return 0
            ;;

        # Quit
        q|Q|$'\x04')  # q, Q, or Ctrl+D
            return 1  # Signal exit
            ;;

        # Ignore other keys
        *)
            return 0
            ;;
    esac
}

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

# Toggle log mode through the cycle
midi_toggle_log_mode() {
    local old_mode="$MIDI_REPL_LOG_MODE"
    case "$MIDI_REPL_LOG_MODE" in
        off) MIDI_REPL_LOG_MODE="raw" ;;
        raw) MIDI_REPL_LOG_MODE="semantic" ;;
        semantic) MIDI_REPL_LOG_MODE="both" ;;
        both) MIDI_REPL_LOG_MODE="off" ;;
    esac
    # Write to file so subprocess can read it
    echo "$MIDI_REPL_LOG_MODE" > "$REPL_LOG_MODE_FILE"
    printf '%bLog: %s → %s%b\n' "${TETRA_YELLOW}" "$old_mode" "$MIDI_REPL_LOG_MODE" "${TETRA_NC}" >&2
}

# Set variant
midi_set_variant() {
    local variant="$1"
    midi_osc_send "/midi/control/variant" "$variant"
}

# Status display
midi_repl_status_display() {
    cat <<EOF
═══ MIDI Status ═══
Controller: ${REPL_CONTROLLER:-none}
${REPL_VARIANT:+Variant: $REPL_VARIANT ($REPL_VARIANT_NAME)}
Log Mode: $MIDI_REPL_LOG_MODE
${REPL_LAST_CC:+Last CC: ${REPL_LAST_CC}=${REPL_LAST_VAL}}
OSC: ${REPL_OSC_MULTICAST}:${REPL_OSC_PORT}
Mode: $(input_mode_get)

EOF
}

# Help display - CLI mode
midi_repl_help_cli() {
    cat <<EOF

═══════════════════════════════════════════════
  MIDI REPL - CLI Commands
═══════════════════════════════════════════════

CLI Commands:
  help, h, ?           Show this help
  status, s            Show MIDI status
  log [mode]           Set/toggle log mode (off/raw/semantic/both)
  variant <a-d>, v     Switch to variant a, b, c, or d
  load-map <name>      Load a MIDI map file
  reload, r            Reload current map
  reload-config, rc    Reload config.toml
  devices, dev         List available MIDI devices
  send note N VEL      Send MIDI note (e.g., send note 40 127)
  send cc N VAL        Send MIDI CC (e.g., send cc 7 64)
  exit, quit, q        Exit REPL

Mode Switching:
  /key                 Enter key-command mode
  (in key mode) ESC    Return to CLI mode

Key Commands (in key mode):
  a, b, c, d           Switch variant (instant)
  l                    Toggle log mode
  s                    Show status
  h, ?                 Help
  q, Ctrl+D            Quit

Examples:
  variant b            Switch to variant B
  load-map vmx8[0]     Load vmx8 controller map
  log semantic         Show semantic events only
  /key                 Switch to key mode
  (press 'b')          Instant switch to variant B
  (press ESC)          Return to CLI mode

EOF
}

# Help display - Key mode
midi_repl_help_key() {
    cat <<'EOF'
═══════════════════════════════════════════════
  MIDI REPL - Key-Command Mode
═══════════════════════════════════════════════

Single-Key Actions:

  a b c d    Switch variant (instant)
  l          Cycle log mode (off→raw→semantic→both→off)
  s          Show status
  h ?        This help
  q Ctrl+D   Quit
  ESC        Return to CLI mode

Prompt Shows:
  [device:variant] [CC#=val] [log:mode] host:port [KEY] >
                                                   ^^^^^ mode indicator

Color-Coded CC Values:
  Green   = Low (0-42)
  Yellow  = Mid (43-84)
  Red     = High (85-127)

Press ESC to return to CLI mode for full commands!
EOF
}

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
            esac
        done < <(tr ' ' '\n' < "$REPL_STATE_FILE")
    fi

    # Build prompt components
    local ctrl_part cc_part log_part conn_part mode_indicator

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

    # Mode indicator
    mode_indicator=$(input_mode_get_indicator "bracket")
    [[ -n "$mode_indicator" ]] && mode_indicator=" $mode_indicator"

    # Return complete prompt string
    printf '%b %b %b %b%b %b ' \
        "$ctrl_part" "$cc_part" "$log_part" "$conn_part" \
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

# ============================================================================
# OSC LISTENER
# ============================================================================

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

                # Write state to file for main REPL to read
                echo "$state_str" > "$REPL_STATE_FILE"
                ;;

            __EVENT__*)
                # Parse event: __EVENT__ id delta_ms elapsed_ms type ...
                local event_str="${line#__EVENT__ }"

                # Extract timing info
                local id delta elapsed rest
                read -r id delta elapsed rest <<< "$event_str"

                # Determine type (4th field after timing)
                local event_type="${rest%% *}"  # raw or mapped

                # Read current log mode from file
                local current_log_mode="off"
                if [[ -f "$REPL_LOG_MODE_FILE" ]]; then
                    current_log_mode=$(cat "$REPL_LOG_MODE_FILE")
                fi

                # Format event for display
                local formatted_event=""
                case "$current_log_mode" in
                    off) ;;  # Don't display or store
                    raw)
                        if [[ "$event_type" == "raw" ]]; then
                            formatted_event=$(printf '[%d] Δ%dms: %s' "$id" "$delta" "$rest")
                        fi
                        ;;
                    semantic)
                        if [[ "$event_type" == "mapped" ]]; then
                            formatted_event=$(printf '[%d] Δ%dms: %s' "$id" "$delta" "$rest")
                        fi
                        ;;
                    both)
                        formatted_event=$(printf '[%d] Δ%dms %s: %s' "$id" "$delta" "$event_type" "$rest")
                        ;;
                esac

                # Add to status display event buffer if we have an event
                if [[ -n "$formatted_event" ]]; then
                    status_display_add_event "$formatted_event"
                fi
                ;;

            *)
                # Filter out startup messages, only show errors
                if [[ -n "$line" && ! "$line" =~ ^✓ ]]; then
                    if [[ "$line" =~ ERROR|Error|Failed|failed ]]; then
                        echo "$line" >&2
                    fi
                fi
                ;;
        esac
    done
}

# ============================================================================
# TAB COMPLETION (Tree-based)
# ============================================================================

# Static fallback completions (when tree isn't available)
_midi_static_completions() {
    cat <<'EOF'
help
h
?
status
s
log
variant
v
load-map
load
map
reload
r
reload-config
rc
devices
dev
/key
exit
quit
q
off
raw
semantic
both
a
b
c
d
EOF

    # Dynamic: map names
    if [[ -d "$MIDI_MAPS_DIR" ]]; then
        ls -1 "$MIDI_MAPS_DIR"/*.json 2>/dev/null | xargs -n1 basename | sed 's/\.json$//'
    fi
}

# Initialize completion when REPL starts
_midi_repl_init_completion() {
    # Initialize the MIDI help tree
    if command -v midi_init_help_tree >/dev/null 2>&1; then
        midi_init_help_tree
    fi

    # Register tree-based completion with fallback
    # This is the proper Tetra pattern used by org_repl, tdocs_repl, etc.
    if command -v repl_register_tree_completion >/dev/null 2>&1; then
        repl_register_tree_completion "help.midi" "_midi_static_completions"
    else
        # Fallback if tree system not available: use static completions
        if command -v repl_set_completion_generator >/dev/null 2>&1; then
            repl_set_completion_generator "_midi_static_completions"
        fi
    fi
}

# ============================================================================
# MAIN ENTRY POINT
# ============================================================================

# Main REPL entry point
midi_repl() {
    local osc_host="${1:-$REPL_OSC_HOST}"
    local osc_port="${2:-$REPL_OSC_PORT}"
    local osc_multicast="${3:-239.1.1.1}"

    # Save OSC settings
    REPL_OSC_HOST="$osc_host"
    REPL_OSC_PORT="$osc_port"
    REPL_OSC_MULTICAST="$osc_multicast"

    # Setup history
    mkdir -p "$(dirname "$REPL_HISTORY_FILE")"
    touch "$REPL_HISTORY_FILE"

    # Initialize log mode file
    echo "$MIDI_REPL_LOG_MODE" > "$REPL_LOG_MODE_FILE"

    # Initialize tree-based completion
    _midi_repl_init_completion

    # Clear screen for clean start
    clear

    # Initialize status display
    status_display_init

    # Show welcome banner
    printf '%b╔════════════════════════════════════════════╗%b\n' "${TETRA_CYAN}" "${TETRA_NC}"
    printf '%b║%b   MIDI REPL                                %b║%b\n' "${TETRA_CYAN}" "${TETRA_NC}" "${TETRA_CYAN}" "${TETRA_NC}"
    printf '%b╚════════════════════════════════════════════╝%b\n' "${TETRA_CYAN}" "${TETRA_NC}"
    printf '\n'
    printf '%b✓ Connected to OSC:%b %s:%s\n' "${TETRA_GREEN}" "${TETRA_NC}" "$osc_multicast" "$osc_port"
    printf '%b✓ Real-time status display enabled%b\n' "${TETRA_GREEN}" "${TETRA_NC}"
    printf '\n'
    printf '%bModes:%b\n' "${TETRA_YELLOW}" "${TETRA_NC}"
    printf '  %bCLI Mode%b    - Type commands, use history, tab completion (default)\n' "${TETRA_GREEN}" "${TETRA_NC}"
    printf '  %bKey Mode%b    - Type %b/key%b for instant single-key actions\n' "${TETRA_CYAN}" "${TETRA_NC}" "${TETRA_YELLOW}" "${TETRA_NC}"
    printf '\n'
    printf '%bQuick Start:%b\n' "${TETRA_DIM}" "${TETRA_NC}"
    printf '  Type: %bhelp%b, %bstatus%b, %bvariant b%b (use TAB for completion)\n' "${TETRA_YELLOW}" "${TETRA_NC}" "${TETRA_YELLOW}" "${TETRA_NC}" "${TETRA_YELLOW}" "${TETRA_NC}"
    printf '  Type %b/key%b then press %ba%b/%bb%b/%bc%b/%bd%b for instant variant switch\n' \
        "${TETRA_YELLOW}" "${TETRA_NC}" \
        "${TETRA_YELLOW}" "${TETRA_NC}" \
        "${TETRA_YELLOW}" "${TETRA_NC}" \
        "${TETRA_YELLOW}" "${TETRA_NC}" \
        "${TETRA_YELLOW}" "${TETRA_NC}"
    printf '  Press %bESC%b to return to CLI mode\n' "${TETRA_YELLOW}" "${TETRA_NC}"
    printf '\n'
    printf '%bPress Enter to continue...%b' "${TETRA_DIM}" "${TETRA_NC}"
    read -r

    # Start background OSC listener
    {
        midi_repl_osc_listener "$osc_host" "$osc_port" 2>&1
    } &
    MIDI_REPL_LISTENER_PID=$!

    # Disown to suppress job notifications
    disown "$MIDI_REPL_LISTENER_PID" 2>/dev/null

    # Wait for listener to be ready
    sleep 0.3

    # Request initial state from service
    node "$MIDI_SRC/osc_send.js" "$osc_multicast" "$osc_port" "/midi/control/status" 2>/dev/null || true
    sleep 0.2

    # Start background status display refresh loop
    {
        status_display_refresh_loop "$REPL_STATE_FILE" "$REPL_LOG_MODE_FILE" "$STATUS_DISPLAY_EVENTS_FILE"
    } &
    local STATUS_REFRESH_PID=$!
    disown "$STATUS_REFRESH_PID" 2>/dev/null

    # Initial render
    status_display_render "$REPL_STATE_FILE" "$REPL_LOG_MODE_FILE" "$STATUS_DISPLAY_EVENTS_FILE"

    # Setup cleanup trap
    trap "kill $MIDI_REPL_LISTENER_PID $STATUS_REFRESH_PID 2>/dev/null; wait $MIDI_REPL_LISTENER_PID $STATUS_REFRESH_PID 2>/dev/null || true; status_display_cleanup; rm -f '$REPL_STATE_FILE' '$REPL_LOG_MODE_FILE'; stty sane 2>/dev/null" EXIT INT TERM

    # Run multimodal input loop
    input_mode_main_loop

    # Cleanup
    kill "$MIDI_REPL_LISTENER_PID" "$STATUS_REFRESH_PID" 2>/dev/null || true
    wait "$MIDI_REPL_LISTENER_PID" "$STATUS_REFRESH_PID" 2>/dev/null || true
    status_display_cleanup
    rm -f "$REPL_STATE_FILE" "$REPL_LOG_MODE_FILE"
}

# Export functions
export -f midi_repl
export -f input_mode_handle_cli
export -f input_mode_handle_key
export -f input_mode_build_prompt
export -f input_mode_render_prompt
export -f midi_toggle_log_mode
export -f midi_set_variant
export -f midi_repl_status_display
export -f midi_repl_help_cli
export -f midi_repl_help_key
export -f midi_repl_osc_listener
