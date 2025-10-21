#!/usr/bin/env bash

# TSM Generic TView Action Handler
# Implements standard TView action interface

# Standard interface: handle_module_action()
handle_module_action() {
    local action="$1"
    local env="${2:-$CURRENT_ENV}"
    shift 2
    local args=("$@")

    case "$action" in
        "start")
            handle_tsm_start "$env" "${args[@]}"
            ;;
        "stop")
            handle_tsm_stop "$env" "${args[@]}"
            ;;
        "restart")
            handle_tsm_restart "$env" "${args[@]}"
            ;;
        "logs")
            handle_tsm_logs "$env" "${args[@]}"
            ;;
        "save")
            handle_tsm_save "$env" "${args[@]}"
            ;;
        "enable")
            handle_tsm_enable "$env" "${args[@]}"
            ;;
        "disable")
            handle_tsm_disable "$env" "${args[@]}"
            ;;
        "connect")
            handle_tsm_connect "$env" "${args[@]}"
            ;;
        "deploy")
            handle_tsm_deploy "$env" "${args[@]}"
            ;;
        "status")
            handle_tsm_status "$env" "${args[@]}"
            ;;
        "manage")
            handle_tsm_manage "$env" "${args[@]}"
            ;;
        "configure")
            handle_tsm_configure "$env" "${args[@]}"
            ;;
        "inspect")
            handle_tsm_inspect "$env" "${args[@]}"
            ;;
        "services")
            handle_tsm_services_overview "$env" "${args[@]}"
            ;;
        *)
            echo "Unknown action: $action"
            echo "Available actions: $(get_module_capabilities "$env")"
            return 1
            ;;
    esac
}

# Action implementations

