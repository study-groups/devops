#!/usr/bin/env bash

# TSM TView Integration Functions
# Functions specifically for TView framework integration

# Get list of available services for TView display
tview_tsm_get_services() {
    local services_dir="$TETRA_DIR/tsm/services-available"

    if [[ -d "$services_dir" ]]; then
        for service_file in "$services_dir"/*.tsm; do
            [[ -f "$service_file" ]] || continue
            basename "$service_file" .tsm
        done
    fi
}

# Get list of enabled services for TView
tview_tsm_get_enabled_services() {
    local enabled_dir="$TETRA_DIR/tsm/services-enabled"

    if [[ -d "$enabled_dir" ]]; then
        for service_link in "$enabled_dir"/*.tsm; do
            [[ -L "$service_link" ]] || continue
            basename "$service_link" .tsm
        done
    fi
}

# Check if a service is running and return status for TView
tview_tsm_service_status() {
    local service="$1"

    if [[ -z "$service" ]]; then
        echo "stopped"
        return
    fi

    # Check if any process with service name prefix is running
    if tsm list 2>/dev/null | grep -q "^[0-9]*[[:space:]]*${service}-"; then
        echo "running"
    else
        echo "stopped"
    fi
}

# Get detailed service information for TView
tview_tsm_service_info() {
    local service="$1"
    local service_file="$TETRA_DIR/tsm/services-available/${service}.tsm"

    if [[ ! -f "$service_file" ]]; then
        echo "Service not found"
        return 1
    fi

    # Source service definition
    source "$service_file"

    echo "Name: $TSM_NAME"
    echo "Command: $TSM_COMMAND"
    echo "Directory: $TSM_CWD"
    echo "Environment: ${TSM_ENV_FILE:-none}"

    # Check if enabled
    if [[ -L "$TETRA_DIR/tsm/services-enabled/${service}.tsm" ]]; then
        echo "Status: enabled"
    else
        echo "Status: disabled"
    fi

    # Check if running
    echo "Running: $(tview_tsm_service_status "$service")"
}

# Main TView action handler - called when user presses action key in TView
handle_tsm_execute() {
    case $CURRENT_ITEM in
        0)
            echo "🚀 Starting all enabled services..."
            bash -c "source ~/tetra/tetra.sh && tsm startup"
            ;;
        1)
            echo "📋 Running services:"
            tsm list
            ;;
        2)
            echo "💾 Save menu - showing running processes:"
            tsm list
            read -p "Enter TSM ID to save as service: " tsm_id
            if [[ -n "$tsm_id" ]]; then
                read -p "Service name: " service_name
                bash -c "source ~/tetra/tetra.sh && tsm save $tsm_id $service_name"
            fi
            ;;
        3)
            tview_tsm_manage_menu
            ;;
    esac
}

# Interactive service management within TView
tview_tsm_manage_menu() {
    echo "🔧 Service Management"
    echo
    echo "Available services:"

    local services=($(tview_tsm_get_services))
    if [[ ${#services[@]} -eq 0 ]]; then
        echo "No services found"
        return 0
    fi

    local i=1
    for service in "${services[@]}"; do
        local status="⚪"
        if [[ -L "$TETRA_DIR/tsm/services-enabled/${service}.tsm" ]]; then
            status="✅"
        fi
        echo "$i) $service $status"
        ((i++))
    done

    echo
    read -p "Select service number (or Enter to cancel): " selection

    if [[ -n "$selection" && "$selection" =~ ^[0-9]+$ ]]; then
        local service_index=$((selection - 1))
        if [[ $service_index -ge 0 && $service_index -lt ${#services[@]} ]]; then
            local service="${services[$service_index]}"

            if [[ -L "$TETRA_DIR/tsm/services-enabled/${service}.tsm" ]]; then
                echo "Disabling $service..."
                bash -c "source ~/tetra/tetra.sh && tsm disable $service"
            else
                echo "Enabling $service..."
                bash -c "source ~/tetra/tetra.sh && tsm enable $service"
            fi
        else
            echo "Invalid selection"
        fi
    fi
}

# Get TSM status for TView display
tview_tsm_status() {
    local running_count=$(tsm list 2>/dev/null | grep -c "running" || echo "0")
    local enabled_count=$(tview_tsm_get_enabled_services | wc -l)
    local available_count=$(tview_tsm_get_services | wc -l)

    echo "Services: $running_count running, $enabled_count enabled, $available_count available"
}

# Export TView integration functions
export -f tview_tsm_get_services
export -f tview_tsm_get_enabled_services
export -f tview_tsm_service_status
export -f tview_tsm_service_info
export -f handle_tsm_execute
export -f tview_tsm_manage_menu
export -f tview_tsm_status