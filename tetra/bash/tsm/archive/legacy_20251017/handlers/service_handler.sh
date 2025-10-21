#!/usr/bin/env bash

# TSM Service Handler
# Handles service lifecycle operations: save, enable, disable, rm, show
# Implements TSM handler interface

# Source base handler interface
source "$(dirname "${BASH_SOURCE[0]}")/base_handler.sh"

# Handler implementation - check if we can execute this action
handler_can_execute() {
    local verb="$1"
    local noun="$2"

    case "$verb" in
        save|enable|disable|rm|show|list-services)
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

# Handler implementation - execute the action
handler_execute() {
    local verb="$1"
    local noun="$2"
    local env="${3:-}"
    local mode="${4:-}"
    shift 4
    local args=("$@")

    case "$verb" in
        save)
            tetra_tsm_save "$noun" "${args[@]}"
            ;;
        enable)
            tetra_tsm_enable "$noun"
            ;;
        disable)
            tetra_tsm_disable "$noun"
            ;;
        rm)
            tetra_tsm_rm "$noun"
            ;;
        show)
            tetra_tsm_show_service "$noun"
            ;;
        list-services)
            tetra_tsm_list_services "${args[@]}"
            ;;
        *)
            echo "ERROR: Unsupported service action: $verb" >&2
            return 1
            ;;
    esac
}

# Handler implementation - describe what this action does
handler_describe() {
    local verb="$1"
    local noun="$2"

    case "$verb" in
        save)
            echo "Save current command or process as a service definition"
            ;;
        enable)
            echo "Enable service for automatic startup"
            ;;
        disable)
            echo "Disable service from automatic startup"
            ;;
        rm)
            echo "Remove service definition and disable if enabled"
            ;;
        show)
            echo "Show detailed service configuration"
            ;;
        list-services)
            echo "List all available service definitions"
            ;;
        *)
            echo "Unknown service action: $verb"
            ;;
    esac
}

# Handler implementation - get supported verbs
handler_get_verbs() {
    echo "save enable disable rm show list-services"
}

# === SERVICE OPERATIONS ===

# Save current TSM command as a service definition
tetra_tsm_save() {
    local first_arg="$1"

    # Check if first argument is a process ID or name (numeric or existing process)
    if [[ "$first_arg" =~ ^[0-9]+$ ]] || tetra_tsm_is_running "$first_arg" 2>/dev/null; then
        _tsm_save_from_process "$@"
        return $?
    fi

    # Original functionality: save from command line
    local service_name="$1"
    local command="$2"
    shift 2
    local args=("$@")

    if [[ -z "$service_name" || -z "$command" ]]; then
        echo "Usage: tsm save <service-name> <command> [args...]"
        echo "   or: tsm save <process-id|process-name> [new-service-name]"
        return 1
    fi

    # Create services directory
    mkdir -p "$TETRA_DIR/tsm/services-available"

    local service_file="$TETRA_DIR/tsm/services-available/${service_name}.tsm"

    # Check if service exists and ask for confirmation to overwrite
    if [[ -f "$service_file" ]]; then
        echo "⚠️  Service '$service_name' already exists."
        read -p "Overwrite existing service? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Cancelled. Service not saved."
            return 0
        fi
    fi

    # Get current working directory and environment
    local cwd="$(pwd)"
    local env_file="${TSM_ENV_FILE:-}"
    local port="${TSM_PORT:-}"

    # Write new simplified service definition
    cat > "$service_file" <<EOF
#!/usr/bin/env bash
# TSM Service: $service_name
# Generated on $(date)

TSM_NAME="$service_name"
TSM_COMMAND="$command"
TSM_CWD="$cwd"
TSM_ENV_FILE="$env_file"
EOF

    chmod +x "$service_file"

    if [[ -f "$service_file.old" ]]; then
        echo "✅ Updated service definition: $service_file"
    else
        echo "✅ Saved service definition: $service_file"
    fi
    echo "Enable with: tsm enable $service_name"
    echo "Start with: tsm start $service_name"
}

