#!/usr/bin/env bash
# quadrapole_mechanics.sh - Quadrapole control mechanics
# Two pulsars start together, controlled jointly by left stick
# Right stick contrary motion splits them with tension/repulsion dynamics

[[ -n "${_GAME_QUADRAPOLE_MECHANICS_LOADED}" ]] && return 0
_GAME_QUADRAPOLE_MECHANICS_LOADED=1

# ============================================================================
# QUADRAPOLE STATE
# ============================================================================

# State tracking
declare -g QUADRAPOLE_BONDED=1           # 1 = bonded (together), 0 = split
declare -g QUADRAPOLE_PULSAR_A=""        # First pulsar ID
declare -g QUADRAPOLE_PULSAR_B=""        # Second pulsar ID
declare -g QUADRAPOLE_CONTRARY_TIMER=0.0 # Timer for contrary motion detection
declare -g QUADRAPOLE_LAST_LEFT_X=0.0    # Previous left stick X
declare -g QUADRAPOLE_LAST_LEFT_Y=0.0    # Previous left stick Y
declare -g QUADRAPOLE_LAST_RIGHT_X=0.0   # Previous right stick X
declare -g QUADRAPOLE_LAST_RIGHT_Y=0.0   # Previous right stick Y

# Configuration (can be overridden by TOML later)
declare -g QUADRAPOLE_CONTRARY_THRESHOLD=1.5  # Seconds of contrary motion to split
declare -g QUADRAPOLE_CONTRARY_ANGLE=150      # Degrees - how opposite the sticks must be
declare -g QUADRAPOLE_TENSION_CONSTANT=0.3
declare -g QUADRAPOLE_REPULSION_CONSTANT=1.5
declare -g QUADRAPOLE_MAX_SEPARATION=30.0
declare -g QUADRAPOLE_MIN_SEPARATION=5.0
declare -g QUADRAPOLE_START_X=20              # Starting X position (screen center-left)
declare -g QUADRAPOLE_START_Y=12              # Starting Y position

# ============================================================================
# JOYSTICK MAPPING - Maps raw axes to game coordinates
# This is outside the engine as requested
# ============================================================================

# Map raw joystick axes [-1.0, 1.0] to screen velocity
# Usage: quadrapole_map_stick_to_velocity <stick_x> <stick_y> <var_vx> <var_vy>
quadrapole_map_stick_to_velocity() {
    local stick_x="$1"
    local stick_y="$2"
    local -n out_vx="$3"
    local -n out_vy="$4"

    # Apply deadzone
    local deadzone=0.15
    local mag=$(echo "scale=4; sqrt($stick_x*$stick_x + $stick_y*$stick_y)" | bc -l)

    if (( $(echo "$mag < $deadzone" | bc -l) )); then
        out_vx=0.0
        out_vy=0.0
        return
    fi

    # Scale to velocity (e.g., max 20 units/sec)
    local max_velocity=20.0
    out_vx=$(echo "scale=4; $stick_x * $max_velocity" | bc -l)
    out_vy=$(echo "scale=4; $stick_y * $max_velocity" | bc -l)
}

# Map raw joystick axes to pulsar position delta
# Usage: quadrapole_map_stick_to_delta <stick_x> <stick_y> <dt> <var_dx> <var_dy>
quadrapole_map_stick_to_delta() {
    local stick_x="$1"
    local stick_y="$2"
    local dt="$3"
    local -n out_dx="$4"
    local -n out_dy="$5"

    local vx vy
    quadrapole_map_stick_to_velocity "$stick_x" "$stick_y" vx vy

    out_dx=$(echo "scale=4; $vx * $dt" | bc -l)
    out_dy=$(echo "scale=4; $vy * $dt" | bc -l)
}

# ============================================================================
# QUADRAPOLE INITIALIZATION
# ============================================================================

