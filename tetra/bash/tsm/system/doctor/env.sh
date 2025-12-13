#!/usr/bin/env bash

# TSM Doctor - Environment Diagnostics
# Environment file loading and startup failure diagnosis

# Diagnose environment loading issues
doctor_diagnose_env_loading() {
    local env_file="${1:-env/local.env}"

    doctor_log "Diagnosing environment file loading: $env_file"
    echo

    # Check if file exists
    if [[ ! -f "$env_file" ]]; then
        doctor_error "Environment file not found: $env_file"
        echo "  Checked from: $(pwd)"
        echo "  Try: tetra env init local"
        return 1
    fi

    doctor_success "Environment file exists: $env_file"

    # Check file permissions
    if [[ ! -r "$env_file" ]]; then
        doctor_error "Environment file is not readable"
        echo "  Try: chmod 644 $env_file"
        return 1
    fi

    doctor_success "Environment file is readable"

    # Check for PORT variable
    if grep -q "^export PORT=" "$env_file"; then
        local port_value=$(grep "^export PORT=" "$env_file" | cut -d'=' -f2)
        doctor_success "PORT variable found: $port_value"

        # Check if that port is available
        local port_num="${port_value//[^0-9]/}"
        if [[ -n "$port_num" ]]; then
            if doctor_scan_port "$port_num" >/dev/null 2>&1; then
                doctor_success "Target port $port_num is available"
            else
                doctor_warn "Target port $port_num is in use - this may cause TSM to use fallback port"
                doctor_scan_port "$port_num"
            fi
        fi
    else
        doctor_warn "No PORT variable found in $env_file"
        echo "  TSM may default to port 3000"
        echo "  Add: export PORT=4000"
    fi

    # Check for other common variables
    local required_vars=("NODE_ENV" "PD_DIR")
    for var in "${required_vars[@]}"; do
        if grep -q "^export $var=" "$env_file"; then
            doctor_success "$var variable found"
        else
            doctor_warn "$var variable not found in $env_file"
        fi
    done

    # Test sourcing the file
    doctor_log "Testing environment file sourcing..."
    # Source once and capture both validation and variable output
    local env_output
    if env_output=$(source "$env_file" 2>&1 && env | grep -E "^(PORT|NODE_ENV|PD_DIR)="); then
        doctor_success "Environment file sources without errors"

        # Show extracted variables
        echo "  Extracted variables:"
        echo "$env_output" | sed 's/^/    /'
    else
        doctor_error "Environment file has syntax errors"
        echo "  Try: bash -n $env_file"
    fi
}

# Diagnose startup failure - provide detailed error context
doctor_diagnose_startup_failure() {
    local service_name="$1"
    local port="$2"
    local command="$3"
    local env_file="$4"

    echo "tsm: diagnosing startup failure for '$service_name'" >&2
    echo >&2

    # Check port conflict
    local existing_pid
    existing_pid=$(tsm_get_port_pid "$port")
    if [[ -n "$existing_pid" ]]; then
        local process_name_full process_name process_cmd_full process_cmd user_name
        process_name_full=$(ps -p $existing_pid -o comm= 2>/dev/null | tr -d ' ' || echo "unknown")
        process_name=$(doctor_truncate_middle "$process_name_full" 30)
        process_cmd_full=$(ps -p $existing_pid -o args= 2>/dev/null || echo "unknown")
        process_cmd=$(doctor_truncate_middle "$process_cmd_full" 80)
        user_name=$(ps -p $existing_pid -o user= 2>/dev/null | tr -d ' ' || echo "unknown")

        doctor_error "Port $port is already in use"
        echo "  PID:     $existing_pid" >&2
        echo "  Process: $process_name" >&2
        echo "  User:    $user_name" >&2
        echo "  Command: $process_cmd" >&2
        echo >&2

        # Check if it's TSM-managed
        local tsm_process_name=""
        if [[ -d "$TSM_PROCESSES_DIR" ]]; then
            for process_file in "$TSM_PROCESSES_DIR"/*; do
                [[ -f "$process_file" ]] || continue
                local stored_pid
                stored_pid=$(grep "^PID=" "$process_file" 2>/dev/null | cut -d'=' -f2)
                if [[ "$stored_pid" == "$existing_pid" ]]; then
                    tsm_process_name=$(basename "$process_file")
                    break
                fi
            done
        fi

        if [[ -n "$tsm_process_name" ]]; then
            doctor_info "This is a TSM-managed process: $tsm_process_name"
            echo "  Run: tsm stop $tsm_process_name" >&2
        else
            doctor_info "This is NOT a TSM-managed process"
            echo "  Run: tsm doctor kill $port    # Interactive kill" >&2
            echo "  Or:  kill $existing_pid       # Manual kill" >&2
        fi
        echo >&2
        return 1
    fi

    # Check environment file if specified
    if [[ -n "$env_file" ]]; then
        if [[ ! -f "$env_file" ]]; then
            doctor_error "Environment file not found: $env_file"
            echo "  Run: tetra env init <environment-name>" >&2
            echo >&2
        elif [[ ! -r "$env_file" ]]; then
            doctor_error "Environment file not readable: $env_file"
            echo "  Run: chmod 644 $env_file" >&2
            echo >&2
        else
            doctor_success "Environment file exists and is readable: $env_file"
        fi
    fi

    # Check command executable
    if [[ -n "$command" ]]; then
        local cmd_parts=($command)
        local executable="${cmd_parts[0]}"

        if ! command -v "$executable" >/dev/null 2>&1; then
            doctor_error "Command not found: $executable"
            echo "  Make sure '$executable' is installed and in PATH" >&2
            echo >&2
        else
            doctor_success "Command executable found: $executable"
        fi
    fi

    # Check for recent TSM process failures
    local log_file="$TSM_LOGS_DIR/${service_name}.out"
    if [[ -f "$log_file" ]]; then
        local recent_errors
        recent_errors=$(tail -20 "$log_file" 2>/dev/null | grep -i "error\|failed\|cannot\|permission" | tail -3)
        if [[ -n "$recent_errors" ]]; then
            doctor_warn "Recent errors found in log file:"
            echo "$recent_errors" | sed 's/^/  /' >&2
            echo "  Full log: $log_file" >&2
            echo >&2
        fi
    fi

    # Check disk space
    local available_space
    available_space=$(df -h "$TETRA_DIR" 2>/dev/null | awk 'NR==2 {print $4}' || echo "unknown")
    if [[ "$available_space" != "unknown" ]]; then
        doctor_info "Available disk space: $available_space"
    fi

    return 0
}

# Export functions
export -f doctor_diagnose_env_loading
export -f doctor_diagnose_startup_failure
