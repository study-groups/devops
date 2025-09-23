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
    mkdir -p "$TETRA_DIR/tsm/services-available"

    local service_file="$TETRA_DIR/tsm/services-available/${service_name}.tsm"

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

    echo "✅ Saved service definition: $service_file"
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
        meta_file="$TETRA_DIR/tsm/runtime/processes/"
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
        meta_file="$TETRA_DIR/tsm/runtime/processes/${process_name}.meta"
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

# Start all enabled services
tetra_tsm_startup() {
    local enabled_dir="$TETRA_DIR/tsm/services-enabled"

    if [[ ! -d "$enabled_dir" ]]; then
        echo "No enabled services directory found"
        return 0
    fi

    echo "🚀 Starting enabled services..."

    local started_count=0
    local failed_count=0

    for service_link in "$enabled_dir"/*.tsm; do
        [[ -L "$service_link" ]] || continue

        local service_name=$(basename "$service_link" .tsm)
        echo "Starting $service_name..."

        if tetra_tsm_start_service "$service_name"; then
            ((started_count++))
        else
            ((failed_count++))
            echo "❌ Failed to start $service_name"
        fi
    done

    echo "✅ Startup complete: $started_count started, $failed_count failed"

    # Log to startup.log
    echo "$(date): Started $started_count services, $failed_count failed" >> "$TETRA_DIR/tsm/startup.log"
}

# Start a service by name
tetra_tsm_start_service() {
    local service_name="$1"
    local service_file="$TETRA_DIR/tsm/services-available/${service_name}.tsm"

    if [[ ! -f "$service_file" ]]; then
        echo "❌ Service not found: $service_name"
        return 1
    fi

    # Source service definition
    source "$service_file"

    # Extract port from environment file if specified
    local port=""
    if [[ -n "$TSM_ENV_FILE" && -f "$TSM_CWD/$TSM_ENV_FILE" ]]; then
        port=$(cd "$TSM_CWD" && source "$TSM_ENV_FILE" && echo "$PORT")
    fi

    if [[ -z "$port" ]]; then
        echo "❌ Could not determine port for service $service_name"
        return 1
    fi

    # Generate process name
    local process_name="${TSM_NAME}-${port}"

    # Check if already running
    if tetra_tsm_is_running "$process_name"; then
        echo "⚠️  Service already running: $process_name"
        return 0
    fi

    # Start the service using TSM command mode
    echo "Starting $service_name on port $port..."

    # Change to service directory and start
    (
        cd "$TSM_CWD"
        if [[ -n "$TSM_ENV_FILE" ]]; then
            source "$TSM_ENV_FILE"
        fi

        # Use TSM command mode to start
        tsm start --port "$port" --name "$TSM_NAME" $TSM_COMMAND
    )

    # Validate port is open
    sleep 2
    if lsof -i ":$port" -t >/dev/null 2>&1; then
        echo "✅ $process_name listening on port $port"
        return 0
    else
        echo "❌ $process_name failed to open port $port"
        return 1
    fi
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
export -f tetra_tsm_startup
export -f tetra_tsm_start_service
export -f tetra_tsm_enable
export -f tetra_tsm_disable
export -f tetra_tsm_list_services
export -f tetra_tsm_show_service