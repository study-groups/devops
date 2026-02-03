#!/usr/bin/env bash
# cdp_session.sh - CDP Agent Session Management (TES-Agent 1.0)
#
# Type Contracts:
#   cdp.save_session :: (session_data:json) → @cdp:config/session.state
#     where Effect[filesystem]
#
#   cdp.load_session :: () → Session[json]
#     where Effect[filesystem]
#
#   cdp.clear_session :: () → Status
#     where Effect[filesystem]

# Source paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/cdp_paths.sh"

# Save session state
cdp_save_session() {
    local session_data="$1"

    if [[ -z "$session_data" ]]; then
        echo "Error: Session data required" >&2
        return 1
    fi

    local session_file=$(cdp_get_session_state)
    local session_dir=$(dirname "$session_file")

    mkdir -p "$session_dir"

    if ! echo "$session_data" | jq empty 2>/dev/null; then
        echo "Error: Invalid JSON in session data" >&2
        return 1
    fi

    echo "$session_data" | jq '.' > "$session_file"
    return 0
}

# Load session state
cdp_load_session() {
    local session_file=$(cdp_get_session_state)

    if [[ ! -f "$session_file" ]]; then
        jq -n '{
            "session_id": "",
            "agent": "cdp",
            "connected": false,
            "connected_at": null,
            "external": {},
            "metadata": {}
        }'
        return 0
    fi

    jq '.' "$session_file"
}

# Get session state file path
cdp_get_session_state_file() {
    echo "$(cdp_get_config_dir)/session.state"
}

# Check if session is connected
cdp_is_connected() {
    local session=$(cdp_load_session)
    local connected=$(echo "$session" | jq -r '.connected // false')
    [[ "$connected" == "true" ]]
}

# Get session ID
cdp_get_session_id() {
    local session=$(cdp_load_session)
    echo "$session" | jq -r '.session_id // ""'
}

# Get session WebSocket URL
cdp_get_session_ws_url() {
    local session=$(cdp_load_session)
    echo "$session" | jq -r '.external.websocket_url // ""'
}

# Get session Chrome PID
cdp_get_session_chrome_pid() {
    local session=$(cdp_load_session)
    echo "$session" | jq -r '.external.process_id // ""'
}

# Update session field
cdp_update_session_field() {
    local field="$1"
    local value="$2"

    local session=$(cdp_load_session)
    local updated=$(echo "$session" | jq --arg field "$field" --arg value "$value" \
        'setpath($field | split("."); $value)')

    cdp_save_session "$updated"
}

# Mark session as connected
cdp_mark_connected() {
    local session_id="$1"
    local ws_url="$2"
    local chrome_pid="$3"

    local timestamp=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

    local session_data=$(jq -n \
        --arg session_id "$session_id" \
        --arg agent "cdp" \
        --arg timestamp "$timestamp" \
        --arg ws_url "$ws_url" \
        --arg chrome_pid "$chrome_pid" \
        '{
            "session_id": $session_id,
            "agent": $agent,
            "connected": true,
            "connected_at": $timestamp,
            "external": {
                "websocket_url": $ws_url,
                "process_id": $chrome_pid
            },
            "metadata": {
                "profile": "default",
                "version": "1.0"
            }
        }')

    cdp_save_session "$session_data"
}

# Mark session as disconnected
cdp_mark_disconnected() {
    local session=$(cdp_load_session)
    local updated=$(echo "$session" | jq '.connected = false')
    cdp_save_session "$updated"
}

# Clear session
cdp_clear_session() {
    local session_file=$(cdp_get_session_state)

    if [[ -f "$session_file" ]]; then
        rm "$session_file"
        echo "Session cleared"
    else
        echo "No session to clear"
    fi
}

# Get session metadata
cdp_get_session_metadata() {
    local session=$(cdp_load_session)
    echo "$session" | jq '.metadata // {}'
}

# Set session metadata
cdp_set_session_metadata() {
    local key="$1"
    local value="$2"

    local session=$(cdp_load_session)
    local updated=$(echo "$session" | jq \
        --arg key "$key" \
        --arg value "$value" \
        '.metadata[$key] = $value')

    cdp_save_session "$updated"
}
