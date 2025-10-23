#!/usr/bin/env bash

# Pulsar Entity Animation
# Manages pulsing arms radiating from a center point

# Create a pulsar entity
# Args: x, y, color_code, pulse_period_ms, var_name
# Usage: pulsar_create 10 20 "$color" 2000 my_pulsar_id
pulsar_create() {
    local x="$1"
    local y="$2"
    local color="$3"
    local period="${4:-2000}"
    local var_name="${5:-GAME_LAST_ENTITY_ID}"

    # Create entity and get ID immediately
    local _eid
    game_entity_create "pulsar" _eid

    # Position
    game_entity_set "$_eid" "x" "$x"
    game_entity_set "$_eid" "y" "$y"

    # Appearance
    game_entity_set "$_eid" "color" "$color"
    game_entity_set "$_eid" "arm_count" "8"

    # Animation state
    game_entity_set "$_eid" "pulse_period" "$period"
    game_entity_set "$_eid" "pulse_time" "0"
    game_entity_set "$_eid" "arm_length" "1"
    game_entity_set "$_eid" "arm_min" "1"
    game_entity_set "$_eid" "arm_max" "10"

    # Rotation state
    game_entity_set "$_eid" "rotation_angle" "0"
    game_entity_set "$_eid" "rotation_speed" "15"  # degrees per second
    game_entity_set "$_eid" "rotation_direction" "1"  # 1=CW, -1=CCW

    # Register update and render functions
    game_entity_register_update "$_eid" "pulsar_update"
    game_entity_register_render "$_eid" "pulsar_render"

    # Set return variable (use printf to avoid subshell)
    printf -v "$var_name" "%s" "$_eid"
}

# Update pulsar animation
# Args: entity_id, delta_ms
pulsar_update() {
    local entity_id="$1"
    local delta="$2"

    # Update pulse time
    local pulse_time=$(game_entity_get "$entity_id" "pulse_time")
    local period=$(game_entity_get "$entity_id" "pulse_period")
    pulse_time=$((pulse_time + delta))

    # Wrap around
    if [[ $pulse_time -ge $period ]]; then
        pulse_time=$((pulse_time - period))
    fi

    game_entity_set "$entity_id" "pulse_time" "$pulse_time"

    # Calculate arm length using sine wave (0 to 1)
    local t=$(awk "BEGIN {print $pulse_time / $period}")
    local pulse=$(tween_sine_01 "$t")

    # Map to arm length range
    local arm_min=$(game_entity_get "$entity_id" "arm_min")
    local arm_max=$(game_entity_get "$entity_id" "arm_max")
    local arm_length=$(awk "BEGIN {printf \"%.0f\", $arm_min + ($arm_max - $arm_min) * $pulse}")

    game_entity_set "$entity_id" "arm_length" "$arm_length"

    # Update rotation angle
    local rotation_angle=$(game_entity_get "$entity_id" "rotation_angle")
    local rotation_speed=$(game_entity_get "$entity_id" "rotation_speed")
    local rotation_direction=$(game_entity_get "$entity_id" "rotation_direction")

    # Calculate degrees to rotate this frame (delta is in ms)
    local degrees_delta=$(awk "BEGIN {printf \"%.2f\", ($rotation_speed * $delta / 1000.0) * $rotation_direction}")
    rotation_angle=$(awk "BEGIN {print $rotation_angle + $degrees_delta}")

    # Normalize angle to 0-360
    while (( $(awk "BEGIN {print ($rotation_angle >= 360)}") )); do
        rotation_angle=$(awk "BEGIN {print $rotation_angle - 360}")
    done
    while (( $(awk "BEGIN {print ($rotation_angle < 0)}") )); do
        rotation_angle=$(awk "BEGIN {print $rotation_angle + 360}")
    done

    game_entity_set "$entity_id" "rotation_angle" "$rotation_angle"
}

# Render pulsar to screen
# Args: entity_id
pulsar_render() {
    local entity_id="$1"

    local cx=$(game_entity_get "$entity_id" "x")
    local cy=$(game_entity_get "$entity_id" "y")
    local color=$(game_entity_get "$entity_id" "color")
    local arm_count=$(game_entity_get "$entity_id" "arm_count")
    local arm_length=$(game_entity_get "$entity_id" "arm_length")
    local rotation_angle=$(game_entity_get "$entity_id" "rotation_angle")

    # Draw center point
    game_draw_char "$cx" "$cy" "●" "$color"

    # Draw 8 arms (cardinal and diagonal directions)
    # Use fixed directions for performance - rotation shows in pulsing
    local directions=(
        "0:-1"    # North
        "1:-1"    # NE
        "1:0"     # East
        "1:1"     # SE
        "0:1"     # South
        "-1:1"    # SW
        "-1:0"    # West
        "-1:-1"   # NW
    )

    # Rotate the directions array based on rotation_angle
    # Approximate: shift directions by rotation index (45° increments)
    local rotation_idx=$(( (${rotation_angle%.*} + 22) / 45 % 8 ))

    # Calculate step to distribute arms evenly
    local step=$((8 / arm_count))
    [[ $step -lt 1 ]] && step=1

    for ((arm_idx=0; arm_idx<arm_count; arm_idx++)); do
        # Get direction index with rotation applied
        local dir_idx=$((arm_idx * step))
        local actual_idx=$(( (dir_idx + rotation_idx) % 8 ))
        local dir="${directions[$actual_idx]}"

        local dx="${dir%%:*}"
        local dy="${dir##*:}"

        # Draw arm segments
        for ((i=1; i<=arm_length; i++)); do
            local x=$((cx + dx * i))
            local y=$((cy + dy * i))

            # Use different characters based on direction
            local char="━"
            if [[ $dx -eq 0 ]]; then
                char="┃"
            elif [[ $dy -eq 0 ]]; then
                char="━"
            elif [[ $dx -eq $dy ]]; then
                char="╲"
            else
                char="╱"
            fi

            game_draw_char "$x" "$y" "$char" "$color"
        done
    done
}

# Set pulsar pulse speed
# Args: entity_id, period_ms
pulsar_set_period() {
    local entity_id="$1"
    local period="$2"
    game_entity_set "$entity_id" "pulse_period" "$period"
}

# Set pulsar arm length range
# Args: entity_id, min_length, max_length
pulsar_set_arm_range() {
    local entity_id="$1"
    local min_len="$2"
    local max_len="$3"
    game_entity_set "$entity_id" "arm_min" "$min_len"
    game_entity_set "$entity_id" "arm_max" "$max_len"
}

# Set pulsar rotation direction
# Args: entity_id, direction (1=CW, -1=CCW)
pulsar_set_rotation() {
    local entity_id="$1"
    local direction="$2"
    game_entity_set "$entity_id" "rotation_direction" "$direction"
}

# Export pulsar functions
export -f pulsar_create
export -f pulsar_update
export -f pulsar_render
export -f pulsar_set_period
export -f pulsar_set_arm_range
export -f pulsar_set_rotation
