#!/usr/bin/env bash
# project/project_services.sh - Service manifest discovery
#
# Discovers and reads *.tsm service manifests from project's services/ directory.
# Service manifests define how TSM starts and exposes processes.

# =============================================================================
# DISCOVERY
# =============================================================================

# List services for a project
# Returns service names (one per line)
project_services_list() {
    local name="$1"

    if [[ -z "$name" ]]; then
        echo "Usage: project_services_list <project>" >&2
        return 1
    fi

    local path=$(_project_get_path "$name")
    if [[ -z "$path" || ! -d "$path" ]]; then
        echo "Project path not found: $name" >&2
        return 1
    fi

    local services_dir="$path/services"
    if [[ ! -d "$services_dir" ]]; then
        return 0  # No services directory
    fi

    for tsm in "$services_dir"/*.tsm; do
        [[ -f "$tsm" ]] && basename "$tsm" .tsm
    done
}

# Get service manifest path
project_service_path() {
    local name="$1"
    local service="$2"

    local path=$(_project_get_path "$name")
    [[ -z "$path" ]] && return 1

    local tsm="$path/services/${service}.tsm"
    [[ -f "$tsm" ]] && echo "$tsm"
}

# =============================================================================
# MANIFEST READING
# =============================================================================

# Load service manifest variables
# Usage: project_service_load <project> <service>
# Sets: TSM_NAME, TSM_COMMAND, TSM_PORT, TSM_KIND, TSM_PROXY, etc.
project_service_load() {
    local name="$1"
    local service="$2"

    local tsm=$(project_service_path "$name" "$service")
    if [[ -z "$tsm" || ! -f "$tsm" ]]; then
        echo "Service not found: $service in $name" >&2
        return 1
    fi

    # Clear previous values
    unset TSM_NAME TSM_COMMAND TSM_CWD TSM_PORT TSM_KIND
    unset TSM_PROXY TSM_PROXY_PATH TSM_HEALTH

    # Source the manifest (shell variables)
    source "$tsm"

    # Default TSM_NAME to service name if not set
    : "${TSM_NAME:=$service}"

    return 0
}

# Get single value from service manifest without loading all
project_service_get() {
    local name="$1"
    local service="$2"
    local key="$3"

    local tsm=$(project_service_path "$name" "$service")
    [[ -z "$tsm" || ! -f "$tsm" ]] && return 1

    grep -E "^${key}=" "$tsm" 2>/dev/null | head -1 | cut -d= -f2 | tr -d '"'
}

# =============================================================================
# INFO
# =============================================================================

# Show service manifest details
project_service_show() {
    local name="$1"
    local service="$2"

    if [[ -z "$name" || -z "$service" ]]; then
        echo "Usage: project_service_show <project> <service>"
        return 1
    fi

    local tsm=$(project_service_path "$name" "$service")
    if [[ -z "$tsm" || ! -f "$tsm" ]]; then
        echo "Service not found: $service in $name"
        return 1
    fi

    echo "Service: $service"
    echo "Project: $name"
    echo "File: $tsm"
    echo ""
    echo "Manifest:"
    echo "---------"
    cat "$tsm"
}

# Show all services for a project with details
project_services() {
    local name="$1"

    if [[ -z "$name" ]]; then
        echo "Usage: deploy project services <name>"
        return 1
    fi

    local path=$(_project_get_path "$name")
    if [[ -z "$path" ]]; then
        echo "Project not found: $name"
        return 1
    fi

    local type=$(_project_get_type "$name")
    echo "Project: $name ($type)"
    echo "Path: $path"
    echo ""

    local services_dir="$path/services"
    if [[ ! -d "$services_dir" ]]; then
        echo "No services/ directory"
        echo ""
        echo "Create services at: $services_dir/"
        echo "Example:"
        echo "  mkdir -p $services_dir"
        echo "  cat > $services_dir/api.tsm << 'EOF'"
        echo '  TSM_NAME="api"'
        echo '  TSM_COMMAND="node server.js"'
        echo '  TSM_PORT=3001'
        echo '  TSM_KIND="http"'
        echo '  TSM_PROXY="subdomain"'
        echo "  EOF"
        return 0
    fi

    local count=0
    for tsm in "$services_dir"/*.tsm; do
        [[ -f "$tsm" ]] || continue
        ((count++))
    done

    if [[ $count -eq 0 ]]; then
        echo "Services: (none)"
        return 0
    fi

    echo "Services: $count"
    echo ""
    printf "%-15s %-8s %-10s %-12s %s\n" "NAME" "PORT" "KIND" "PROXY" "COMMAND"
    printf "%-15s %-8s %-10s %-12s %s\n" "----" "----" "----" "-----" "-------"

    for tsm in "$services_dir"/*.tsm; do
        [[ -f "$tsm" ]] || continue

        local svc=$(basename "$tsm" .tsm)
        local port=$(grep -E '^TSM_PORT=' "$tsm" | cut -d= -f2 | tr -d '"')
        local kind=$(grep -E '^TSM_KIND=' "$tsm" | cut -d= -f2 | tr -d '"')
        local proxy=$(grep -E '^TSM_PROXY=' "$tsm" | cut -d= -f2 | tr -d '"')
        local cmd=$(grep -E '^TSM_COMMAND=' "$tsm" | cut -d= -f2 | tr -d '"')

        # Truncate command for display
        [[ ${#cmd} -gt 30 ]] && cmd="${cmd:0:27}..."

        printf "%-15s %-8s %-10s %-12s %s\n" \
            "$svc" "${port:-—}" "${kind:-http}" "${proxy:-none}" "$cmd"
    done
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f project_services_list project_service_path
export -f project_service_load project_service_get
export -f project_service_show project_services
