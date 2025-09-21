#!/usr/bin/env bash

# TSM Service Management - Save and Enable Services
# nginx-style service enable/disable with symlinks

# Save current TSM command as a service definition
tetra_tsm_save() {
    local service_name="$1"
    local command="$2"
    shift 2
    local args=("$@")

    if [[ -z "$service_name" || -z "$command" ]]; then
        echo "Usage: tsm save <service-name> <command> [args...]"
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

    echo "📋 Available Services:"
    if [[ -d "$services_dir" ]]; then
        for service_file in "$services_dir"/*.tsm.sh; do
            [[ -f "$service_file" ]] || continue
            local service_name=$(basename "$service_file" .tsm.sh)
            local enabled=""
            if [[ -L "$enabled_dir/${service_name}.tsm.sh" ]]; then
                enabled=" (enabled)"
            fi
            echo "  📄 $service_name$enabled"
        done
    else
        echo "  No services found"
    fi
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