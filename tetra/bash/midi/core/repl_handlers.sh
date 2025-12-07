#!/usr/bin/env bash

# MIDI REPL Command Handlers
# Extracted from input_mode_handle_cli for maintainability
# Each handler receives args and returns 0 (continue) or 1 (exit)

# ============================================================================
# SIMPLE DELEGATORS
# ============================================================================

# Help handler - delegates to midi_repl_help
_midi_repl_handle_help() {
    local args="$1"
    midi_repl_help "$args"
}

# Status handler - displays MIDI status
_midi_repl_handle_status() {
    printf '\n' >&2
    midi_repl_status_display >&2
}

# Reload current map
_midi_repl_handle_reload() {
    echo "Reloading current map..."
    midi_osc_send "/midi/control/reload"
}

# Reload configuration
_midi_repl_handle_reload_config() {
    echo "Reloading configuration..."
    midi_osc_send "/midi/control/reload-config"
}

# ============================================================================
# MEDIUM COMPLEXITY HANDLERS
# ============================================================================

# Log mode handler - set or toggle log mode
_midi_repl_handle_log() {
    local args="$1"

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
}

# Variant handler - switch controller variant
_midi_repl_handle_variant() {
    local args="$1"

    if [[ -z "$args" ]]; then
        echo "Usage: variant <a|b|c|d>"
    elif [[ "$args" =~ ^[a-d]$ ]]; then
        midi_set_variant "$args"
    else
        echo "Error: Variant must be a, b, c, or d"
    fi
}

# List MIDI devices
_midi_repl_handle_devices() {
    echo ""
    node "$MIDI_SRC/midi.js" -l
    echo ""
}

# Switch to specific device
_midi_repl_handle_device() {
    local args="$1"

    if [[ -z "$args" ]]; then
        echo "Usage: device <id|name>"
        echo "       device 0          # Select first device"
        echo "       device VMX8       # Select by name"
        echo ""
        echo "Use 'devices' to list available devices"
    else
        echo "Switching to device: $args"
        midi_osc_send "/midi/control/device" "$args"
    fi
}

# Load map handler
_midi_repl_handle_load() {
    local args="$1"

    if [[ -z "$args" ]]; then
        echo "Usage: load-map <name>"
        echo "Available maps:"
        ls -1 "$MIDI_MAPS_DIR"/*.json 2>/dev/null | xargs -n1 basename | sed 's/\.json$//' | sed 's/^/  /'
    else
        echo "Loading map: $args"
        midi_osc_send "/midi/control/load-map" "$args"
    fi
}

# OSC raw send handler
_midi_repl_handle_osc() {
    local args="$1"

    if [[ -z "$args" ]]; then
        echo "Usage: osc <address> [args...]"
        echo "       osc -t <host:port> <address> [args...]"
        echo ""
        echo "Send ad-hoc OSC messages for testing"
        echo ""
        echo "Examples:"
        echo "  osc /tau/filter/cutoff 0.5"
        echo "  osc /tau/envelope/attack 0.1 0.2"
        echo "  osc -t localhost:5000 /synth/play 440"
    else
        "$MIDI_SRC/osc_send_raw.sh" $args
    fi
}

# ============================================================================
# COMPLEX HANDLERS
# ============================================================================

# Map subcommands handler
_midi_repl_handle_map() {
    local args="$1"
    local subcmd="${args%% *}"
    local subargs="${args#* }"
    [[ "$subargs" == "$subcmd" ]] && subargs=""

    local map_file
    case "$subcmd" in
        ""|info|overview)
            map_file=$(_get_current_map_file) && midi_map_overview "$map_file"
            ;;
        list)
            map_file=$(_get_current_map_file) && midi_map_list_hardware "$map_file" "$subargs"
            ;;
        show)
            [[ -z "$subargs" ]] && { echo "Usage: map show <control>"; return 0; }
            map_file=$(_get_current_map_file) && midi_map_show_control "$map_file" "$subargs"
            ;;
        variant)
            [[ -z "$subargs" ]] && { echo "Usage: map variant <a|b|c|d>"; return 0; }
            map_file=$(_get_current_map_file) && midi_map_show_variant "$map_file" "$subargs"
            ;;
        search)
            [[ -z "$subargs" ]] && { echo "Usage: map search <term>"; return 0; }
            map_file=$(_get_current_map_file) && midi_map_search "$map_file" "$subargs"
            ;;
        *)
            echo "Unknown map subcommand: $subcmd"
            echo "Usage: map [info|list|show|variant|search]"
            ;;
    esac
}

# Send MIDI message handler (note, cc, clear)
_midi_repl_handle_send() {
    local args="$1"

    if [[ -z "$args" ]]; then
        echo "Usage: send note <note> <velocity>"
        echo "       send cc <controller> <value>"
        echo "       send clear              # Turn off all LEDs (notes 0-127)"
        echo "Example: send note 40 127    # Turn on LED for button at note 40"
        echo "         send note 40 0      # Turn off LED"
        echo "         send cc 7 64        # Send CC message"
        return 0
    fi

    local type="${args%% *}"
    local rest="${args#* }"

    case "$type" in
        note)
            _midi_repl_handle_send_note "$rest"
            ;;
        cc)
            _midi_repl_handle_send_cc "$rest"
            ;;
        clear)
            _midi_repl_handle_send_clear
            ;;
        *)
            echo "Unknown send type: $type"
            echo "Use: send note <note> <velocity>, send cc <controller> <value>, or send clear"
            ;;
    esac
}

# Send note sub-handler
_midi_repl_handle_send_note() {
    local rest="$1"
    local note="${rest%% *}"
    local velocity="${rest#* }"

    if [[ -n "$note" && -n "$velocity" ]]; then
        node "$MIDI_SRC/osc_send.js" "$REPL_OSC_MULTICAST" "$REPL_OSC_PORT" "/midi/out/note" 1 "$note" "$velocity"
        echo "Sent: NOTE ch1 $note vel=$velocity"
    else
        echo "Usage: send note <note> <velocity>"
    fi
}

# Send CC sub-handler
_midi_repl_handle_send_cc() {
    local rest="$1"
    local controller="${rest%% *}"
    local value="${rest#* }"

    if [[ -n "$controller" && -n "$value" ]]; then
        node "$MIDI_SRC/osc_send.js" "$REPL_OSC_MULTICAST" "$REPL_OSC_PORT" "/midi/out/cc" 1 "$controller" "$value"
        echo "Sent: CC ch1 $controller val=$value"
    else
        echo "Usage: send cc <controller> <value>"
    fi
}

# Send clear (all LEDs off) sub-handler
_midi_repl_handle_send_clear() {
    echo "Clearing all LEDs (notes 0-127)..."
    node "$MIDI_SRC/midi_send_clear.js" "$REPL_OSC_MULTICAST" "$REPL_OSC_PORT"
    echo "All LEDs cleared"
}

# ============================================================================
# EXPORTS
# ============================================================================

export -f _midi_repl_handle_help
export -f _midi_repl_handle_status
export -f _midi_repl_handle_reload
export -f _midi_repl_handle_reload_config
export -f _midi_repl_handle_log
export -f _midi_repl_handle_variant
export -f _midi_repl_handle_devices
export -f _midi_repl_handle_device
export -f _midi_repl_handle_load
export -f _midi_repl_handle_osc
export -f _midi_repl_handle_map
export -f _midi_repl_handle_send
export -f _midi_repl_handle_send_note
export -f _midi_repl_handle_send_cc
export -f _midi_repl_handle_send_clear
