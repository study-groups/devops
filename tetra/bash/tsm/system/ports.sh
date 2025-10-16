#!/usr/bin/env bash

# TSM Named Port Registry with Persistent Configuration
# Establishes standard port assignments for known services

# Load TOML parser (deferred to avoid loading issues)
_tsm_ports_load_toml_parser() {
    if [[ -f "${TETRA_SRC}/bash/utils/toml_parser.sh" ]]; then
        source "${TETRA_SRC}/bash/utils/toml_parser.sh"
    fi
}

# Configuration file location
TSM_PORTS_CONFIG="${TETRA_DIR}/config/ports.toml"

# Named port registry - global associative array
if ! declare -p TSM_NAMED_PORTS >/dev/null 2>&1; then
    declare -gA TSM_NAMED_PORTS
fi

# Port allocation settings
declare -gA TSM_PORT_ALLOCATION
declare -gA TSM_PORT_RANGES
declare -ga TSM_RESERVED_PORTS

# Load port configuration from TOML file
_tsm_load_port_config() {
    # Ensure config directory exists
    mkdir -p "$(dirname "$TSM_PORTS_CONFIG")"

    # Create default config if it doesn't exist
    if [[ ! -f "$TSM_PORTS_CONFIG" ]]; then
        _tsm_create_default_port_config
    fi

    # Parse TOML configuration
    if toml_parse "$TSM_PORTS_CONFIG" "TSM_CONFIG"; then
        # Load named ports
        TSM_NAMED_PORTS=()
        if declare -p TSM_CONFIG_ports >/dev/null 2>&1; then
            local -n ports_section=TSM_CONFIG_ports
            for service in "${!ports_section[@]}"; do
                TSM_NAMED_PORTS["$service"]="${ports_section[$service]}"
            done
        fi

        # Load port ranges
        TSM_PORT_RANGES=()
        if declare -p TSM_CONFIG_port_ranges >/dev/null 2>&1; then
            local -n ranges_section=TSM_CONFIG_port_ranges
            for env in "${!ranges_section[@]}"; do
                TSM_PORT_RANGES["$env"]="${ranges_section[$env]}"
            done
        fi

        # Load allocation settings
        TSM_PORT_ALLOCATION=()
        if declare -p TSM_CONFIG_allocation >/dev/null 2>&1; then
            local -n allocation_section=TSM_CONFIG_allocation
            for setting in "${!allocation_section[@]}"; do
                TSM_PORT_ALLOCATION["$setting"]="${allocation_section[$setting]}"
            done
        fi

        # Load reserved ports
        TSM_RESERVED_PORTS=()
        if declare -p TSM_CONFIG_reserved >/dev/null 2>&1; then
            local -n reserved_section=TSM_CONFIG_reserved
            for category in "${!reserved_section[@]}"; do
                local ports="${reserved_section[$category]}"
                # Split space-separated ports
                for port in $ports; do
                    TSM_RESERVED_PORTS+=("$port")
                done
            done
        fi

        return 0
    else
        echo "Warning: Failed to load port configuration from $TSM_PORTS_CONFIG" >&2
        _tsm_load_fallback_ports
        return 1
    fi
}

# Create default port configuration
_tsm_create_default_port_config() {
    cat > "$TSM_PORTS_CONFIG" <<'EOF'
# TSM Named Port Registry Configuration
# This file defines standard port assignments for known services

[metadata]
version = "1.0"
last_updated = "2025-09-21T00:00:00Z"
auto_updated = true

[ports]
# Development services
devpages = 4000
tetra = 4444
arcade = 8400
pbase = 2600

[port_ranges]
# Environment-specific port ranges
development = "3000-3999"
staging = "4000-4999"
production = "5000-5999"
testing = "6000-6999"

[allocation]
# Automatic port allocation settings
auto_allocate = true
allocation_strategy = "sequential"
avoid_system_ports = true
min_port = 3000
max_port = 9999

[conflicts]
# Port conflict resolution settings
check_on_start = true
auto_resolve = false
prefer_named_services = true

[reserved]
# Reserved ports that should not be allocated
system = "22 80 443 3306 5432 6379 27017"
development = "3000 8080 9000"
EOF
}