# Initialize quadrapole with two pulsars on top of each other
# Usage: quadrapole_init <pulsar_a_id> <pulsar_b_id>
quadrapole_init() {
    local pulsar_a="$1"
    local pulsar_b="$2"

    QUADRAPOLE_PULSAR_A="$pulsar_a"
    QUADRAPOLE_PULSAR_B="$pulsar_b"
    QUADRAPOLE_BONDED=1
    QUADRAPOLE_CONTRARY_TIMER=0.0

    # Set both pulsars to starting position (center-left of screen)
    pulsar_set "$pulsar_a" "center_x" "$QUADRAPOLE_START_X"
    pulsar_set "$pulsar_a" "center_y" "$QUADRAPOLE_START_Y"
    pulsar_set "$pulsar_b" "center_x" "$QUADRAPOLE_START_X"
    pulsar_set "$pulsar_b" "center_y" "$QUADRAPOLE_START_Y"

    tetra_log_info "game" "Quadrapole initialized at ($QUADRAPOLE_START_X, $QUADRAPOLE_START_Y)"
}

# ============================================================================
# CONTRARY MOTION DETECTION
# ============================================================================

# Calculate angle between two 2D vectors (in degrees)
# Usage: angle=$(quadrapole_angle_between <x1> <y1> <x2> <y2>)
quadrapole_angle_between() {
    local x1="$1" y1="$2" x2="$3" y2="$4"

    # Calculate magnitudes
    local mag1=$(echo "scale=4; sqrt($x1*$x1 + $y1*$y1)" | bc -l)
    local mag2=$(echo "scale=4; sqrt($x2*$x2 + $y2*$y2)" | bc -l)

    # Avoid division by zero
    if (( $(echo "$mag1 < 0.01 || $mag2 < 0.01" | bc -l) )); then
        echo "0"
        return
    fi

    # Dot product
    local dot=$(echo "scale=4; $x1*$x2 + $y1*$y2" | bc -l)

    # Calculate angle in radians, then convert to degrees
    local cos_angle=$(echo "scale=4; $dot / ($mag1 * $mag2)" | bc -l)

    # Clamp to [-1, 1] to avoid domain errors
    cos_angle=$(echo "scale=4; if ($cos_angle > 1.0) 1.0 else if ($cos_angle < -1.0) -1.0 else $cos_angle" | bc -l)

    # arc cosine gives angle in radians, convert to degrees
    local angle_rad=$(echo "scale=4; a(sqrt(1 - $cos_angle*$cos_angle) / $cos_angle)" | bc -l 2>/dev/null || echo "1.57")
    local angle_deg=$(echo "scale=2; $angle_rad * 180 / 3.14159" | bc -l)

    # If dot product is negative, angle is > 90 degrees
    if (( $(echo "$dot < 0" | bc -l) )); then
        angle_deg=$(echo "scale=2; 180 - $angle_deg" | bc -l)
    fi

    echo "$angle_deg"
}

# Check if stick inputs are contrary (opposite directions)
# Returns 0 (true) if contrary, 1 (false) otherwise
# Usage: if quadrapole_is_contrary <lx> <ly> <rx> <ry>; then ...
quadrapole_is_contrary() {
    local lx="$1" ly="$2" rx="$3" ry="$4"

    # Check if both sticks have significant magnitude
    local left_mag=$(echo "scale=4; sqrt($lx*$lx + $ly*$ly)" | bc -l)
    local right_mag=$(echo "scale=4; sqrt($rx*$rx + $ry*$ry)" | bc -l)

    if (( $(echo "$left_mag < 0.3 || $right_mag < 0.3" | bc -l) )); then
        return 1  # Not contrary - sticks not active enough
    fi

    # Calculate angle between stick directions
    local angle=$(quadrapole_angle_between "$lx" "$ly" "$rx" "$ry")

    # Check if angle is >= threshold (default 150 degrees = mostly opposite)
    if (( $(echo "$angle >= $QUADRAPOLE_CONTRARY_ANGLE" | bc -l) )); then
        return 0  # Contrary motion detected
    fi

    return 1  # Not contrary
}

# ============================================================================
# QUADRAPOLE UPDATE LOOP
# ============================================================================

