#!/usr/bin/env bash
# TMC State Management Module
# Provides centralized state container to eliminate global variable pollution
# Focus: CC (Control Change) values are critical - maintain precision

# State container using associative arrays (bash 4.0+)
declare -gA TMC_STATE
declare -gA TMC_HARDWARE_MAP      # CC|channel|controller -> syntax
declare -gA TMC_HARDWARE_REV      # syntax -> CC|channel|controller
declare -gA TMC_SEMANTIC_MAP      # syntax -> semantic|min|max
declare -gA TMC_SEMANTIC_REV      # semantic -> syntax
declare -gA TMC_SUBSCRIBERS_CACHE # socket_path -> 1 (in-memory cache)

# State initialization
tmc_state_init() {
    TMC_STATE=(
        # Bridge state
        [bridge_pid]=""
        [bridge_socket]=""
        [bridge_type]="nodejs"
        [bridge_binary]=""

        # Device state
        [input_device]="-1"
        [output_device]="-1"
        [device_id]=""
        [device_name]=""
        [controller_name]=""        # Short name: vmx8, akai, etc.
        [map_name]=""               # Map name: qpong, default, etc.

        # Runtime state
        [broadcast_mode]="all"
        [server_running]="0"

        # Learning state
        [learning_active]="0"
        [learning_syntax]=""
        [learning_semantic]=""
        [learning_min]=""
        [learning_max]=""
        [learning_timeout]="5"
        [learning_pid]=""
        [learning_lockfile]=""

        # Map state
        [hardware_map_loaded]="0"
        [semantic_map_loaded]="0"
        [hardware_map_file]=""
        [semantic_map_file]=""

        # Subscriber state
        [subscribers_file]=""
        [subscribers_cache_valid]="0"
        [last_subscriber_check]="0"

        # Session state
        [active_session]=""
        [session_dir]=""

        # Statistics (for CC value tracking)
        [events_processed]="0"
        [cc_events_processed]="0"
        [last_cc_channel]=""
        [last_cc_controller]=""
        [last_cc_value]=""
    )

    return 0
}

# State getters
tmc_state_get() {
    local key="$1"
    echo "${TMC_STATE[$key]:-}"
}

# State setters with validation
tmc_state_set() {
    local key="$1"
    local value="$2"

    # Validate key exists
    if [[ ! -v TMC_STATE[$key] ]]; then
        echo "ERROR: Invalid state key: $key" >&2
        return 1
    fi

    TMC_STATE[$key]="$value"
    return 0
}

# Specialized setter for CC values (preserves precision)
tmc_state_set_last_cc() {
    local channel="$1"
    local controller="$2"
    local value="$3"

    # Validate CC value range (0-127)
    if [[ ! "$value" =~ ^[0-9]+$ ]] || [[ "$value" -lt 0 ]] || [[ "$value" -gt 127 ]]; then
        echo "ERROR: Invalid CC value: $value (must be 0-127)" >&2
        return 1
    fi

    TMC_STATE[last_cc_channel]="$channel"
    TMC_STATE[last_cc_controller]="$controller"
    TMC_STATE[last_cc_value]="$value"
    TMC_STATE[cc_events_processed]=$((${TMC_STATE[cc_events_processed]} + 1))

    return 0
}

# Increment event counter
tmc_state_increment_events() {
    TMC_STATE[events_processed]=$((${TMC_STATE[events_processed]} + 1))
}

# Learning state management with lock
tmc_state_start_learning() {
    local syntax="$1"
    local semantic="${2:-}"
    local min="${3:-}"
    local max="${4:-}"

    # Check if already learning
    if [[ "${TMC_STATE[learning_active]}" == "1" ]]; then
        echo "ERROR: Learning already in progress" >&2
        return 1
    fi

    # Create lock file
    local lockfile="$TMC_CONFIG_DIR/.learning.lock"
    if [[ -f "$lockfile" ]]; then
        # Check if stale (older than timeout)
        local lock_age=$(($(date +%s) - $(stat -f %m "$lockfile" 2>/dev/null || echo 0)))
        if [[ $lock_age -lt ${TMC_STATE[learning_timeout]} ]]; then
            echo "ERROR: Learning lock exists (age: ${lock_age}s)" >&2
            return 1
        fi
        rm -f "$lockfile"
    fi

    # Create lock
    echo "$$" > "$lockfile"

    # Set learning state
    TMC_STATE[learning_active]="1"
    TMC_STATE[learning_syntax]="$syntax"
    TMC_STATE[learning_semantic]="$semantic"
    TMC_STATE[learning_min]="$min"
    TMC_STATE[learning_max]="$max"
    TMC_STATE[learning_lockfile]="$lockfile"

    return 0
}

