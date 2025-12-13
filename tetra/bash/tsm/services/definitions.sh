#!/usr/bin/env bash

# TSM Service Management - Save and Enable Services
# nginx-style service enable/disable with symlinks
# Multi-org aware: scans $TETRA_DIR/orgs/*/tsm for services
# Requires: bash 5.2+

# Guard: TETRA_DIR must be set
if [[ -z "$TETRA_DIR" ]]; then
    echo "❌ TETRA_DIR not set. Source tetra.sh first." >&2
    return 1 2>/dev/null || exit 1
fi

# Default org for saving new services (can be overridden)
TSM_DEFAULT_ORG="${TSM_DEFAULT_ORG:-tetra}"

# Get list of all orgs with TSM directories
_tsm_get_orgs() {
    local org_dir
    for org_dir in "$TETRA_DIR/orgs"/*/tsm; do
        [[ -d "$org_dir" ]] || continue
        basename "$(dirname "$org_dir")"
    done
}

# Parse service reference: "org/service" or just "service"
# Usage: _tsm_parse_service_ref "tetra/quasar" out_org out_service
_tsm_parse_service_ref() {
    local ref="$1"
    local -n _out_org="$2"
    local -n _out_service="$3"

    if [[ "$ref" == */* ]]; then
        _out_org="${ref%%/*}"
        _out_service="${ref#*/}"
    else
        _out_org=""
        _out_service="$ref"
    fi
}

# Find a service across all orgs (or in specific org if prefixed)
# Usage: _tsm_find_service "quasar" out_org out_file
# Returns 0 if found, 1 if not found
_tsm_find_service() {
    local ref="$1"
    local -n _out_found_org="$2"
    local -n _out_found_file="$3"

    local parsed_org parsed_service
    _tsm_parse_service_ref "$ref" parsed_org parsed_service

    if [[ -n "$parsed_org" ]]; then
        # Explicit org specified
        local service_file="$TETRA_DIR/orgs/$parsed_org/tsm/services-available/${parsed_service}.tsm"
        if [[ -f "$service_file" ]]; then
            _out_found_org="$parsed_org"
            _out_found_file="$service_file"
            return 0
        fi
        return 1
    fi

    # Search all orgs - check for ambiguity first
    local org match_count=0 first_org="" first_file=""
    for org in $(_tsm_get_orgs); do
        local service_file="$TETRA_DIR/orgs/$org/tsm/services-available/${parsed_service}.tsm"
        if [[ -f "$service_file" ]]; then
            ((match_count++))
            if [[ $match_count -eq 1 ]]; then
                first_org="$org"
                first_file="$service_file"
            fi
        fi
    done

    if [[ $match_count -eq 0 ]]; then
        return 1
    fi

    if [[ $match_count -gt 1 ]]; then
        echo "⚠️  '$parsed_service' exists in $match_count orgs, using '$first_org'. Use org/service to be explicit." >&2
    fi

    _out_found_org="$first_org"
    _out_found_file="$first_file"
    return 0
}

# Get the TSM directory for a specific org
_tsm_org_dir() {
    local org="${1:-$TSM_DEFAULT_ORG}"
    echo "$TETRA_DIR/orgs/$org/tsm"
}