# Main quadrapole update function
# Processes stick inputs and manages bonded/split state
# Usage: quadrapole_update <left_x> <left_y> <right_x> <right_y> <dt>
quadrapole_update() {
    local left_x="$1"
    local left_y="$2"
    local right_x="$3"
    local right_y="$4"
    local dt="$5"

    # Get mapped velocities for logging
    local left_vx left_vy right_vx right_vy
    quadrapole_map_stick_to_velocity "$left_x" "$left_y" left_vx left_vy
    quadrapole_map_stick_to_velocity "$right_x" "$right_y" right_vx right_vy

    # Log mapped values and current state
    tetra_log_debug "game" "Sticks: L[%.2f,%.2f]->V[%.2f,%.2f] R[%.2f,%.2f]->V[%.2f,%.2f] bonded=%d timer=%.2f" \
        "$left_x" "$left_y" "$left_vx" "$left_vy" \
        "$right_x" "$right_y" "$right_vx" "$right_vy" \
        "$QUADRAPOLE_BONDED" "$QUADRAPOLE_CONTRARY_TIMER"

    # Dev mode logging (if enabled)
    if declare -F dev_mode_log_mapping >/dev/null 2>&1; then
        dev_mode_log_mapping "$left_x" "$left_y" "$left_vx" "$left_vy" \
                             "$right_x" "$right_y" "$right_vx" "$right_vy"
        dev_mode_log_state "$QUADRAPOLE_BONDED" "$QUADRAPOLE_CONTRARY_TIMER"
    fi

    if [[ "$QUADRAPOLE_BONDED" == "1" ]]; then
        # BONDED STATE: Both pulsars move together with left stick
        quadrapole_update_bonded "$left_x" "$left_y" "$right_x" "$right_y" "$dt"
    else
        # SPLIT STATE: Left stick controls A, right stick controls B, with field forces
        quadrapole_update_split "$left_x" "$left_y" "$right_x" "$right_y" "$dt"
    fi

    # Store current stick values for next frame
    QUADRAPOLE_LAST_LEFT_X="$left_x"
    QUADRAPOLE_LAST_LEFT_Y="$left_y"
    QUADRAPOLE_LAST_RIGHT_X="$right_x"
    QUADRAPOLE_LAST_RIGHT_Y="$right_y"
}

# Update bonded state - both pulsars move together
quadrapole_update_bonded() {
    local left_x="$1" left_y="$2" right_x="$3" right_y="$4" dt="$5"

    # Check for contrary motion
    if quadrapole_is_contrary "$left_x" "$left_y" "$right_x" "$right_y"; then
        # Increment timer
        QUADRAPOLE_CONTRARY_TIMER=$(echo "scale=4; $QUADRAPOLE_CONTRARY_TIMER + $dt" | bc -l)

        tetra_log_debug "game" "Contrary motion detected! Timer: %.2fs / %.2fs" \
            "$QUADRAPOLE_CONTRARY_TIMER" "$QUADRAPOLE_CONTRARY_THRESHOLD"

        # Check if timer exceeds threshold
        if (( $(echo "$QUADRAPOLE_CONTRARY_TIMER >= $QUADRAPOLE_CONTRARY_THRESHOLD" | bc -l) )); then
            # SNAP! Split the quadrapole
            quadrapole_split
            return
        fi
    else
        # Reset timer if not contrary
        if (( $(echo "$QUADRAPOLE_CONTRARY_TIMER > 0" | bc -l) )); then
            QUADRAPOLE_CONTRARY_TIMER=$(echo "scale=4; $QUADRAPOLE_CONTRARY_TIMER - ($dt * 2.0)" | bc -l)
            if (( $(echo "$QUADRAPOLE_CONTRARY_TIMER < 0" | bc -l) )); then
                QUADRAPOLE_CONTRARY_TIMER=0.0
            fi
        fi
    fi

    # Move both pulsars together using left stick
    local dx dy
    quadrapole_map_stick_to_delta "$left_x" "$left_y" "$dt" dx dy

    if (( $(echo "$dx != 0 || $dy != 0" | bc -l) )); then
        # Get current positions
        local ax=$(pulsar_query "$QUADRAPOLE_PULSAR_A" "center_x" 2>/dev/null || echo "$QUADRAPOLE_START_X")
        local ay=$(pulsar_query "$QUADRAPOLE_PULSAR_A" "center_y" 2>/dev/null || echo "$QUADRAPOLE_START_Y")

        # Calculate new positions
        local new_x=$(echo "scale=2; $ax + $dx" | bc -l)
        local new_y=$(echo "scale=2; $ay + $dy" | bc -l)

        # Apply to both pulsars
        pulsar_set "$QUADRAPOLE_PULSAR_A" "center_x" "$new_x"
        pulsar_set "$QUADRAPOLE_PULSAR_A" "center_y" "$new_y"
        pulsar_set "$QUADRAPOLE_PULSAR_B" "center_x" "$new_x"
        pulsar_set "$QUADRAPOLE_PULSAR_B" "center_y" "$new_y"

        tetra_log_debug "game" "Bonded move: (%.2f, %.2f) -> (%.2f, %.2f)" "$ax" "$ay" "$new_x" "$new_y"
    fi
}

