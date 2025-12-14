#!/usr/bin/env bash

# TSM Service Save
# Save commands or running processes as service definitions

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

    # Extract metadata from JSON
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

    # Check if service file already exists
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

export -f tetra_tsm_save
export -f _tsm_save_from_process
