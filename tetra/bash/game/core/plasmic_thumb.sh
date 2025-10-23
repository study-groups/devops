#!/usr/bin/env bash
# Plasmic-Thumb Mechanic
# Grab/push/pull pulsars in the field between a pair

[[ -n "${_GAME_PLASMIC_THUMB_LOADED}" ]] && return 0
_GAME_PLASMIC_THUMB_LOADED=1

# Requires pair_dynamics.sh
[[ -z "$_GAME_PAIR_DYNAMICS_LOADED" ]] && source "$(dirname "${BASH_SOURCE[0]}")/pair_dynamics.sh"

# Plasmic-thumb state
declare -g -A PLASMIC_THUMB_ACTIVE      # [player_id] = true/false
declare -g -A PLASMIC_THUMB_TARGET      # [player_id] = target_pulsar_id
declare -g -A PLASMIC_THUMB_ENERGY      # [player_id] = remaining_energy
declare -g -A PLASMIC_THUMB_COOLDOWN    # [player_id] = cooldown_timer

# Configuration
declare -g PLASMIC_THUMB_GRAB_ZONE_ASPECT=0.3
declare -g PLASMIC_THUMB_FORCE_SCALING=2.0
declare -g PLASMIC_THUMB_ENERGY_COST=0.2   # per second
declare -g PLASMIC_THUMB_COOLDOWN_TIME=1.0
declare -g PLASMIC_THUMB_MAX_TARGETS=1

# Activate plasmic-thumb for a player
# Usage: plasmic_thumb_activate <player_id> <pair_id>
plasmic_thumb_activate() {
    local player_id="$1"
    local pair_id="$2"

    # Check cooldown
    local cooldown="${PLASMIC_THUMB_COOLDOWN[$player_id]:-0}"
    if (( $(echo "$cooldown > 0" | bc -l) )); then
        return 1
    fi

    PLASMIC_THUMB_ACTIVE[$player_id]="true"
    PLASMIC_THUMB_ENERGY[$player_id]="1.0"

    return 0
}

# Deactivate plasmic-thumb
# Usage: plasmic_thumb_deactivate <player_id>
plasmic_thumb_deactivate() {
    local player_id="$1"

    PLASMIC_THUMB_ACTIVE[$player_id]="false"
    unset "PLASMIC_THUMB_TARGET[$player_id]"

    # Start cooldown
    PLASMIC_THUMB_COOLDOWN[$player_id]="$PLASMIC_THUMB_COOLDOWN_TIME"
}

# Check if point is inside grab zone (ellipse between pair)
# Usage: if plasmic_thumb_point_in_zone <pair_id> <x> <y>; then ...
plasmic_thumb_point_in_zone() {
    local pair_id="$1"
    local px="$2"
    local py="$3"

    read -r pulsar_a pulsar_b < <(pair_get_pulsars "$pair_id")

    # Get pair positions
    local ax=$(game_state_query "pulsar.${pulsar_a}.center_x" 2>/dev/null || echo "80")
    local ay=$(game_state_query "pulsar.${pulsar_a}.center_y" 2>/dev/null || echo "48")
    local bx=$(game_state_query "pulsar.${pulsar_b}.center_x" 2>/dev/null || echo "80")
    local by=$(game_state_query "pulsar.${pulsar_b}.center_y" 2>/dev/null || echo "48")

    # Calculate ellipse parameters
    local cx=$(echo "scale=2; ($ax + $bx) / 2" | bc -l)
    local cy=$(echo "scale=2; ($ay + $by) / 2" | bc -l)

    local dx=$((bx - ax))
    local dy=$((by - ay))
    local distance=$(echo "scale=2; sqrt($dx*$dx + $dy*$dy)" | bc -l)

    local semi_major=$(echo "scale=2; $distance / 2" | bc -l)
    local semi_minor=$(echo "scale=2; $semi_major * $PLASMIC_THUMB_GRAB_ZONE_ASPECT" | bc -l)

    # Rotate point into ellipse coordinate system
    local angle=$(echo "scale=4; a($dy / $dx)" | bc -l)
    local rx=$(echo "scale=2; ($px - $cx) * c($angle) + ($py - $cy) * s($angle)" | bc -l)
    local ry=$(echo "scale=2; -($px - $cx) * s($angle) + ($py - $cy) * c($angle)" | bc -l)

    # Check ellipse equation: (rx/a)² + (ry/b)² <= 1
    local test=$(echo "scale=4; ($rx/$semi_major)^2 + ($ry/$semi_minor)^2" | bc -l)

    (( $(echo "$test <= 1.0" | bc -l) ))
}