# Update split state - independent control with field forces
quadrapole_update_split() {
    local left_x="$1" left_y="$2" right_x="$3" right_y="$4" dt="$5"

    # Move pulsar A with left stick
    local dx_a dy_a
    quadrapole_map_stick_to_delta "$left_x" "$left_y" "$dt" dx_a dy_a

    if (( $(echo "$dx_a != 0 || $dy_a != 0" | bc -l) )); then
        local ax=$(pulsar_query "$QUADRAPOLE_PULSAR_A" "center_x" 2>/dev/null || echo "$QUADRAPOLE_START_X")
        local ay=$(pulsar_query "$QUADRAPOLE_PULSAR_A" "center_y" 2>/dev/null || echo "$QUADRAPOLE_START_Y")
        local new_ax=$(echo "scale=2; $ax + $dx_a" | bc -l)
        local new_ay=$(echo "scale=2; $ay + $dy_a" | bc -l)
        pulsar_set "$QUADRAPOLE_PULSAR_A" "center_x" "$new_ax"
        pulsar_set "$QUADRAPOLE_PULSAR_A" "center_y" "$new_ay"
    fi

    # Move pulsar B with right stick
    local dx_b dy_b
    quadrapole_map_stick_to_delta "$right_x" "$right_y" "$dt" dx_b dy_b

    if (( $(echo "$dx_b != 0 || $dy_b != 0" | bc -l) )); then
        local bx=$(pulsar_query "$QUADRAPOLE_PULSAR_B" "center_x" 2>/dev/null || echo "$QUADRAPOLE_START_X")
        local by=$(pulsar_query "$QUADRAPOLE_PULSAR_B" "center_y" 2>/dev/null || echo "$QUADRAPOLE_START_Y")
        local new_bx=$(echo "scale=2; $bx + $dx_b" | bc -l)
        local new_by=$(echo "scale=2; $by + $dy_b" | bc -l)
        pulsar_set "$QUADRAPOLE_PULSAR_B" "center_x" "$new_bx"
        pulsar_set "$QUADRAPOLE_PULSAR_B" "center_y" "$new_by"
    fi

    # Apply field forces (tension/repulsion)
    quadrapole_apply_field_forces "$dt"
}

# Split the quadrapole
quadrapole_split() {
    QUADRAPOLE_BONDED=0
    QUADRAPOLE_CONTRARY_TIMER=0.0

    tetra_log_info "game" "SNAP! Quadrapole split - independent control active"

    # Offset the pulsars slightly so they're not on top of each other
    local ax=$(game_state_query "pulsar.${QUADRAPOLE_PULSAR_A}.center_x" 2>/dev/null || echo "$QUADRAPOLE_START_X")
    local ay=$(game_state_query "pulsar.${QUADRAPOLE_PULSAR_A}.center_y" 2>/dev/null || echo "$QUADRAPOLE_START_Y")

    local new_bx=$(echo "scale=2; $ax + 2" | bc -l)
    pulsar_set "$QUADRAPOLE_PULSAR_B" "center_x" "$new_bx"
}

# ============================================================================
# FIELD FORCES (TENSION & REPULSION)
# ============================================================================

