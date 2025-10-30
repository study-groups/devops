#!/usr/bin/env bash

# TMC Mapper - Two-Layer MIDI Mapping System
# Layer 1: Hardware (CC/NOTE) → Syntax (p1, s1, b1a, etc.)
# Layer 2: Syntax → Semantic (VOLUME, TRIGGER_KICK, etc.)

# Global mapping state
declare -gA TMC_HARDWARE_MAP     # "CC|1|7" → "p1"
declare -gA TMC_HARDWARE_REV     # "p1" → "CC|1|7" (reverse lookup)
declare -gA TMC_SEMANTIC_MAP     # "p1" → "VOLUME|0.0|1.0"
declare -gA TMC_SEMANTIC_REV     # "VOLUME" → "p1" (reverse lookup)

# Broadcast mode: raw|syntax|semantic|all
TMC_BROADCAST_MODE="${TMC_BROADCAST_MODE:-all}"

# Config paths
TMC_CONFIG_DIR="${TETRA_DIR}/midi"
TMC_DEVICE_DIR=""  # Set by load_device()
TMC_CURRENT_DEVICE=""

# Initialize mapper
tmc_mapper_init() {
    mkdir -p "$TMC_CONFIG_DIR"/{devices,sessions,colors}
}

# Load device configuration
tmc_load_device() {
    local device_id="$1"

    if [[ -z "$device_id" ]]; then
        echo "ERROR: Device ID required" >&2
        return 1
    fi

    TMC_CURRENT_DEVICE="$device_id"
    TMC_DEVICE_DIR="$TMC_CONFIG_DIR/devices/$device_id"

    mkdir -p "$TMC_DEVICE_DIR"

    # Clear existing maps
    TMC_HARDWARE_MAP=()
    TMC_HARDWARE_REV=()
    TMC_SEMANTIC_MAP=()
    TMC_SEMANTIC_REV=()

    # Load hardware map
    local hw_map="$TMC_DEVICE_DIR/hardware_map.txt"
    if [[ -f "$hw_map" ]]; then
        tmc_load_hardware_map "$hw_map"
    fi

    # Load semantic map
    local sem_map="$TMC_DEVICE_DIR/semantic_map.txt"
    if [[ -f "$sem_map" ]]; then
        tmc_load_semantic_map "$sem_map"
    fi

    echo "Loaded device: $device_id"
    echo "  Hardware mappings: ${#TMC_HARDWARE_MAP[@]}"
    echo "  Semantic mappings: ${#TMC_SEMANTIC_MAP[@]}"
}

