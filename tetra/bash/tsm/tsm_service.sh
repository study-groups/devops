#!/usr/bin/env bash

# TSM Service Management - Save and Enable Services
# nginx-style service enable/disable with symlinks

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
    mkdir -p "$TETRA_DIR/services"

    local service_file="$TETRA_DIR/services/${service_name}.tsm.sh"

    # Get current working directory and environment
    local cwd="$(pwd)"
    local env_file="${TSM_ENV_FILE:-}"
    local port="${TSM_PORT:-}"

    # Write service definition
    cat > "$service_file" <<EOF
#!/usr/bin/env bash

# TSM Service Definition: $service_name
# Generated on $(date)

# Service metadata
export TSM_NAME="$service_name"
export TSM_COMMAND="$command"
export TSM_CWD="$cwd"

# Optional settings
EOF

    if [[ -n "$env_file" ]]; then
        echo "export TSM_ENV=\"$env_file\"" >> "$service_file"
    fi

    if [[ -n "$port" ]]; then
        echo "export TSM_PORT=\"$port\"" >> "$service_file"
    fi

    if [[ ${#args[@]} -gt 0 ]]; then
        echo "export TSM_ARGS=($(printf "'%s' " "${args[@]}"))" >> "$service_file"
    fi

    cat >> "$service_file" <<EOF

# Description (optional)
export TSM_DESCRIPTION="Service: $service_name"

# Start command: tsm start --env \${TSM_ENV} \${TSM_COMMAND} \${TSM_NAME}
EOF

    chmod +x "$service_file"

    echo "✅ Saved service definition: $service_file"
    echo "Enable with: tsm enable $service_name"
    echo "Start with: tsm start $service_name"
}

# Enable service (create symlink to enabled directory)
tetra_tsm_enable() {
    local service_name="$1"

    if [[ -z "$service_name" ]]; then
        echo "Usage: tsm enable <service-name>"
        return 1
    fi

    local service_file="$TETRA_DIR/services/${service_name}.tsm.sh"
    local enabled_dir="$TETRA_DIR/services/enabled"
    local enabled_link="$enabled_dir/${service_name}.tsm.sh"

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

    ln -s "../${service_name}.tsm.sh" "$enabled_link"
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

    local enabled_link="$TETRA_DIR/services/enabled/${service_name}.tsm.sh"

    if [[ ! -L "$enabled_link" ]]; then
        echo "⚠️  Service not enabled: $service_name"
        return 0
    fi

    rm "$enabled_link"
    echo "✅ Disabled service: $service_name"
    echo "Service will not start automatically"
}

# List available services
tetra_tsm_list_services() {
    local services_dir="$TETRA_DIR/services"
    local enabled_dir="$services_dir/enabled"
    local detail="${1:-}"

    echo "📋 Saved Service Definitions:"
    if [[ -d "$services_dir" ]]; then
        local found_services=false
        for service_file in "$services_dir"/*.tsm.sh; do
            [[ -f "$service_file" ]] || continue
            found_services=true

            local service_name=$(basename "$service_file" .tsm.sh)
            local enabled_status=""
            if [[ -L "$enabled_dir/${service_name}.tsm.sh" ]]; then
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

    local service_file="$TETRA_DIR/services/${service_name}.tsm.sh"

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
    if [[ -L "$TETRA_DIR/services/enabled/${service_name}.tsm.sh" ]]; then
        echo "  Status: enabled ✅"
    else
        echo "  Status: disabled"
    fi
}