# Apply tension and repulsion forces between pulsars
# Usage: quadrapole_apply_field_forces <dt>
quadrapole_apply_field_forces() {
    local dt="$1"

    # Get positions
    local ax=$(game_state_query "pulsar.${QUADRAPOLE_PULSAR_A}.center_x" 2>/dev/null || echo "$QUADRAPOLE_START_X")
    local ay=$(game_state_query "pulsar.${QUADRAPOLE_PULSAR_A}.center_y" 2>/dev/null || echo "$QUADRAPOLE_START_Y")
    local bx=$(game_state_query "pulsar.${QUADRAPOLE_PULSAR_B}.center_x" 2>/dev/null || echo "$QUADRAPOLE_START_X")
    local by=$(game_state_query "pulsar.${QUADRAPOLE_PULSAR_B}.center_y" 2>/dev/null || echo "$QUADRAPOLE_START_Y")

    # Calculate distance and direction
    local dx=$(echo "scale=4; $bx - $ax" | bc -l)
    local dy=$(echo "scale=4; $by - $ay" | bc -l)
    local distance=$(echo "scale=4; sqrt($dx*$dx + $dy*$dy)" | bc -l)

    # Avoid division by zero
    if (( $(echo "$distance < 0.1" | bc -l) )); then
        return
    fi

    # Unit vector from A to B
    local ux=$(echo "scale=4; $dx / $distance" | bc -l)
    local uy=$(echo "scale=4; $dy / $distance" | bc -l)

    local force_x=0.0 force_y=0.0

    # Apply tension if too far apart
    if (( $(echo "$distance > $QUADRAPOLE_MAX_SEPARATION" | bc -l) )); then
        local excess=$(echo "scale=4; $distance - $QUADRAPOLE_MAX_SEPARATION" | bc -l)
        local tension=$(echo "scale=4; $QUADRAPOLE_TENSION_CONSTANT * $excess" | bc -l)

        force_x=$(echo "scale=4; $tension * $ux" | bc -l)
        force_y=$(echo "scale=4; $tension * $uy" | bc -l)

        tetra_log_debug "game" "Tension: dist=%.2f excess=%.2f force=[%.2f, %.2f]" \
            "$distance" "$excess" "$force_x" "$force_y"
    fi

    # Apply repulsion if too close
    if (( $(echo "$distance < $QUADRAPOLE_MIN_SEPARATION" | bc -l) )); then
        local deficit=$(echo "scale=4; $QUADRAPOLE_MIN_SEPARATION - $distance" | bc -l)
        local repulsion=$(echo "scale=4; $QUADRAPOLE_REPULSION_CONSTANT * $deficit" | bc -l)

        force_x=$(echo "scale=4; -$repulsion * $ux" | bc -l)
        force_y=$(echo "scale=4; -$repulsion * $uy" | bc -l)

        tetra_log_debug "game" "Repulsion: dist=%.2f deficit=%.2f force=[%.2f, %.2f]" \
            "$distance" "$deficit" "$force_x" "$force_y"
    fi

    # Apply forces to both pulsars (equal and opposite)
    if (( $(echo "$force_x != 0 || $force_y != 0" | bc -l) )); then
        # Apply to A (toward/away from B)
        local new_ax=$(echo "scale=2; $ax + $force_x * $dt" | bc -l)
        local new_ay=$(echo "scale=2; $ay + $force_y * $dt" | bc -l)
        pulsar_set "$QUADRAPOLE_PULSAR_A" "center_x" "$new_ax"
        pulsar_set "$QUADRAPOLE_PULSAR_A" "center_y" "$new_ay"

        # Apply to B (opposite direction)
        local new_bx=$(echo "scale=2; $bx - $force_x * $dt" | bc -l)
        local new_by=$(echo "scale=2; $by - $force_y * $dt" | bc -l)
        pulsar_set "$QUADRAPOLE_PULSAR_B" "center_x" "$new_bx"
        pulsar_set "$QUADRAPOLE_PULSAR_B" "center_y" "$new_by"
    fi
}

# ============================================================================
# EXPORTS
# ============================================================================

export -f quadrapole_map_stick_to_velocity
export -f quadrapole_map_stick_to_delta
export -f quadrapole_init
export -f quadrapole_angle_between
export -f quadrapole_is_contrary
export -f quadrapole_update
export -f quadrapole_update_bonded
export -f quadrapole_update_split
export -f quadrapole_split
export -f quadrapole_apply_field_forces
