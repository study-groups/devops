#!/usr/bin/env bash

# TSM Doctor - Command Validation
# Pre-flight checks before starting services

# Validate command before starting - pre-flight checks
doctor_validate_command() {
    local command="$1"
    local port="$2"
    local env_file="$3"
    local json_output="${4:-false}"

    local validation_errors=()
    local validation_warnings=()
    local validation_info=()

    # Check command executable
    if [[ -n "$command" ]]; then
        local cmd_parts=($command)
        local executable="${cmd_parts[0]}"

        if ! command -v "$executable" >/dev/null 2>&1; then
            validation_errors+=("Command not found: $executable")
        else
            validation_info+=("Command executable found: $executable")
        fi
    else
        validation_errors+=("No command specified")
    fi

    # Check port availability
    if [[ -n "$port" ]]; then
        local existing_pid=$(tsm_get_port_pid "$port")
        if [[ -n "$existing_pid" ]]; then
            local process_cmd_full=$(ps -p $existing_pid -o args= 2>/dev/null || echo "unknown")
            local process_cmd=$(doctor_truncate_middle "$process_cmd_full" 60)
            validation_errors+=("Port $port is already in use by PID $existing_pid ($process_cmd)")
        else
            validation_info+=("Port $port is available")
        fi

        # Check if port is in valid range
        if [[ ! "$port" =~ ^[0-9]+$ ]] || [[ "$port" -lt 1 ]] || [[ "$port" -gt 65535 ]]; then
            validation_errors+=("Invalid port number: $port")
        elif [[ "$port" -lt 1024 ]]; then
            validation_warnings+=("Port $port is privileged (requires sudo)")
        fi
    fi

    # Check environment file
    if [[ -n "$env_file" ]]; then
        if [[ ! -f "$env_file" ]]; then
            validation_errors+=("Environment file not found: $env_file")
        elif [[ ! -r "$env_file" ]]; then
            validation_errors+=("Environment file not readable: $env_file")
        else
            validation_info+=("Environment file exists and is readable: $env_file")

            # Check for placeholder values
            if grep -q "your_.*_here\|your-.*-name" "$env_file"; then
                validation_warnings+=("Environment file contains placeholder values")
            fi
        fi
    fi

    # Check disk space
    local available_space
    available_space=$(df -h "$TETRA_DIR" 2>/dev/null | awk 'NR==2 {print $4}' || echo "unknown")
    if [[ "$available_space" != "unknown" ]]; then
        validation_info+=("Available disk space: $available_space")
    fi

    # Output results
    if [[ "$json_output" == "true" ]]; then
        echo "{"
        echo "  \"valid\": $([[ ${#validation_errors[@]} -eq 0 ]] && echo "true" || echo "false"),"
        echo "  \"errors\": ["
        local first=true
        for err in "${validation_errors[@]}"; do
            [[ "$first" == true ]] && first=false || echo ","
            echo -n "    \"$(_tsm_json_escape "$err")\""
        done
        echo ""
        echo "  ],"
        echo "  \"warnings\": ["
        first=true
        for warning in "${validation_warnings[@]}"; do
            [[ "$first" == true ]] && first=false || echo ","
            echo -n "    \"$(_tsm_json_escape "$warning")\""
        done
        echo ""
        echo "  ],"
        echo "  \"info\": ["
        first=true
        for inf in "${validation_info[@]}"; do
            [[ "$first" == true ]] && first=false || echo ","
            echo -n "    \"$(_tsm_json_escape "$inf")\""
        done
        echo ""
        echo "  ]"
        echo "}"
    else
        doctor_log "Pre-flight validation results:"
        echo

        # Show errors
        if [[ ${#validation_errors[@]} -gt 0 ]]; then
            for err in "${validation_errors[@]}"; do
                doctor_error "$err"
            done
            echo
        fi

        # Show warnings
        if [[ ${#validation_warnings[@]} -gt 0 ]]; then
            for warning in "${validation_warnings[@]}"; do
                doctor_warn "$warning"
            done
            echo
        fi

        # Show info
        if [[ ${#validation_info[@]} -gt 0 ]]; then
            for inf in "${validation_info[@]}"; do
                doctor_success "$inf"
            done
            echo
        fi

        if [[ ${#validation_errors[@]} -eq 0 ]]; then
            doctor_success "✅ Validation passed - ready to start"
        else
            doctor_error "❌ Validation failed - ${#validation_errors[@]} error(s) found"
        fi
    fi

    # Return success/failure based on errors
    return $([[ ${#validation_errors[@]} -eq 0 ]] && echo 0 || echo 1)
}

# Export functions
export -f doctor_validate_command