tmc_state_stop_learning() {
    # Clear learning state
    TMC_STATE[learning_active]="0"
    TMC_STATE[learning_syntax]=""
    TMC_STATE[learning_semantic]=""
    TMC_STATE[learning_min]=""
    TMC_STATE[learning_max]=""

    # Remove lock
    if [[ -n "${TMC_STATE[learning_lockfile]}" ]]; then
        rm -f "${TMC_STATE[learning_lockfile]}"
        TMC_STATE[learning_lockfile]=""
    fi

    # Kill timeout process if exists
    if [[ -n "${TMC_STATE[learning_pid]}" ]]; then
        kill "${TMC_STATE[learning_pid]}" 2>/dev/null || true
        TMC_STATE[learning_pid]=""
    fi

    return 0
}

# Map management
tmc_state_set_hardware_map() {
    local syntax="$1"
    local type="$2"
    local channel="$3"
    local controller="$4"

    local key="${type}|${channel}|${controller}"
    TMC_HARDWARE_MAP[$key]="$syntax"
    TMC_HARDWARE_REV[$syntax]="$key"
}

tmc_state_get_hardware_map() {
    local type="$1"
    local channel="$2"
    local controller="$3"

    local key="${type}|${channel}|${controller}"
    echo "${TMC_HARDWARE_MAP[$key]:-}"
}

tmc_state_set_semantic_map() {
    local syntax="$1"
    local semantic="$2"
    local min="$3"
    local max="$4"

    TMC_SEMANTIC_MAP[$syntax]="${semantic}|${min}|${max}"
    TMC_SEMANTIC_REV[$semantic]="$syntax"
}

tmc_state_get_semantic_map() {
    local syntax="$1"
    echo "${TMC_SEMANTIC_MAP[$syntax]:-}"
}

# Subscriber cache management
tmc_state_add_subscriber() {
    local socket="$1"
    TMC_SUBSCRIBERS_CACHE[$socket]="1"
    TMC_STATE[subscribers_cache_valid]="1"
}

tmc_state_remove_subscriber() {
    local socket="$1"
    unset TMC_SUBSCRIBERS_CACHE[$socket]
}

tmc_state_get_subscribers() {
    # Return array of active subscribers
    printf '%s\n' "${!TMC_SUBSCRIBERS_CACHE[@]}"
}

tmc_state_clear_subscribers() {
    TMC_SUBSCRIBERS_CACHE=()
    TMC_STATE[subscribers_cache_valid]="0"
}

tmc_state_invalidate_subscriber_cache() {
    TMC_STATE[subscribers_cache_valid]="0"
}

# Controller and map management
tmc_state_set_controller() {
    local controller_name="$1"
    TMC_STATE[controller_name]="$controller_name"
}

tmc_state_set_map() {
    local map_name="$1"
    # Extract just the map name (e.g., "qpong" from "qpong.cc.midi")
    map_name="${map_name%.cc.midi}"
    map_name="${map_name%.midi}"
    TMC_STATE[map_name]="$map_name"
}

tmc_state_set_controller_and_map() {
    local controller="$1"
    local map="$2"
    tmc_state_set_controller "$controller"
    tmc_state_set_map "$map"
}

# State reset
tmc_state_reset() {
    tmc_state_init
    TMC_HARDWARE_MAP=()
    TMC_HARDWARE_REV=()
    TMC_SEMANTIC_MAP=()
    TMC_SEMANTIC_REV=()
    TMC_SUBSCRIBERS_CACHE=()
}

# State debugging
tmc_state_dump() {
    echo "=== TMC State Dump ==="
    for key in "${!TMC_STATE[@]}"; do
        echo "$key = ${TMC_STATE[$key]}"
    done

    echo ""
    echo "Hardware Map Entries: ${#TMC_HARDWARE_MAP[@]}"
    echo "Semantic Map Entries: ${#TMC_SEMANTIC_MAP[@]}"
    echo "Active Subscribers: ${#TMC_SUBSCRIBERS_CACHE[@]}"
}

# Initialize on source
tmc_state_init

# Export functions
export -f tmc_state_init
export -f tmc_state_get
export -f tmc_state_set
export -f tmc_state_set_last_cc
export -f tmc_state_increment_events
export -f tmc_state_start_learning
export -f tmc_state_stop_learning
export -f tmc_state_set_hardware_map
export -f tmc_state_get_hardware_map
export -f tmc_state_set_semantic_map
export -f tmc_state_get_semantic_map
export -f tmc_state_add_subscriber
export -f tmc_state_remove_subscriber
export -f tmc_state_get_subscribers
export -f tmc_state_clear_subscribers
export -f tmc_state_invalidate_subscriber_cache
export -f tmc_state_set_controller
export -f tmc_state_set_map
export -f tmc_state_set_controller_and_map
export -f tmc_state_reset
export -f tmc_state_dump