# List all available orgs
tetra_tsm_orgs() {
    echo "Available orgs:"
    local org
    for org in $(_tsm_get_orgs); do
        local count=$(ls -1 "$TETRA_DIR/orgs/$org/tsm/services-available"/*.tsm 2>/dev/null | wc -l | tr -d ' ')
        echo "  $org ($count services)"
    done
}

# Save current TSM command as a service definition
# Usage: tsm save <org/service-name> <command> [args...]
#    or: tsm save <process-id|process-name> [org/new-service-name]
tetra_tsm_save() {
    local first_arg="$1"

    # Check if first argument is a process ID or name (numeric or existing process)
    if [[ "$first_arg" =~ ^[0-9]+$ ]] || tetra_tsm_is_running "$first_arg" 2>/dev/null; then
        _tsm_save_from_process "$@"
        return $?
    fi

    # Save from command line - require explicit org/service format
    local service_ref="$1"
    local command="$2"
    shift 2 2>/dev/null || true

    if [[ -z "$service_ref" || -z "$command" ]]; then
        echo "Usage: tsm save <org/service-name> <command> [args...]"
        echo "   or: tsm save <process-id|process-name> [org/new-service-name]"
        echo ""
        echo "Example: tsm save tetra/myservice python app.py"
        return 1
    fi

    # Require explicit org/service format
    if [[ "$service_ref" != */* ]]; then
        echo "❌ Explicit org required: tsm save <org/service-name> <command>"
        echo ""
        echo "Example: tsm save tetra/$service_ref $command"
        echo ""
        echo "Available orgs:"
        for org in $(_tsm_get_orgs); do
            echo "  $org"
        done
        return 1
    fi

    # Parse org/service reference
    local parsed_org parsed_service
    _tsm_parse_service_ref "$service_ref" parsed_org parsed_service
    local org="$parsed_org"
    local service_name="$parsed_service"
    local tsm_dir="$(_tsm_org_dir "$org")"

    # Create services directory
    mkdir -p "$tsm_dir/services-available"

    local service_file="$tsm_dir/services-available/${service_name}.tsm"

    # Get current working directory
    local cwd="$(pwd)"
    local port="${TSM_PORT:-}"
    local env="${TSM_ENV:-none}"

    # Write new simplified service definition
    cat > "$service_file" <<EOF
#!/usr/bin/env bash
# TSM Service: $service_name
# Generated on $(date)

TSM_NAME="$service_name"
TSM_COMMAND="$command"
TSM_CWD="$cwd"
TSM_ENV="$env"
TSM_PORT="$port"
EOF

    chmod +x "$service_file"

    echo "✅ Saved service definition: $service_file"
    echo "Enable with: tsm enable $org/$service_name"
    echo "Start with: tsm start $org/$service_name"
}

# Save service from running process
_tsm_save_from_process() {
    local process_identifier="$1"
    local new_service_name="${2:-}"

    # Check for jq
    if ! command -v jq >/dev/null 2>&1; then
        echo "❌ jq is required but not installed"
        return 1
    fi

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
    local command cwd env_name port
    command=$(jq -r '.command // empty' "$meta_file" 2>/dev/null)
    cwd=$(jq -r '.cwd // empty' "$meta_file" 2>/dev/null)
    env_name=$(jq -r '.env // "none"' "$meta_file" 2>/dev/null)
    port=$(jq -r '.port // empty' "$meta_file" 2>/dev/null)

    if [[ -z "$command" ]]; then
        echo "❌ Failed to read metadata for $process_name"
        return 1
    fi

    # Handle null/empty values
    [[ "$env_name" == "null" || "$env_name" == "" ]] && env_name="none"
    [[ "$port" == "null" || "$port" == "" ]] && port=""
    [[ "$cwd" == "null" || "$cwd" == "" ]] && cwd="$(pwd)"

    # Determine service name (supports org/service format)
    local service_ref="${new_service_name:-${process_name%%-*}}"
    local parsed_org parsed_service
    _tsm_parse_service_ref "$service_ref" parsed_org parsed_service
    local org="${parsed_org:-$TSM_DEFAULT_ORG}"
    local service_name="$parsed_service"
    local tsm_dir="$(_tsm_org_dir "$org")"

    # Create services directory
    mkdir -p "$tsm_dir/services-available"
    local service_file="$tsm_dir/services-available/${service_name}.tsm"

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
TSM_ENV="$env_name"
TSM_PORT="$port"
EOF

    chmod +x "$service_file"

    echo "✅ Saved running process '$process_name' as service: $service_file"
    echo "   Org: $org"
    echo "   Command: $command"
    echo "   Working directory: $cwd"
    [[ "$env_name" != "none" ]] && echo "   Environment: $env_name"
    [[ -n "$port" ]] && echo "   Port: $port"
    echo ""
    echo "Enable with: tsm enable $org/$service_name"
    echo "Start with: tsm start $org/$service_name"
}

