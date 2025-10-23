#!/usr/bin/env bash

# Game Entity System
# Entity registry, lifecycle management, and update callbacks
# Supports both bash-based rendering and Pulsar C engine integration

# Entity storage (declared globally in game.sh)
# GAME_ENTITIES - array of entity IDs
# GAME_ENTITY_DATA - entity_id:field -> value
# GAME_ENTITY_UPDATE_FN - entity_id -> update function name
# GAME_ENTITY_RENDER_FN - entity_id -> render function name
# GAME_ENTITY_NEXT_ID - next available ID

# GlyphGrid integration mode
declare -g GAME_USE_PULSAR="${GAME_USE_PULSAR:-0}"

# Create a new entity
# Args: entity_type, var_name (variable to store ID in)
# Usage: game_entity_create "pulsar" my_id
game_entity_create() {
    local entity_type="$1"
    local var_name="${2:-GAME_LAST_ENTITY_ID}"

    local entity_id=$GAME_ENTITY_NEXT_ID
    GAME_ENTITY_NEXT_ID=$((GAME_ENTITY_NEXT_ID + 1))

    # Add to registry
    GAME_ENTITIES+=("$entity_id")

    # Initialize common fields (use variables to avoid syntax issues)
    local key_type="${entity_id}:type"
    local key_active="${entity_id}:active"
    local key_x="${entity_id}:x"
    local key_y="${entity_id}:y"

    GAME_ENTITY_DATA["$key_type"]="$entity_type"
    GAME_ENTITY_DATA["$key_active"]="1"
    GAME_ENTITY_DATA["$key_x"]="0"
    GAME_ENTITY_DATA["$key_y"]="0"

    # Set return variable (use printf to avoid eval issues)
    printf -v "$var_name" "%s" "$entity_id"
}

# Set entity field
# Args: entity_id, field, value
game_entity_set() {
    local entity_id="$1"
    local field="$2"
    local value="$3"
    local key="${entity_id}:${field}"
    GAME_ENTITY_DATA["$key"]="$value"
}

# Get entity field
# Args: entity_id, field
# Returns: value
game_entity_get() {
    local entity_id="$1"
    local field="$2"
    local key="${entity_id}:${field}"
    echo "${GAME_ENTITY_DATA[$key]}"
}

# Register update function for entity
# Args: entity_id, function_name
game_entity_register_update() {
    local entity_id="$1"
    local fn_name="$2"
    GAME_ENTITY_UPDATE_FN["$entity_id"]="$fn_name"
}

# Register render function for entity
# Args: entity_id, function_name
game_entity_register_render() {
    local entity_id="$1"
    local fn_name="$2"
    GAME_ENTITY_RENDER_FN["$entity_id"]="$fn_name"
}

# Update all active entities
# Args: delta_ms
game_entity_update_all() {
    local delta="$1"

    for entity_id in "${GAME_ENTITIES[@]}"; do
        local active=$(game_entity_get "$entity_id" "active")
        [[ "$active" != "1" ]] && continue

        local update_fn="${GAME_ENTITY_UPDATE_FN[$entity_id]}"
        if [[ -n "$update_fn" ]] && declare -f "$update_fn" >/dev/null 2>&1; then
            "$update_fn" "$entity_id" "$delta"
        fi
    done
}

# Render all active entities
game_entity_render_all() {
    for entity_id in "${GAME_ENTITIES[@]}"; do
        local active=$(game_entity_get "$entity_id" "active")
        [[ "$active" != "1" ]] && continue

        local render_fn="${GAME_ENTITY_RENDER_FN[$entity_id]}"
        if [[ -n "$render_fn" ]] && declare -f "$render_fn" >/dev/null 2>&1; then
            "$render_fn" "$entity_id"
        fi
    done
}

# Destroy entity
# Args: entity_id
game_entity_destroy() {
    local entity_id="$1"

    # GlyphGrid integration: kill sprite if mapped
    if [[ "$GAME_USE_PULSAR" == "1" ]] && declare -f pulsar_entity_unregister >/dev/null 2>&1; then
        pulsar_entity_unregister "$entity_id"
    fi

    # Remove from active list
    local new_entities=()
    for eid in "${GAME_ENTITIES[@]}"; do
        [[ "$eid" != "$entity_id" ]] && new_entities+=("$eid")
    done
    GAME_ENTITIES=("${new_entities[@]}")

    # Clean up data
    for key in "${!GAME_ENTITY_DATA[@]}"; do
        if [[ "$key" =~ ^${entity_id}: ]]; then
            unset GAME_ENTITY_DATA["$key"]
        fi
    done

    # Clean up function references
    unset GAME_ENTITY_UPDATE_FN["$entity_id"]
    unset GAME_ENTITY_RENDER_FN["$entity_id"]
}

# Clear all entities
game_entity_clear_all() {
    # GlyphGrid integration: kill all mapped sprites
    if [[ "$GAME_USE_PULSAR" == "1" ]] && declare -f pulsar_entity_unregister >/dev/null 2>&1; then
        for entity_id in "${GAME_ENTITIES[@]}"; do
            pulsar_entity_unregister "$entity_id" 2>/dev/null || true
        done
    fi

    GAME_ENTITIES=()
    GAME_ENTITY_DATA=()
    GAME_ENTITY_UPDATE_FN=()
    GAME_ENTITY_RENDER_FN=()
    GAME_ENTITY_NEXT_ID=1
}

# Get count of active entities
game_entity_count() {
    echo "${#GAME_ENTITIES[@]}"
}

# Export entity functions
export -f game_entity_create
export -f game_entity_set
export -f game_entity_get
export -f game_entity_register_update
export -f game_entity_register_render
export -f game_entity_update_all
export -f game_entity_render_all
export -f game_entity_destroy
export -f game_entity_clear_all
export -f game_entity_count
