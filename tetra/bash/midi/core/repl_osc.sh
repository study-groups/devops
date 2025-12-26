#!/usr/bin/env bash

# MIDI REPL OSC Listener
# Extracted from repl.sh for maintainability

# ============================================================================
# OSC LISTENER
# ============================================================================

# Background OSC event listener
midi_repl_osc_listener() {
    local osc_host="$1"
    local osc_port="$2"

    # Use C listener if available, fallback to Node.js
    local osc_cmd
    if [[ -x "$MIDI_SRC/osc_listen" ]]; then
        osc_cmd="$MIDI_SRC/osc_listen -p $osc_port"
    else
        osc_cmd="node $MIDI_SRC/osc_repl_listener.js -h $osc_host -p $osc_port"
    fi

    # Start OSC listener
    $osc_cmd 2>&1 | while IFS= read -r line; do
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

# Export functions
export -f midi_repl_osc_listener
