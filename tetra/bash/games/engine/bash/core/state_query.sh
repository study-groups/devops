#!/usr/bin/env bash
# State Query Protocol
# Allows bash to query and export game state from the C engine

[[ -n "${_GAME_STATE_QUERY_LOADED}" ]] && return 0
_GAME_STATE_QUERY_LOADED=1

# Query a single state value
# Usage: game_state_query "pulsar.0.center_x"
game_state_query() {
    local path="$1"
    echo "QUERY $path"

    # Read response from engine
    local response
    read -r response

    if [[ "$response" =~ ^VALUE\ (.+)\ (.+)$ ]]; then
        echo "${BASH_REMATCH[2]}"
        return 0
    elif [[ "$response" =~ ^ERROR\ (.+)$ ]]; then
        echo "Error: ${BASH_REMATCH[1]}" >&2
        return 1
    fi

    return 1
}

# Export entire state as TOML
# Usage: game_state_export > state.toml
game_state_export() {
    echo "EXPORT_STATE"

    # Read multi-line TOML response
    local line
    while IFS= read -r line; do
        [[ "$line" == "END_STATE" ]] && break
        echo "$line"
    done
}

# Import state from TOML file
# Usage: game_state_import state.toml
game_state_import() {
    local file="$1"

    if [[ ! -f "$file" ]]; then
        echo "Error: File not found: $file" >&2
        return 1
    fi

    echo "IMPORT_STATE"
    cat "$file"
    echo "END_STATE"

    # Read response
    local response
    read -r response

    if [[ "$response" =~ ^OK ]]; then
        return 0
    else
        echo "Error: $response" >&2
        return 1
    fi
}

# Set a single state value
# Usage: game_state_set "pulsar.0.center_x" 100.0
game_state_set() {
    local path="$1"
    local value="$2"

    echo "SET_STATE $path $value"

    # Read response
    local response
    read -r response

    if [[ "$response" =~ ^OK ]]; then
        return 0
    else
        echo "Error: $response" >&2
        return 1
    fi
}

# Validate current state
# Usage: game_state_validate
game_state_validate() {
    echo "VALIDATE_STATE"

    local response
    read -r response

    if [[ "$response" =~ ^OK\ VALID ]]; then
        echo "State is valid"
        return 0
    elif [[ "$response" =~ ^ERROR\ (.+)$ ]]; then
        echo "Validation failed: ${BASH_REMATCH[1]}" >&2
        return 1
    fi

    return 1
}

# Get derived property (calculated, not stored)
# Usage: game_state_derive "pulsar.0.arm.0.tip_x"
game_state_derive() {
    local path="$1"
    echo "DERIVE $path"

    local response
    read -r response

    if [[ "$response" =~ ^VALUE\ (.+)\ (.+)$ ]]; then
        echo "${BASH_REMATCH[2]}"
        return 0
    fi

    return 1
}

# List all pulsars
# Usage: game_state_list_pulsars
game_state_list_pulsars() {
    echo "LIST_PULSARS"

    local line
    while IFS= read -r line; do
        [[ "$line" == "END_LIST" ]] && break
        echo "$line"
    done
}

# Get pulsar count
# Usage: count=$(game_state_count_pulsars)
game_state_count_pulsars() {
    game_state_query "world.pulsars.count"
}

# Export single pulsar to TOML
# Usage: game_state_export_pulsar 0 > pulsar_0.toml
game_state_export_pulsar() {
    local id="$1"
    echo "EXPORT_PULSAR $id"

    local line
    while IFS= read -r line; do
        [[ "$line" == "END_PULSAR" ]] && break
        echo "$line"
    done
}

# Watch state value for changes
# Usage: game_state_watch "pulsar.0.entropy.total" "callback_function"
game_state_watch() {
    local path="$1"
    local callback="$2"

    echo "WATCH $path"

    # Read watch ID
    local response
    read -r response

    if [[ "$response" =~ ^WATCH_ID\ ([0-9]+)$ ]]; then
        local watch_id="${BASH_REMATCH[1]}"

        # Store watch callback
        declare -g "GAME_WATCH_${watch_id}=$callback"
        echo "$watch_id"
        return 0
    fi

    return 1
}

# Unwatch state value
# Usage: game_state_unwatch 123
game_state_unwatch() {
    local watch_id="$1"
    echo "UNWATCH $watch_id"

    # Remove callback
    unset "GAME_WATCH_${watch_id}"
}

# Process watch notifications (call in game loop)
# Usage: game_state_process_watches
game_state_process_watches() {
    # Check for watch notifications
    local line
    while IFS= read -t 0 -r line; do
        if [[ "$line" =~ ^WATCH_NOTIFY\ ([0-9]+)\ (.+)\ (.+)$ ]]; then
            local watch_id="${BASH_REMATCH[1]}"
            local path="${BASH_REMATCH[2]}"
            local value="${BASH_REMATCH[3]}"

            # Call registered callback
            local callback_var="GAME_WATCH_${watch_id}"
            local callback="${!callback_var}"

            if [[ -n "$callback" ]]; then
                "$callback" "$path" "$value"
            fi
        fi
    done
}

# Get entropy for pulsar
# Usage: entropy=$(game_state_get_entropy 0)
game_state_get_entropy() {
    local pulsar_id="$1"
    game_state_query "pulsar.${pulsar_id}.entropy.total"
}

# Get world entropy
# Usage: entropy=$(game_state_get_world_entropy)
game_state_get_world_entropy() {
    game_state_query "world.entropy.total"
}

# Dump state for debugging
# Usage: game_state_dump
game_state_dump() {
    echo "=== Game State Dump ===" >&2

    local count=$(game_state_count_pulsars)
    echo "Pulsars: $count" >&2

    for ((i=0; i<count; i++)); do
        echo "--- Pulsar $i ---" >&2
        echo "  Position: ($(game_state_query "pulsar.$i.center_x"), $(game_state_query "pulsar.$i.center_y"))" >&2
        echo "  Energy: $(game_state_query "pulsar.$i.total_energy")" >&2
        echo "  Entropy: $(game_state_query "pulsar.$i.entropy.total")" >&2
    done

    echo "World Entropy: $(game_state_get_world_entropy)" >&2
}
