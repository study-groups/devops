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

# Source map display functions
if [[ -f "$MIDI_SRC/core/map_display.sh" ]]; then
    source "$MIDI_SRC/core/map_display.sh"
fi

# Source REPL command handlers
if [[ -f "$MIDI_SRC/core/repl_handlers.sh" ]]; then
    source "$MIDI_SRC/core/repl_handlers.sh"
fi

# Define missing color
export TETRA_DIM='\033[2m'

# ============================================================================
# HELPER FUNCTIONS (defined early for use throughout)
# ============================================================================

# Get the current map file path, or return error
# Usage: local map_file; map_file=$(_get_current_map_file) || return
_get_current_map_file() {
    if [[ ! -f "$REPL_STATE_FILE" ]]; then
        echo "REPL not initialized" >&2
        return 1
    fi

    local controller
    controller=$(grep "^controller=" "$REPL_STATE_FILE" 2>/dev/null | cut -d= -f2)

    if [[ -z "$controller" ]]; then
        echo "No map currently loaded" >&2
        return 1
    fi

    local map_file="$MIDI_MAPS_DIR/${controller}[0].json"

    if [[ ! -f "$map_file" ]]; then
        echo "Map file not found: $map_file" >&2
        return 1
    fi

    echo "$map_file"
}

# Get a single value from state file
_get_state_value() {
    local key="$1"
    [[ -f "$REPL_STATE_FILE" ]] && grep "^${key}=" "$REPL_STATE_FILE" 2>/dev/null | cut -d= -f2
}

# Cleanup function for trap
_midi_repl_cleanup() {
    # Kill background processes
    [[ -n "$MIDI_REPL_LISTENER_PID" ]] && kill "$MIDI_REPL_LISTENER_PID" 2>/dev/null
    [[ -n "$MIDI_REPL_STATUS_PID" ]] && kill "$MIDI_REPL_STATUS_PID" 2>/dev/null

    # Wait for processes to exit
    wait "$MIDI_REPL_LISTENER_PID" 2>/dev/null || true
    wait "$MIDI_REPL_STATUS_PID" 2>/dev/null || true

    # Cleanup display
    status_display_cleanup

    # Remove temp files
    rm -f "$REPL_STATE_FILE" "$REPL_LOG_MODE_FILE"

    # Restore terminal
    stty sane 2>/dev/null || true
}

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
REPL_LAST_SEMANTIC=""
REPL_LAST_SEMANTIC_VAL=""
REPL_INPUT_DEVICE=""
REPL_OUTPUT_DEVICE=""

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
# Handlers extracted to repl_handlers.sh for maintainability
input_mode_handle_cli() {
    local input="$1"

    # Empty input - just redraw
    [[ -z "$input" ]] && return 0

    # Check for /key command (mode switch handled by multimodal system)
    [[ "$input" == "/key" ]] && return 0

    # Parse command and arguments
    local cmd="${input%% *}"
    local args="${input#* }"
    [[ "$args" == "$cmd" ]] && args=""

    case "$cmd" in
        help|h|\?)        _midi_repl_handle_help "$args" ;;
        status|s)         _midi_repl_handle_status ;;
        log)              _midi_repl_handle_log "$args" ;;
        variant|v)        _midi_repl_handle_variant "$args" ;;
        map)              _midi_repl_handle_map "$args" ;;
        load-map|load)    _midi_repl_handle_load "$args" ;;
        reload|r)         _midi_repl_handle_reload ;;
        reload-config|rc) _midi_repl_handle_reload_config ;;
        devices|dev)      _midi_repl_handle_devices ;;
        device)           _midi_repl_handle_device "$args" ;;
        send)             _midi_repl_handle_send "$args" ;;
        osc)              _midi_repl_handle_osc "$args" ;;
        exit|quit|q)      return 1 ;;
        "")               ;;
        *)                echo "Unknown command: $cmd"; echo "Type 'help' for available commands" ;;
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
    # Get MIDI service info if available
    local midi_pid=""
    local midi_uptime=""
    local midi_map=""

    if command -v tsm >/dev/null 2>&1; then
        local tsm_info=$(tsm ls 2>/dev/null | grep "midi-${REPL_OSC_PORT}" | head -1)
        if [[ -n "$tsm_info" ]]; then
            midi_pid=$(echo "$tsm_info" | awk '{print $4}')
            if [[ -n "$midi_pid" && "$midi_pid" =~ ^[0-9]+$ ]]; then
                midi_uptime=$(ps -p "$midi_pid" -o etime= 2>/dev/null | tr -d ' ')
                # Extract map file from command line
                midi_map=$(ps -p "$midi_pid" -o command= 2>/dev/null | grep -o '/[^ ]*\.json' | xargs basename 2>/dev/null)
            fi
        fi
    fi

    cat <<EOF
═══ MIDI Status ═══
Controller: ${REPL_CONTROLLER:-none}${REPL_INSTANCE:+ [${REPL_INSTANCE}]}
${REPL_VARIANT:+Variant: $REPL_VARIANT ($REPL_VARIANT_NAME)}
${midi_map:+Map File: $midi_map}
${REPL_INPUT_DEVICE:+Input Device: $REPL_INPUT_DEVICE}
${REPL_OUTPUT_DEVICE:+Output Device: $REPL_OUTPUT_DEVICE}
Log Mode: $MIDI_REPL_LOG_MODE
${REPL_LAST_CC:+Last CC: ${REPL_LAST_CC}=${REPL_LAST_VAL}}
OSC: ${REPL_OSC_MULTICAST}:${REPL_OSC_PORT}
${midi_pid:+Service PID: $midi_pid}
${midi_uptime:+Uptime: $midi_uptime}
Mode: $(input_mode_get)

