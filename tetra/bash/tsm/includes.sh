#!/usr/bin/env bash

# TSM Module Includes - Standard tetra module entry point
# Controls what gets loaded for TSM (Tetra Service Manager) functionality

# Follow tetra convention: MOD_SRC for source code, MOD_DIR for runtime data
# Per CLAUDE.md: "MOD_SRC is a strong global. A module can count on it."
# IMPORTANT: Always set explicitly to avoid conflicts with other modules
MOD_SRC="$TETRA_SRC/bash/tsm"  # Source files
MOD_DIR="$TETRA_DIR/tsm"        # Runtime data

# Backward compatibility - modules may still reference TSM_*
TSM_SRC="$MOD_SRC"
TSM_DIR="$MOD_DIR"

# Create runtime directories if they don't exist
[[ ! -d "$MOD_DIR" ]] && mkdir -p "$MOD_DIR"
[[ ! -d "$MOD_DIR/runtime" ]] && mkdir -p "$MOD_DIR/runtime"
[[ ! -d "$MOD_DIR/runtime/processes" ]] && mkdir -p "$MOD_DIR/runtime/processes"
[[ ! -d "$MOD_DIR/logs" ]] && mkdir -p "$MOD_DIR/logs"

# Export for subprocesses
export MOD_SRC MOD_DIR TSM_SRC TSM_DIR

# Source the main TSM module (which handles all component loading)
source "$MOD_SRC/tsm.sh"

# Source module index (metadata and tab completion)
source "$MOD_SRC/index.sh"

# Source tree help registration
source "$MOD_SRC/tsm_tree.sh" 2>/dev/null || true

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
