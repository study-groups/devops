#!/usr/bin/env bash
# TSM Module TCS-Compliant Actions
# Follows Tetra Module Convention 2.0 and TCS 3.0

# Import TSM functionality
: "${TSM_SRC:=$TETRA_SRC/bash/tsm}"
source "$TSM_SRC/tsm.sh" 2>/dev/null || true

# Register TSM actions with TUI
tsm_register_actions() {
    # Ensure declare_action exists (from demo 014/013)
    if ! declare -f declare_action >/dev/null 2>&1; then
        echo "Warning: declare_action not available" >&2
        return 1
    fi

    # Start a service
    declare_action "start_service" \
        "verb=start" \
        "noun=service" \
        "exec_at=@local" \
        "contexts=Local" \
        "modes=Execute" \
        "tes_operation=local" \
        "inputs=service_name,env_file" \
        "output=@tui[status]" \
        "effects=@tsm[process/started]" \
        "immediate=false" \
        "can=Start a service from services-available" \
        "cannot=Modify service definitions"

    # Stop a service/process
    declare_action "stop_service" \
        "verb=stop" \
        "noun=service" \
        "exec_at=@local" \
        "contexts=Local" \
        "modes=Execute" \
        "tes_operation=local" \
        "inputs=process_id" \
        "output=@tui[status]" \
        "effects=@tsm[process/stopped]" \
        "immediate=true" \
        "can=Stop running processes by name or ID" \
        "cannot=Stop system processes"

    # List running services
    declare_action "list_services" \
        "verb=list" \
        "noun=services" \
        "exec_at=@local" \
        "contexts=Local" \
        "modes=Inspect" \
        "tes_operation=local" \
        "inputs=filter" \
        "output=@tui[content]" \
        "immediate=true" \
        "can=List running or available services" \
        "cannot=Modify service states"

    # Show service logs
    declare_action "show_logs" \
        "verb=show" \
        "noun=logs" \
        "exec_at=@local" \
        "contexts=Local" \
        "modes=Inspect" \
        "tes_operation=local" \
        "inputs=process_id,follow" \
        "output=@tui[content]" \
        "immediate=true" \
        "can=Display service logs" \
        "cannot=Modify log files"

    # Monitor service health
    declare_action "monitor_service" \
        "verb=monitor" \
        "noun=service" \
        "exec_at=@local" \
        "contexts=Local" \
        "modes=Inspect" \
        "tes_operation=local" \
        "inputs=service_name" \
        "output=@tui[content]" \
        "immediate=false" \
        "can=Monitor service for tetra tokens and health" \
        "cannot=Modify service configuration"

    # Show port assignments
    declare_action "list_ports" \
        "verb=list" \
        "noun=ports" \
        "exec_at=@local" \
        "contexts=Local" \
        "modes=Inspect" \
        "tes_operation=local" \
        "output=@tui[content]" \
        "immediate=true" \
        "can=Show named ports and their status" \
        "cannot=Modify port assignments"

    # Run diagnostics
    declare_action "run_doctor" \
        "verb=run" \
        "noun=doctor" \
        "exec_at=@local" \
        "contexts=Local" \
        "modes=Inspect" \
        "tes_operation=local" \
        "output=@tui[content]" \
        "immediate=false" \
        "can=Validate TSM environment and diagnose issues" \
        "cannot=Fix issues automatically"
}

# Execute TSM actions
tsm_execute_action() {
    local action="$1"
    shift
    local args=("$@")

    case "$action" in
        start:service)
            local service_name="${args[0]}"
            local env_file="${args[1]:-}"

            if [[ -z "$service_name" ]]; then
                echo "Error: service_name required"
                return 1
            fi

            if [[ -n "$env_file" ]]; then
                tsm start --env "$env_file" "$service_name"
            else
                tsm start "$service_name"
            fi
            ;;

        stop:service)
            local process_id="${args[0]}"

            if [[ -z "$process_id" ]]; then
                echo "Error: process_id required"
                return 1
            fi

            tsm stop "$process_id"
            ;;

        list:services)
            local filter="${args[0]:-running}"
            tsm list "$filter"
            ;;

        show:logs)
            local process_id="${args[0]}"
            local follow="${args[1]:-}"

            if [[ -z "$process_id" ]]; then
                echo "Error: process_id required"
                return 1
            fi

            if [[ "$follow" == "true" || "$follow" == "-f" ]]; then
                tsm logs "$process_id" -f
            else
                tsm logs "$process_id"
            fi
            ;;

        monitor:service)
            local service_name="${args[0]}"

            if [[ -z "$service_name" ]]; then
                echo "Error: service_name required"
                return 1
            fi

            tsm monitor "$service_name"
            ;;

        list:ports)
            tsm ports overview
            ;;

        run:doctor)
            tsm doctor healthcheck
            ;;

        *)
            echo "Unknown action: $action"
            return 1
            ;;
    esac
}

export -f tsm_register_actions
export -f tsm_execute_action