# Fallback to hardcoded ports if config loading fails
_tsm_load_fallback_ports() {
    TSM_NAMED_PORTS["devpages"]="4000"
    TSM_NAMED_PORTS["tetra"]="4444"
    TSM_NAMED_PORTS["arcade"]="8400"
    TSM_NAMED_PORTS["pbase"]="2600"
}

# Save current port configuration to TOML file
_tsm_save_port_config() {
    # Update timestamp
    toml_set "metadata" "last_updated" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "TSM_CONFIG"

    # Update ports section
    for service in "${!TSM_NAMED_PORTS[@]}"; do
        toml_set "ports" "$service" "${TSM_NAMED_PORTS[$service]}" "TSM_CONFIG"
    done

    # Write back to file
    if toml_write "$TSM_PORTS_CONFIG" "TSM_CONFIG"; then
        return 0
    else
        echo "Error: Failed to save port configuration to $TSM_PORTS_CONFIG" >&2
        return 1
    fi
}

# Initialize port configuration on module load
_tsm_load_port_config

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
        "detailed")
            printf "%-15s %-8s %s\n" "SERVICE" "PORT" "DATA SOURCE"
            printf "%-15s %-8s %s\n" "-------" "----" "-----------"
            echo "# Port data stored in: $TSM_PORTS_CONFIG"
            echo "# Last updated: $(stat -f "%Sm" "$TSM_PORTS_CONFIG" 2>/dev/null || echo "unknown")"
            echo
            for service in "${!TSM_NAMED_PORTS[@]}"; do
                local port="${TSM_NAMED_PORTS[$service]}"
                local source="ports.toml"
                if [[ -z "$port" ]]; then
                    port="(not set)"
                    source="not configured"
                fi
                printf "%-15s %-8s %s\n" "$service" "$port" "$source"
            done | sort

            # Also show services that might exist but don't have ports configured
            echo
            echo "# Configuration file location: $TSM_PORTS_CONFIG"
            if [[ -f "$TSM_PORTS_CONFIG" ]]; then
                echo "# File exists: ✅"
                echo "# File permissions: $(ls -l "$TSM_PORTS_CONFIG" | cut -d' ' -f1)"
            else
                echo "# File exists: ❌ (will be created on first port assignment)"
            fi
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
            echo "Supported formats: table, detailed, env, json" >&2
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

    # Check if port is reserved
    if _tsm_is_port_reserved "$port"; then
        echo "ERROR: Port $port is reserved and cannot be assigned" >&2
        return 1
    fi

    # Check if port is already assigned to another service
    local existing_owner=$(tsm_get_port_owner "$port")
    if [[ -n "$existing_owner" && "$existing_owner" != "$service" ]]; then
        echo "ERROR: Port $port is already assigned to $existing_owner" >&2
        return 1
    fi

    # Update in-memory registry
    TSM_NAMED_PORTS["$service"]="$port"

    # Persist to configuration file
    if _tsm_save_port_config; then
        echo "Set $service port to $port (saved to config)"
    else
        echo "Set $service port to $port (WARNING: failed to save to config)" >&2
    fi
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

        # Remove from in-memory registry
        unset TSM_NAMED_PORTS["$service"]

        # Remove from configuration file
        if toml_set "ports" "$service" "" "TSM_CONFIG" && _tsm_save_port_config; then
            echo "Removed $service (was using port $port, saved to config)"
        else
            echo "Removed $service (was using port $port, WARNING: failed to save to config)" >&2
        fi
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

    echo "📋 Named Port Registry Status:"
    echo
    printf "%-15s %-6s %-10s %-8s %-10s %-15s %-20s\n" "SERVICE" "PORT" "STATUS" "ENABLED" "PID" "TSM_STATUS" "PROCESS"
    printf "%-15s %-6s %-10s %-8s %-10s %-15s %-20s\n" "-------" "----" "------" "-------" "---" "----------" "-------"

    for service in "${!TSM_NAMED_PORTS[@]}"; do
        local port="${TSM_NAMED_PORTS[$service]}"

        # Skip empty ports
        if [[ -z "$port" ]]; then
            continue
        fi

        local pid=$(lsof -ti :$port 2>/dev/null)
        local status_color=""
        local status=""
        local process=""
        local tsm_status=""
        local enabled_status=""

        # Check port availability
        if [[ -n "$pid" ]]; then
            status="🔴 USED"
            status_color="\033[0;31m"
            local full_process=$(ps -p $pid -o comm= 2>/dev/null || echo "unknown")

            # Shorten process name: first 5 chars + "..." + last 15 chars
            if [[ ${#full_process} -gt 23 ]]; then
                process="${full_process:0:5}...${full_process: -15}"
            else
                process="$full_process"
            fi
        else
            status="🟢 FREE"
            status_color="\033[0;32m"
            process="-"
            pid="-"
        fi

        # Check if service is enabled for auto-start
        if command -v tsm >/dev/null 2>&1; then
            if tsm services 2>/dev/null | grep -q "$service.*✅"; then
                enabled_status="✅ YES"
            elif tsm services 2>/dev/null | grep -q "$service.*⚪"; then
                enabled_status="⚪ NO"
            else
                enabled_status="❓ N/A"
            fi

            # Check if service is running in TSM
            if tsm list 2>/dev/null | grep -q "$service"; then
                tsm_status="🚀 RUNNING"
            else
                tsm_status="⏹️  STOPPED"
            fi
        else
            enabled_status="❓ N/A"
            tsm_status="❓ N/A"
        fi

        printf "%-15s %-6s ${status_color}%-10s\033[0m %-8s %-10s %-15s %-20s\n" \
            "$service" "$port" "$status" "$enabled_status" "$pid" "$tsm_status" "$process"
    done | sort

    if [[ "$show_all" == "true" ]]; then
        echo
        echo "📊 All Development Ports:"
        tetra_tsm_doctor scan 2>/dev/null || {
            echo "Note: Run 'tsm doctor scan' for full port scan"
        }
    fi
}

# Enhanced ports overview combining named ports and services
tsm_ports_overview() {
    echo "🔍 TSM Ports & Services Overview"
    echo "================================="
    echo

    # Show named ports status
    tsm_scan_named_ports false

    echo
    echo "📋 Service Configuration Summary:"
    echo

    # Show services and their status
    if command -v tsm >/dev/null 2>&1; then
        local services_output
        services_output=$(tsm services 2>/dev/null)

        if [[ -n "$services_output" ]]; then
            echo "$services_output"
        else
            echo "No services configured"
        fi
    else
        echo "TSM command not available"
    fi

    echo
    echo "💡 Legend:"
    echo "  🟢 FREE - Port available for use"
    echo "  🔴 USED - Port currently in use"
    echo "  ✅ YES - Service enabled for auto-start"
    echo "  ⚪ NO  - Service disabled for auto-start"
    echo "  🚀 RUNNING - Service currently managed by TSM"
    echo "  ⏹️  STOPPED - Service not currently running in TSM"
}

# === DOUBLE-ENTRY PORT ACCOUNTING (merged from core/ports_double.sh) ===

# Initialize port registry (TSV format for reconciliation)
tsm_init_port_registry() {
    local registry="$TSM_PORTS_DIR/registry.tsv"
    mkdir -p "$(dirname "$registry")"

    if [[ ! -f "$registry" ]]; then
        echo -e "tsm_id\tname\tdeclared_port\tactual_port\tpid\ttimestamp" > "$registry"
    fi
}

# Register declared port
tsm_register_port() {
    local tsm_id="$1"
    local name="$2"
    local declared_port="$3"
    local pid="$4"

    local registry="$TSM_PORTS_DIR/registry.tsv"
    tsm_init_port_registry

    echo -e "$tsm_id\t$name\t$declared_port\tnone\t$pid\t$(date +%s)" >> "$registry"
}

# Update actual scanned port
tsm_update_actual_port() {
    local tsm_id="$1"
    local actual_port="$2"

    local registry="$TSM_PORTS_DIR/registry.tsv"
    [[ ! -f "$registry" ]] && return 1

    local tmp="${registry}.tmp"

    awk -v id="$tsm_id" -v port="$actual_port" '
        BEGIN {FS=OFS="\t"}
        NR==1 {print; next}
        $1==id {$4=port}
        {print}
    ' "$registry" > "$tmp" && mv "$tmp" "$registry"
}

# Deregister port when process stops
tsm_deregister_port() {
    local tsm_id="$1"

    local registry="$TSM_PORTS_DIR/registry.tsv"
    [[ ! -f "$registry" ]] && return 0

    local tmp="${registry}.tmp"

    awk -v id="$tsm_id" 'BEGIN {FS=OFS="\t"} NR==1 || $1!=id {print}' "$registry" > "$tmp" && mv "$tmp" "$registry"
}

# Scan actual listening ports
tsm_scan_actual_ports() {
    if command -v lsof >/dev/null 2>&1; then
        lsof -iTCP -sTCP:LISTEN -n -P 2>/dev/null | awk 'NR>1 {print $2, $9}' | sed 's/.*://' | sed 's/\*://' | grep -E '^[0-9]+ [0-9]+$'
    else
        netstat -tlnp 2>/dev/null | awk '/LISTEN/ {print $7, $4}' | sed 's/\// /' | sed 's/.*://' | grep -E '^[0-9]+ [0-9]+$'
    fi
}

# Reconcile declared vs actual ports
tsm_reconcile_ports() {
    echo "🔍 Port Accounting Reconciliation"
    echo "=================================="

    local registry="$TSM_PORTS_DIR/registry.tsv"
    if [[ ! -f "$registry" ]]; then
        echo "No port registry found"
        return 0
    fi

    declare -A tsm_by_pid
    declare -A tsm_by_port

    while IFS=$'\t' read -r tsm_id name declared_port actual_port pid timestamp; do
        [[ "$tsm_id" == "tsm_id" ]] && continue
        tsm_by_pid[$pid]="$tsm_id:$name:$declared_port:$actual_port"
        [[ "$declared_port" != "none" ]] && tsm_by_port[$declared_port]="$tsm_id:$name:$pid"
    done < "$registry"

    declare -A actual_ports
    while read -r pid port; do
        actual_ports[$pid]=$port
    done < <(tsm_scan_actual_ports)

    local correct=0 mismatches=0 orphans=0

    echo ""
    echo "📊 TSM-Managed Processes:"
    for pid in "${!tsm_by_pid[@]}"; do
        IFS=':' read -r tsm_id name declared_port stored_actual <<< "${tsm_by_pid[$pid]}"
        local actual_port="${actual_ports[$pid]:-none}"

        if [[ "$declared_port" == "$actual_port" ]]; then
            echo "  ✅ TSM ID $tsm_id: $name (port=$actual_port)"
            ((correct++))
        elif [[ "$declared_port" == "none" && "$actual_port" == "none" ]]; then
            echo "  ✅ TSM ID $tsm_id: $name (no port)"
            ((correct++))
        elif [[ "$actual_port" == "none" ]]; then
            echo "  ⚠️  TSM ID $tsm_id: $name - DECLARED port $declared_port but NOTHING listening"
            ((mismatches++))
        else
            echo "  ❌ TSM ID $tsm_id: $name - PORT MISMATCH (declared=$declared_port, actual=$actual_port)"
            ((mismatches++))
        fi
    done

    echo ""
    echo "🔓 System Ports Not in TSM Registry:"
    for pid in "${!actual_ports[@]}"; do
        if [[ -z "${tsm_by_pid[$pid]:-}" ]]; then
            local port="${actual_ports[$pid]}"
            local cmd=$(ps -p "$pid" -o comm= 2>/dev/null || echo "unknown")
            echo "  🔓 PID $pid: $cmd listening on port $port (not managed by TSM)"
            ((orphans++))
        fi
    done

    echo ""
    echo "📈 Summary: ✅ Correct: $correct | ❌ Mismatches: $mismatches | 🔓 Orphan ports: $orphans"

    [[ $mismatches -eq 0 ]]
}

# Export unified functions
export -f tsm_get_named_port
export -f tsm_get_port_owner
export -f tsm_list_named_ports
export -f tsm_validate_port_registry
export -f tsm_set_named_port
export -f tsm_remove_named_port
export -f tsm_resolve_service_port
export -f tsm_scan_named_ports
export -f tsm_ports_overview
export -f tsm_init_port_registry
export -f tsm_register_port
export -f tsm_update_actual_port
export -f tsm_deregister_port
export -f tsm_scan_actual_ports
export -f tsm_reconcile_ports

# Check if a port is reserved
_tsm_is_port_reserved() {
    local port="$1"

    for reserved_port in "${TSM_RESERVED_PORTS[@]}"; do
        if [[ "$reserved_port" == "$port" ]]; then
            return 0
        fi
    done
    return 1
}

# Automatic port allocation
tsm_allocate_port() {
    local service="$1"
    local environment="${2:-development}"
    local strategy="${TSM_PORT_ALLOCATION[allocation_strategy]:-sequential}"

    if [[ -z "$service" ]]; then
        echo "Usage: tsm_allocate_port <service> [environment]" >&2
        return 1
    fi

    # Check if service already has a port
    if [[ -n "${TSM_NAMED_PORTS[$service]}" ]]; then
        echo "Service $service already has port ${TSM_NAMED_PORTS[$service]}" >&2
        return 1
    fi

    # Get port range for environment
    local port_range="${TSM_PORT_RANGES[$environment]}"
    if [[ -z "$port_range" ]]; then
        echo "No port range defined for environment: $environment" >&2
        return 1
    fi

    # Parse port range (e.g., "3000-3999")
    local min_port max_port
    if [[ "$port_range" =~ ^([0-9]+)-([0-9]+)$ ]]; then
        min_port="${BASH_REMATCH[1]}"
        max_port="${BASH_REMATCH[2]}"
    else
        echo "Invalid port range format: $port_range" >&2
        return 1
    fi

    # Find available port based on strategy
    local allocated_port
    case "$strategy" in
        "sequential")
            allocated_port=$(_tsm_find_sequential_port "$min_port" "$max_port")
            ;;
        "random")
            allocated_port=$(_tsm_find_random_port "$min_port" "$max_port")
            ;;
        *)
            echo "Unknown allocation strategy: $strategy" >&2
            return 1
            ;;
    esac

    if [[ -n "$allocated_port" ]]; then
        tsm_set_named_port "$service" "$allocated_port"
        echo "Allocated port $allocated_port to $service"
        return 0
    else
        echo "No available ports in range $port_range for environment $environment" >&2
        return 1
    fi
}

