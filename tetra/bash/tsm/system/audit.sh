#!/usr/bin/env bash

# TSM Audit System - Service configuration auditing
# Audits services-available and services-enabled directories (nginx-style)
# Validates service definitions and port assignments

# Load services configuration
# Cross-module dependencies handled by include.sh loading order
# services/registry.sh functions are available after include.sh completes

# Setup audit directories
TSM_SERVICES_AVAILABLE="$TETRA_DIR/tsm/services-available"
TSM_SERVICES_ENABLED="$TETRA_DIR/tsm/services-enabled"

# Initialize service directories
tsm_audit_init() {
    mkdir -p "$TSM_SERVICES_AVAILABLE"
    mkdir -p "$TSM_SERVICES_ENABLED"
    echo "✅ Initialized service directories:"
    echo "   Available: $TSM_SERVICES_AVAILABLE"
    echo "   Enabled:   $TSM_SERVICES_ENABLED"
}

# Audit service configurations
tsm_audit() {
    local show_details="${1:-false}"
    local issues=0

    echo "🔍 TSM Service Audit"
    echo "===================="

    # Check if directories exist
    if [[ ! -d "$TSM_SERVICES_AVAILABLE" ]]; then
        echo "❌ Services available directory missing: $TSM_SERVICES_AVAILABLE"
        issues=$((issues + 1))
    fi

    if [[ ! -d "$TSM_SERVICES_ENABLED" ]]; then
        echo "❌ Services enabled directory missing: $TSM_SERVICES_ENABLED"
        issues=$((issues + 1))
    fi

    if [[ $issues -gt 0 ]]; then
        echo ""
        echo "Run 'tsm audit init' to create missing directories"
        return $issues
    fi

    # Audit available services
    echo ""
    echo "📋 Available Services:"
    local available_count=0
    if [[ -d "$TSM_SERVICES_AVAILABLE" ]]; then
        for service_file in "$TSM_SERVICES_AVAILABLE"/*.tsm; do
            [[ -f "$service_file" ]] || continue
            local service_name=$(basename "$service_file" .tsm)
            available_count=$((available_count + 1))

            if [[ "$show_details" == "true" ]]; then
                echo "   📄 $service_name"
                _audit_service_file "$service_file"
            else
                echo "   📄 $service_name"
            fi
        done
    fi

    if [[ $available_count -eq 0 ]]; then
        echo "   (No services available)"
    fi

    # Audit enabled services
    echo ""
    echo "🚀 Enabled Services:"
    local enabled_count=0
    if [[ -d "$TSM_SERVICES_ENABLED" ]]; then
        for service_link in "$TSM_SERVICES_ENABLED"/*.tsm; do
            [[ -L "$service_link" ]] || continue
            local service_name=$(basename "$service_link" .tsm)
            local target=$(readlink "$service_link")
            enabled_count=$((enabled_count + 1))

            # Check if the symlink resolves correctly from its directory context
            local full_target_path="$TSM_SERVICES_ENABLED/$target"
            if [[ -f "$full_target_path" ]]; then
                echo "   ✅ $service_name → $target"
            else
                echo "   ❌ $service_name → $target (broken link)"
                issues=$((issues + 1))
            fi
        done
    fi

    if [[ $enabled_count -eq 0 ]]; then
        echo "   (No services enabled)"
    fi

    # Audit port conflicts
    echo ""
    echo "🔍 Port Audit:"
    _audit_ports

    # Summary
    echo ""
    if [[ $issues -eq 0 ]]; then
        echo "✅ Audit completed - no issues found"
        echo "   Available: $available_count services"
        echo "   Enabled: $enabled_count services"
    else
        echo "❌ Audit completed - $issues issues found"
    fi

    return $issues
}

# Audit individual service file
_audit_service_file() {
    local service_file="$1"
    local service_name=$(basename "$service_file" .tsm)

    # Check if file is executable
    if [[ ! -x "$service_file" ]]; then
        echo "      ⚠️  Not executable"
    fi

    # Check for required fields
    local has_name=false
    local has_command=false
    local port=""

    while IFS= read -r line; do
        if [[ "$line" =~ TSM_NAME= ]]; then
            has_name=true
        elif [[ "$line" =~ TSM_COMMAND= ]]; then
            has_command=true
        elif [[ "$line" =~ TSM_PORT= ]]; then
            port=$(echo "$line" | cut -d'=' -f2 | tr -d '"')
        fi
    done < "$service_file"

    if [[ "$has_name" == "false" ]]; then
        echo "      ❌ Missing TSM_NAME"
    fi

    if [[ "$has_command" == "false" ]]; then
        echo "      ❌ Missing TSM_COMMAND"
    fi

    if [[ -n "$port" ]]; then
        if tsm_is_ignored_port "$port"; then
            echo "      ⚠️  Using ignored port: $port"
        fi
    fi
}

# Audit port conflicts
_audit_ports() {
    local ports_used=()
    local conflicts=()

    # Collect ports from enabled services
    if [[ -d "$TSM_SERVICES_ENABLED" ]]; then
        for service_link in "$TSM_SERVICES_ENABLED"/*.tsm; do
            [[ -L "$service_link" ]] || continue
            local target=$(readlink "$service_link")
            [[ -f "$target" ]] || continue

            local port=""
            while IFS= read -r line; do
                if [[ "$line" =~ TSM_PORT= ]]; then
                    port=$(echo "$line" | cut -d'=' -f2 | tr -d '"')
                    break
                fi
            done < "$target"

            if [[ -n "$port" ]]; then
                local service_name=$(basename "$service_link" .tsm)

                # Check for conflicts
                for used_port in "${ports_used[@]}"; do
                    if [[ "$port" == "$used_port" ]]; then
                        conflicts+=("Port $port: conflict detected")
                    fi
                done

                ports_used+=("$port")

                # Check if port is ignored
                if tsm_is_ignored_port "$port"; then
                    echo "   ⚠️  $service_name using ignored port $port"
                else
                    echo "   ✅ $service_name using port $port"
                fi
            fi
        done
    fi

    # Report conflicts
    for conflict in "${conflicts[@]}"; do
        echo "   ❌ $conflict"
    done
}

# Enable a service (create symlink)
tsm_enable() {
    local service_name="$1"

    if [[ -z "$service_name" ]]; then
        echo "Usage: tsm enable <service-name>"
        return 1
    fi

    local available_file="$TSM_SERVICES_AVAILABLE/${service_name}.tsm"
    local enabled_link="$TSM_SERVICES_ENABLED/${service_name}.tsm"

    if [[ ! -f "$available_file" ]]; then
        echo "❌ Service not available: $service_name"
        echo "   Expected: $available_file"
        return 1
    fi

    if [[ -L "$enabled_link" ]]; then
        echo "⚠️  Service already enabled: $service_name"
        return 0
    fi

    ln -s "$available_file" "$enabled_link"
    echo "✅ Service enabled: $service_name"
}

# Disable a service (remove symlink)
tsm_disable() {
    local service_name="$1"

    if [[ -z "$service_name" ]]; then
        echo "Usage: tsm disable <service-name>"
        return 1
    fi

    local enabled_link="$TSM_SERVICES_ENABLED/${service_name}.tsm"

    if [[ ! -L "$enabled_link" ]]; then
        echo "⚠️  Service not enabled: $service_name"
        return 0
    fi

    rm "$enabled_link"
    echo "✅ Service disabled: $service_name"
}

# List available services in tabular format
tsm_list_available() {
    printf "%-3s %-20s %-10s %-5s %-5s %-8s %-3s %-8s\n" \
        "ID" "Name" "Env" "PID" "Port" "Status" "↻" "Uptime"
    printf "%-3s %-20s %-10s %-5s %-5s %-8s %-3s %-8s\n" \
        "--" "--------------------" "----------" "-----" "-----" "--------" "---" "--------"

    local id=0
    if [[ -d "$TSM_SERVICES_AVAILABLE" ]]; then
        for service_file in "$TSM_SERVICES_AVAILABLE"/*.tsm; do
            [[ -f "$service_file" ]] || continue

            local service_name=$(basename "$service_file" .tsm)
            local env_file=""
            local port=""
            local pid=""
            local status="stopped"
            local restarts="-"
            local uptime="-"

            # Parse service file
            while IFS= read -r line; do
                if [[ "$line" =~ TSM_ENV_FILE= ]]; then
                    env_file=$(echo "$line" | cut -d'=' -f2 | tr -d '"' | xargs basename 2>/dev/null || echo "-")
                elif [[ "$line" =~ TSM_PORT= ]]; then
                    port=$(echo "$line" | cut -d'=' -f2 | tr -d '"')
                fi
            done < "$service_file"

            # Check if service is running
            local process_file="$TSM_PROCESSES_DIR/${service_name}.meta"
            if [[ -f "$process_file" ]]; then
                pid=$(grep -o "pid=[0-9]*" "$process_file" 2>/dev/null | cut -d'=' -f2)

                if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
                    status="online"

                    # Calculate uptime
                    if [[ -n "$pid" ]]; then
                        local start_time
                        if command -v ps >/dev/null 2>&1; then
                            # Get process start time
                            start_time=$(ps -o lstart= -p "$pid" 2>/dev/null | xargs)
                            if [[ -n "$start_time" ]]; then
                                # Convert to epoch and calculate uptime
                                local start_epoch=$(date -j -f "%a %b %d %H:%M:%S %Y" "$start_time" "+%s" 2>/dev/null || echo "")
                                if [[ -n "$start_epoch" ]]; then
                                    local current_epoch=$(date "+%s")
                                    local uptime_seconds=$((current_epoch - start_epoch))

                                    # Format uptime
                                    if [[ $uptime_seconds -lt 60 ]]; then
                                        uptime="${uptime_seconds}s"
                                    elif [[ $uptime_seconds -lt 3600 ]]; then
                                        uptime="$((uptime_seconds / 60))m"
                                    elif [[ $uptime_seconds -lt 86400 ]]; then
                                        uptime="$((uptime_seconds / 3600))h"
                                    else
                                        uptime="$((uptime_seconds / 86400))d"
                                    fi
                                fi
                            fi
                        fi
                    fi

                    # Get restart count if available
                    local restart_count=$(grep -o "restarts=[0-9]*" "$process_file" 2>/dev/null | cut -d'=' -f2 || echo "0")
                    restarts="$restart_count"
                else
                    pid="-"
                fi
            else
                pid="-"
            fi

            # Default values
            [[ -z "$env_file" ]] && env_file="-"
            [[ -z "$port" ]] && port="-"

            # Print formatted row
            printf "%-3s %-20s %-10s %-5s %-5s %-8s %-3s %-8s\n" \
                "$id" "$service_name" "$env_file" "$pid" "$port" "$status" "$restarts" "$uptime"

            id=$((id + 1))
        done
    fi

    if [[ $id -eq 0 ]]; then
        echo ""
        echo "No services available. Create services in $TSM_SERVICES_AVAILABLE"
    fi
}

# List available and enabled services (original function)
tsm_list() {
    echo "Available services:"
    if [[ -d "$TSM_SERVICES_AVAILABLE" ]]; then
        for service_file in "$TSM_SERVICES_AVAILABLE"/*.tsm; do
            [[ -f "$service_file" ]] || continue
            local service_name=$(basename "$service_file" .tsm)
            echo "  📄 $service_name"
        done
    fi

    echo ""
    echo "Enabled services:"
    if [[ -d "$TSM_SERVICES_ENABLED" ]]; then
        for service_link in "$TSM_SERVICES_ENABLED"/*.tsm; do
            [[ -L "$service_link" ]] || continue
            local service_name=$(basename "$service_link" .tsm)
            echo "  ✅ $service_name"
        done
    fi
}

# Note: Auto-execution removed - functions only defined, not executed on source
# Use: tsm audit [command] to run audit functions explicitly