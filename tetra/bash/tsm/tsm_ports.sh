#!/usr/bin/env bash

# TSM Named Port Registry
# Establishes standard port assignments for known services

# Named port registry - global associative array
if ! declare -p TSM_NAMED_PORTS >/dev/null 2>&1; then
    declare -gA TSM_NAMED_PORTS
fi
TSM_NAMED_PORTS["devpages"]="4000"
TSM_NAMED_PORTS["tetra"]="4444"
TSM_NAMED_PORTS["arcade"]="8400"
TSM_NAMED_PORTS["pbase"]="2600"

# Get port for a named service
tsm_get_named_port() {
    local service_name="$1"

    if [[ -n "${TSM_NAMED_PORTS[$service_name]}" ]]; then
        echo "${TSM_NAMED_PORTS[$service_name]}"
        return 0
    else
        return 1
    fi
}

# Check if a port is assigned to a named service
tsm_get_port_owner() {
    local port="$1"

    for service in "${!TSM_NAMED_PORTS[@]}"; do
        if [[ "${TSM_NAMED_PORTS[$service]}" == "$port" ]]; then
            echo "$service"
            return 0
        fi
    done
    return 1
}

# List all named ports
tsm_list_named_ports() {
    local format="${1:-table}"

    case "$format" in
        "table")
            printf "%-12s %s\n" "SERVICE" "PORT"
            printf "%-12s %s\n" "-------" "----"
            for service in "${!TSM_NAMED_PORTS[@]}"; do
                printf "%-12s %s\n" "$service" "${TSM_NAMED_PORTS[$service]}"
            done | sort
            ;;
        "env")
            for service in "${!TSM_NAMED_PORTS[@]}"; do
                local upper_service=$(echo "$service" | tr '[:lower:]' '[:upper:]')
                echo "export ${upper_service}_PORT=${TSM_NAMED_PORTS[$service]}"
            done | sort
            ;;
        "json")
            echo "{"
            local first=true
            for service in "${!TSM_NAMED_PORTS[@]}"; do
                if [[ "$first" == true ]]; then
                    first=false
                else
                    echo ","
                fi
                echo -n "  \"$service\": ${TSM_NAMED_PORTS[$service]}"
            done
            echo ""
            echo "}"
            ;;
        *)
            echo "Unknown format: $format" >&2
            echo "Supported formats: table, env, json" >&2
            return 1
            ;;
    esac
}

# Validate named port assignments don't conflict
tsm_validate_port_registry() {
    local errors=0
    local seen_ports=()

    # Check for duplicate ports
    for service in "${!TSM_NAMED_PORTS[@]}"; do
        local port="${TSM_NAMED_PORTS[$service]}"

        # Check if port already seen
        for seen_port in "${seen_ports[@]}"; do
            if [[ "$seen_port" == "$port" ]]; then
                echo "ERROR: Port $port assigned to multiple services" >&2
                errors=$((errors + 1))
            fi
        done

        seen_ports+=("$port")

        # Validate port number
        if [[ ! "$port" =~ ^[0-9]+$ ]] || [[ "$port" -lt 1 ]] || [[ "$port" -gt 65535 ]]; then
            echo "ERROR: Invalid port number for $service: $port" >&2
            errors=$((errors + 1))
        fi

        # Check for privileged ports
        if [[ "$port" -lt 1024 ]]; then
            echo "WARNING: $service uses privileged port $port (requires sudo)" >&2
        fi
    done

    return $errors
}

# Add or update a named port
tsm_set_named_port() {
    local service="$1"
    local port="$2"

    if [[ -z "$service" || -z "$port" ]]; then
        echo "Usage: tsm_set_named_port <service> <port>" >&2
        return 1
    fi

    if [[ ! "$port" =~ ^[0-9]+$ ]] || [[ "$port" -lt 1 ]] || [[ "$port" -gt 65535 ]]; then
        echo "ERROR: Invalid port number: $port" >&2
        return 1
    fi

    # Check if port is already assigned to another service
    local existing_owner=$(tsm_get_port_owner "$port")
    if [[ -n "$existing_owner" && "$existing_owner" != "$service" ]]; then
        echo "ERROR: Port $port is already assigned to $existing_owner" >&2
        return 1
    fi

    TSM_NAMED_PORTS["$service"]="$port"
    echo "Set $service port to $port"
}

# Remove a named port
tsm_remove_named_port() {
    local service="$1"

    if [[ -z "$service" ]]; then
        echo "Usage: tsm_remove_named_port <service>" >&2
        return 1
    fi

    if [[ -n "${TSM_NAMED_PORTS[$service]}" ]]; then
        local port="${TSM_NAMED_PORTS[$service]}"
        unset TSM_NAMED_PORTS["$service"]
        echo "Removed $service (was using port $port)"
    else
        echo "Service $service not found in port registry" >&2
        return 1
    fi
}

# Enhanced port resolution for TSM services
# This function determines the port for a service in priority order:
# 1. Explicit --port flag
# 2. PORT from environment file
# 3. Named port registry
# 4. Default port 3000
tsm_resolve_service_port() {
    local service_name="$1"
    local explicit_port="$2"
    local env_port="$3"

    # Priority 1: Explicit port flag
    if [[ -n "$explicit_port" ]]; then
        echo "$explicit_port"
        return 0
    fi

    # Priority 2: PORT from environment file
    if [[ -n "$env_port" ]]; then
        echo "$env_port"
        return 0
    fi

    # Priority 3: Named port registry
    local named_port=$(tsm_get_named_port "$service_name" 2>/dev/null)
    if [[ -n "$named_port" ]]; then
        echo "$named_port"
        return 0
    fi

    # Priority 4: Default port
    echo "3000"
    return 0
}

# Port scanning with named port awareness
tsm_scan_named_ports() {
    local show_all="${1:-false}"

    echo "Named Port Registry Status:"
    echo
    printf "%-12s %-6s %-8s %-10s %s\n" "SERVICE" "PORT" "STATUS" "PID" "PROCESS"
    printf "%-12s %-6s %-8s %-10s %s\n" "-------" "----" "------" "---" "-------"

    for service in "${!TSM_NAMED_PORTS[@]}"; do
        local port="${TSM_NAMED_PORTS[$service]}"
        local pid=$(lsof -ti :$port 2>/dev/null)

        if [[ -n "$pid" ]]; then
            local process=$(ps -p $pid -o comm= 2>/dev/null || echo "unknown")
            printf "%-12s %-6s \033[0;31m%-8s\033[0m %-10s %s\n" "$service" "$port" "USED" "$pid" "$process"
        else
            printf "%-12s %-6s \033[0;32m%-8s\033[0m %-10s %s\n" "$service" "$port" "FREE" "-" "-"
        fi
    done | sort

    if [[ "$show_all" == "true" ]]; then
        echo
        echo "All Development Ports:"
        tetra_tsm_doctor scan 2>/dev/null || {
            echo "Note: Run 'tsm doctor' for full port scan"
        }
    fi
}

# Export functions for use in other TSM modules
export -f tsm_get_named_port
export -f tsm_get_port_owner
export -f tsm_list_named_ports
export -f tsm_validate_port_registry
export -f tsm_set_named_port
export -f tsm_remove_named_port
export -f tsm_resolve_service_port
export -f tsm_scan_named_ports

# Auto-validate on source
if ! tsm_validate_port_registry >/dev/null 2>&1; then
    echo "WARNING: TSM named port registry has validation errors" >&2
    echo "Run 'tsm ports validate' to see details" >&2
fi