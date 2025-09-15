#!/bin/bash
# Port information aggregation

# Appends port information to the shared data file for later processing.
# Arguments:
#   $1: Port number
#   $2: Service name (e.g., nginx, docker)
#   $3: Action (e.g., listen, proxy_pass)
#   $4: Details (e.g., config file, container name)
add_port_info() {
    if [ -n "$PORTS_DATA_FILE" ] && [ -f "$PORTS_DATA_FILE" ]; then
        echo -e "$1\t$2\t$3\t$4" >> "$PORTS_DATA_FILE"
    fi
} 