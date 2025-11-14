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

    # Find process by TSM ID or name
    local process_name meta_file tsm_id
    if [[ "$process_identifier" =~ ^[0-9]+$ ]]; then
        # TSM ID provided - search for process with this ID
        tsm_id="$process_identifier"
        for process_dir in "$TSM_PROCESSES_DIR"/*/; do
            [[ -d "$process_dir" ]] || continue
            local check_file="${process_dir}meta.json"
            [[ -f "$check_file" ]] || continue

            local found_id=$(jq -r '.tsm_id // empty' "$check_file" 2>/dev/null)
            if [[ "$found_id" == "$tsm_id" ]]; then
                process_name=$(basename "$process_dir")
                meta_file="$check_file"
                break
            fi
        done

        if [[ -z "$meta_file" ]]; then
            echo "❌ Process with TSM ID $tsm_id not found"
            return 1
        fi
    else
        # Process name provided
        process_name="$process_identifier"
        meta_file="$TSM_PROCESSES_DIR/$process_name/meta.json"

        if [[ ! -f "$meta_file" ]]; then
            echo "❌ Process not found: $process_name"
            return 1
        fi

        tsm_id=$(jq -r '.tsm_id // empty' "$meta_file" 2>/dev/null)
    fi

    # Extract metadata from JSON (individual calls to handle spaces/tabs in values)
    local command cwd env_file port
    command=$(jq -r '.command // empty' "$meta_file" 2>/dev/null)
    cwd=$(jq -r '.cwd // empty' "$meta_file" 2>/dev/null)
    env_file=$(jq -r '.env_file // empty' "$meta_file" 2>/dev/null)
    port=$(jq -r '.port // empty' "$meta_file" 2>/dev/null)

    if [[ -z "$command" ]]; then
        echo "❌ Failed to read metadata for $process_name"
        return 1
    fi

    # Handle null/empty values
    [[ "$env_file" == "null" || "$env_file" == "" ]] && env_file=""
    [[ "$port" == "null" || "$port" == "" ]] && port=""
    [[ "$cwd" == "null" || "$cwd" == "" ]] && cwd="$(pwd)"

    # Determine service name
    local service_name="${new_service_name:-${process_name%%-*}}"

    # Create services directory
    mkdir -p "$TETRA_DIR/tsm/services-available"
    local service_file="$TETRA_DIR/tsm/services-available/${service_name}.tsm"

    # Check if service file already exists - prompt for confirmation
    if [[ -f "$service_file" ]]; then
        echo "⚠️  Service '$service_name' already exists at:"
        echo "   $service_file"
        echo -n "Overwrite? [y/N] "
        read -r response
        if [[ ! "$response" =~ ^[Yy]$ ]]; then
            echo "❌ Save cancelled"
            return 1
        fi
    fi

    # Create service definition
    cat > "$service_file" <<EOF
#!/usr/bin/env bash
# TSM Service: $service_name
# Saved from running process: $process_name (TSM ID: $tsm_id)
# Generated on $(date)

TSM_NAME="$service_name"
TSM_COMMAND="$command"
TSM_CWD="$cwd"
TSM_ENV_FILE="$env_file"
TSM_PORT="$port"
EOF

    chmod +x "$service_file"

    echo "✅ Saved running process '$process_name' as service: $service_file"
    echo "   Command: $command"
    echo "   Working directory: $cwd"
    [[ -n "$env_file" ]] && echo "   Environment file: $env_file"
    [[ -n "$port" ]] && echo "   Port: $port"
    echo ""
    echo "Enable with: tsm enable $service_name"
    echo "Start with: tsm start $service_name"
}

# Start all enabled services
# Show startup status (what services would start)
tetra_tsm_startup_status() {
    local enabled_dir="$TETRA_DIR/tsm/services-enabled"
    local services_dir="$TETRA_DIR/tsm/services-available"

    echo "🚀 TSM Startup Configuration"
    echo

    # Check if daemon is enabled
    if command -v systemctl >/dev/null 2>&1; then
        local daemon_status=$(systemctl is-enabled tsm.service 2>/dev/null || echo "not-installed")
        case "$daemon_status" in
            enabled)
                echo "✅ Systemd daemon: enabled (will start on boot)"
                ;;
            disabled)
                echo "⚪ Systemd daemon: disabled (will NOT start on boot)"
                echo "   Run 'tsm daemon enable' to enable boot startup"
                ;;
            *)
                echo "⚠️  Systemd daemon: not installed"
                echo "   Run 'tsm daemon install @dev' to set up boot startup"
                ;;
        esac
        echo
    fi

    # List enabled services
    echo "📋 Services Configured for Autostart:"
    if [[ ! -d "$enabled_dir" ]]; then
        echo "  No services enabled"
        echo "  Use 'tsm enable <service>' to enable services for autostart"
        return 0
    fi

    local enabled_count=0
    for service_link in "$enabled_dir"/*.tsm; do
        [[ -L "$service_link" ]] || continue

        local service_name=$(basename "$service_link" .tsm)
        local service_file="$services_dir/${service_name}.tsm"

        if [[ ! -f "$service_file" ]]; then
            echo "  ⚠️  $service_name (service file missing)"
            continue
        fi

        # Source to get details
        local TSM_COMMAND="" TSM_PORT=""
        (source "$service_file" 2>/dev/null)
        local cmd="$TSM_COMMAND"
        local port="$TSM_PORT"

        local port_info=""
        [[ -n "$port" ]] && port_info=" :$port"

        # Check if currently running
        local running_status=""
        if tetra_tsm_is_running "$service_name" 2>/dev/null; then
            running_status=" (currently running)"
        fi

        echo "  ✅ $service_name$port_info$running_status"
        ((enabled_count++))
    done

    if [[ $enabled_count -eq 0 ]]; then
        echo "  No services enabled"
        echo "  Use 'tsm enable <service>' to enable services for autostart"
    fi

    echo
    echo "Commands:"
    echo "  tsm services --enabled     - Show enabled services with details"
    echo "  tsm startup                - Start all enabled services now"
    echo "  tsm daemon enable          - Enable boot startup (systemd)"
}

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

    # Extract port from service file or environment file
    local port="$TSM_PORT"

    # If no port in service file, try environment file
    if [[ -z "$port" && -n "$TSM_ENV_FILE" && -f "$TSM_CWD/$TSM_ENV_FILE" ]]; then
        port=$(cd "$TSM_CWD" && source "$TSM_ENV_FILE" && echo "$PORT")
    fi

    # If still no port, use a default or skip port validation
    if [[ -z "$port" ]]; then
        echo "⚠️  No port specified for service $service_name, starting without port binding"
        port="auto"
    fi

    # Generate process name
    local process_name="${TSM_NAME}-${port}"

    # Check if already running
    if tetra_tsm_is_running "$process_name"; then
        echo "⚠️  Service already running: $process_name"
        return 0
    fi

    # Start the service using TSM command mode
    if [[ "$port" == "auto" ]]; then
        echo "Starting $service_name..."
    else
        echo "Starting $service_name on port $port..."
    fi

    # Change to service directory and start
    (
        cd "$TSM_CWD"
        if [[ -n "$TSM_ENV_FILE" ]]; then
            source "$TSM_ENV_FILE"
        fi

        # Set port environment variable if specified
        if [[ "$port" != "auto" ]]; then
            export PORT="$port"
            export TSM_PORT="$port"
        fi

        # Build start command with optional pre-hook
        local start_args=(--name "$TSM_NAME")
        [[ "$port" != "auto" ]] && start_args+=(--port "$port")
        [[ -n "${TSM_PRE_COMMAND:-}" ]] && start_args+=(--pre-hook "$TSM_PRE_COMMAND")

        # Use TSM command mode to start
        tsm start "${start_args[@]}" $TSM_COMMAND
    )

    # Validate port is open (only if port is specified)
    if [[ "$port" != "auto" ]]; then
        sleep 2
        if lsof -i ":$port" -t >/dev/null 2>&1; then
            echo "✅ $process_name listening on port $port"
            return 0
        else
            echo "❌ $process_name failed to open port $port"
            return 1
        fi
    else
        echo "✅ $process_name started"
        return 0
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

    # Parse arguments
    local detail=false
    local filter="all"  # all, enabled, disabled, available

    while [[ $# -gt 0 ]]; do
        case "$1" in
            -d|--detail)
                detail=true
                shift
                ;;
            --enabled)
                filter="enabled"
                shift
                ;;
            --disabled)
                filter="disabled"
                shift
                ;;
            --available)
                filter="all"
                shift
                ;;
            *)
                echo "tsm: unknown flag '$1' for services command" >&2
                echo "Usage: tsm services [--enabled|--disabled|--available] [-d|--detail]" >&2
                return 64
                ;;
        esac
    done

    # Set title based on filter
    case "$filter" in
        enabled)
            echo "📋 Enabled Services (Auto-start on Boot):"
            ;;
        disabled)
            echo "📋 Disabled Services:"
            ;;
        *)
            echo "📋 Saved Service Definitions:"
            ;;
    esac

    if [[ -d "$services_dir" ]]; then
        local found_services=false
        local shown_count=0

        for service_file in "$services_dir"/*.tsm; do
            [[ -f "$service_file" ]] || continue
            found_services=true

            local service_name=$(basename "$service_file" .tsm)
            local is_enabled=false
            local enabled_status=""

            if [[ -L "$enabled_dir/${service_name}.tsm" ]]; then
                is_enabled=true
                enabled_status=" ✅"
            else
                enabled_status=" ⚪"
            fi

            # Apply filter
            case "$filter" in
                enabled)
                    [[ "$is_enabled" != "true" ]] && continue
                    ;;
                disabled)
                    [[ "$is_enabled" == "true" ]] && continue
                    ;;
            esac

            ((shown_count++))

            # Source service definition to get details
            local TSM_NAME="" TSM_COMMAND="" TSM_CWD="" TSM_ENV_FILE="" TSM_PORT="" TSM_DESCRIPTION=""
            (source "$service_file" 2>/dev/null)
            local cmd="$TSM_COMMAND"
            local port="$TSM_PORT"
            local env="$TSM_ENV_FILE"
            local desc="$TSM_DESCRIPTION"

            if [[ "$detail" == "true" ]]; then
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
        elif [[ $shown_count -eq 0 ]]; then
            case "$filter" in
                enabled)
                    echo "  No enabled services found"
                    echo "  Use 'tsm enable <service>' to enable services for autostart"
                    ;;
                disabled)
                    echo "  No disabled services found"
                    ;;
            esac
        fi
    else
        echo "  Services directory not found: $services_dir"
    fi

    echo
    if [[ "$filter" == "all" ]]; then
        echo "Legend: ✅ enabled for autostart, ⚪ disabled"
    fi
    echo "Usage: tsm services [--enabled|--disabled|--available] [-d|--detail]"
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
export -f tetra_tsm_startup_status
export -f tetra_tsm_start_service
export -f tetra_tsm_enable
export -f tetra_tsm_disable
export -f tetra_tsm_list_services
export -f tetra_tsm_show_service