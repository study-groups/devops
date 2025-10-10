#!/usr/bin/env bash

# TSM Configuration and Global State Management
# No dependencies - can be loaded early

# TSM configuration constants
if [[ -z "${TSM_DEFAULT_PORT:-}" ]]; then
    readonly TSM_DEFAULT_PORT=3000
fi
if [[ -z "${TSM_MAX_PROCESSES:-}" ]]; then
    readonly TSM_MAX_PROCESSES=100
fi
if [[ -z "${TSM_LOG_MAX_LINES:-}" ]]; then
    readonly TSM_LOG_MAX_LINES=1000
fi

# TSM Module Directory (source location)
export TSM_DIR="${TETRA_SRC}/bash/tsm"

# TSM Runtime Directory Structure
export TSM_LOGS_DIR="${TETRA_DIR}/tsm/runtime/logs"
export TSM_PIDS_DIR="${TETRA_DIR}/tsm/runtime/pids"
export TSM_PROCESSES_DIR="${TETRA_DIR}/tsm/runtime/processes"
export TSM_PORTS_DIR="${TETRA_DIR}/tsm/runtime/ports"
export TSM_ID_FILE="${TETRA_DIR}/tsm/runtime/next_id"

# Global state initialization function
_tsm_init_global_state() {
    # Only initialize if Bash 4+ (associative arrays)
    if [[ "${BASH_VERSION%%.*}" -ge 4 ]]; then
        # Initialize process registry
        if ! declare -p TSM_PROCESS_REGISTRY >/dev/null 2>&1; then
            declare -gA TSM_PROCESS_REGISTRY
        fi

        # Mark global state as initialized
        export TSM_GLOBAL_STATE_INITIALIZED=true
    else
        echo "Warning: TSM requires Bash 4.0+ for full functionality" >&2
        export TSM_GLOBAL_STATE_INITIALIZED=false
    fi
}

# Named port access function (implementation in tsm_ports.sh)
tsm_get_named_port() {
    local service_name="$1"

    # Ensure global state is initialized
    if [[ "${TSM_GLOBAL_STATE_INITIALIZED:-}" != "true" ]]; then
        _tsm_init_global_state
    fi

    if [[ -n "${TSM_NAMED_PORTS[$service_name]:-}" ]]; then
        echo "${TSM_NAMED_PORTS[$service_name]}"
        return 0
    else
        return 1
    fi
}

# Port resolution with priority order
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
    local named_port
    if named_port=$(tsm_get_named_port "$service_name" 2>/dev/null); then
        echo "$named_port"
        return 0
    fi

    # Priority 4: Default port
    echo "$TSM_DEFAULT_PORT"
    return 0
}

# Configuration validation
tsm_validate_config() {
    local errors=0

    # Check Bash version
    if [[ "${BASH_VERSION%%.*}" -lt 4 ]]; then
        echo "ERROR: TSM requires Bash 4.0 or later (current: $BASH_VERSION)" >&2
        errors=$((errors + 1))
    fi

    # Validate named ports for conflicts
    if [[ "${TSM_GLOBAL_STATE_INITIALIZED:-}" == "true" ]]; then
        local seen_ports=()
        for service in "${!TSM_NAMED_PORTS[@]}"; do
            local port="${TSM_NAMED_PORTS[$service]}"

            # Check for duplicates
            for seen_port in "${seen_ports[@]}"; do
                if [[ "$seen_port" == "$port" ]]; then
                    echo "ERROR: Port $port assigned to multiple services" >&2
                    errors=$((errors + 1))
                fi
            done
            seen_ports+=("$port")

            # Validate port range
            if [[ ! "$port" =~ ^[0-9]+$ ]] || [[ "$port" -lt 1 ]] || [[ "$port" -gt 65535 ]]; then
                echo "ERROR: Invalid port number for $service: $port" >&2
                errors=$((errors + 1))
            fi
        done
    fi

    return $errors
}

# Export functions for use by other modules
export -f tsm_get_named_port
export -f tsm_resolve_service_port
export -f tsm_validate_config