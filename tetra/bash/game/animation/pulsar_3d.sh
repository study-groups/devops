#!/usr/bin/env bash

# Pulsar Entity - Pulsar C Engine Backend
# Uses native Pulsar8 sprites via Pulsar protocol

# Create a pulsar entity using Pulsar backend
# Args: x, y, valence, pulse_period_ms, var_name
# Usage: pulsar_3d_create 40 12 "accent" 2000 my_pulsar_id
pulsar_3d_create() {
    local x="$1"
    local y="$2"
    local valence="${3:-accent}"
    local period="${4:-2000}"
    local var_name="${5:-GAME_LAST_ENTITY_ID}"

    # Create bash entity wrapper
    local _eid
    game_entity_create "pulsar_glyphgrid" _eid

    # Convert terminal coordinates to microgrid
    local coords
    coords=$(pulsar_cell_to_micro "$x" "$y")
    local mx=${coords%% *}
    local my=${coords##* }

    # Calculate Pulsar parameters from period
    # period (ms) → freq (Hz): freq = 1 / (period / 1000)
    local freq
    freq=$(awk "BEGIN {printf \"%.3f\", 1.0 / ($period / 1000.0)}")

    # Fixed defaults for arm animation
    local len0=18    # base arm length (microgrid units)
    local amp=6      # pulse amplitude (microgrid units)
    local dtheta=0.6 # rotation speed (rad/s)

    # Convert valence string to integer
    local val_int
    val_int=$(pulsar_valence_to_int "$valence")

    # Spawn Pulsar8 sprite in C engine
    local glyph_id
    glyph_id=$(pulsar_spawn_pulsar "$mx" "$my" "$len0" "$amp" "$freq" "$dtheta" "$val_int")

    if [[ -z "$glyph_id" ]]; then
        tetra_log_error "game" "Failed to spawn Pulsar pulsar"
        game_entity_destroy "$_eid"
        return 1
    fi

    # Store entity data
    game_entity_set "$_eid" "x" "$x"
    game_entity_set "$_eid" "y" "$y"
    game_entity_set "$_eid" "valence" "$valence"
    game_entity_set "$_eid" "glyph_id" "$glyph_id"
    game_entity_set "$_eid" "pulse_period" "$period"
    game_entity_set "$_eid" "rotation_speed" "$dtheta"
    game_entity_set "$_eid" "arm_count" "8"
    game_entity_set "$_eid" "len0" "$len0"
    game_entity_set "$_eid" "amp" "$amp"
    game_entity_set "$_eid" "freq" "$freq"

    # Register entity-to-glyph mapping
    pulsar_entity_register "$_eid" "$glyph_id"

    # Register update function (render happens in C engine)
    game_entity_register_update "$_eid" "pulsar_3d_update"

    # Set return variable
    printf -v "$var_name" "%s" "$_eid"
}

# Update pulsar parameters (currently no-op, C engine handles animation)
# Args: entity_id, delta_ms
pulsar_3d_update() {
    local entity_id="$1"
    local delta="$2"

    # Future: could update Pulsar parameters here via SET commands
    # For now, the C engine handles all animation autonomously
}

# Set pulsar position
# Args: entity_id, x, y
pulsar_3d_set_position() {
    local entity_id="$1"
    local x="$2"
    local y="$3"

    local glyph_id
    glyph_id=$(game_entity_get "$entity_id" "glyph_id")

    if [[ -z "$glyph_id" ]]; then
        tetra_log_error "game" "Entity $entity_id has no glyph_id"
        return 1
    fi

    # Convert to microgrid coordinates
    local coords
    coords=$(pulsar_cell_to_micro "$x" "$y")
    local mx=${coords%% *}
    local my=${coords##* }

    # Update C engine
    pulsar_set "$glyph_id" "x" "$mx"
    pulsar_set "$glyph_id" "y" "$my"

    # Update entity data
    game_entity_set "$entity_id" "x" "$x"
    game_entity_set "$entity_id" "y" "$y"
}

# Set pulsar rotation speed
# Args: entity_id, dtheta (rad/s)
pulsar_3d_set_rotation() {
    local entity_id="$1"
    local dtheta="$2"

    local glyph_id
    glyph_id=$(game_entity_get "$entity_id" "glyph_id")

    if [[ -z "$glyph_id" ]]; then
        tetra_log_error "game" "Entity $entity_id has no glyph_id"
        return 1
    fi

    # Update C engine
    pulsar_set "$glyph_id" "dtheta" "$dtheta"

    # Update entity data
    game_entity_set "$entity_id" "rotation_speed" "$dtheta"
}

# Set pulsar arm count (by adjusting amplitude per arm)
# Args: entity_id, count (1-8)
pulsar_3d_set_arm_count() {
    local entity_id="$1"
    local count="$2"

    if [[ $count -lt 1 || $count -gt 8 ]]; then
        tetra_log_warn "game" "Arm count must be 1-8, got: $count"
        return 1
    fi

    local glyph_id
    glyph_id=$(game_entity_get "$entity_id" "glyph_id")

    if [[ -z "$glyph_id" ]]; then
        tetra_log_error "game" "Entity $entity_id has no glyph_id"
        return 1
    fi

    # Show first N arms by setting amp to 0 for others
    for ((i=0; i<8; i++)); do
        if [[ $i -lt $count ]]; then
            pulsar_set "$glyph_id" "amp[$i]" "6"
        else
            pulsar_set "$glyph_id" "amp[$i]" "0"
        fi
    done

    game_entity_set "$entity_id" "arm_count" "$count"
}

# Set pulsar pulse frequency
# Args: entity_id, period_ms
pulsar_3d_set_period() {
    local entity_id="$1"
    local period="$2"

    local glyph_id
    glyph_id=$(game_entity_get "$entity_id" "glyph_id")

    if [[ -z "$glyph_id" ]]; then
        tetra_log_error "game" "Entity $entity_id has no glyph_id"
        return 1
    fi

    # Convert period (ms) to frequency (Hz)
    local freq
    freq=$(awk "BEGIN {printf \"%.3f\", 1.0 / ($period / 1000.0)}")

    # Update all arms with new frequency
    for ((i=0; i<8; i++)); do
        pulsar_set "$glyph_id" "freq[$i]" "$freq"
    done

    game_entity_set "$entity_id" "pulse_period" "$period"
    game_entity_set "$entity_id" "freq" "$freq"
}

# Export functions
export -f pulsar_3d_create
export -f pulsar_3d_update
export -f pulsar_3d_set_position
export -f pulsar_3d_set_rotation
export -f pulsar_3d_set_arm_count
export -f pulsar_3d_set_period
