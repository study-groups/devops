#!/usr/bin/env bash

# TSM Module Includes - Standard tetra module entry point
# Controls what gets loaded for TSM (Tetra Service Manager) functionality

TSM_SRC="$TETRA_SRC/bash/tsm"
TSM_DIR="$TETRA_DIR/tsm"

# Create runtime directories if they don't exist
[[ ! -d "$TSM_DIR" ]] && mkdir -p "$TSM_DIR"
[[ ! -d "$TSM_DIR/config" ]] && mkdir -p "$TSM_DIR/config"
[[ ! -d "$TSM_DIR/runtime" ]] && mkdir -p "$TSM_DIR/runtime"
[[ ! -d "$TSM_DIR/runtime/processes" ]] && mkdir -p "$TSM_DIR/runtime/processes"
[[ ! -d "$TSM_DIR/logs" ]] && mkdir -p "$TSM_DIR/logs"

# Export for subprocesses
export TSM_SRC TSM_DIR

# =============================================================================
# COLOR CONFIGURATION (uses TDS module_config)
# =============================================================================

# Default color tokens for TSM
declare -gA TSM_COLOR_TOKENS=(
    # Status feedback
    [status.error]="mode:0"
    [status.warning]="mode:1"
    [status.success]="mode:2"
    [status.info]="mode:3"

    # Text hierarchy
    [text.primary]="nouns:7"
    [text.secondary]="nouns:5"
    [text.tertiary]="nouns:3"
    [text.disabled]="nouns:2"

    # Interactive elements
    [interactive.primary]="verbs:5"
    [interactive.secondary]="verbs:1"
    [interactive.destructive]="verbs:0"
    [interactive.constructive]="verbs:3"
    [interactive.accent]="verbs:4"

    # Help system
    [help.title]="env:1"
    [help.section]="verbs:5"
    [help.command]="verbs:4"
    [help.description]="nouns:3"
    [help.comment]="nouns:2"

    # List displays
    [list.header]="env:1"
    [list.selected]="verbs:4"
    [list.index]="nouns:3"

    # Process status
    [process.running]="mode:2"
    [process.stopped]="mode:0"
    [process.starting]="mode:1"
    [process.name]="nouns:7"
    [process.port]="env:1"
    [process.port_suffix]="env:0"
    [process.pid]="nouns:4"
    [process.type]="verbs:4"
    [process.uptime]="nouns:5"
    [process.env]="verbs:1"

    # Doctor diagnostics
    [doctor.log]="verbs:5"
    [doctor.warn]="mode:1"
    [doctor.error]="mode:0"
    [doctor.success]="mode:2"
    [doctor.info]="verbs:4"

    # REPL interface
    [repl.prompt]="verbs:3"
    [repl.input]="nouns:7"
    [repl.output]="nouns:5"
    [repl.error]="mode:0"
    [repl.hint]="nouns:3"
)

# Register with TDS module config system (if available)
if declare -f tds_module_register >/dev/null 2>&1; then
    tds_module_register "tsm" "$TSM_DIR/colors.conf" TSM_COLOR_TOKENS
fi

# Source the main TSM module (which handles all component loading)
source "$TSM_SRC/tsm.sh"

# Source module index (metadata and tab completion)
source "$TSM_SRC/index.sh"

# Source tree help registration
source "$TSM_SRC/tsm_tree.sh" 2>/dev/null || true

# Register tsm actions with action registry
if [[ -f "$TETRA_SRC/actions/registry.sh" ]]; then
    source "$TETRA_SRC/actions/registry.sh"

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
