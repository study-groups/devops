#!/bin/bash
# Systemd Data Collection and Reporting

command_exists() {
    command -v "$1" &> /dev/null
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
    if ! command_exists systemctl; then return; fi
    cache_listening_ports # Ensure port data is cached

    local CACHE_FILE="$TEMP_DIR/listening_ports.ss"
    if [ ! -s "$CACHE_FILE" ]; then return; fi # Cache is empty

    systemctl list-units --type=service --state=running --no-pager --no-legend --plain | awk '{print $1}' | while read -r service_unit; do
        if [ -z "$service_unit" ]; then continue; fi

        local main_pid
        main_pid=$(systemctl show "$service_unit" -p MainPID --value 2>/dev/null)

        if [ -n "$main_pid" ] && [ "$main_pid" -gt 0 ]; then
            # Grep the cache for this PID to get listening port lines
            grep "pid=$main_pid," "$CACHE_FILE" | \
            awk -v service="$service_unit" '
            {
                # Extract address and port, compatible with both ss and netstat
                listen_addr = ($1 == "tcp" || $1 == "udp") ? $4 : $5;
                split(listen_addr, addr_parts, ":");
                port = addr_parts[length(addr_parts)];
                if (port ~ /^[0-9]+$/) {
                    print port, "systemd", "listen", service
                }
            }' | while read -r port svc action details; do
                add_port_info "$port" "$svc" "$action" "$details"
            done
        fi
    done
}

# Generates a summary report of running systemd services.
generate_systemd_summary() {
    if ! command_exists systemctl; then return; fi
    echo ""
    echo "Systemd Service Summary"
    echo "-----------------------"
    systemctl list-units --type=service --state=running --no-pager
}

# Generates a detailed report of running systemd services and their ports.
generate_systemd_detailed() {
    if ! command_exists systemctl; then
        echo "systemctl command not found."
        return
    fi
    cache_listening_ports # Ensure port data is cached
    local CACHE_FILE="$TEMP_DIR/listening_ports.ss"
    
    echo ""
    echo "Detailed Systemd Service Analysis"
    echo "================================="

    systemctl list-units --type=service --state=running --no-pager --no-legend --plain | awk '{print $1}' | while read -r service_unit; do
        if [ -z "$service_unit" ]; then continue; fi

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
            if grep -q "pid=$main_pid," "$CACHE_FILE"; then
                ports_info=$(grep "pid=$main_pid," "$CACHE_FILE" | awk '{
                    listen_addr = ($1 == "tcp" || $1 == "udp") ? $4 : $5;
                    split(listen_addr, addr_parts, ":");
                    port = addr_parts[length(addr_parts)];
                    printf "%s ", port
                }' | xargs)
            fi
        fi
        
        echo "  ${user:-<no_user>}:${ports_info:-<no_port>}"
        echo "  ${exec_path:-<no_path>}:${exec_args:-<no_args>}"
        echo ""
    done
} 