#!/bin/bash
# Systemd Data Collection and Reporting

command_exists() {
    command -v "$1" &> /dev/null
}

# List of common/standard system services to ignore in default reports
# These are typically system services that are expected to be running
SYSTEMD_IGNORE_LIST=(
    "systemd-.*"
    ".*\.mount"
    ".*\.swap" 
    "ssh\.service"
    "sshd\.service"
    "NetworkManager\.service"
    "dbus\.service"
    "systemd-logind\.service"
    "systemd-resolved\.service"
    "systemd-timesyncd\.service"
    "systemd-networkd\.service"
    "systemd-journald\.service"
    "systemd-udevd\.service"
    "accounts-daemon\.service"
    "avahi-daemon\.service"
    "bluetooth\.service"
    "cron\.service"
    "rsyslog\.service"
    "ufw\.service"
    "unattended-upgrades\.service"
    "polkit\.service"
    "udisks2\.service"
    "packagekit\.service"
    "snapd\.service"
    "NetworkManager-wait-online\.service"
    "getty@.*\.service"
    "user@.*\.service"
    "session-.*\.scope"
)

# Check if a service should be ignored based on the ignore list
should_ignore_service() {
    local service_name="$1"
    local ignore_filtered="${2:-false}"
    
    # If ignore_filtered is true, don't filter anything (show all services)
    if [ "$ignore_filtered" = "true" ]; then
        return 1  # Don't ignore
    fi
    
    # Check against ignore patterns
    for pattern in "${SYSTEMD_IGNORE_LIST[@]}"; do
        if [[ "$service_name" =~ ^${pattern}$ ]]; then
            return 0  # Should ignore
        fi
    done
    return 1  # Don't ignore
}

# Pre-fetches all listening port data to avoid repeated slow calls.
cache_listening_ports() {
    local CACHE_FILE="$TEMP_DIR/listening_ports.ss"
    if [ -f "$CACHE_FILE" ]; then return; fi # Already cached

    # Prefer ss for its structured output, fallback to netstat.
    if command_exists ss; then
        ss -tulnp > "$CACHE_FILE"
    elif command_exists netstat; then
        netstat -tulnp > "$CACHE_FILE"
    else
        touch "$CACHE_FILE" # Create empty file if no tool is available
    fi
}

# Collects systemd service data using the cached port info.
collect_systemd_data() {
    local ignore_filtered="${1:-false}"
    if ! command_exists systemctl; then return; fi
    cache_listening_ports # Ensure port data is cached

    local CACHE_FILE="$TEMP_DIR/listening_ports.ss"
    if [ ! -s "$CACHE_FILE" ]; then return; fi # Cache is empty

    systemctl list-units --type=service --state=running --no-pager --no-legend --plain | awk '{print $1}' | while read -r service_unit; do
        if [ -z "$service_unit" ]; then continue; fi
        
        # Skip services in ignore list unless we're showing all details
        if should_ignore_service "$service_unit" "$ignore_filtered"; then
            continue
        fi

        local main_pid
        main_pid=$(systemctl show "$service_unit" -p MainPID --value 2>/dev/null)

        if [ -n "$main_pid" ] && [ "$main_pid" -gt 0 ]; then
            # Get all PIDs in the process tree (main PID + all descendants)
            local all_pids
            if command_exists pstree; then
                # Use pstree to find all child processes
                all_pids=$(pstree -p "$main_pid" 2>/dev/null | grep -oE '\([0-9]+\)' | tr -d '()')
            else
                # Fallback: use ps to find direct children only
                all_pids=$(ps --ppid "$main_pid" -o pid --no-headers 2>/dev/null | xargs)
                all_pids="$main_pid $all_pids"
            fi
            
            # Check each PID for listening ports
            for pid in $all_pids; do
                grep "pid=$pid," "$CACHE_FILE" | \
                awk -v service="$service_unit" '
                {
                    # Extract address and port, compatible with both ss and netstat
                    # For ss: field 5 is local address, for netstat: field 4 is local address
                    listen_addr = ($1 == "tcp" || $1 == "udp") ? $5 : $4;
                    # Handle both IPv4 and IPv6 addresses properly

                    # Use gsub to extract port from both [::1]:4400 and 0.0.0.0:4400 formats
                    if (listen_addr ~ /]:.*/) {
                        # IPv6 format like [::1]:4400 - extract everything after ]:
                        gsub(/.*]:/, "", listen_addr);
                        port = listen_addr;
                    } else {
                        # IPv4 format - split on : and take last part
                        split(listen_addr, addr_parts, ":");
                        port = addr_parts[length(addr_parts)];
                    }
                    if (port ~ /^[0-9]+$/) {
                        print port, "systemd", "listen", service
                    }
                }' | while read -r port svc action details; do
                    add_port_info "$port" "$svc" "$action" "$details"
                done
            done
        fi
    done
}