# Find next available port sequentially
_tsm_find_sequential_port() {
    local min_port="$1"
    local max_port="$2"

    for ((port = min_port; port <= max_port; port++)); do
        if _tsm_is_port_available "$port"; then
            echo "$port"
            return 0
        fi
    done
    return 1
}

# Find available port randomly
_tsm_find_random_port() {
    local min_port="$1"
    local max_port="$2"
    local attempts=100

    for ((i = 0; i < attempts; i++)); do
        local port=$(( min_port + RANDOM % (max_port - min_port + 1) ))
        if _tsm_is_port_available "$port"; then
            echo "$port"
            return 0
        fi
    done
    return 1
}

# Check if port is available for allocation
_tsm_is_port_available() {
    local port="$1"

    # Check if reserved
    if _tsm_is_port_reserved "$port"; then
        return 1
    fi

    # Check if already assigned to a service
    if tsm_get_port_owner "$port" >/dev/null 2>&1; then
        return 1
    fi

    # Check if currently in use by a process
    if lsof -ti ":$port" >/dev/null 2>&1; then
        return 1
    fi

    return 0
}

# Import port configuration
tsm_import_ports() {
    local import_file="$1"

    if [[ -z "$import_file" ]]; then
        echo "Usage: tsm_import_ports <file.toml>" >&2
        return 1
    fi

    if [[ ! -f "$import_file" ]]; then
        echo "Import file not found: $import_file" >&2
        return 1
    fi

    # Backup current config
    local backup_file="${TSM_PORTS_CONFIG}.backup.$(date +%s)"
    if [[ -f "$TSM_PORTS_CONFIG" ]]; then
        cp "$TSM_PORTS_CONFIG" "$backup_file"
        echo "Created backup: $backup_file"
    fi

    # Copy import file to config location
    if cp "$import_file" "$TSM_PORTS_CONFIG"; then
        echo "Imported port configuration from $import_file"
        # Reload configuration
        _tsm_load_port_config
        echo "Port registry reloaded"
        return 0
    else
        echo "Failed to import configuration from $import_file" >&2
        return 1
    fi
}