# Load hardware map from file
# Format: syntax|type|channel|controller_or_note
# Example: p1|CC|1|7
tmc_load_hardware_map() {
    local file="$1"

    while IFS='|' read -r syntax type channel controller; do
        # Skip comments and empty lines
        [[ "$syntax" =~ ^# ]] && continue
        [[ -z "$syntax" ]] && continue

        local key="${type}|${channel}|${controller}"
        TMC_HARDWARE_MAP["$key"]="$syntax"
        TMC_HARDWARE_REV["$syntax"]="$key"
    done < "$file"
}

# Load semantic map from file
# Format: syntax|semantic|min|max
# Example: p1|VOLUME|0.0|1.0
tmc_load_semantic_map() {
    local file="$1"

    while IFS='|' read -r syntax semantic min max; do
        # Skip comments and empty lines
        [[ "$syntax" =~ ^# ]] && continue
        [[ -z "$syntax" ]] && continue

        local value="${semantic}|${min}|${max}"
        TMC_SEMANTIC_MAP["$syntax"]="$value"
        TMC_SEMANTIC_REV["$semantic"]="$syntax"
    done < "$file"
}

# Save hardware map to file
tmc_save_hardware_map() {
    local file="${1:-$TMC_DEVICE_DIR/hardware_map.txt}"

    {
        echo "# TMC Hardware Map: Syntax → MIDI CC/NOTE"
        echo "# Format: syntax|type|channel|controller_or_note"
        echo "#"

        for syntax in $(printf '%s\n' "${!TMC_HARDWARE_REV[@]}" | sort); do
            local key="${TMC_HARDWARE_REV[$syntax]}"
            IFS='|' read -r type channel controller <<< "$key"
            echo "$syntax|$type|$channel|$controller"
        done
    } > "$file"

    echo "Saved hardware map: $file"
}

# Save semantic map to file
tmc_save_semantic_map() {
    local file="${1:-$TMC_DEVICE_DIR/semantic_map.txt}"

    {
        echo "# TMC Semantic Map: Syntax → Semantic Names"
        echo "# Format: syntax|semantic|min|max"
        echo "#"

        for syntax in $(printf '%s\n' "${!TMC_SEMANTIC_MAP[@]}" | sort); do
            local value="${TMC_SEMANTIC_MAP[$syntax]}"
            IFS='|' read -r semantic min max <<< "$value"
            echo "$syntax|$semantic|$min|$max"
        done
    } > "$file"

    echo "Saved semantic map: $file"
}

# Save session (both maps together)
tmc_save_session() {
    local session_name="$1"

    if [[ -z "$session_name" ]]; then
        echo "ERROR: Session name required" >&2
        return 1
    fi

    local session_dir="$TMC_CONFIG_DIR/sessions/$session_name"
    mkdir -p "$session_dir"

    tmc_save_hardware_map "$session_dir/hardware_map.txt"
    tmc_save_semantic_map "$session_dir/semantic_map.txt"

    echo "Saved session: $session_name"
}

# Load session
tmc_load_session() {
    local session_name="$1"

    if [[ -z "$session_name" ]]; then
        echo "ERROR: Session name required" >&2
        return 1
    fi

    local session_dir="$TMC_CONFIG_DIR/sessions/$session_name"

    if [[ ! -d "$session_dir" ]]; then
        echo "ERROR: Session not found: $session_name" >&2
        return 1
    fi

    # Clear existing maps
    TMC_HARDWARE_MAP=()
    TMC_HARDWARE_REV=()
    TMC_SEMANTIC_MAP=()
    TMC_SEMANTIC_REV=()

    tmc_load_hardware_map "$session_dir/hardware_map.txt"
    tmc_load_semantic_map "$session_dir/semantic_map.txt"

    echo "Loaded session: $session_name"
}

# Normalize value from MIDI 0-127 to custom range
tmc_normalize_value() {
    local midi_value="$1"
    local min="$2"
    local max="$3"

    # Default to 0-127 if no range specified
    [[ -z "$min" ]] && min=0
    [[ -z "$max" ]] && max=127

    # Normalize: value = min + (midi/127) * (max-min)
    bc -l <<< "scale=4; $min + ($midi_value / 127.0) * ($max - $min)"
}

# Map incoming MIDI event through both layers
# Input: type channel controller value
# Output: formatted string based on broadcast mode
tmc_map_event() {
    local type="$1"
    local channel="$2"
    local controller="$3"
    local value="$4"

    local key="${type}|${channel}|${controller}"

    # Layer 1: Hardware → Syntax
    local syntax="${TMC_HARDWARE_MAP[$key]}"

    # Layer 2: Syntax → Semantic
    local semantic=""
    local normalized=""

    if [[ -n "$syntax" ]]; then
        local sem_value="${TMC_SEMANTIC_MAP[$syntax]}"
        if [[ -n "$sem_value" ]]; then
            IFS='|' read -r semantic min max <<< "$sem_value"
            normalized=$(tmc_normalize_value "$value" "$min" "$max")
        fi
    fi

    # Format output based on broadcast mode
    case "$TMC_BROADCAST_MODE" in
        raw)
            echo "RAW $type $channel $controller $value"
            ;;
        syntax)
            if [[ -n "$syntax" ]]; then
                echo "SYNTAX $syntax $value"
            fi
            ;;
        semantic)
            if [[ -n "$semantic" ]]; then
                echo "SEMANTIC $semantic $normalized"
            fi
            ;;
        all)
            # Include all available layers
            local parts="$type $channel $controller $value"
            [[ -n "$syntax" ]] && parts="$parts $syntax"
            [[ -n "$semantic" ]] && parts="$parts $semantic $normalized"
            echo "ALL $parts"
            ;;
        *)
            echo "RAW $type $channel $controller $value"
            ;;
    esac
}

