#!/usr/bin/env bash

# TSM Service Registry
# Service name resolution and management

# Get service registry file path
_tsm_services_file() {
    echo "$TETRA_SRC/bash/tsm/services.conf"
}

# Parse service line
_tsm_parse_service() {
    local service_line="$1"
    local name type command port directory description

    IFS=':' read -r name type command port directory description <<< "$service_line"

    # Expand variables in directory and command
    directory=$(eval echo "$directory")
    command=$(eval echo "$command")

    # Output parsed values
    echo "name='$name'"
    echo "type='$type'"
    echo "command='$command'"
    echo "port='$port'"
    echo "directory='$directory'"
    echo "description='$description'"
}

# Find service by name
tsm_find_service() {
    local service_name="$1"
    local services_file=$(_tsm_services_file)

    [[ -f "$services_file" ]] || {
        echo "tsm: services file not found: $services_file" >&2
        return 1
    }

    local service_line
    while IFS= read -r line; do
        # Skip comments and empty lines
        [[ "$line" =~ ^#.*$ ]] && continue
        [[ -z "$line" ]] && continue

        # Check if this line matches the service name
        if [[ "$line" =~ ^${service_name}: ]]; then
            echo "$line"
            return 0
        fi
    done < "$services_file"

    return 1
}

# List all services
tsm_list_services() {
    tsm_format_services_list
}

# Start service by name
tsm_start_service() {
    local service_name="$1"
    shift
    local additional_args=("$@")

    local service_line
    service_line=$(tsm_find_service "$service_name") || {
        echo "tsm: service '$service_name' not found" >&2
        echo "Use 'tsm services' to list available services" >&2
        return 1
    }

    # Parse service configuration
    local name type command port directory description
    eval "$(_tsm_parse_service "$service_line")"

    echo "tsm: starting service '$name' ($type)"

    # Change to service directory if specified
    local original_dir="$PWD"
    if [[ -n "$directory" && "$directory" != "-" ]]; then
        [[ -d "$directory" ]] || {
            echo "tsm: service directory not found: $directory" >&2
            return 1
        }
        cd "$directory" || return 1
    fi

    # Start based on service type
    case "$type" in
        node)
            # For node services, use the command directly
            tetra_tsm_start_command $command --port "$port" --name "$name" "${additional_args[@]}"
            ;;
        bash)
            # For bash services, run the command
            tetra_tsm_start_command $command --port "$port" --name "$name" "${additional_args[@]}"
            ;;
        go)
            # For go services, run the command
            tetra_tsm_start_command $command --port "$port" --name "$name" "${additional_args[@]}"
            ;;
        *)
            echo "tsm: unknown service type '$type'" >&2
            cd "$original_dir"
            return 1
            ;;
    esac

    local result=$?
    cd "$original_dir"
    return $result
}

# Service management help
tsm_services_help() {
    cat <<'EOF'
TSM Service Registry
===================

Commands:
  tsm services                  List all registered services
  tsm start <service>           Start a registered service
  tsm service add <config>      Add service to registry (future)
  tsm service remove <name>     Remove service from registry (future)

Service Types:
  node    - Node.js applications
  bash    - Shell scripts and commands
  go      - Go applications

Examples:
  tsm start tetra              Start tetra server on port 4444
  tsm start devpages           Start devpages server on port 4000
  tsm start webserver          Start Python web server on port 8888

Service Configuration:
  Services are defined in: $TETRA_SRC/bash/tsm/services.conf
  Format: NAME:TYPE:COMMAND:PORT:DIRECTORY:DESCRIPTION

EOF
}