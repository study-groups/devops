#!/usr/bin/env bash

# tubes_paths.sh - TCS 3.0 compliant path functions
# Defines all path-related functions for the tubes module

# Strong globals (per CLAUDE.md)
: "${TUBES_SRC:=$TETRA_SRC/bash/tubes}"
: "${TUBES_DIR:=$TETRA_DIR/tubes}"

# Export for subprocesses
export TUBES_SRC TUBES_DIR

# Get the primary database directory for tubes
tubes_get_db_dir() {
    echo "$TUBES_DIR/db"
}

# Get the config directory
tubes_get_config_dir() {
    echo "$TUBES_DIR/config"
}

# Get the FIFOs directory
tubes_get_fifos_dir() {
    echo "$TUBES_DIR/fifos"
}

# Get the active tubes registry
tubes_get_registry() {
    echo "$(tubes_get_config_dir)/registry.json"
}

# Get the router PID file
tubes_get_router_pid() {
    echo "$(tubes_get_config_dir)/router.pid"
}

# Get the router log
tubes_get_router_log() {
    echo "$TUBES_DIR/logs/router.log"
}

# Generate timestamp (TCS 3.0 standard)
tubes_generate_timestamp() {
    date +%s
}

# Get timestamped database path
tubes_get_db_path() {
    local timestamp="$1"
    local type="$2"
    local extension="${3:-json}"
    echo "$(tubes_get_db_dir)/${timestamp}.${type}.${extension}"
}

# Get tube FIFO path by name
tubes_get_tube_path() {
    local tube_name="$1"
    echo "$(tubes_get_fifos_dir)/${tube_name}.fifo"
}

# Get tube control FIFO (for commands to the tube)
tubes_get_control_path() {
    local tube_name="$1"
    echo "$(tubes_get_fifos_dir)/${tube_name}.control"
}

# Initialize directory structure
tubes_init_dirs() {
    mkdir -p "$(tubes_get_db_dir)"
    mkdir -p "$(tubes_get_config_dir)"
    mkdir -p "$(tubes_get_fifos_dir)"
    mkdir -p "$TUBES_DIR/logs"
}
