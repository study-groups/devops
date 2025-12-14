#!/usr/bin/env bash
# Pair Dynamics System
# Manages pair bonds, energy transfer, and tether physics

[[ -n "${_GAME_PAIR_DYNAMICS_LOADED}" ]] && return 0
_GAME_PAIR_DYNAMICS_LOADED=1

# Pair bond storage
declare -g -A GAME_PAIR_BONDS          # [pair_id] = "pulsar_a_id:pulsar_b_id"
declare -g -A GAME_PAIR_PLAYERS        # [pair_id] = player_id
declare -g -A GAME_PULSAR_TO_PAIR      # [pulsar_id] = pair_id
declare -g GAME_NEXT_PAIR_ID=0

# Configuration (default values, load from TOML later)
declare -g PAIR_MAX_SEPARATION=80.0
declare -g PAIR_MIN_SEPARATION=10.0
declare -g PAIR_SPRING_CONSTANT=0.5
declare -g PAIR_REPULSION_CONSTANT=2.0
declare -g ENERGY_TRANSFER_RATE=0.1

# Create a pair bond between two pulsars
# Usage: pair_create <pulsar_a_id> <pulsar_b_id> <player_id>
pair_create() {
    local pulsar_a="$1"
    local pulsar_b="$2"
    local player_id="${3:-0}"

    local pair_id="pair_${GAME_NEXT_PAIR_ID}"
    ((GAME_NEXT_PAIR_ID++))

    GAME_PAIR_BONDS[$pair_id]="${pulsar_a}:${pulsar_b}"
    GAME_PAIR_PLAYERS[$pair_id]="$player_id"
    GAME_PULSAR_TO_PAIR[$pulsar_a]="$pair_id"
    GAME_PULSAR_TO_PAIR[$pulsar_b]="$pair_id"

    echo "$pair_id"
}

# Get pair ID for a pulsar
# Usage: pair=$(pair_get_for_pulsar <pulsar_id>)
pair_get_for_pulsar() {
    local pulsar_id="$1"
    echo "${GAME_PULSAR_TO_PAIR[$pulsar_id]}"
}

# Get both pulsars in a pair
# Usage: read pulsar_a pulsar_b < <(pair_get_pulsars <pair_id>)
pair_get_pulsars() {
    local pair_id="$1"
    local bond="${GAME_PAIR_BONDS[$pair_id]}"

    if [[ -n "$bond" ]]; then
        echo "${bond//:/ }"
    fi
}

# Get partner pulsar
# Usage: partner=$(pair_get_partner <pulsar_id>)
pair_get_partner() {
    local pulsar_id="$1"
    local pair_id=$(pair_get_for_pulsar "$pulsar_id")

    if [[ -z "$pair_id" ]]; then
        return 1
    fi

    read -r pulsar_a pulsar_b < <(pair_get_pulsars "$pair_id")

    if [[ "$pulsar_a" == "$pulsar_id" ]]; then
        echo "$pulsar_b"
    else
        echo "$pulsar_a"
    fi
}

# Calculate distance between pair members
# Usage: dist=$(pair_get_distance <pair_id>)
pair_get_distance() {
    local pair_id="$1"
    read -r pulsar_a pulsar_b < <(pair_get_pulsars "$pair_id")

    # Query positions from engine (placeholder - implement with state_query)
    local ax=$(game_state_query "pulsar.${pulsar_a}.center_x" 2>/dev/null || echo "0")
    local ay=$(game_state_query "pulsar.${pulsar_a}.center_y" 2>/dev/null || echo "0")
    local bx=$(game_state_query "pulsar.${pulsar_b}.center_x" 2>/dev/null || echo "0")
    local by=$(game_state_query "pulsar.${pulsar_b}.center_y" 2>/dev/null || echo "0")

    # Calculate euclidean distance
    local dx=$((bx - ax))
    local dy=$((by - ay))

    echo "scale=2; sqrt($dx*$dx + $dy*$dy)" | bc -l
}

# Calculate power factor based on pair distance
# Returns: 0.0 to 1.0 (1.0 = close, 0.0 = far)
# Usage: power=$(pair_get_power_factor <pair_id>)
pair_get_power_factor() {
    local pair_id="$1"
    local distance=$(pair_get_distance "$pair_id")

    if (( $(echo "$distance <= $PAIR_MIN_SEPARATION" | bc -l) )); then
        echo "1.0"
    elif (( $(echo "$distance >= $PAIR_MAX_SEPARATION" | bc -l) )); then
        echo "0.2"  # Minimum power
    else
        # Inverse square falloff
        local range=$((PAIR_MAX_SEPARATION - PAIR_MIN_SEPARATION))
        local normalized=$(echo "scale=4; ($distance - $PAIR_MIN_SEPARATION) / $range" | bc -l)
        local power=$(echo "scale=4; 1.0 - 0.8 * $normalized * $normalized" | bc -l)
        echo "$power"
    fi
}

