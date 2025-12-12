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

    # Get current org (or "none" if not set)
    local org=$(tsm_get_effective_org)
    local services_dir=$(tsm_get_services_dir "$org")

    # Create services directory for this org
    mkdir -p "$services_dir"

    local service_file="$services_dir/${service_name}.tsm"

    # Get current working directory and environment
    local cwd="$(pwd)"
    local env_file="${TSM_ENV_FILE:-}"
    local port="${TSM_PORT:-}"

    # Write service definition with org
    cat > "$service_file" <<EOF
#!/usr/bin/env bash
# TSM Service: $service_name
# Org: $org
# Generated on $(date)

TSM_ORG="$org"
TSM_NAME="$service_name"
TSM_COMMAND="$command"
TSM_CWD="$cwd"
TSM_ENV_FILE="$env_file"
EOF

    chmod +x "$service_file"

    local org_display=$(tsm_get_org_short_name "$org")
    echo "✅ Saved service definition: $service_file"
    echo "   Org: $org_display"
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
    local command cwd env_file port process_org
    command=$(jq -r '.command // empty' "$meta_file" 2>/dev/null)
    cwd=$(jq -r '.cwd // empty' "$meta_file" 2>/dev/null)
    env_file=$(jq -r '.env_file // empty' "$meta_file" 2>/dev/null)
    port=$(jq -r '.port // empty' "$meta_file" 2>/dev/null)
    process_org=$(jq -r '.org // "none"' "$meta_file" 2>/dev/null)

    if [[ -z "$command" ]]; then
        echo "❌ Failed to read metadata for $process_name"
        return 1
    fi

    # Handle null/empty values
    [[ "$env_file" == "null" || "$env_file" == "" ]] && env_file=""
    [[ "$port" == "null" || "$port" == "" ]] && port=""
    [[ "$cwd" == "null" || "$cwd" == "" ]] && cwd="$(pwd)"
    [[ "$process_org" == "null" || "$process_org" == "" ]] && process_org="none"

    # Determine service name
    local service_name="${new_service_name:-${process_name%%-*}}"

    # Use the process's original org (from meta.json), not current TETRA_ORG
    local org="$process_org"
    local services_dir=$(tsm_get_services_dir "$org")

    # Create services directory for this org
    mkdir -p "$services_dir"
    local service_file="$services_dir/${service_name}.tsm"

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

    # Create service definition with org
    cat > "$service_file" <<EOF
#!/usr/bin/env bash
# TSM Service: $service_name
# Org: $org
# Saved from running process: $process_name (TSM ID: $tsm_id)
# Generated on $(date)