# Start all enabled services
# Show startup status (what services would start) - reads central services-enabled
tetra_tsm_startup_status() {
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

    # List enabled services from central services-enabled
    echo "📋 Services Configured for Autostart:"

    local enabled_count=0

    [[ -d "$TSM_SERVICES_ENABLED" ]] || {
        echo "  No services enabled"
        echo "  Use 'tsm enable org/service' to enable services for autostart"
        return
    }

    for service_link in "$TSM_SERVICES_ENABLED"/*.tsm; do
        [[ -L "$service_link" ]] || continue

        # Parse org-service from link name (e.g., "tetra-quasar.tsm")
        local link_name=$(basename "$service_link" .tsm)
        local org="${link_name%%-*}"
        local service_name="${link_name#*-}"

        local service_file=$(readlink "$service_link")

        if [[ ! -f "$service_file" ]]; then
            echo "  ⚠️  $org/$service_name (service file missing)"
            continue
        fi

        # Source to get details safely in subshell
        local port
        port=$(source "$service_file" 2>/dev/null && echo "$TSM_PORT")

        local port_info=""
        [[ -n "$port" ]] && port_info=" :$port"

        # Check if currently running
        local running_status=""
        if tetra_tsm_is_running "$service_name" 2>/dev/null; then
            running_status=" (currently running)"
        fi

        echo "  ✅ $org/$service_name$port_info$running_status"
        ((enabled_count++))
    done

    if [[ $enabled_count -eq 0 ]]; then
        echo "  No services enabled"
        echo "  Use 'tsm enable org/service' to enable services for autostart"
    fi

    echo
    echo "Commands:"
    echo "  tsm services --enabled     - Show enabled services with details"
    echo "  tsm startup                - Start all enabled services now"
    echo "  tsm daemon enable          - Enable boot startup (systemd)"
}

# Start all enabled services from central services-enabled
tetra_tsm_startup() {
    echo "🚀 Starting enabled services..."

    local started_count=0
    local failed_count=0

    [[ -d "$TSM_SERVICES_ENABLED" ]] || {
        echo "No services enabled"
        return 0
    }

    for service_link in "$TSM_SERVICES_ENABLED"/*.tsm; do
        [[ -L "$service_link" ]] || continue

        # Parse org-service from link name (e.g., "tetra-quasar.tsm")
        local link_name=$(basename "$service_link" .tsm)
        local org="${link_name%%-*}"
        local service_name="${link_name#*-}"

        echo "Starting $org/$service_name..."

        if tetra_tsm_start_service "$org/$service_name"; then
            ((started_count++))
        else
            ((failed_count++))
            echo "❌ Failed to start $org/$service_name"
        fi
    done

    echo "✅ Startup complete: $started_count started, $failed_count failed"

    # Log to central tsm startup.log
    mkdir -p "$TETRA_DIR/tsm"
    echo "$(date): Started $started_count services, $failed_count failed" >> "$TETRA_DIR/tsm/startup.log"
}

# Start a service by name (supports org/service or just service)
tetra_tsm_start_service() {
    local service_ref="$1"
    local org service_file

    if ! _tsm_find_service "$service_ref" org service_file; then
        echo "❌ Service not found: $service_ref"
        echo "Available services:"
        tetra_tsm_list_services 2>/dev/null | head -20
        return 1
    fi

    # Guard: TETRA_SRC required for service definitions that reference it
    if [[ -z "$TETRA_SRC" ]]; then
        echo "❌ TETRA_SRC not set. Source tetra.sh first." >&2
        return 1
    fi

    # Load service config in isolated way
    local TSM_NAME TSM_COMMAND TSM_CWD TSM_ENV TSM_PORT TSM_PRE_COMMAND
    local _tsm_decl_output
    _tsm_decl_output=$(
        export TETRA_SRC="$TETRA_SRC"
        export TETRA_DIR="$TETRA_DIR"
        source "$service_file" 2>&1 && \
        declare -p TSM_NAME TSM_COMMAND TSM_CWD TSM_ENV TSM_PORT TSM_PRE_COMMAND 2>/dev/null
    )

    [[ "$_tsm_decl_output" != *"declare"* ]] && { echo "❌ Failed to load: $service_file" >&2; return 1; }
    eval "$(echo "$_tsm_decl_output" | sed 's/^declare -x /declare /' | sed 's/^declare -- /declare /')"

    # Resolve CWD
    [[ "$TSM_CWD" == "." || -z "$TSM_CWD" ]] && TSM_CWD="$PWD"

    # Resolve env file (skip if TSM_ENV="none")
    local env_file=""
    if [[ "${TSM_ENV:-local}" != "none" ]]; then
        env_file="$TSM_CWD/env/${TSM_ENV:-local}.env"
        [[ ! -f "$env_file" ]] && { echo "❌ Env file not found: $env_file" >&2; return 1; }
    fi

    # Check if already running
    local process_name="${TSM_NAME}-${TSM_PORT:-auto}"
    if tetra_tsm_is_running "$process_name" 2>/dev/null; then
        echo "⚠️  Already running: $process_name"
        return 0
    fi

    echo "Starting $TSM_NAME on port ${TSM_PORT:-auto}..."

    # DIRECT CALL - no CLI re-invocation
    (
        cd "$TSM_CWD"
        tsm_start_any_command "$TSM_COMMAND" "$env_file" "$TSM_PORT" "$TSM_NAME" "$TSM_PRE_COMMAND"
    )
}

# Single services-enabled directory (consolidated)
TSM_SERVICES_ENABLED="$TETRA_DIR/tsm/services-enabled"

# Enable service (create symlink in central services-enabled)
# Usage: tsm enable [org/]service-name
tetra_tsm_enable() {
    local service_ref="$1"

    if [[ -z "$service_ref" ]]; then
        echo "Usage: tsm enable [org/]<service-name>"
        return 1
    fi

    # Use _found_ prefix to avoid nameref conflicts
    local _found_org _found_file
    if ! _tsm_find_service "$service_ref" _found_org _found_file; then
        echo "❌ Service not found: $service_ref"
        echo "Available services:"
        tetra_tsm_list_services
        return 1
    fi

    local parsed_org service_name
    _tsm_parse_service_ref "$service_ref" parsed_org service_name

    mkdir -p "$TSM_SERVICES_ENABLED"

    # Use org-prefixed link name for uniqueness
    local link_name="${_found_org}-${service_name}.tsm"
    local enabled_link="$TSM_SERVICES_ENABLED/$link_name"

    if [[ -L "$enabled_link" ]]; then
        echo "⚠️  Already enabled: $_found_org/$service_name"
        return 0
    fi

    ln -s "$_found_file" "$enabled_link"
    echo "✅ Enabled: $_found_org/$service_name"
    echo "Service will start automatically with tetra daemon"
}

# Disable service (remove symlink from central services-enabled)
# Usage: tsm disable [org/]service-name
tetra_tsm_disable() {
    local service_ref="$1"

    if [[ -z "$service_ref" ]]; then
        echo "Usage: tsm disable [org/]<service-name>"
        return 1
    fi

    # Use _found_ prefix to avoid nameref conflicts
    local _found_org _found_file
    if ! _tsm_find_service "$service_ref" _found_org _found_file; then
        echo "❌ Service not found: $service_ref"
        return 1
    fi

    local parsed_org service_name
    _tsm_parse_service_ref "$service_ref" parsed_org service_name

    local link_name="${_found_org}-${service_name}.tsm"
    local enabled_link="$TSM_SERVICES_ENABLED/$link_name"

    if [[ ! -L "$enabled_link" ]]; then
        echo "⚠️  Not enabled: $_found_org/$service_name"
        return 0
    fi

    rm "$enabled_link"
    echo "✅ Disabled: $_found_org/$service_name"
    echo "Service will not start automatically"
}

# List available services across all orgs
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
    local filter="all"  # all, enabled, disabled

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
    if [[ "$has_colors" == "true" ]]; then
        text_color "00AAAA"
    fi

    case "$filter" in
        enabled)
            echo "Enabled Services (Auto-start on Boot):"
            ;;
        disabled)
            echo "Disabled Services:"
            ;;
        *)
            echo "Saved Service Definitions (all orgs):"
            ;;
    esac

    [[ "$has_colors" == "true" ]] && reset_color

    local total_shown=0
    local org

    # Iterate over all orgs
    for org in $(_tsm_get_orgs); do
        local services_dir="$TETRA_DIR/orgs/$org/tsm/services-available"

        [[ -d "$services_dir" ]] || continue

        local org_has_services=false

        for service_file in "$services_dir"/*.tsm; do
            [[ -f "$service_file" ]] || continue

            local service_name=$(basename "$service_file" .tsm)
            local is_enabled=false

            # Check central services-enabled (org-prefixed link name)
            if [[ -L "$TSM_SERVICES_ENABLED/${org}-${service_name}.tsm" ]]; then
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

            # Print org header on first service
            if [[ "$org_has_services" == "false" ]]; then
                org_has_services=true
                if [[ "$has_colors" == "true" ]]; then
                    text_color "AA77DD"  # Purple for org name
                fi
                echo "  [$org]"
                [[ "$has_colors" == "true" ]] && reset_color
            fi

            ((total_shown++))

            # Source service definition in subshell to extract values safely
            local cmd port
            cmd=$(source "$service_file" 2>/dev/null && echo "$TSM_COMMAND")
            port=$(source "$service_file" 2>/dev/null && echo "$TSM_PORT")

            local full_name="$org/$service_name"

            if [[ "$detail" == "true" ]]; then
                if [[ "$has_colors" == "true" ]]; then
                    text_color "5599FF"
                fi
                echo -n "    $full_name"
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
                echo -n "        Command: "
                [[ "$has_colors" == "true" ]] && reset_color
                if [[ "$has_colors" == "true" ]]; then
                    text_color "FFAA44"
                fi
                echo "$cmd"
                [[ "$has_colors" == "true" ]] && reset_color

                if [[ -n "$port" ]]; then
                    if [[ "$has_colors" == "true" ]]; then
                        text_color "777788"
                    fi
                    echo -n "        Port: "
                    [[ "$has_colors" == "true" ]] && reset_color
                    if [[ "$has_colors" == "true" ]]; then
                        text_color "00AAAA"
                    fi
                    echo "$port"
                    [[ "$has_colors" == "true" ]] && reset_color
                fi
                echo
            else
                # Compact view: org/service  enabled  command :port
                if [[ "$has_colors" == "true" ]]; then
                    text_color "5599FF"
                fi
                printf "    %-20s" "$full_name"
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

                if [[ "$has_colors" == "true" ]]; then
                    text_color "FFAA44"
                fi
                echo -n "$cmd"
                [[ "$has_colors" == "true" ]] && reset_color

                if [[ -n "$port" ]]; then
                    if [[ "$has_colors" == "true" ]]; then
                        text_color "00AAAA"
                    fi
                    echo -n " :$port"
                    [[ "$has_colors" == "true" ]] && reset_color
                fi
                echo ""
            fi
        done
    done

    if [[ $total_shown -eq 0 ]]; then
        case "$filter" in
            enabled)
                echo "  No enabled services found"
                echo "  Use 'tsm enable org/service' to enable services"
                ;;
            disabled)
                echo "  No disabled services found"
                ;;
            *)
                echo "  No services found in any org"
                ;;
        esac
    fi

    echo
    if [[ "$has_colors" == "true" ]]; then
        text_color "777788"
    fi
    echo "Usage: tsm services [--enabled|--disabled|--available] [-d|--detail]"
    [[ "$has_colors" == "true" ]] && reset_color
}

# Show service details
# Usage: tsm show [org/]service-name
tetra_tsm_show_service() {
    local service_ref="$1"

    if [[ -z "$service_ref" ]]; then
        echo "Usage: tsm show [org/]<service-name>"
        return 1
    fi

    local org service_file
    if ! _tsm_find_service "$service_ref" org service_file; then
        echo "❌ Service not found: $service_ref"
        return 1
    fi

    local parsed_org service_name
    _tsm_parse_service_ref "$service_ref" parsed_org service_name
    local tsm_dir="$(_tsm_org_dir "$org")"

    echo "🔍 Service: $org/$service_name"
    echo "📄 File: $service_file"
    echo

    # Source and display variables in subshell to avoid pollution
    (
        source "$service_file"
        echo "Configuration:"
        echo "  Org: $org"
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
    if [[ -L "$tsm_dir/services-enabled/${service_name}.tsm" ]]; then
        echo "  Status: enabled ✅"
    else
        echo "  Status: disabled"
    fi
}

# Export all service functions
export -f _tsm_get_orgs
export -f _tsm_parse_service_ref
export -f _tsm_find_service
export -f _tsm_org_dir
export -f tetra_tsm_orgs
export -f tetra_tsm_save
export -f _tsm_save_from_process
export -f tetra_tsm_startup
export -f tetra_tsm_startup_status
export -f tetra_tsm_start_service
export -f tetra_tsm_enable
export -f tetra_tsm_disable
export -f tetra_tsm_list_services
export -f tetra_tsm_show_service