# Save service from running process
_tsm_save_from_process() {
    local process_identifier="$1"
    local new_service_name="${2:-}"

    # Get process metadata
    local meta_file process_name
    if [[ "$process_identifier" =~ ^[0-9]+$ ]]; then
        # TSM ID provided
        local tsm_id="$process_identifier"
        meta_file="$TSM_PROCESSES_DIR/"
        for meta in "$meta_file"*.meta; do
            [[ -f "$meta" ]] || continue
            if grep -q "tsm_id=$tsm_id " "$meta"; then
                meta_file="$meta"
                process_name=$(basename "$meta" .meta)
                break
            fi
        done
    else
        # Process name provided
        process_name="$process_identifier"
        meta_file="$TSM_PROCESSES_DIR/${process_name}.meta"
    fi

    if [[ ! -f "$meta_file" ]]; then
        echo "❌ Process not found: $process_identifier"
        return 1
    fi

    # Extract metadata
    source "$meta_file"
    local service_name="${new_service_name:-${process_name%%-*}}"

    # Create service definition
    mkdir -p "$TETRA_DIR/tsm/services-available"
    local service_file="$TETRA_DIR/tsm/services-available/${service_name}.tsm"

    # Check for overwrite
    if [[ -f "$service_file" ]]; then
        echo "⚠️  Service '$service_name' already exists."
        read -p "Overwrite existing service? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Cancelled. Service not saved."
            return 0
        fi
    fi

    cat > "$service_file" <<EOF
#!/usr/bin/env bash
# TSM Service: $service_name
# Saved from running process: $process_name
# Generated on $(date)

TSM_NAME="$service_name"
TSM_COMMAND="$script"
TSM_CWD="$cwd"
TSM_ENV_FILE=""
EOF

    chmod +x "$service_file"

    echo "✅ Saved running process '$process_name' as service: $service_file"
    echo "Enable with: tsm enable $service_name"
}

# Enable service (create symlink to enabled directory)
tetra_tsm_enable() {
    local service_name="$1"

    if [[ -z "$service_name" ]]; then
        echo "Usage: tsm enable <service-name>"
        return 1
    fi

    local service_file="$TETRA_DIR/tsm/services-available/${service_name}.tsm"
    local enabled_dir="$TETRA_DIR/tsm/services-enabled"
    local enabled_link="$enabled_dir/${service_name}.tsm"

    if [[ ! -f "$service_file" ]]; then
        echo "❌ Service not found: $service_file"
        echo "Available services:"
        tetra_tsm_list_services
        return 1
    fi

    # Create enabled directory
    mkdir -p "$enabled_dir"

    # Create symlink
    if [[ -L "$enabled_link" ]]; then
        echo "⚠️  Service already enabled: $service_name"
        return 0
    fi

    ln -s "../services-available/${service_name}.tsm" "$enabled_link"
    echo "✅ Enabled service: $service_name"
    echo "Service will start automatically with tetra daemon"
}

# Disable service (remove symlink from enabled directory)
tetra_tsm_disable() {
    local service_name="$1"

    if [[ -z "$service_name" ]]; then
        echo "Usage: tsm disable <service-name>"
        return 1
    fi

    local enabled_link="$TETRA_DIR/tsm/services-enabled/${service_name}.tsm"

    if [[ ! -L "$enabled_link" ]]; then
        echo "⚠️  Service not enabled: $service_name"
        return 0
    fi

    rm "$enabled_link"
    echo "✅ Disabled service: $service_name"
    echo "Service will not start automatically"
}

# Remove service (delete from services-available and disable if enabled)
tetra_tsm_rm() {
    local service_name="$1"

    if [[ -z "$service_name" ]]; then
        echo "Usage: tsm rm <service-name>"
        return 1
    fi

    local service_file="$TETRA_DIR/tsm/services-available/${service_name}.tsm"
    local enabled_link="$TETRA_DIR/tsm/services-enabled/${service_name}.tsm"

    # Check if service exists
    if [[ ! -f "$service_file" ]]; then
        echo "❌ Service not found: $service_name"
        echo "Available services:"
        tetra_tsm_list_services
        return 1
    fi

    # Disable service if enabled
    if [[ -L "$enabled_link" ]]; then
        echo "🔄 Disabling service first..."
        tetra_tsm_disable "$service_name"
    fi

    # Remove service definition
    rm -f "$service_file"
    echo "✅ Removed service: $service_name"
    echo "Service definition deleted from $service_file"
}

