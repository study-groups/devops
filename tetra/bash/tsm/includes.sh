#!/usr/bin/env bash

# TSM Module Includes - Standard tetra module entry point
# Controls what gets loaded for TSM (Tetra Service Manager) functionality

# Load module utilities
source "$TETRA_SRC/bash/utils/module_init.sh"
source "$TETRA_SRC/bash/utils/function_helpers.sh"

# Initialize module with standard tetra conventions
# Creates MOD_SRC, MOD_DIR and specified subdirectories
tetra_module_init_with_alias "tsm" "TSM" "runtime:runtime/processes:logs"

# Source the main TSM module (which handles all component loading)
source "$MOD_SRC/tsm.sh"

# Run TSM initialization (setup directories, check dependencies)
tetra_call_if_exists tetra_tsm_setup >/dev/null 2>&1 || true

# Source tree help registration
tetra_source_silent "$MOD_SRC/tsm_tree.sh"

# Register tsm actions with action registry
if [[ -f "$TETRA_SRC/bash/actions/registry.sh" ]]; then
    source "$TETRA_SRC/bash/actions/registry.sh"

    # Service lifecycle actions
    action_register "tsm" "start.service" "Start a service from services-available" "<service_name> [env_file]" "no"
    action_register "tsm" "stop.service" "Stop running processes by name or ID" "<process_id>" "no"
    action_register "tsm" "restart.service" "Restart a running service" "<process_id>" "no"

    # Service inspection actions
    action_register "tsm" "list.services" "List running or available services" "[filter]" "no"
    action_register "tsm" "show.logs" "Display service logs" "<process_id> [--follow]" "no"
    action_register "tsm" "monitor.service" "Monitor service health and resources" "<process_id>" "no"

    # Port management actions
    action_register "tsm" "list.ports" "List registered ports and their owners" "" "no"
    action_register "tsm" "scan.ports" "Scan for port conflicts" "" "no"

    # System diagnostics
    action_register "tsm" "run.doctor" "Run TSM health diagnostics" "" "no"
fi
