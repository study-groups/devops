#!/usr/bin/env bash

# TSM Generic TView Data Provider
# Implements standard TView provider interface

# Standard interface: get_module_items()
get_module_items() {
    local env="${1:-$CURRENT_ENV}"

    case "$env" in
        "LOCAL")
            get_tsm_local_items
            ;;
        "DEV"|"STAGING"|"PROD"|"QA")
            get_tsm_remote_items "$env"
            ;;
        "TETRA")
            get_tsm_tetra_items
            ;;
        *)
            echo "  No items available for environment: $env"
            ;;
    esac
}

# Standard interface: get_module_status()
get_module_status() {
    local env="${1:-$CURRENT_ENV}"

    local running_count=$(tsm list 2>/dev/null | grep -c "running" || echo "0")
    local enabled_count=$(get_enabled_services | wc -l)
    local available_count=$(get_available_services | wc -l)

    case "$env" in
        "LOCAL")
            echo "running:$running_count,enabled:$enabled_count,available:$available_count"
            ;;
        "DEV"|"STAGING"|"PROD"|"QA")
            local connection_status=$(test_remote_connection "$env")
            echo "connection:$connection_status,services:$running_count"
            ;;
        "TETRA")
            echo "local_services:$available_count,system:ready"
            ;;
        *)
            echo "status:unknown"
            ;;
    esac
}

# Standard interface: get_module_capabilities()
get_module_capabilities() {
    local env="${1:-$CURRENT_ENV}"

    case "$env" in
        "LOCAL")
            echo "start,stop,restart,logs,save,enable,disable"
            ;;
        "DEV"|"STAGING"|"PROD"|"QA")
            echo "connect,deploy,restart,logs,status"
            ;;
        "TETRA")
            echo "manage,configure,inspect,services"
            ;;
        *)
            echo "none"
            ;;
    esac
}

# Standard interface: get_module_details() (optional)
get_module_details() {
    local item="$1"
    local env="${2:-$CURRENT_ENV}"

    if [[ -z "$item" ]]; then
        echo "Service name required"
        return 1
    fi

    get_service_detailed_info "$item"
}

# Internal implementation functions

# Get local TSM items
get_tsm_local_items() {
    echo "  Available Services:"

    local services=($(get_available_services))
    if [[ ${#services[@]} -eq 0 ]]; then
        echo "    No services configured"
        return 0
    fi

    for service in "${services[@]}"; do
        local status=$(get_service_status "$service")
        local enabled_indicator=""

        if is_service_enabled "$service"; then
            enabled_indicator=" ✅"
        else
            enabled_indicator=" ⚪"
        fi

        case "$status" in
            "running")
                echo "    🟢 $service (running)$enabled_indicator"
                ;;
            "stopped")
                echo "    🔴 $service (stopped)$enabled_indicator"
                ;;
            *)
                echo "    ⚫ $service ($status)$enabled_indicator"
                ;;
        esac
    done

    echo ""
    echo "  Running Processes:"
    local running_processes=$(tsm list 2>/dev/null | grep -E "^\s*[0-9]+" || echo "")
    if [[ -n "$running_processes" ]]; then
        echo "$running_processes" | while read -r line; do
            echo "    $line"
        done
    else
        echo "    No running processes"
    fi
}

# Get remote TSM items (for remote environments)
get_tsm_remote_items() {
    local env="$1"

    echo "  Remote Services on $env:"

    local connection_status=$(test_remote_connection "$env")
    if [[ "$connection_status" != "connected" ]]; then
        echo "    ❌ Connection failed - cannot list services"
        echo "    Status: $connection_status"
        return 1
    fi

    # Would integrate with actual remote service listing
    echo "    🔍 Checking remote services..."
    echo "    📋 Use 'connect' to access remote TSM"
}

# Get TETRA environment items
get_tsm_tetra_items() {
    echo "  TSM System Overview:"
    echo "    📁 Services Directory: $TETRA_DIR/tsm/services-available"
    echo "    🔗 Enabled Services: $TETRA_DIR/tsm/services-enabled"
    echo "    📊 Available: $(get_available_services | wc -l) services"
    echo "    ✅ Enabled: $(get_enabled_services | wc -l) services"
    echo "    🟢 Running: $(tsm list 2>/dev/null | grep -c "running" || echo "0") processes"
}

# Helper functions (internal)

# Get list of available services
get_available_services() {
    local services_dir="$TETRA_DIR/tsm/services-available"

    if [[ -d "$services_dir" ]]; then
        for service_file in "$services_dir"/*.tsm; do
            [[ -f "$service_file" ]] || continue
            basename "$service_file" .tsm
        done
    fi
}

# Get list of enabled services
get_enabled_services() {
    local enabled_dir="$TETRA_DIR/tsm/services-enabled"

    if [[ -d "$enabled_dir" ]]; then
        for service_link in "$enabled_dir"/*.tsm; do
            [[ -L "$service_link" ]] || continue
            basename "$service_link" .tsm
        done
    fi
}

# Get service status
get_service_status() {
    local service="$1"

    if [[ -z "$service" ]]; then
        echo "unknown"
        return 1
    fi

    # Check if any process with service name prefix is running
    if tsm list 2>/dev/null | grep -q "^[0-9]*[[:space:]]*${service}-"; then
        echo "running"
    else
        echo "stopped"
    fi
}

# Check if service is enabled
is_service_enabled() {
    local service="$1"
    [[ -L "$TETRA_DIR/tsm/services-enabled/${service}.tsm" ]]
}

# Get detailed service information
get_service_detailed_info() {
    local service="$1"
    local service_file="$TETRA_DIR/tsm/services-available/${service}.tsm"

    if [[ ! -f "$service_file" ]]; then
        echo "Service '$service' not found"
        return 1
    fi

    # Source service definition in subshell
    (
        source "$service_file"

        echo "Service: $service"
        echo "Name: ${TSM_NAME:-$service}"
        echo "Command: ${TSM_COMMAND:-not defined}"
        echo "Directory: ${TSM_CWD:-not defined}"
        echo "Environment: ${TSM_ENV_FILE:-none}"

        # Check status
        if is_service_enabled "$service"; then
            echo "Status: enabled"
        else
            echo "Status: disabled"
        fi

        echo "Running: $(get_service_status "$service")"
    )
}

# Test remote connection
test_remote_connection() {
    local env="$1"

    # Get SSH configuration for environment
    local ssh_prefix=$(get_ssh_prefix_for_env "$env")

    if [[ -z "$ssh_prefix" ]]; then
        echo "no_config"
        return 1
    fi

    # Test connection
    if timeout 2 $ssh_prefix "echo 'ok'" >/dev/null 2>&1; then
        echo "connected"
    else
        echo "failed"
    fi
}

# Get SSH prefix for environment (from existing function in tsm_data.sh)
get_ssh_prefix_for_env() {
    local env="$1"

    case "$env" in
        "DEV")
            echo "ssh root@dev.pixeljamarcade.com"
            ;;
        "STAGING")
            echo "ssh root@staging.pixeljamarcade.com"
            ;;
        "PROD")
            echo "ssh root@prod.pixeljamarcade.com"
            ;;
        "QA")
            echo "ssh root@qa.pixeljamarcade.com"
            ;;
        *)
            echo ""
            ;;
    esac
}