# List available services
tetra_tsm_list_services() {
    local services_dir="$TETRA_DIR/tsm/services-available"
    local enabled_dir="$TETRA_DIR/tsm/services-enabled"
    local detail="${1:-}"

    echo "📋 Saved Service Definitions:"
    if [[ -d "$services_dir" ]]; then
        local found_services=false
        for service_file in "$services_dir"/*.tsm; do
            [[ -f "$service_file" ]] || continue
            found_services=true

            local service_name=$(basename "$service_file" .tsm)
            local enabled_status=""
            if [[ -L "$enabled_dir/${service_name}.tsm" ]]; then
                enabled_status=" ✅"
            else
                enabled_status=" ⚪"
            fi

            # Source service definition to get details
            local TSM_NAME="" TSM_COMMAND="" TSM_CWD="" TSM_ENV_FILE="" TSM_PORT="" TSM_DESCRIPTION=""
            (source "$service_file" 2>/dev/null)
            local cmd="$TSM_COMMAND"
            local port="$TSM_PORT"
            local env="$TSM_ENV_FILE"
            local desc="$TSM_DESCRIPTION"

            if [[ "$detail" == "--detail" || "$detail" == "-d" ]]; then
                echo "  📄 $service_name$enabled_status"
                echo "      Command: $cmd"
                [[ -n "$port" ]] && echo "      Port: $port"
                [[ -n "$env" ]] && echo "      Env: $env"
                [[ -n "$desc" ]] && echo "      Description: $desc"
                echo
            else
                local port_info=""
                [[ -n "$port" ]] && port_info=" :$port"
                echo "  📄 $service_name$enabled_status ($cmd$port_info)"
            fi
        done

        if [[ "$found_services" == "false" ]]; then
            echo "  No saved services found"
        fi
    else
        echo "  Services directory not found: $services_dir"
    fi

    echo
    echo "Legend: ✅ enabled for autostart, ⚪ disabled"
    echo "Usage: tsm list-services [-d|--detail]"
}

# Show service details
tetra_tsm_show_service() {
    local service_name="$1"

    if [[ -z "$service_name" ]]; then
        echo "Usage: tsm show <service-name>"
        return 1
    fi

    local service_file="$TETRA_DIR/tsm/services-available/${service_name}.tsm"

    if [[ ! -f "$service_file" ]]; then
        echo "❌ Service not found: $service_file"
        return 1
    fi

    echo "🔍 Service: $service_name"
    echo "📄 File: $service_file"
    echo

    # Source and display variables
    (
        source "$service_file"
        echo "Configuration:"
        echo "  Name: ${TSM_NAME:-}"
        echo "  Command: ${TSM_COMMAND:-}"
        echo "  Directory: ${TSM_CWD:-}"
        echo "  Environment: ${TSM_ENV:-none}"
        echo "  Port: ${TSM_PORT:-none}"
        echo "  Description: ${TSM_DESCRIPTION:-none}"
        if [[ -n "${TSM_ARGS:-}" ]]; then
            echo "  Arguments: ${TSM_ARGS[*]}"
        fi
    )

    # Check if enabled
    if [[ -L "$TETRA_DIR/tsm/services-enabled/${service_name}.tsm" ]]; then
        echo "  Status: enabled ✅"
    else
        echo "  Status: disabled"
    fi
}

# Export all service functions
export -f tetra_tsm_save
export -f _tsm_save_from_process
export -f tetra_tsm_enable
export -f tetra_tsm_disable
export -f tetra_tsm_rm
export -f tetra_tsm_list_services
export -f tetra_tsm_show_service