#!/usr/bin/env bash

# MSC - Message Sequence Chart Generator
# Core data structures and state management

# Determine MSC directory
MSC_SRC="${MSC_SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
export MSC_SRC

# MSC State
declare -ga MSC_ENTITIES=()          # List of entity names (column headers)
declare -ga MSC_EVENTS=()            # List of events (serialized)
declare -gA MSC_ENTITY_COLORS=()     # Entity name -> color hex
declare -g MSC_CURRENT_INDEX=0       # Event counter

# Default colors for entities (cycle through these)
MSC_DEFAULT_COLORS=(
    "66FFFF"  # Cyan
    "FF6B9D"  # Pink
    "FFD666"  # Yellow
    "95E1D3"  # Teal
    "F38BA8"  # Rose
    "B4BEFE"  # Lavender
    "89DCEB"  # Sky
    "FAB387"  # Peach
)

# ============================================================================
# INITIALIZATION
# ============================================================================

# Initialize MSC with entities (column headers)
# Usage: msc_init "User" "REPL" "Database" "API"
msc_init() {
    local entities=("$@")

    if [[ ${#entities[@]} -eq 0 ]]; then
        echo "Error: msc_init requires at least one entity" >&2
        return 1
    fi

    # Reset state
    MSC_ENTITIES=()
    MSC_EVENTS=()
    MSC_ENTITY_COLORS=()
    MSC_CURRENT_INDEX=0

    # Register entities with colors
    local color_index=0
    for entity in "${entities[@]}"; do
        MSC_ENTITIES+=("$entity")
        local color="${MSC_DEFAULT_COLORS[$color_index]}"
        MSC_ENTITY_COLORS[$entity]="$color"
        color_index=$(( (color_index + 1) % ${#MSC_DEFAULT_COLORS[@]} ))
    done
}

# Clear MSC state
msc_clear() {
    MSC_ENTITIES=()
    MSC_EVENTS=()
    MSC_ENTITY_COLORS=()
    MSC_CURRENT_INDEX=0
}

# ============================================================================
# EVENT RECORDING
# ============================================================================

# Record a message between entities
# Usage: msc_message "User" "REPL" "user new mike"
msc_message() {
    local from="$1"
    local to="$2"
    local label="$3"

    if [[ -z "$from" || -z "$to" || -z "$label" ]]; then
        echo "Error: msc_message requires from, to, and label" >&2
        return 1
    fi

    # Validate entities exist
    local from_valid=false
    local to_valid=false
    for entity in "${MSC_ENTITIES[@]}"; do
        [[ "$entity" == "$from" ]] && from_valid=true
        [[ "$entity" == "$to" ]] && to_valid=true
    done

    if [[ "$from_valid" == "false" ]]; then
        echo "Error: Entity '$from' not found in MSC" >&2
        return 1
    fi

    if [[ "$to_valid" == "false" ]]; then
        echo "Error: Entity '$to' not found in MSC" >&2
        return 1
    fi

    # Serialize event: type|from|to|label
    MSC_EVENTS+=("message|$from|$to|$label")
    MSC_CURRENT_INDEX=$((MSC_CURRENT_INDEX + 1))
}

# Record a note on an entity
# Usage: msc_note "Database" "Writing to disk..."
msc_note() {
    local entity="$1"
    local text="$2"

    if [[ -z "$entity" || -z "$text" ]]; then
        echo "Error: msc_note requires entity and text" >&2
        return 1
    fi

    # Validate entity exists
    local entity_valid=false
    for e in "${MSC_ENTITIES[@]}"; do
        [[ "$e" == "$entity" ]] && entity_valid=true && break
    done

    if [[ "$entity_valid" == "false" ]]; then
        echo "Error: Entity '$entity' not found in MSC" >&2
        return 1
    fi

    # Serialize event: type|entity|text
    MSC_EVENTS+=("note|$entity|$text")
    MSC_CURRENT_INDEX=$((MSC_CURRENT_INDEX + 1))
}

# Record an activation (entity starts processing)
# Usage: msc_activate "API"
msc_activate() {
    local entity="$1"

    if [[ -z "$entity" ]]; then
        echo "Error: msc_activate requires entity" >&2
        return 1
    fi

    MSC_EVENTS+=("activate|$entity")
    MSC_CURRENT_INDEX=$((MSC_CURRENT_INDEX + 1))
}

# Record a deactivation (entity stops processing)
# Usage: msc_deactivate "API"
msc_deactivate() {
    local entity="$1"

    if [[ -z "$entity" ]]; then
        echo "Error: msc_deactivate requires entity" >&2
        return 1
    fi

    MSC_EVENTS+=("deactivate|$entity")
    MSC_CURRENT_INDEX=$((MSC_CURRENT_INDEX + 1))
}

# ============================================================================
# QUERY FUNCTIONS
# ============================================================================

# Get entity index (0-based)
msc_get_entity_index() {
    local entity="$1"
    local index=0

    for e in "${MSC_ENTITIES[@]}"; do
        if [[ "$e" == "$entity" ]]; then
            echo "$index"
            return 0
        fi
        index=$((index + 1))
    done

    echo "-1"
    return 1
}

# Get entity count
msc_get_entity_count() {
    echo "${#MSC_ENTITIES[@]}"
}

# Get event count
msc_get_event_count() {
    echo "${#MSC_EVENTS[@]}"
}

# Get entity color
msc_get_entity_color() {
    local entity="$1"
    echo "${MSC_ENTITY_COLORS[$entity]}"
}

# Export functions
export -f msc_init msc_clear
export -f msc_message msc_note msc_activate msc_deactivate
export -f msc_get_entity_index msc_get_entity_count msc_get_event_count msc_get_entity_color
