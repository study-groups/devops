#!/usr/bin/env bash

# TSM MIDI Integration
# Helpers for midi-mp registration and control using TDP

# midi-mp connection settings
MIDI_MP_SOCKET="${MIDI_MP_SOCKET:-/tmp/tetra/midi-mp.sock}"
MIDI_MP_UDP_PORT="${MIDI_MP_UDP_PORT:-1984}"
MIDI_MP_BROADCAST_PORT="${MIDI_MP_BROADCAST_PORT:-2020}"

# Check if midi-mp is running
# Usage: tsm_midi_mp_available
tsm_midi_mp_available() {
    # Check socket first (preferred)
    if [[ -S "$MIDI_MP_SOCKET" ]]; then
        return 0
    fi

    # Fall back to checking if process is running
    if tsm_process_exists "midi-mp" 2>/dev/null; then
        return 0
    fi

    # Check if port is in use
    if lsof -i UDP:$MIDI_MP_UDP_PORT >/dev/null 2>&1; then
        return 0
    fi

    return 1
}

# Register a service for MIDI with midi-mp using TDP topics
# Usage: tsm_midi_register <service_name> <topic> [subscribe_patterns]
# Example: tsm_midi_register trax "tetra/game/trax" "tetra/midi/+/1/cc/40,tetra/midi/+/1/cc/41"
tsm_midi_register() {
    local service="$1"
    local topic="${2:-tetra/service/$service}"
    local subscribe="${3:-}"

    if ! tsm_midi_mp_available; then
        echo "tsm: midi-mp not available, skipping registration" >&2
        return 1
    fi

    # Build registration message (JSON format for UDP) using TDP
    local msg
    msg=$(jq -n \
        --arg type "register" \
        --arg name "$service" \
        --arg topic "$topic" \
        --arg subscribe "$subscribe" \
        '{
            _proto: "tdp",
            _v: 1,
            type: $type,
            name: $name,
            topic: $topic,
            subscribe: ($subscribe | split(",") | map(select(length > 0))),
            transport: "udp",
            address: "127.0.0.1:2020"
        }')

    # Send via UDP to midi-mp
    echo "$msg" | nc -u -w1 localhost "$MIDI_MP_UDP_PORT" 2>/dev/null

    local result=$?
    if [[ $result -eq 0 ]]; then
        echo "tsm: registered '$service' with midi-mp (topic: $topic)"
    else
        echo "tsm: warning: could not send registration to midi-mp" >&2
    fi

    return $result
}

# Unregister service from midi-mp
# Usage: tsm_midi_unregister <service_name>
tsm_midi_unregister() {
    local service="$1"

    if ! tsm_midi_mp_available; then
        return 0  # Silent success if midi-mp not running
    fi

    local msg
    msg=$(jq -n \
        --arg type "unregister" \
        --arg name "$service" \
        '{type: $type, name: $name}')

    echo "$msg" | nc -u -w1 localhost "$MIDI_MP_UDP_PORT" 2>/dev/null
    echo "tsm: unregistered '$service' from midi-mp"
}

# Parse controls.json and register mappings with midi-mp
# Usage: tsm_midi_register_from_controls <controls_file> <service_name>
tsm_midi_register_from_controls() {
    local controls_file="$1"
    local service="$2"

    if [[ ! -f "$controls_file" ]]; then
        echo "tsm: controls file not found: $controls_file" >&2
        return 1
    fi

    # Check for tdp section first (new format), fall back to tucp (legacy)
    local topic subscribe
    topic=$(jq -r '.tdp.topic // .tucp.topic // .tucp.channel // empty' "$controls_file" 2>/dev/null)
    subscribe=$(jq -r '(.tdp.subscribe // .tucp.subscribe // []) | join(",")' "$controls_file" 2>/dev/null)

    if [[ -n "$topic" ]]; then
        # Use TDP section
        tsm_midi_register "$service" "$topic" "$subscribe"
        return $?
    fi

    # Fall back to extracting MIDI CC from defaults section
    # Convert legacy CC numbers to TDP topic patterns
    local cc_list
    cc_list=$(jq -r '
        .defaults.midi // {} |
        to_entries |
        map(.value | select(type == "object")) |
        map(.left_cc // empty, .right_cc // empty, .cc // empty) |
        flatten | unique | sort | map("tetra/midi/+/1/cc/\(.)") | join(",")
    ' "$controls_file" 2>/dev/null)

    if [[ -n "$cc_list" && "$cc_list" != "null" ]]; then
        # Use service-based topic
        tsm_midi_register "$service" "tetra/game/$service" "$cc_list"
        return $?
    fi

    echo "tsm: no MIDI mappings found in $controls_file" >&2
    return 1
}

# Get TDP topic for a running service
# Usage: tsm_midi_get_topic <service_name>
tsm_midi_get_topic() {
    local service="$1"
    tsm_read_metadata "$service" "tdp_topic"
}

# Set TDP topic for a running service
# Usage: tsm_midi_set_topic <service_name> <topic>
tsm_midi_set_topic() {
    local service="$1"
    local topic="$2"
    tsm_update_metadata "$service" "tdp_topic" "$topic"
}

# List all services registered with TDP topics
# Usage: tsm_midi_list_registered
tsm_midi_list_registered() {
    echo "TDP-registered services:"
    echo "========================"

    for process_dir in "$TSM_PROCESSES_DIR"/*/; do
        [[ -d "$process_dir" ]] || continue
        local name=$(basename "$process_dir")
        local meta_file="$process_dir/meta.json"

        [[ -f "$meta_file" ]] || continue

        local topic
        topic=$(jq -r '.tdp_topic // empty' "$meta_file" 2>/dev/null)

        if [[ -n "$topic" ]]; then
            local status
            status=$(jq -r '.status // "unknown"' "$meta_file" 2>/dev/null)
            printf "  %-20s topic: %-30s status: %s\n" "$name" "$topic" "$status"
        fi
    done
}

# Hook function to be called on service start
# Usage: tsm_midi_on_start <service_name>
tsm_midi_on_start() {
    local service="$1"
    local cwd
    cwd=$(tsm_read_metadata "$service" "cwd")

    # Check for controls.json in service directory
    local controls_file="$cwd/controls.json"
    if [[ -f "$controls_file" ]]; then
        tsm_midi_register_from_controls "$controls_file" "$service"
    fi
}

# Hook function to be called on service stop
# Usage: tsm_midi_on_stop <service_name>
tsm_midi_on_stop() {
    local service="$1"
    local topic
    topic=$(tsm_midi_get_topic "$service")

    if [[ -n "$topic" ]]; then
        tsm_midi_unregister "$service"
    fi
}

# Export functions
export -f tsm_midi_mp_available
export -f tsm_midi_register
export -f tsm_midi_unregister
export -f tsm_midi_register_from_controls
export -f tsm_midi_get_topic
export -f tsm_midi_set_topic
export -f tsm_midi_list_registered
export -f tsm_midi_on_start
export -f tsm_midi_on_stop