# Learn hardware mapping
# Args: syntax type channel controller
tmc_learn_hardware() {
    local syntax="$1"
    local type="$2"
    local channel="$3"
    local controller="$4"

    if [[ -z "$syntax" || -z "$type" || -z "$channel" || -z "$controller" ]]; then
        echo "ERROR: Invalid hardware mapping" >&2
        return 1
    fi

    # Validate syntax name format
    if ! [[ "$syntax" =~ ^(p[1-8]|s[1-8]|b[1-8][a-d]|play|pause|stop|back|fwd|fback|ffwd|up|down|left|right)$ ]]; then
        echo "ERROR: Invalid syntax name: $syntax" >&2
        return 1
    fi

    local key="${type}|${channel}|${controller}"

    # Remove old mapping if syntax was mapped to something else
    if [[ -n "${TMC_HARDWARE_REV[$syntax]}" ]]; then
        local old_key="${TMC_HARDWARE_REV[$syntax]}"
        unset TMC_HARDWARE_MAP["$old_key"]
    fi

    # Add new mapping
    TMC_HARDWARE_MAP["$key"]="$syntax"
    TMC_HARDWARE_REV["$syntax"]="$key"

    echo "Learned: $syntax → $type ch$channel cc$controller"
}

# Learn semantic mapping
# Args: syntax semantic min max
tmc_learn_semantic() {
    local syntax="$1"
    local semantic="$2"
    local min="${3:-0}"
    local max="${4:-127}"

    if [[ -z "$syntax" || -z "$semantic" ]]; then
        echo "ERROR: Invalid semantic mapping" >&2
        return 1
    fi

    # Remove old mapping if semantic was mapped to something else
    if [[ -n "${TMC_SEMANTIC_REV[$semantic]}" ]]; then
        local old_syntax="${TMC_SEMANTIC_REV[$semantic]}"
        unset TMC_SEMANTIC_MAP["$old_syntax"]
    fi

    # Add new mapping
    local value="${semantic}|${min}|${max}"
    TMC_SEMANTIC_MAP["$syntax"]="$value"
    TMC_SEMANTIC_REV["$semantic"]="$syntax"

    echo "Learned: $syntax → $semantic (range: $min - $max)"
}

# List all mappings
tmc_list_mappings() {
    echo "TMC Mappings (Device: ${TMC_CURRENT_DEVICE:-none})"
    echo "=================================================="
    echo ""

    echo "Hardware Mappings (${#TMC_HARDWARE_MAP[@]}):"
    echo "-----------------------------------"
    printf "%-8s %-6s %-4s %-5s\n" "SYNTAX" "TYPE" "CH" "CC"

    for syntax in $(printf '%s\n' "${!TMC_HARDWARE_REV[@]}" | sort); do
        local key="${TMC_HARDWARE_REV[$syntax]}"
        IFS='|' read -r type channel controller <<< "$key"
        printf "%-8s %-6s %-4s %-5s\n" "$syntax" "$type" "$channel" "$controller"
    done

    echo ""
    echo "Semantic Mappings (${#TMC_SEMANTIC_MAP[@]}):"
    echo "------------------------------------"
    printf "%-8s %-20s %-8s %-8s\n" "SYNTAX" "SEMANTIC" "MIN" "MAX"

    for syntax in $(printf '%s\n' "${!TMC_SEMANTIC_MAP[@]}" | sort); do
        local value="${TMC_SEMANTIC_MAP[$syntax]}"
        IFS='|' read -r semantic min max <<< "$value"
        printf "%-8s %-20s %-8s %-8s\n" "$syntax" "$semantic" "$min" "$max"
    done

    echo ""
    echo "Broadcast Mode: $TMC_BROADCAST_MODE"
}

# Set broadcast mode
tmc_set_mode() {
    local mode="$1"

    if [[ ! "$mode" =~ ^(raw|syntax|semantic|all)$ ]]; then
        echo "ERROR: Invalid mode. Use: raw|syntax|semantic|all" >&2
        return 1
    fi

    TMC_BROADCAST_MODE="$mode"
    echo "Broadcast mode: $TMC_BROADCAST_MODE"
}

# Export functions
export -f tmc_mapper_init
export -f tmc_load_device
export -f tmc_load_hardware_map
export -f tmc_load_semantic_map
export -f tmc_save_hardware_map
export -f tmc_save_semantic_map
export -f tmc_save_session
export -f tmc_load_session
export -f tmc_normalize_value
export -f tmc_map_event
export -f tmc_learn_hardware
export -f tmc_learn_semantic
export -f tmc_list_mappings
export -f tmc_set_mode