# Apply tether forces to keep pair within bounds
# Usage: pair_apply_tether_forces <pair_id>
pair_apply_tether_forces() {
    local pair_id="$1"
    local distance=$(pair_get_distance "$pair_id")

    read -r pulsar_a pulsar_b < <(pair_get_pulsars "$pair_id")

    # Get positions
    local ax=$(game_state_query "pulsar.${pulsar_a}.center_x" 2>/dev/null || echo "0")
    local ay=$(game_state_query "pulsar.${pulsar_a}.center_y" 2>/dev/null || echo "0")
    local bx=$(game_state_query "pulsar.${pulsar_b}.center_x" 2>/dev/null || echo "0")
    local by=$(game_state_query "pulsar.${pulsar_b}.center_y" 2>/dev/null || echo "0")

    # Calculate unit vector from A to B
    local dx=$((bx - ax))
    local dy=$((by - ay))
    local mag=$(echo "scale=4; sqrt($dx*$dx + $dy*$dy)" | bc -l)

    if (( $(echo "$mag < 0.1" | bc -l) )); then
        return  # Too close to calculate direction
    fi

    local ux=$(echo "scale=4; $dx / $mag" | bc -l)
    local uy=$(echo "scale=4; $dy / $mag" | bc -l)

    # Apply spring force if too far
    if (( $(echo "$distance > $PAIR_MAX_SEPARATION" | bc -l) )); then
        local excess=$(echo "$distance - $PAIR_MAX_SEPARATION" | bc -l)
        local force=$(echo "scale=4; $PAIR_SPRING_CONSTANT * $excess" | bc -l)

        # Apply toward partner (A pulls toward B, B pulls toward A)
        echo "APPLY_FORCE $pulsar_a $(echo "$force * $ux" | bc -l) $(echo "$force * $uy" | bc -l)"
        echo "APPLY_FORCE $pulsar_b $(echo "-$force * $ux" | bc -l) $(echo "-$force * $uy" | bc -l)"
    fi

    # Apply repulsion if too close
    if (( $(echo "$distance < $PAIR_MIN_SEPARATION" | bc -l) )); then
        local deficit=$(echo "$PAIR_MIN_SEPARATION - $distance" | bc -l)
        local force=$(echo "scale=4; $PAIR_REPULSION_CONSTANT * $deficit" | bc -l)

        # Apply away from partner
        echo "APPLY_FORCE $pulsar_a $(echo "-$force * $ux" | bc -l) $(echo "-$force * $uy" | bc -l)"
        echo "APPLY_FORCE $pulsar_b $(echo "$force * $ux" | bc -l) $(echo "$force * $uy" | bc -l)"
    fi
}

# Transfer energy between pair members
# Usage: pair_transfer_energy <pair_id> <delta_time>
pair_transfer_energy() {
    local pair_id="$1"
    local dt="${2:-0.016}"  # Default 60 FPS

    read -r pulsar_a pulsar_b < <(pair_get_pulsars "$pair_id")

    # Get current energies (placeholder - implement with state_query)
    local energy_a=$(game_state_query "pulsar.${pulsar_a}.energy" 2>/dev/null || echo "1.0")
    local energy_b=$(game_state_query "pulsar.${pulsar_b}.energy" 2>/dev/null || echo "1.0")

    # Get distance
    local distance=$(pair_get_distance "$pair_id")

    # Calculate transfer rate (inverse distance)
    local transfer_rate=$(echo "scale=4; $ENERGY_TRANSFER_RATE / $distance" | bc -l)

    # Calculate energy delta
    local delta=$(echo "scale=4; $transfer_rate * ($energy_b - $energy_a) * $dt" | bc -l)

    # Apply transfer
    local new_energy_a=$(echo "scale=4; $energy_a + $delta" | bc -l)
    local new_energy_b=$(echo "scale=4; $energy_b - $delta" | bc -l)

    # Clamp to [0.1, 1.0]
    new_energy_a=$(echo "if ($new_energy_a < 0.1) 0.1 else if ($new_energy_a > 1.0) 1.0 else $new_energy_a" | bc -l)
    new_energy_b=$(echo "if ($new_energy_b < 0.1) 0.1 else if ($new_energy_b > 1.0) 1.0 else $new_energy_b" | bc -l)

    # Update energies
    echo "SET_ENERGY $pulsar_a $new_energy_a"
    echo "SET_ENERGY $pulsar_b $new_energy_b"
}

# Update all pairs
# Usage: pair_update_all <delta_time>
pair_update_all() {
    local dt="${1:-0.016}"

    for pair_id in "${!GAME_PAIR_BONDS[@]}"; do
        pair_transfer_energy "$pair_id" "$dt"
        pair_apply_tether_forces "$pair_id"
    done
}

# Destroy a pair bond
# Usage: pair_destroy <pair_id>
pair_destroy() {
    local pair_id="$1"
    read -r pulsar_a pulsar_b < <(pair_get_pulsars "$pair_id")

    unset "GAME_PAIR_BONDS[$pair_id]"
    unset "GAME_PAIR_PLAYERS[$pair_id]"
    unset "GAME_PULSAR_TO_PAIR[$pulsar_a]"
    unset "GAME_PULSAR_TO_PAIR[$pulsar_b]"
}

# Check if pulsar is part of a pair
# Usage: if pair_is_bonded <pulsar_id>; then ...
pair_is_bonded() {
    local pulsar_id="$1"
    [[ -n "${GAME_PULSAR_TO_PAIR[$pulsar_id]}" ]]
}

# List all pairs
# Usage: pair_list_all
pair_list_all() {
    for pair_id in "${!GAME_PAIR_BONDS[@]}"; do
        echo "$pair_id"
    done
}

# Get pair info for debugging
# Usage: pair_debug <pair_id>
pair_debug() {
    local pair_id="$1"
    read -r pulsar_a pulsar_b < <(pair_get_pulsars "$pair_id")

    echo "Pair: $pair_id"
    echo "  Pulsar A: $pulsar_a"
    echo "  Pulsar B: $pulsar_b"
    echo "  Player: ${GAME_PAIR_PLAYERS[$pair_id]}"
    echo "  Distance: $(pair_get_distance "$pair_id")"
    echo "  Power: $(pair_get_power_factor "$pair_id")"
}