# Find targets in grab zone
# Usage: targets=($(plasmic_thumb_find_targets <pair_id>))
plasmic_thumb_find_targets() {
    local pair_id="$1"
    local targets=()

    # Get all pulsars (placeholder - should query engine)
    # For now, return empty array
    local all_pulsars=($(game_state_list_pulsars 2>/dev/null))

    for pulsar_id in "${all_pulsars[@]}"; do
        # Skip pair members themselves
        read -r pulsar_a pulsar_b < <(pair_get_pulsars "$pair_id")
        if [[ "$pulsar_id" == "$pulsar_a" || "$pulsar_id" == "$pulsar_b" ]]; then
            continue
        fi

        # Get pulsar position
        local px=$(game_state_query "pulsar.${pulsar_id}.center_x" 2>/dev/null)
        local py=$(game_state_query "pulsar.${pulsar_id}.center_y" 2>/dev/null)

        # Check if in grab zone
        if plasmic_thumb_point_in_zone "$pair_id" "$px" "$py"; then
            targets+=("$pulsar_id")

            # Limit to max targets
            if [[ ${#targets[@]} -ge $PLASMIC_THUMB_MAX_TARGETS ]]; then
                break
            fi
        fi
    done

    echo "${targets[@]}"
}

# Apply force to target pulsar
# Usage: plasmic_thumb_apply_force <player_id> <pair_id> <stick_x> <stick_y> <dt>
plasmic_thumb_apply_force() {
    local player_id="$1"
    local pair_id="$2"
    local stick_x="$3"
    local stick_y="$4"
    local dt="${5:-0.016}"

    # Check if active
    if [[ "${PLASMIC_THUMB_ACTIVE[$player_id]}" != "true" ]]; then
        return 1
    fi

    # Get or find target
    local target="${PLASMIC_THUMB_TARGET[$player_id]}"

    if [[ -z "$target" ]]; then
        # Find closest target
        local targets=($(plasmic_thumb_find_targets "$pair_id"))

        if [[ ${#targets[@]} -eq 0 ]]; then
            return 1  # No targets
        fi

        target="${targets[0]}"
        PLASMIC_THUMB_TARGET[$player_id]="$target"
    fi

    # Drain energy
    local energy="${PLASMIC_THUMB_ENERGY[$player_id]}"
    local cost=$(echo "scale=4; $PLASMIC_THUMB_ENERGY_COST * $dt" | bc -l)
    energy=$(echo "scale=4; $energy - $cost" | bc -l)

    if (( $(echo "$energy <= 0" | bc -l) )); then
        # Out of energy, deactivate
        plasmic_thumb_deactivate "$player_id"
        return 1
    fi

    PLASMIC_THUMB_ENERGY[$player_id]="$energy"

    # Calculate force magnitude
    local power_factor=$(pair_get_power_factor "$pair_id")
    local stick_magnitude=$(echo "scale=4; sqrt($stick_x*$stick_x + $stick_y*$stick_y)" | bc -l)

    # Clamp stick magnitude to [0, 1]
    if (( $(echo "$stick_magnitude > 1.0" | bc -l) )); then
        stick_magnitude=1.0
    fi

    local force=$(echo "scale=4; $stick_magnitude * $power_factor * $PLASMIC_THUMB_FORCE_SCALING" | bc -l)

    # Normalize stick direction
    if (( $(echo "$stick_magnitude > 0.01" | bc -l) )); then
        local force_x=$(echo "scale=4; $force * $stick_x / $stick_magnitude" | bc -l)
        local force_y=$(echo "scale=4; $force * $stick_y / $stick_magnitude" | bc -l)

        # Apply force to target
        echo "APPLY_FORCE $target $force_x $force_y"
    fi
}

# Update cooldowns
# Usage: plasmic_thumb_update_cooldowns <dt>
plasmic_thumb_update_cooldowns() {
    local dt="${1:-0.016}"

    for player_id in "${!PLASMIC_THUMB_COOLDOWN[@]}"; do
        local cooldown="${PLASMIC_THUMB_COOLDOWN[$player_id]}"

        if (( $(echo "$cooldown > 0" | bc -l) )); then
            cooldown=$(echo "scale=4; $cooldown - $dt" | bc -l)

            if (( $(echo "$cooldown <= 0" | bc -l) )); then
                cooldown=0
            fi

            PLASMIC_THUMB_COOLDOWN[$player_id]="$cooldown"
        fi
    done
}

# Get grab zone coordinates for rendering
# Usage: read cx cy semi_major semi_minor angle < <(plasmic_thumb_get_zone_params <pair_id>)
plasmic_thumb_get_zone_params() {
    local pair_id="$1"

    read -r pulsar_a pulsar_b < <(pair_get_pulsars "$pair_id")

    # Get pair positions
    local ax=$(game_state_query "pulsar.${pulsar_a}.center_x" 2>/dev/null || echo "80")
    local ay=$(game_state_query "pulsar.${pulsar_a}.center_y" 2>/dev/null || echo "48")
    local bx=$(game_state_query "pulsar.${pulsar_b}.center_x" 2>/dev/null || echo "80")
    local by=$(game_state_query "pulsar.${pulsar_b}.center_y" 2>/dev/null || echo "48")

    # Calculate center
    local cx=$(echo "scale=2; ($ax + $bx) / 2" | bc -l)
    local cy=$(echo "scale=2; ($ay + $by) / 2" | bc -l)

    # Calculate semi-major axis
    local dx=$((bx - ax))
    local dy=$((by - ay))
    local distance=$(echo "scale=2; sqrt($dx*$dx + $dy*$dy)" | bc -l)
    local semi_major=$(echo "scale=2; $distance / 2" | bc -l)

    # Calculate semi-minor axis
    local semi_minor=$(echo "scale=2; $semi_major * $PLASMIC_THUMB_GRAB_ZONE_ASPECT" | bc -l)

    # Calculate rotation angle
    local angle=$(echo "scale=4; a($dy / ($dx + 0.001))" | bc -l)  # Avoid division by zero

    echo "$cx $cy $semi_major $semi_minor $angle"
}

# Check if plasmic-thumb is active for player
# Usage: if plasmic_thumb_is_active <player_id>; then ...
plasmic_thumb_is_active() {
    local player_id="$1"
    [[ "${PLASMIC_THUMB_ACTIVE[$player_id]}" == "true" ]]
}

# Get energy remaining
# Usage: energy=$(plasmic_thumb_get_energy <player_id>)
plasmic_thumb_get_energy() {
    local player_id="$1"
    echo "${PLASMIC_THUMB_ENERGY[$player_id]:-1.0}"
}

# Get cooldown remaining
# Usage: cooldown=$(plasmic_thumb_get_cooldown <player_id>)
plasmic_thumb_get_cooldown() {
    local player_id="$1"
    echo "${PLASMIC_THUMB_COOLDOWN[$player_id]:-0}"
}

# Debug info
# Usage: plasmic_thumb_debug <player_id>
plasmic_thumb_debug() {
    local player_id="$1"

    echo "Plasmic-Thumb Player $player_id:"
    echo "  Active: ${PLASMIC_THUMB_ACTIVE[$player_id]:-false}"
    echo "  Target: ${PLASMIC_THUMB_TARGET[$player_id]:-none}"
    echo "  Energy: $(plasmic_thumb_get_energy "$player_id")"
    echo "  Cooldown: $(plasmic_thumb_get_cooldown "$player_id")"
}