# Generates a summary report of running systemd services.
generate_systemd_summary() {
    local ignore_filtered="${1:-false}"
    if ! command_exists systemctl; then return; fi
    echo ""
    if [ "$ignore_filtered" = "true" ]; then
        echo "Systemd Service Summary (All Services)"
    else
        echo "Systemd Service Summary (Filtered)"
    fi
    echo "-----------------------"
    
    if [ "$ignore_filtered" = "true" ]; then
        # Show all services
        systemctl list-units --type=service --state=running --no-pager
    else
        # Filter out common services
        systemctl list-units --type=service --state=running --no-pager --no-legend --plain | while read -r service_unit rest; do
            if [ -z "$service_unit" ]; then continue; fi
            
            # Skip services in ignore list
            if should_ignore_service "$service_unit" "$ignore_filtered"; then
                continue
            fi
            
            echo "$service_unit $rest"
        done
    fi
}

# Generates a detailed report of running systemd services and their ports.
generate_systemd_detailed() {
    local ignore_filtered="${1:-false}"
    if ! command_exists systemctl; then
        echo "systemctl command not found."
        return
    fi
    cache_listening_ports # Ensure port data is cached
    local CACHE_FILE="$TEMP_DIR/listening_ports.ss"
    
    echo ""
    if [ "$ignore_filtered" = "true" ]; then
        echo "Detailed Systemd Service Analysis (All Services)"
    else
        echo "Detailed Systemd Service Analysis (Filtered)"
    fi
    echo "================================="

    systemctl list-units --type=service --state=running --no-pager --no-legend --plain | awk '{print $1}' | while read -r service_unit; do
        if [ -z "$service_unit" ]; then continue; fi
        
        # Skip services in ignore list unless we're showing all details
        if should_ignore_service "$service_unit" "$ignore_filtered"; then
            continue
        fi

        local props main_pid user exec_start exec_path exec_args
        props=$(systemctl show "$service_unit" --no-pager --property=User --property=MainPID --property=ExecStart 2>/dev/null)
        
        main_pid=$(echo "$props" | grep '^MainPID=' | cut -d= -f2-)
        user=$(echo "$props" | grep '^User=' | cut -d= -f2-)
        exec_start=$(echo "$props" | grep '^ExecStart=' | cut -d= -f2-)
        
        # Extract path and args from ExecStart
        exec_path=$(echo "$exec_start" | sed -n 's/^{ path=\([^ ;]*\).*$/\1/p')
        exec_args=$(echo "$exec_start" | sed -n 's/.*argv\[\]=\([^;]*\).*$/\1/p' | sed 's/;//')

        echo "Service: $service_unit:$main_pid"
        
        local ports_info=""
        if [ -n "$main_pid" ] && [ "$main_pid" -gt 0 ] && [ -s "$CACHE_FILE" ]; then
            # Get all PIDs in the process tree (main PID + all descendants)
            local all_pids
            if command_exists pstree; then
                # Use pstree to find all child processes
                all_pids=$(pstree -p "$main_pid" 2>/dev/null | grep -oE '\([0-9]+\)' | tr -d '()')
            else
                # Fallback: use ps to find direct children only
                all_pids=$(ps --ppid "$main_pid" -o pid --no-headers 2>/dev/null | xargs)
                all_pids="$main_pid $all_pids"
            fi
            
            # Check each PID for listening ports and collect them
            for pid in $all_pids; do
                if grep -q "pid=$pid," "$CACHE_FILE"; then
                    local pid_ports
                    pid_ports=$(grep "pid=$pid," "$CACHE_FILE" | awk '{
                        # For ss: field 5 is local address, for netstat: field 4 is local address
                        listen_addr = ($1 == "tcp" || $1 == "udp") ? $5 : $4;
                        # Handle both IPv4 and IPv6 addresses properly
                        if (listen_addr ~ /]:.*/) {
                            # IPv6 format like [::1]:4400 - extract everything after ]:
                            gsub(/.*]:/, "", listen_addr);
                            port = listen_addr;
                        } else {
                            # IPv4 format - split on : and take last part
                            split(listen_addr, addr_parts, ":");
                            port = addr_parts[length(addr_parts)];
                        }
                        if (port ~ /^[0-9]+$/) printf "%s ", port
                    }' | xargs)
                    if [ -n "$pid_ports" ]; then
                        ports_info="$ports_info $pid_ports"
                    fi
                fi
            done
            ports_info=$(echo "$ports_info" | xargs)  # Clean up extra spaces
        fi
        
        echo "  ${user:-<no_user>}:${ports_info:-<no_port>}"
        echo "  ${exec_path:-<no_path>}:${exec_args:-<no_args>}"
        echo ""
    done
} 