# Start TSM services
handle_tsm_start() {
    local env="$1"
    shift
    local args=("$@")

    case "$env" in
        "LOCAL")
            if [[ ${#args[@]} -eq 0 ]]; then
                echo "🚀 Starting all enabled services..."
                tsm startup
            else
                for service in "${args[@]}"; do
                    echo "🚀 Starting service: $service"
                    tsm start "$service"
                done
            fi
            ;;
        *)
            echo "❌ Cannot start services in $env environment from here"
            echo "💡 Use 'connect' to access remote environment"
            ;;
    esac
}

# Stop TSM services
handle_tsm_stop() {
    local env="$1"
    shift
    local args=("$@")

    case "$env" in
        "LOCAL")
            if [[ ${#args[@]} -eq 0 ]]; then
                echo "🛑 Stopping all running services..."
                tsm list | grep -E "^\s*[0-9]+" | while read -r line; do
                    local tsm_id=$(echo "$line" | awk '{print $1}')
                    echo "Stopping TSM ID: $tsm_id"
                    tsm stop "$tsm_id"
                done
            else
                for service in "${args[@]}"; do
                    echo "🛑 Stopping service: $service"
                    tsm stop "$service"
                done
            fi
            ;;
        *)
            echo "❌ Cannot stop services in $env environment from here"
            ;;
    esac
}

# Restart TSM services
handle_tsm_restart() {
    local env="$1"
    shift
    local args=("$@")

    for service in "${args[@]}"; do
        echo "🔄 Restarting service: $service"
        handle_tsm_stop "$env" "$service"
        sleep 1
        handle_tsm_start "$env" "$service"
    done
}

# View TSM logs
handle_tsm_logs() {
    local env="$1"
    shift
    local args=("$@")

    if [[ ${#args[@]} -eq 0 ]]; then
        echo "📋 Running services:"
        tsm list
        echo ""
        read -p "Enter service name or TSM ID to view logs: " service_input
        args=("$service_input")
    fi

    for service in "${args[@]}"; do
        echo "📜 Viewing logs for: $service"
        tsm logs "$service"
    done
}

# Save running process as service
handle_tsm_save() {
    local env="$1"
    shift
    local args=("$@")

    echo "💾 Save Running Process as Service"
    echo ""
    echo "📋 Running processes:"
    tsm list

    local tsm_id="${args[0]}"
    local service_name="${args[1]}"

    if [[ -z "$tsm_id" ]]; then
        read -p "Enter TSM ID to save: " tsm_id
    fi

    if [[ -z "$service_name" ]]; then
        read -p "Enter service name: " service_name
    fi

    if [[ -n "$tsm_id" && -n "$service_name" ]]; then
        echo "💾 Saving TSM ID $tsm_id as service '$service_name'"
        tsm save "$tsm_id" "$service_name"
    else
        echo "❌ Both TSM ID and service name are required"
    fi
}

# Enable service
handle_tsm_enable() {
    local env="$1"
    shift
    local args=("$@")

    for service in "${args[@]}"; do
        echo "✅ Enabling service: $service"
        tsm enable "$service"
    done
}

# Disable service
handle_tsm_disable() {
    local env="$1"
    shift
    local args=("$@")

    for service in "${args[@]}"; do
        echo "⚪ Disabling service: $service"
        tsm disable "$service"
    done
}

# Connect to remote environment
handle_tsm_connect() {
    local env="$1"
    shift

    echo "🔌 Connecting to $env environment..."

    local ssh_prefix=$(get_ssh_prefix_for_env "$env")
    if [[ -z "$ssh_prefix" ]]; then
        echo "❌ No SSH configuration for $env environment"
        return 1
    fi

    echo "Executing: $ssh_prefix"
    eval "$ssh_prefix"
}

# Deploy to remote environment
handle_tsm_deploy() {
    local env="$1"
    shift

    echo "🚀 Deploying TSM configuration to $env..."

    # This would integrate with actual deployment system
    echo "📋 Services to deploy:"
    get_enabled_services | while read -r service; do
        echo "  - $service"
    done

    echo ""
    echo "💡 This would sync service definitions and restart services on $env"
    echo "💡 Implementation pending - requires deployment integration"
}

# Show status
handle_tsm_status() {
    local env="$1"
    shift

    echo "📊 TSM Status for $env:"
    echo ""

    local status=$(get_module_status "$env")
    echo "Status: $status"
    echo ""

    echo "Items:"
    get_module_items "$env"
}

# TSM management menu
handle_tsm_manage() {
    local env="$1"
    shift

    echo "🔧 TSM Service Management"
    echo ""

    # Interactive service management
    interactive_service_management
}

# Configure TSM
handle_tsm_configure() {
    local env="$1"
    shift

    echo "⚙️  TSM Configuration"
    echo ""
    echo "Configuration directory: $TETRA_DIR/tsm/"
    echo "Services available: $TETRA_DIR/tsm/services-available/"
    echo "Services enabled: $TETRA_DIR/tsm/services-enabled/"
    echo ""
    echo "💡 Use 'manage' for interactive service configuration"
}

# Inspect TSM system
handle_tsm_inspect() {
    local env="$1"
    shift

    echo "🔍 TSM System Inspection"
    echo ""

    # Run TSM doctor or inspection
    if command -v tsm >/dev/null && tsm --help 2>/dev/null | grep -q "doctor\|inspect"; then
        tsm doctor
    else
        echo "📋 Basic TSM inspection:"
        echo ""
        echo "Available services: $(get_available_services | wc -l)"
        echo "Enabled services: $(get_enabled_services | wc -l)"
        echo "Running processes: $(tsm list 2>/dev/null | grep -c "running" || echo "0")"
    fi
}

# Services overview
handle_tsm_services_overview() {
    local env="$1"
    shift

    echo "📋 TSM Services Overview"
    echo ""

    get_module_items "$env"
}

# Helper functions

# Interactive service management
interactive_service_management() {
    local services=($(get_available_services))

    if [[ ${#services[@]} -eq 0 ]]; then
        echo "No services found in $TETRA_DIR/tsm/services-available/"
        return 0
    fi

    echo "Available services:"
    local i=1
    for service in "${services[@]}"; do
        local status="⚪"
        if is_service_enabled "$service"; then
            status="✅"
        fi
        echo "$i) $service $status"
        ((i++))
    done

    echo ""
    read -p "Select service number (or Enter to cancel): " selection

    if [[ -n "$selection" && "$selection" =~ ^[0-9]+$ ]]; then
        local service_index=$((selection - 1))
        if [[ $service_index -ge 0 && $service_index -lt ${#services[@]} ]]; then
            local service="${services[$service_index]}"

            if is_service_enabled "$service"; then
                echo "Disabling $service..."
                tsm disable "$service"
            else
                echo "Enabling $service..."
                tsm enable "$service"
            fi
        else
            echo "Invalid selection"
        fi
    fi
}

# Get enabled services helper (duplicated from providers.sh for independence)
get_enabled_services() {
    local enabled_dir="$TETRA_DIR/tsm/services-enabled"

    if [[ -d "$enabled_dir" ]]; then
        for service_link in "$enabled_dir"/*.tsm; do
            [[ -L "$service_link" ]] || continue
            basename "$service_link" .tsm
        done
    fi
}

# Check if service is enabled helper
is_service_enabled() {
    local service="$1"
    [[ -L "$TETRA_DIR/tsm/services-enabled/${service}.tsm" ]]
}

# Get available services helper
get_available_services() {
    local services_dir="$TETRA_DIR/tsm/services-available"

    if [[ -d "$services_dir" ]]; then
        for service_file in "$services_dir"/*.tsm; do
            [[ -f "$service_file" ]] || continue
            basename "$service_file" .tsm
        done
    fi
}

# SSH prefix helper (duplicated from providers.sh)
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