EOF
}

# Help system - hierarchical with tab completion
# Usage: help [topic]  Topics: map, send, log, key
midi_repl_help() {
    local topic="${1:-}"

    case "$topic" in
        ""|topics)
            cat <<'EOF'
MIDI REPL - Type 'help <topic>' for details

  status, s      Show MIDI status
  log [mode]     off|raw|semantic|both (or toggle)
  variant <a-d>  Switch variant
  map            Map info (help map for subcommands)
  send           Send MIDI (help send)
  devices        List MIDI devices
  /key           Key mode (ESC to exit)
  q              Quit

Topics: map, send, log, key
EOF
            ;;
        map)
            cat <<'EOF'
map - MIDI mapping commands

  map              Overview of current map
  map list         List hardware controls
  map show <ctrl>  Show control details (e.g., map show p1)
  map variant <v>  Show variant mappings (a/b/c/d)
  map search <s>   Search semantic names

  load-map <name>  Load different map
  reload           Reload current map
EOF
            ;;
        send)
            cat <<'EOF'
send - Output MIDI messages

  send note <n> <vel>  Send note (e.g., send note 40 127)
  send cc <n> <val>    Send CC (e.g., send cc 7 64)
  send clear           Turn off all LEDs (0-127)
  osc <addr> [args]    Send OSC message
EOF
            ;;
        log)
            cat <<'EOF'
log - Event logging control

  log           Toggle: off→raw→semantic→both→off
  log off       Disable logging
  log raw       Show raw CC/note events
  log semantic  Show mapped parameter names
  log both      Show raw + semantic
EOF
            ;;
        key)
            cat <<'EOF'
Key Mode - Single keystroke actions

  /key       Enter key mode
  ESC        Exit to CLI mode

Keys:
  a b c d    Switch variant
  l          Cycle log mode
  s          Status
  h          Help
  q          Quit
EOF
            ;;
        *)
            echo "Unknown topic: $topic"
            echo "Topics: map, send, log, key"
            ;;
    esac
}

# Help topics for tab completion
_midi_help_topics() {
    echo -e "map\nsend\nlog\nkey\ntopics"
}

# Key mode help (compact)
midi_repl_help_key() {
    cat <<'EOF'
Key Mode: a/b/c/d=variant l=log s=status h=help q=quit ESC=CLI
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
help map
help send
help log
help key
status
log
log off
log raw
log semantic
log both
variant
variant a
variant b
variant c
variant d
map
map list
map show
map variant
map search
load-map
reload
reload-config
devices
device
send
send note
send cc
send clear
osc
/key
exit
quit
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

    # Clean up stale state files from crashed REPL sessions (older than 1 day)
    find "${MIDI_DIR}/repl/" -name "state.*" -mtime +1 -delete 2>/dev/null || true
    find "${MIDI_DIR}/repl/" -name "log_mode.*" -mtime +1 -delete 2>/dev/null || true
    find "${MIDI_DIR}/repl/" -name "events.*" -mtime +1 -delete 2>/dev/null || true

    # Initialize log mode file
    echo "$MIDI_REPL_LOG_MODE" > "$REPL_LOG_MODE_FILE"

    # Initialize tree-based completion
    _midi_repl_init_completion

    # Show compact welcome
    printf '%bMIDI REPL%b %s:%s - type %bhelp%b, %b/key%b for key mode, %bq%b to quit\n' \
        "${TETRA_CYAN}" "${TETRA_NC}" \
        "$osc_multicast" "$osc_port" \
        "${TETRA_YELLOW}" "${TETRA_NC}" \
        "${TETRA_YELLOW}" "${TETRA_NC}" \
        "${TETRA_YELLOW}" "${TETRA_NC}"

    # Disable job control to suppress [1] 12345 notifications
    set +m

    # Start background OSC listener
    midi_repl_osc_listener "$osc_host" "$osc_port" &
    MIDI_REPL_LISTENER_PID=$!

    # Wait for listener to be ready
    sleep 0.3

    # Request initial state from service
    node "$MIDI_SRC/osc_send.js" "$osc_multicast" "$osc_port" "/midi/control/status" 2>/dev/null || true
    sleep 0.2

    # Start background status display refresh loop
    status_display_refresh_loop "$REPL_STATE_FILE" "$REPL_LOG_MODE_FILE" "$STATUS_DISPLAY_EVENTS_FILE" &
    MIDI_REPL_STATUS_PID=$!

    # Re-enable job control
    set -m

    # Initialize status display (sets scroll region)
    status_display_init

    # Initial render
    status_display_render "$REPL_STATE_FILE" "$REPL_LOG_MODE_FILE" "$STATUS_DISPLAY_EVENTS_FILE"

    # Setup cleanup trap
    trap '_midi_repl_cleanup' EXIT INT TERM

    # Run multimodal input loop
    input_mode_main_loop

    # Cleanup (also called by trap, but explicit for normal exit)
    _midi_repl_cleanup
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
export -f midi_repl_help
export -f midi_repl_help_key
export -f _midi_help_topics
export -f midi_repl_osc_listener
export -f _get_current_map_file
export -f _get_state_value
export -f _midi_repl_cleanup
