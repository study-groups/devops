#!/usr/bin/env bash
# TSM Tree - Help and Completion Tree Structure
# Defines the TSM (Tetra Service Manager) command tree

# Source dependencies (only if not already loaded)
if [[ -z "${TREE_TYPE[*]}" ]]; then
    source "$TETRA_SRC/bash/tree/core.sh"
fi

# Initialize TSM tree under help.tsm namespace
tsm_tree_init() {
    local ns="help.tsm"

    # Root category
    tree_insert "$ns" "category" \
        title="Tetra Service Manager" \
        description="Process and service management system for background tasks"

    # ========================================================================
    # PROCESS LIFECYCLE COMMANDS
    # ========================================================================

    # start - Start a service/command
    tree_insert "$ns.start" "command" \
        title="Start a service or command" \
        description="Launch any command as a background service managed by TSM" \
        usage="tsm start [OPTIONS] <command|service>" \
        handler="tetra_tsm_start" \
        examples="tsm start python -m http.server 8020
tsm start --env dev server.js
tsm start devpages"

    # stop - Stop a running process
    tree_insert "$ns.stop" "command" \
        title="Stop a running process" \
        description="Stop a process by name, ID, or port" \
        usage="tsm stop <process|id|port|*>" \
        handler="tetra_tsm_stop" \
        examples="tsm stop devpages-4444
tsm stop 0
tsm stop *"

    # restart - Restart a process
    tree_insert "$ns.restart" "command" \
        title="Restart a process" \
        description="Stop and start a process" \
        usage="tsm restart <process|id>" \
        handler="tetra_tsm_restart"

    # kill - Force kill and delete process
    tree_insert "$ns.kill" "command" \
        title="Force kill and delete process" \
        description="Forcefully terminate a process and remove its tracking files" \
        usage="tsm kill <process|id|port>" \
        handler="tetra_tsm_kill"

    # ========================================================================
    # PROCESS INFORMATION COMMANDS
    # ========================================================================

    # list - List processes
    tree_insert "$ns.list" "command" \
        title="List running processes" \
        description="Display all running TSM-managed processes" \
        usage="tsm list [running|available|all|pwd|-l]" \
        handler="tsm_list_running" \
        aliases="ls" \
        examples="tsm list
tsm list available
tsm list -l"

    # info - Show process details
    tree_insert "$ns.info" "command" \
        title="Show detailed process information" \
        description="Display comprehensive details about a specific process" \
        usage="tsm info <process|id>" \
        handler="tetra_tsm_info"

    # logs - Show process logs
    tree_insert "$ns.logs" "command" \
        title="Show process logs" \
        description="View stdout/stderr logs for a process" \
        usage="tsm logs <process|id> [-f|--follow]" \
        handler="tetra_tsm_logs" \
        examples="tsm logs devpages-4444
tsm logs 0 -f"

    # ========================================================================
    # SERVICE MANAGEMENT
    # ========================================================================

    # services - List saved services
    tree_insert "$ns.services" "command" \
        title="List available service definitions" \
        description="Show all saved .tsm service definition files" \
        usage="tsm services" \
        handler="tetra_tsm_list_services"

    # save - Save service definition
    tree_insert "$ns.save" "command" \
        title="Save a service definition" \
        description="Create a reusable .tsm service file" \
        usage="tsm save <name> <command> [port]" \
        handler="tetra_tsm_save" \
        examples="tsm save devpages 'node server.js' 4444
tsm save api 'python app.py' 8000"

    # enable - Enable service
    tree_insert "$ns.enable" "command" \
        title="Enable a service" \
        description="Mark a service as enabled in services-enabled/" \
        usage="tsm enable <service>" \
        handler="tetra_tsm_enable"

    # disable - Disable service
    tree_insert "$ns.disable" "command" \
        title="Disable a service" \
        description="Remove service from services-enabled/" \
        usage="tsm disable <service>" \
        handler="tetra_tsm_disable"

    # ========================================================================
    # PORT MANAGEMENT
    # ========================================================================

    # ports - Port management category
    tree_insert "$ns.ports" "category" \
        title="Port management" \
        description="Manage named ports and detect conflicts"

    tree_insert "$ns.ports.list" "command" \
        title="List named port assignments" \
        description="Show all registered service ports" \
        usage="tsm ports [list]" \
        handler="tsm_list_named_ports"

    tree_insert "$ns.ports.scan" "command" \
        title="Scan for port usage" \
        description="Scan system for active ports and conflicts" \
        usage="tsm ports scan" \
        handler="tsm_scan_ports"

    tree_insert "$ns.ports.conflicts" "command" \
        title="Detect port conflicts" \
        description="Find and optionally fix port conflicts" \
        usage="tsm ports conflicts [--fix]" \
        handler="tsm_detect_conflicts"

    # ========================================================================
    # DIAGNOSTICS & HEALTH
    # ========================================================================

    # doctor - Diagnostic tools category
    tree_insert "$ns.doctor" "category" \
        title="System diagnostics" \
        description="Health checks and troubleshooting tools"

    tree_insert "$ns.doctor.healthcheck" "command" \
        title="Full system health check" \
        description="Validate TSM environment and detect issues" \
        usage="tsm doctor healthcheck" \
        handler="tetra_tsm_doctor"

    tree_insert "$ns.doctor.scan" "command" \
        title="Scan for issues" \
        description="Quick diagnostic scan of ports and processes" \
        usage="tsm doctor scan" \
        handler="tetra_tsm_doctor"

    tree_insert "$ns.doctor.orphans" "command" \
        title="Find orphaned processes" \
        description="Detect processes with stale tracking files" \
        usage="tsm doctor orphans" \
        handler="tetra_tsm_doctor"

    tree_insert "$ns.doctor.clean" "command" \
        title="Clean stale tracking files" \
        description="Remove tracking files for dead processes" \
        usage="tsm doctor clean" \
        handler="tetra_tsm_doctor"

    # ========================================================================
    # REPL & INTERACTIVE
    # ========================================================================

    # repl - Interactive REPL
    tree_insert "$ns.repl" "command" \
        title="Interactive TSM REPL" \
        description="Start interactive command-line interface for TSM" \
        usage="tsm repl" \
        handler="tsm_repl_main"

    # monitor - Process monitoring
    tree_insert "$ns.monitor" "command" \
        title="Monitor processes" \
        description="Real-time process monitoring dashboard" \
        usage="tsm monitor" \
        handler="tetra_tsm_monitor"
}

# Export the init function
export -f tsm_tree_init
