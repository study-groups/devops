#!/usr/bin/env bash
# TMC Mapper - Two-Layer MIDI Mapping System
# Layer 1: Hardware (CC/NOTE) → Syntax (p1, s1, b1a, etc.)
# Layer 2: Syntax → Semantic (VOLUME, TRIGGER_KICK, etc.)
#
# REFACTORED: Uses state.sh and errors.sh modules
# PRIORITY: CC values are most important - maintain precision

# Source dependencies
MIDI_SRC="${MIDI_SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
source "$MIDI_SRC/core/state.sh"
source "$MIDI_SRC/lib/errors.sh"

# Initialize mapper
tmc_mapper_init() {
    # Use state container instead of globals
    local config_dir="${TMC_CONFIG_DIR:-$TETRA_DIR/midi}"

    mkdir -p "$config_dir"/{devices,sessions,colors} || {
        tmc_error $TMC_ERR_PERMISSION_DENIED "Failed to create config directories"
        return $TMC_ERR_PERMISSION_DENIED
    }

    tmc_state_set "broadcast_mode" "all"
    tmc_info "Mapper initialized: $config_dir"
    return $TMC_ERR_SUCCESS
}

# Load device configuration
tmc_load_device() {
    local device_id="$1"

    if [[ -z "$device_id" ]]; then
        tmc_error $TMC_ERR_INVALID_ARG "Device ID required"
        return $TMC_ERR_INVALID_ARG
    fi

    # Sanitize device ID
    device_id=$(tmc_sanitize_name "$device_id") || return $?

    local config_dir="${TMC_CONFIG_DIR:-$TETRA_DIR/midi}"
    local device_dir="$config_dir/devices/$device_id"

    mkdir -p "$device_dir" || {
        tmc_error $TMC_ERR_PERMISSION_DENIED "Failed to create device directory"
        return $TMC_ERR_PERMISSION_DENIED
    }

    # Update state
    tmc_state_set "device_id" "$device_id"
    tmc_state_set "device_name" "$device_id"

    # Clear existing maps
    TMC_HARDWARE_MAP=()
    TMC_HARDWARE_REV=()
    TMC_SEMANTIC_MAP=()
    TMC_SEMANTIC_REV=()

    # Load hardware map
    local hw_map="$device_dir/hardware_map.txt"
    if [[ -f "$hw_map" ]]; then
        tmc_load_hardware_map "$hw_map" || return $?
        tmc_state_set "hardware_map_file" "$hw_map"
        tmc_state_set "hardware_map_loaded" "1"
    else
        tmc_warn "No hardware map found: $hw_map"
    fi

    # Load semantic map
    local sem_map="$device_dir/semantic_map.txt"
    if [[ -f "$sem_map" ]]; then
        tmc_load_semantic_map "$sem_map" || return $?
        tmc_state_set "semantic_map_file" "$sem_map"
        tmc_state_set "semantic_map_loaded" "1"
    else
        tmc_warn "No semantic map found: $sem_map"
    fi

    tmc_info "Loaded device: $device_id"
    tmc_info "  Hardware mappings: ${#TMC_HARDWARE_MAP[@]}"
    tmc_info "  Semantic mappings: ${#TMC_SEMANTIC_MAP[@]}"

    return $TMC_ERR_SUCCESS
}