TSM_ORG="$org"
TSM_NAME="$service_name"
TSM_COMMAND="$command"
TSM_CWD="$cwd"
TSM_ENV_FILE="$env_file"
TSM_PORT="$port"
EOF

    chmod +x "$service_file"

    local org_display=$(tsm_get_org_short_name "$org")
    echo "✅ Saved running process '$process_name' as service: $service_file"
    echo "   Org: $org_display"
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

    # Search for service in: current org → none → system
    local service_file
    service_file=$(tsm_find_service_file "$service_name")

    if [[ -z "$service_file" || ! -f "$service_file" ]]; then
        echo "❌ Service not found: $service_name"
        # List available services from all sources
        local available=""
        for org in "$(tsm_get_effective_org)" "none" "system"; do
            local dir=$(tsm_get_services_dir "$org")
            [[ -d "$dir" ]] || continue
            for f in "$dir"/*.tsm; do
                [[ -f "$f" ]] && available+="$(basename "$f" .tsm) "
            done
        done
        echo "   Available: $available"
        return 1
    fi

    # Source service definition (.tsm file)
    source "$service_file"

    # Resolve env file: TSM_CWD/env/{TSM_ENV}.env (optional)
    local env_name="${TSM_ENV:-local}"
    local env_file="$TSM_CWD/env/${env_name}.env"

    # Port priority: env file PORT > .tsm TSM_PORT > auto
    local port="${TSM_PORT:-auto}"
    if [[ -f "$env_file" ]]; then
        local env_port=$(source "$env_file" 2>/dev/null && echo "${PORT:-}")
        [[ -n "$env_port" ]] && port="$env_port"
    fi

    local port_type="${TSM_PORT_TYPE:-tcp}"

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

    # Export TSM_PRE_COMMAND for propagation to subshell
    export TSM_SERVICE_PREHOOK="${TSM_PRE_COMMAND:-}"

    # Change to service directory and start
    (
        cd "$TSM_CWD"

        # Source the environment file if it exists
        if [[ -f "$env_file" ]]; then
            source "$env_file"
        fi

        # Set port environment variable if specified
        if [[ "$port" != "auto" ]]; then
            export PORT="$port"
            export TSM_PORT="$port"
        fi

        # Export port type for metadata
        export TSM_PORT_TYPE="${TSM_PORT_TYPE:-tcp}"

        # Build start command with optional pre-hook
        local start_args=(--name "$TSM_NAME")
        [[ "$port" != "auto" ]] && start_args+=(--port "$port")
        [[ -n "${TSM_SERVICE_PREHOOK:-}" ]] && start_args+=(--pre-hook "$TSM_SERVICE_PREHOOK")

        # Use TSM command mode to start
        tsm start "${start_args[@]}" $TSM_COMMAND
    )
    [[ $? -ne 0 ]] && return 1

    # Validate port is open (only if port is specified)
    local port_type="${TSM_PORT_TYPE:-tcp}"

    if [[ "$port" != "auto" ]]; then
        sleep 2
        case "$port_type" in
            udp)
                # Check UDP port
                if lsof -iUDP:$port -t >/dev/null 2>&1; then
                    echo "✅ $process_name listening on UDP $port"
                    return 0
                else
                    echo "❌ $process_name failed to open UDP $port"
                    return 1
                fi
                ;;
            none)
                # No port validation
                echo "✅ $process_name started (no port binding)"
                return 0
                ;;
            tcp|ws|*)
                # TCP or WebSocket (both use TCP)
                if lsof -iTCP:$port -sTCP:LISTEN -t >/dev/null 2>&1; then
                    echo "✅ $process_name listening on TCP $port"
                    return 0
                else
                    echo "❌ $process_name failed to open TCP $port"
                    return 1
                fi
                ;;
        esac
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

    # Find the service file (searches org → none → system)
    local service_file
    service_file=$(tsm_find_service_file "$service_name")

    if [[ -z "$service_file" || ! -f "$service_file" ]]; then
        echo "❌ Service not found: $service_name"
        echo "Available services:"
        tetra_tsm_list_services
        return 1
    fi

    # Determine which org owns this service
    local org=$(tsm_get_service_org "$service_file")
    local services_dir=$(tsm_get_services_dir "$org")
    local enabled_dir=$(tsm_get_enabled_dir "$org")

    # Create enabled directory for this org
    mkdir -p "$enabled_dir"

    local enabled_link="$enabled_dir/${service_name}.tsm"

    # Create symlink
    if [[ -L "$enabled_link" ]]; then
        echo "⚠️  Service already enabled: $service_name"
        return 0
    fi

    # Relative symlink from enabled to available
    ln -s "../services-available/${service_name}.tsm" "$enabled_link"
    local org_display=$(tsm_get_org_short_name "$org")
    echo "✅ Enabled service: $service_name (org: $org_display)"
    echo "Service will start automatically with tetra daemon"
}

# Disable service (remove symlink from enabled directory)
tetra_tsm_disable() {
    local service_name="$1"

    if [[ -z "$service_name" ]]; then
        echo "Usage: tsm disable <service-name>"
        return 1
    fi

    # Find the service file to determine its org
    local service_file
    service_file=$(tsm_find_service_file "$service_name")

    if [[ -z "$service_file" ]]; then
        echo "⚠️  Service not found: $service_name"
        return 1
    fi

    local org=$(tsm_get_service_org "$service_file")
    local enabled_dir=$(tsm_get_enabled_dir "$org")
    local enabled_link="$enabled_dir/${service_name}.tsm"

    if [[ ! -L "$enabled_link" ]]; then
        echo "⚠️  Service not enabled: $service_name"
        return 0
    fi

    rm "$enabled_link"
    local org_display=$(tsm_get_org_short_name "$org")
    echo "✅ Disabled service: $service_name (org: $org_display)"
    echo "Service will not start automatically"
}

# List available services (from current org + none + system)
tetra_tsm_list_services() {
    # Load color system if available
    local has_colors=false
    if [[ -f "$TETRA_SRC/bash/color/color_core.sh" ]]; then
        source "$TETRA_SRC/bash/color/color_core.sh" 2>/dev/null
        source "$TETRA_SRC/bash/color/color_palettes.sh" 2>/dev/null
        has_colors=true
    fi

    # Parse arguments
    local detail=false
    local verbose=false
    local filter="all"  # all, enabled, disabled

    while [[ $# -gt 0 ]]; do
        case "$1" in
            -d|--detail)
                detail=true
                shift
                ;;
            -v|--verbose)
                verbose=true
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
                echo "Usage: tsm services [--enabled|--disabled|--available] [-d|--detail] [-v|--verbose]" >&2
                return 64
                ;;
        esac
    done

    local current_org=$(tsm_get_effective_org)
    local current_org_display=$(tsm_get_org_short_name "$current_org")

    # Set title based on filter with colors
    if [[ "$has_colors" == "true" ]]; then
        text_color "00AAAA"  # Cyan - info/title color
    fi

    case "$filter" in
        enabled)
            echo "Enabled Services (Auto-start on Boot):"
            ;;
        disabled)
            echo "Disabled Services:"
            ;;
        *)
            echo "Saved Service Definitions (org: $current_org_display + none + system):"
            ;;
    esac

    [[ "$has_colors" == "true" ]] && reset_color

    local total_shown=0

    # Iterate over sources: current org, none (if different), system
    local sources=("$current_org")
    [[ "$current_org" != "none" ]] && sources+=("none")
    sources+=("system")

    for source_org in "${sources[@]}"; do
        local services_dir=$(tsm_get_services_dir "$source_org")
        local enabled_dir=$(tsm_get_enabled_dir "$source_org")
        local org_display=$(tsm_get_org_short_name "$source_org")

        [[ -d "$services_dir" ]] || continue

        local org_shown=0
        for service_file in "$services_dir"/*.tsm; do
            [[ -f "$service_file" ]] || continue

            local service_name=$(basename "$service_file" .tsm)
            local is_enabled=false

            if [[ -L "$enabled_dir/${service_name}.tsm" ]]; then
                is_enabled=true
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

            # Print org header on first service from this org
            if [[ $org_shown -eq 0 ]]; then
                echo ""
                if [[ "$has_colors" == "true" ]]; then
                    text_color "888888"
                fi
                echo "[$org_display]"
                [[ "$has_colors" == "true" ]] && reset_color
            fi

            ((org_shown++))
            ((total_shown++))

            # Source service definition to get details
            local TSM_NAME="" TSM_COMMAND="" TSM_CWD="" TSM_ENV_FILE="" TSM_ENV="" TSM_PORT="" TSM_DESCRIPTION="" TSM_ORG=""
            source "$service_file" 2>/dev/null
            local cmd="$TSM_COMMAND"
            local port="$TSM_PORT"

            if [[ "$detail" == "true" ]]; then
                # Detailed view
                if [[ "$has_colors" == "true" ]]; then
                    text_color "5599FF"
                fi
                echo -n "  $service_name"
                [[ "$has_colors" == "true" ]] && reset_color

                if [[ "$is_enabled" == "true" ]]; then
                    if [[ "$has_colors" == "true" ]]; then
                        text_color "00DD66"
                    fi
                    echo -n " [enabled]"
                    [[ "$has_colors" == "true" ]] && reset_color
                fi
                echo ""

                if [[ "$has_colors" == "true" ]]; then
                    text_color "777788"
                fi
                echo "      Config: $service_file"
                [[ -n "$TSM_CWD" ]] && echo "      Working Dir: $TSM_CWD"
                [[ "$has_colors" == "true" ]] && reset_color

                if [[ "$has_colors" == "true" ]]; then
                    text_color "FFAA44"
                fi
                echo "      Command: $cmd"
                [[ "$has_colors" == "true" ]] && reset_color

                [[ -n "$port" ]] && echo "      Port: $port"
                echo
            else
                # Compact view: org prefix, name, enabled, command, port
                if [[ "$has_colors" == "true" ]]; then
                    text_color "5599FF"
                fi
                printf "  %-15s" "$service_name"
                [[ "$has_colors" == "true" ]] && reset_color

                if [[ "$is_enabled" == "true" ]]; then
                    if [[ "$has_colors" == "true" ]]; then
                        text_color "00DD66"
                    fi
                    printf " %-7s" "enabled"
                    [[ "$has_colors" == "true" ]] && reset_color
                else
                    printf " %-7s" ""
                fi

                echo -n $'\t'

                # Truncate command to ~40 chars in compact view
                local cmd_display="$cmd"
                local cmd_truncated=false
                if [[ ${#cmd_display} -gt 40 ]]; then
                    cmd_display="${cmd_display:0:37}..."
                    cmd_truncated=true
                fi

                if [[ "$has_colors" == "true" ]]; then
                    text_color "FFAA44"
                fi
                echo -n "$cmd_display"
                [[ "$has_colors" == "true" ]] && reset_color

                if [[ -n "$port" ]]; then
                    if [[ "$has_colors" == "true" ]]; then
                        text_color "00AAAA"
                    fi
                    echo -n " :$port"
                    [[ "$has_colors" == "true" ]] && reset_color
                fi
                echo ""

                # Verbose: show full command (if truncated) and file path
                if [[ "$verbose" == "true" ]]; then
                    if [[ "$has_colors" == "true" ]]; then
                        text_color "666666"
                    fi
                    if [[ "$cmd_truncated" == "true" ]]; then
                        echo "                  $cmd"
                    fi
                    echo "                  $service_file"
                    [[ "$has_colors" == "true" ]] && reset_color
                fi
            fi
        done
    done

    if [[ $total_shown -eq 0 ]]; then
        echo "  No services found"
        case "$filter" in
            enabled)
                echo "  Use 'tsm enable <service>' to enable services for autostart"
                ;;
        esac
    fi

    echo
    if [[ "$has_colors" == "true" ]]; then
        text_color "777788"
    fi
    echo "Usage: tsm services [--enabled|--disabled|--available] [-d|--detail] [-v|--verbose]"
    [[ "$has_colors" == "true" ]] && reset_color
}

# Edit service definition file
tetra_tsm_edit() {
    local identifier="$1"

    if [[ -z "$identifier" ]]; then
        echo "Usage: tsm edit <service-name|tsm-id>"
        return 1
    fi

    local service_name=""
    local service_file=""

    # If numeric, look up by TSM ID
    if [[ "$identifier" =~ ^[0-9]+$ ]]; then
        local tsm_id="$identifier"
        # Find process with this TSM ID
        for process_dir in "$TSM_PROCESSES_DIR"/*/; do
            [[ -d "$process_dir" ]] || continue
            local meta_file="${process_dir}meta.json"
            [[ -f "$meta_file" ]] || continue

            local found_id=$(jq -r '.tsm_id // empty' "$meta_file" 2>/dev/null)
            if [[ "$found_id" == "$tsm_id" ]]; then
                local process_name=$(basename "$process_dir")
                # Service name is process name without port suffix
                service_name="${process_name%%-*}"
                break
            fi
        done

        if [[ -z "$service_name" ]]; then
            echo "No process found with TSM ID: $tsm_id"
            return 1
        fi
    else
        service_name="$identifier"
    fi

    # Find service file using org-scoped lookup
    service_file=$(tsm_find_service_file "$service_name")

    if [[ -z "$service_file" || ! -f "$service_file" ]]; then
        echo "Service file not found: $service_name"
        echo "Create with: tsm save $service_name <command>"
        return 1
    fi

    ${EDITOR:-vim} "$service_file"
}

# Show service details
tetra_tsm_show_service() {
    local service_name="$1"

    if [[ -z "$service_name" ]]; then
        echo "Usage: tsm show <service-name>"
        return 1
    fi

    # Find service file using org-scoped lookup
    local service_file
    service_file=$(tsm_find_service_file "$service_name")

    if [[ -z "$service_file" || ! -f "$service_file" ]]; then
        echo "❌ Service not found: $service_name"
        return 1
    fi

    local org=$(tsm_get_service_org "$service_file")
    local org_display=$(tsm_get_org_short_name "$org")
    local enabled_dir=$(tsm_get_enabled_dir "$org")

    echo "🔍 Service: $service_name"
    echo "📁 Org: $org_display"
    echo "📄 File: $service_file"
    echo

    # Source and display variables
    (
        source "$service_file"
        echo "Configuration:"
        echo "  Name: ${TSM_NAME:-}"
        echo "  Org: ${TSM_ORG:-none}"
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
    if [[ -L "$enabled_dir/${service_name}.tsm" ]]; then
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
export -f tetra_tsm_edit