#!/usr/bin/env bash

# TSM Sibling Services - Peer service relationships
# Siblings are started together as a coordinated stack
# Unlike children (started BY parent), siblings are started WITH each other

# Register a sibling relationship (bidirectional)
# Usage: tsm_register_sibling <service1> <service2>
tsm_register_sibling() {
    local service1="$1"
    local service2="$2"

    if [[ -z "$service1" || -z "$service2" ]]; then
        echo "tsm: usage: tsm_register_sibling <service1> <service2>" >&2
        return 1
    fi

    # Add service2 to service1's siblings
    _tsm_add_sibling "$service1" "$service2"
    # Add service1 to service2's siblings
    _tsm_add_sibling "$service2" "$service1"
}

# Internal: Add a sibling to a service's siblings array
_tsm_add_sibling() {
    local service="$1"
    local sibling="$2"
    local meta_file=$(tsm_get_meta_file "$service")

    if [[ ! -f "$meta_file" ]]; then
        return 1
    fi

    local temp_file="${meta_file}.tmp"
    jq --arg sibling "$sibling" \
        '.siblings = ((.siblings // []) + [$sibling] | unique)' \
        "$meta_file" > "$temp_file"
    mv "$temp_file" "$meta_file"
}

# Unregister a sibling relationship
# Usage: tsm_unregister_sibling <service1> <service2>
tsm_unregister_sibling() {
    local service1="$1"
    local service2="$2"

    _tsm_remove_sibling "$service1" "$service2"
    _tsm_remove_sibling "$service2" "$service1"
}

# Internal: Remove a sibling from a service's siblings array
_tsm_remove_sibling() {
    local service="$1"
    local sibling="$2"
    local meta_file=$(tsm_get_meta_file "$service")

    if [[ ! -f "$meta_file" ]]; then
        return 1
    fi

    local temp_file="${meta_file}.tmp"
    jq --arg sibling "$sibling" \
        '.siblings = ((.siblings // []) - [$sibling])' \
        "$meta_file" > "$temp_file"
    mv "$temp_file" "$meta_file"
}

# Get siblings of a service
# Usage: tsm_get_siblings <service_name>
tsm_get_siblings() {
    local name="$1"
    local meta_file=$(tsm_get_meta_file "$name")

    if [[ ! -f "$meta_file" ]]; then
        return 1
    fi

    jq -r '.siblings // [] | .[]' "$meta_file" 2>/dev/null
}

# Check if two services are siblings
# Usage: tsm_is_sibling <service1> <service2>
tsm_is_sibling() {
    local service1="$1"
    local service2="$2"

    local siblings
    siblings=$(tsm_get_siblings "$service1")

    while IFS= read -r sib; do
        [[ "$sib" == "$service2" ]] && return 0
    done <<< "$siblings"

    return 1
}

# Start all siblings of a service
# Usage: tsm_start_siblings <service_name>
tsm_start_siblings() {
    local name="$1"
    local siblings
    siblings=$(tsm_get_siblings "$name")

    if [[ -z "$siblings" ]]; then
        return 0
    fi

    local started=0
    while IFS= read -r sibling; do
        [[ -z "$sibling" ]] && continue

        # Check if sibling is already running
        if tsm_process_exists "$sibling"; then
            continue
        fi

        # Extract service name from process name (strip -port suffix)
        # e.g., "midi-mp-1984" -> "midi-mp"
        local service_name="${sibling%-[0-9]*}"

        # Try to start the sibling service
        if tsm start "$service_name" 2>/dev/null; then
            ((started++))
        fi
    done <<< "$siblings"

    echo "tsm: started $started sibling(s) for '$name'"
}

# Stop all siblings of a service (cascade)
# Usage: tsm_stop_siblings <service_name> [force]
tsm_stop_siblings() {
    local name="$1"
    local force="${2:-false}"
    local siblings
    siblings=$(tsm_get_siblings "$name")

    if [[ -z "$siblings" ]]; then
        return 0
    fi

    local stopped=0
    while IFS= read -r sibling; do
        [[ -z "$sibling" ]] && continue

        # Check if sibling is running
        if ! tsm_process_exists "$sibling"; then
            continue
        fi

        # Stop the sibling
        if [[ "$force" == "true" ]]; then
            tsm kill "$sibling" 2>/dev/null
        else
            tsm stop "$sibling" 2>/dev/null
        fi
        ((stopped++))
    done <<< "$siblings"

    echo "tsm: stopped $stopped sibling(s) of '$name'"
}

# List all sibling groups (services that share siblings)
# Usage: tsm_list_sibling_groups
tsm_list_sibling_groups() {
    local -A groups
    local -a processed

    for process_dir in "$TSM_PROCESSES_DIR"/*/; do
        [[ -d "$process_dir" ]] || continue
        local name=$(basename "$process_dir")
        local meta_file="$process_dir/meta.json"

        [[ -f "$meta_file" ]] || continue

        # Skip if already processed as part of a group
        local already_processed=false
        for p in "${processed[@]}"; do
            [[ "$p" == "$name" ]] && already_processed=true && break
        done
        [[ "$already_processed" == "true" ]] && continue

        # Get siblings
        local siblings
        siblings=$(jq -r '.siblings // [] | .[]' "$meta_file" 2>/dev/null)

        if [[ -n "$siblings" ]]; then
            echo "Group: $name"
            echo "  Members: $name $(echo "$siblings" | tr '\n' ' ')"
            echo ""

            # Mark all siblings as processed
            processed+=("$name")
            while IFS= read -r sib; do
                [[ -n "$sib" ]] && processed+=("$sib")
            done <<< "$siblings"
        fi
    done
}

# Export functions
export -f tsm_register_sibling
export -f tsm_unregister_sibling
export -f tsm_get_siblings
export -f tsm_is_sibling
export -f tsm_start_siblings
export -f tsm_stop_siblings
export -f tsm_list_sibling_groups
export -f _tsm_add_sibling
export -f _tsm_remove_sibling