# Load hardware map from file
# Format: syntax|type|channel|controller_or_note
# Example: p1|CC|1|7
tmc_load_hardware_map() {
    local file="$1"

    tmc_validate_file "$file" || return $?

    local line_num=0
    local loaded=0

    while IFS='|' read -r syntax type channel controller; do
        ((line_num++))

        # Skip comments and empty lines
        [[ "$syntax" =~ ^#.*$ || -z "$syntax" ]] && continue

        # Validate inputs
        if [[ -z "$syntax" || -z "$type" || -z "$channel" || -z "$controller" ]]; then
            tmc_warn "Invalid format at line $line_num: skipping"
            continue
        fi

        # Validate channel
        tmc_validate_channel "$channel" || {
            tmc_warn "Invalid channel at line $line_num: $channel"
            continue
        }

        # Validate controller (for CC type)
        if [[ "$type" == "CC" ]]; then
            tmc_validate_controller "$controller" || {
                tmc_warn "Invalid controller at line $line_num: $controller"
                continue
            }
        fi

        # Add to state
        tmc_state_set_hardware_map "$syntax" "$type" "$channel" "$controller"
        ((loaded++))
    done < "$file"

    tmc_info "Loaded $loaded hardware mappings from $file"
    return $TMC_ERR_SUCCESS
}

# Load semantic map from file
# Format: syntax|semantic|min|max
# Example: p1|VOLUME|0.0|1.0
tmc_load_semantic_map() {
    local file="$1"

    tmc_validate_file "$file" || return $?

    local line_num=0
    local loaded=0

    while IFS='|' read -r syntax semantic min max; do
        ((line_num++))

        # Skip comments and empty lines
        [[ "$syntax" =~ ^#.*$ || -z "$syntax" ]] && continue

        # Validate inputs
        if [[ -z "$syntax" || -z "$semantic" ]]; then
            tmc_warn "Invalid format at line $line_num: skipping"
            continue
        fi

        # Default ranges
        [[ -z "$min" ]] && min=0
        [[ -z "$max" ]] && max=127

        # Add to state
        tmc_state_set_semantic_map "$syntax" "$semantic" "$min" "$max"
        ((loaded++))
    done < "$file"

    tmc_info "Loaded $loaded semantic mappings from $file"
    return $TMC_ERR_SUCCESS
}

# Save hardware map to file
tmc_save_hardware_map() {
    local file="${1:-}"

    if [[ -z "$file" ]]; then
        local device_id=$(tmc_state_get "device_id")
        if [[ -z "$device_id" ]]; then
            tmc_error $TMC_ERR_INVALID_ARG "No device loaded and no file specified"
            return $TMC_ERR_INVALID_ARG
        fi
        local config_dir="${TMC_CONFIG_DIR:-$TETRA_DIR/midi}"
        file="$config_dir/devices/$device_id/hardware_map.txt"
    fi

    {
        echo "# TMC Hardware Map: Syntax → MIDI CC/NOTE"
        echo "# Format: syntax|type|channel|controller_or_note"
        echo "#"

        for syntax in $(printf '%s\n' "${!TMC_HARDWARE_REV[@]}" | sort); do
            local key="${TMC_HARDWARE_REV[$syntax]}"
            IFS='|' read -r type channel controller <<< "$key"
            echo "$syntax|$type|$channel|$controller"
        done
    } > "$file" || {
        tmc_error $TMC_ERR_PERMISSION_DENIED "Failed to write file: $file"
        return $TMC_ERR_PERMISSION_DENIED
    }

    tmc_info "Saved hardware map: $file"
    return $TMC_ERR_SUCCESS
}

# Save semantic map to file
tmc_save_semantic_map() {
    local file="${1:-}"

    if [[ -z "$file" ]]; then
        local device_id=$(tmc_state_get "device_id")
        if [[ -z "$device_id" ]]; then
            tmc_error $TMC_ERR_INVALID_ARG "No device loaded and no file specified"
            return $TMC_ERR_INVALID_ARG
        fi
        local config_dir="${TMC_CONFIG_DIR:-$TETRA_DIR/midi}"
        file="$config_dir/devices/$device_id/semantic_map.txt"
    fi

    {
        echo "# TMC Semantic Map: Syntax → Semantic Names"
        echo "# Format: syntax|semantic|min|max"
        echo "#"

        for syntax in $(printf '%s\n' "${!TMC_SEMANTIC_MAP[@]}" | sort); do
            local value="${TMC_SEMANTIC_MAP[$syntax]}"
            IFS='|' read -r semantic min max <<< "$value"
            echo "$syntax|$semantic|$min|$max"
        done
    } > "$file" || {
        tmc_error $TMC_ERR_PERMISSION_DENIED "Failed to write file: $file"
        return $TMC_ERR_PERMISSION_DENIED
    }

    tmc_info "Saved semantic map: $file"
    return $TMC_ERR_SUCCESS
}

# Save session (both maps together)
tmc_save_session() {
    local session_name="$1"

    if [[ -z "$session_name" ]]; then
        tmc_error $TMC_ERR_INVALID_ARG "Session name required"
        return $TMC_ERR_INVALID_ARG
    fi

    # Sanitize session name
    session_name=$(tmc_sanitize_name "$session_name") || return $?

    local config_dir="${TMC_CONFIG_DIR:-$TETRA_DIR/midi}"
    local session_dir="$config_dir/sessions/$session_name"

    mkdir -p "$session_dir" || {
        tmc_error $TMC_ERR_PERMISSION_DENIED "Failed to create session directory"
        return $TMC_ERR_PERMISSION_DENIED
    }

    tmc_save_hardware_map "$session_dir/hardware_map.txt" || return $?
    tmc_save_semantic_map "$session_dir/semantic_map.txt" || return $?

    tmc_state_set "active_session" "$session_name"
    tmc_state_set "session_dir" "$session_dir"

    tmc_info "Saved session: $session_name"
    return $TMC_ERR_SUCCESS
}

# Load session
tmc_load_session() {
    local session_name="$1"

    if [[ -z "$session_name" ]]; then
        tmc_error $TMC_ERR_INVALID_ARG "Session name required"
        return $TMC_ERR_INVALID_ARG
    fi

    # Sanitize session name
    session_name=$(tmc_sanitize_name "$session_name") || return $?

    local config_dir="${TMC_CONFIG_DIR:-$TETRA_DIR/midi}"
    local session_dir="$config_dir/sessions/$session_name"

    if [[ ! -d "$session_dir" ]]; then
        tmc_error $TMC_ERR_FILE_NOT_FOUND "Session not found: $session_name"
        return $TMC_ERR_FILE_NOT_FOUND
    fi

    # Clear existing maps
    TMC_HARDWARE_MAP=()
    TMC_HARDWARE_REV=()
    TMC_SEMANTIC_MAP=()
    TMC_SEMANTIC_REV=()

    tmc_load_hardware_map "$session_dir/hardware_map.txt" || return $?
    tmc_load_semantic_map "$session_dir/semantic_map.txt" || return $?

    tmc_state_set "active_session" "$session_name"
    tmc_state_set "session_dir" "$session_dir"

    tmc_info "Loaded session: $session_name"
    return $TMC_ERR_SUCCESS
}

# Normalize value from MIDI 0-127 to custom range
# CRITICAL: Maintains precision for CC values
tmc_normalize_value() {
    local midi_value="$1"
    local min="$2"
    local max="$3"

    # Validate CC value
    tmc_validate_cc_value "$midi_value" || return $?

    # Default to 0-127 if no range specified
    [[ -z "$min" ]] && min=0
    [[ -z "$max" ]] && max=127

    # High precision normalization: value = min + (midi/127) * (max-min)
    # Using bc for floating point precision
    bc -l <<< "scale=6; $min + ($midi_value / 127.0) * ($max - $min)"
}

# Map incoming MIDI event through both layers
# Input: type channel controller value
# Output: formatted string based on broadcast mode
# CRITICAL: CC value precision maintained throughout
tmc_map_event() {
    local type="$1"
    local channel="$2"
    local controller="$3"
    local value="$4"

    # Validate inputs
    tmc_validate_channel "$channel" || return $?

    if [[ "$type" == "CC" ]]; then
        tmc_validate_controller "$controller" || return $?
        tmc_validate_cc_value "$value" || return $?

        # Track CC events in state
        tmc_state_set_last_cc "$channel" "$controller" "$value"
    fi

    # Increment event counter
    tmc_state_increment_events

    local key="${type}|${channel}|${controller}"

    # Layer 1: Hardware → Syntax
    local syntax=$(tmc_state_get_hardware_map "$type" "$channel" "$controller")

    # Layer 2: Syntax → Semantic
    local semantic=""
    local normalized=""

    if [[ -n "$syntax" ]]; then
        local sem_value=$(tmc_state_get_semantic_map "$syntax")
        if [[ -n "$sem_value" ]]; then
            IFS='|' read -r semantic min max <<< "$sem_value"
            normalized=$(tmc_normalize_value "$value" "$min" "$max")
        fi
    fi

    # Format output based on broadcast mode
    local mode=$(tmc_state_get "broadcast_mode")

    case "$mode" in
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

    return $TMC_ERR_SUCCESS
}

# Learn hardware mapping
# Args: syntax type channel controller
tmc_learn_hardware() {
    local syntax="$1"
    local type="$2"
    local channel="$3"
    local controller="$4"

    if [[ -z "$syntax" || -z "$type" || -z "$channel" || -z "$controller" ]]; then
        tmc_error $TMC_ERR_INVALID_ARG "All arguments required: syntax type channel controller"
        return $TMC_ERR_INVALID_ARG
    fi

    # Validate syntax name format
    if ! [[ "$syntax" =~ ^(p[1-8]|s[1-8]|b[1-8][a-d]|play|pause|stop|back|fwd|fback|ffwd|up|down|left|right)$ ]]; then
        tmc_error $TMC_ERR_INVALID_ARG "Invalid syntax name: $syntax"
        return $TMC_ERR_INVALID_ARG
    fi

    # Validate channel and controller
    tmc_validate_channel "$channel" || return $?

    if [[ "$type" == "CC" ]]; then
        tmc_validate_controller "$controller" || return $?
    fi

    # Add mapping using state management
    tmc_state_set_hardware_map "$syntax" "$type" "$channel" "$controller"

    tmc_info "Learned: $syntax → $type ch$channel cc$controller"
    return $TMC_ERR_SUCCESS
}

# Learn semantic mapping
# Args: syntax semantic min max
tmc_learn_semantic() {
    local syntax="$1"
    local semantic="$2"
    local min="${3:-0}"
    local max="${4:-127}"

    if [[ -z "$syntax" || -z "$semantic" ]]; then
        tmc_error $TMC_ERR_INVALID_ARG "Syntax and semantic name required"
        return $TMC_ERR_INVALID_ARG
    fi

    # Add mapping using state management
    tmc_state_set_semantic_map "$syntax" "$semantic" "$min" "$max"

    tmc_info "Learned: $syntax → $semantic (range: $min - $max)"
    return $TMC_ERR_SUCCESS
}

# List all mappings
tmc_list_mappings() {
    local device_id=$(tmc_state_get "device_id")

    echo "TMC Mappings (Device: ${device_id:-none})"
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
    local mode=$(tmc_state_get "broadcast_mode")
    echo "Broadcast Mode: $mode"

    # Show statistics
    local events=$(tmc_state_get "events_processed")
    local cc_events=$(tmc_state_get "cc_events_processed")
    echo ""
    echo "Statistics:"
    echo "  Total events: $events"
    echo "  CC events: $cc_events"
}

# Set broadcast mode
tmc_set_mode() {
    local mode="$1"

    if [[ ! "$mode" =~ ^(raw|syntax|semantic|all)$ ]]; then
        tmc_error $TMC_ERR_INVALID_ARG "Invalid mode. Use: raw|syntax|semantic|all"
        return $TMC_ERR_INVALID_ARG
    fi

    tmc_state_set "broadcast_mode" "$mode" || return $?

    tmc_info "Broadcast mode: $mode"
    return $TMC_ERR_SUCCESS
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