# Export port configuration
tsm_export_ports() {
    local export_file="$1"
    local format="${2:-toml}"

    if [[ -z "$export_file" ]]; then
        echo "Usage: tsm_export_ports <file> [format]" >&2
        echo "Formats: toml, json, env" >&2
        return 1
    fi

    case "$format" in
        "toml")
            if cp "$TSM_PORTS_CONFIG" "$export_file"; then
                echo "Exported port configuration to $export_file (TOML format)"
            else
                echo "Failed to export configuration" >&2
                return 1
            fi
            ;;
        "json")
            tsm_list_named_ports json > "$export_file"
            echo "Exported port configuration to $export_file (JSON format)"
            ;;
        "env")
            tsm_list_named_ports env > "$export_file"
            echo "Exported port configuration to $export_file (environment format)"
            ;;
        *)
            echo "Unknown export format: $format" >&2
            echo "Supported formats: toml, json, env" >&2
            return 1
            ;;
    esac
}

# Enhanced conflict detection and resolution
tsm_detect_conflicts() {
    local fix_conflicts="${1:-false}"

    echo "Scanning for port conflicts..."
    echo

    local conflicts_found=0

    # Check for processes using named ports
    for service in "${!TSM_NAMED_PORTS[@]}"; do
        local port="${TSM_NAMED_PORTS[$service]}"
        local existing_pid=$(lsof -ti ":$port" 2>/dev/null)

        if [[ -n "$existing_pid" ]]; then
            local process_cmd=$(ps -p "$existing_pid" -o args= 2>/dev/null | head -c 60 || echo "unknown")
            echo "CONFLICT: Port $port (assigned to $service) is in use by PID $existing_pid"
            echo "  Process: $process_cmd"

            if [[ "$fix_conflicts" == "true" ]]; then
                echo -n "  Kill process $existing_pid? (y/N): "
                read -r response
                if [[ "$response" =~ ^[Yy]$ ]]; then
                    if kill "$existing_pid" 2>/dev/null; then
                        echo "  ✅ Killed process $existing_pid"
                    else
                        echo "  ❌ Failed to kill process $existing_pid"
                    fi
                fi
            fi

            conflicts_found=$((conflicts_found + 1))
            echo
        fi
    done

    if [[ $conflicts_found -eq 0 ]]; then
        echo "✅ No port conflicts found"
    else
        echo "⚠️  Found $conflicts_found port conflict(s)"
        if [[ "$fix_conflicts" != "true" ]]; then
            echo "Run 'tsm ports conflicts --fix' to resolve conflicts interactively"
        fi
    fi

    return $conflicts_found
}

# Export additional functions
export -f tsm_allocate_port tsm_import_ports tsm_export_ports tsm_detect_conflicts
export -f _tsm_is_port_reserved _tsm_is_port_available
export -f _tsm_find_sequential_port _tsm_find_random_port

# Auto-validate on source
if ! tsm_validate_port_registry >/dev/null 2>&1; then
    echo "WARNING: TSM named port registry has validation errors" >&2
    echo "Run 'tsm ports validate' to see details" >&2
fi