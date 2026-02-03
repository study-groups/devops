#!/usr/bin/env bash
# TSM List - router and stale process sweep
#
# Verbosity levels:
#   (none)  : Compact table (ID, NAME, PID, PORT, STATUS, UPTIME)
#   -v      : Add TYPE, CWD columns
#   -vv     : Add parent/sibling relations
#   -vvv    : Multiline detailed format per service
#   -vvvv   : Full metadata dump

# List running processes or service definitions
# Usage: tsm_list [available|enabled] [-v...] [-a] [-U] [-p] [-g] [--org ORG] [--json]
#
# Modes:
#   (default)  - Running processes
#   available  - Service definitions in services-available/
#   enabled    - Service definitions in services-enabled/
#
# Flags:
#   -a         - Include stopped processes (running mode only)
#   -U         - All users (requires root)
#   --org ORG  - Filter by org name
#   -g         - Group by stack
#   -p         - Port-focused view
#   --json     - JSON output
tsm_list() {
    local mode="running"
    local verbosity=0
    local show_all=false
    local show_ports=false
    local json_output=false
    local all_users=false
    local group_by_stack=false
    local filter_org=""

    # Check for mode as first positional arg
    case "${1:-}" in
        available|avail) mode="available"; shift ;;
        enabled)         mode="enabled"; shift ;;
    esac

    while [[ $# -gt 0 ]]; do
        case "$1" in
            -vvvv)           verbosity=4 ;;
            -vvv)            verbosity=3 ;;
            -vv)             verbosity=2 ;;
            -v)              verbosity=1 ;;
            -a|--all)        show_all=true ;;
            -U|--all-users)  all_users=true ;;
            --org)           filter_org="$2"; shift ;;
            -p|--ports)      show_ports=true ;;
            --json)          json_output=true ;;
            -g|--group)      group_by_stack=true ;;
            *)               break ;;
        esac
        shift
    done

    # Set global for helper functions
    _TSM_LIST_ALL_USERS="$all_users"
    _TSM_LIST_FILTER_ORG="$filter_org"

    case "$mode" in
        available)
            _tsm_list_services "available" "$json_output"
            ;;
        enabled)
            _tsm_list_services "enabled" "$json_output"
            ;;
        running)
            # Sweep stale processes first
            _tsm_sweep_stale

            if [[ "$json_output" == "true" ]]; then
                _tsm_list_json "$show_all"
            elif [[ "$show_ports" == "true" ]]; then
                _tsm_list_ports
            elif [[ "$group_by_stack" == "true" ]]; then
                _tsm_list_grouped "$show_all"
            elif [[ $verbosity -ge 3 ]]; then
                _tsm_list_long "$show_all" "$verbosity"
            elif [[ $verbosity -ge 1 ]]; then
                _tsm_list_verbose "$show_all" "$verbosity"
            else
                _tsm_list_table "$show_all"
            fi

            # Warn about early exits detected during sweep
            if [[ ${_TSM_EARLY_EXIT_COUNT:-0} -gt 0 ]]; then
                echo "warn: ${_TSM_EARLY_EXIT_COUNT} service(s) exited early. Use 'tsm logs <name> --err' to inspect." >&2
            fi
            ;;
    esac
}

# Sweep stale (dead) processes
_tsm_sweep_stale() {
    local processes_dirs=()
    local early_exit_count=0

    if [[ "$_TSM_LIST_ALL_USERS" == "true" ]] && tsm_multi_user_enabled; then
        # Sweep all users' processes
        mapfile -t processes_dirs < <(tsm_get_all_process_dirs)
    else
        # Just current user
        [[ -d "$TSM_PROCESSES_DIR" ]] && processes_dirs+=("$TSM_PROCESSES_DIR")
    fi

    for processes_dir in "${processes_dirs[@]}"; do
        [[ -d "$processes_dir" ]] || continue
        for dir in "$processes_dir"/*/; do
            [[ -d "$dir" ]] || continue
            local name=$(basename "$dir")
            [[ "$name" == .* ]] && continue

            local meta="${dir}meta.json"
            [[ -f "$meta" ]] || continue

            local pid=$(jq -r '.pid // empty' "$meta" 2>/dev/null)
            local status=$(jq -r '.status // empty' "$meta" 2>/dev/null)

            if [[ "$status" == "online" ]] && ! tsm_is_pid_alive "$pid"; then
                # Update status in place
                jq '.status = "stopped"' "$meta" > "${meta}.tmp" && mv "${meta}.tmp" "$meta"
                # Check for early exit marker
                [[ -f "${dir}early_exit" ]] && ((early_exit_count++))
            fi
        done
    done

    # Store count for post-table warning
    _TSM_EARLY_EXIT_COUNT=$early_exit_count
}

