#!/bin/bash

# Initialize report directory and structure
init_report_dir() {
    local url="$1"
    # Strip any existing -report suffix before adding it
    url="${url%-report}"
    REPORT_DIR="${url}-report"
    mkdir -p "$REPORT_DIR/nginx"
    log_status "Created report directory: $REPORT_DIR"
    
    # Initialize main metadata file
    cat > "$REPORT_DIR/trace.env" << EOF
URL=$url
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
TRACE_ID=$(uuidgen || echo "trace_${RANDOM}")
EOF
    log_status "Initialized trace.env file: $REPORT_DIR/trace.env"

    # Initialize resolved.env
    touch "$REPORT_DIR/resolved.env"
    log_status "Initialized resolved.env file: $REPORT_DIR/resolved.env"
}

# Function to update resolved.env
update_resolved_env() {
    local ip="$1"
    local name="$2"
    local float_ip="$3"
    local hostname="$4"
    local public_key_name="$5"
    
    cat > "$REPORT_DIR/resolved.env" << EOF
RESOLVED_IP=$ip
RESOLVED_NAME=$name
RESOLVED_VIA_FLOAT=$float_ip
RESOLVED_HOSTNAME=$hostname
RESOLVED_PUBLIC_KEY_NAME=$public_key_name
EOF
    log_status "Updated resolved.env with IP: $ip, Name: $name, Floating IP: $float_ip, Hostname: $hostname, Public Key Name: $public_key_name"
}

# Structured metadata writer
write_meta() {
    local scope="$1"    # e.g., "dns", "nginx"
    local key="$2"
    local value="$3"
    local ip="$4"       # optional
    
    local meta_file
    if [ -n "$ip" ]; then
        meta_file="$REPORT_DIR/${scope}_${ip}.env"
    else
        meta_file="$REPORT_DIR/${scope}.env"
    fi
    
    # Ensure parent directory exists
    mkdir -p "$(dirname "$meta_file")"
    echo "${key}=${value}" >> "$meta_file"
    log_status "Wrote metadata to file: $meta_file"
}

# Show hierarchical usage information
show_usage() {
    cat << EOF
Usage: $0 <url> [nginx_path]

Environment variables required:
    NH_DIR         Base directory for configuration
    NH_CONTEXT     Context name (or DIGITALOCEAN_CONTEXT if set)

Example:
    NH_DIR=/etc/nethelper NH_CONTEXT=default $0 https://example.com /abracalab/

Description:
    Traces a URL through infrastructure components:
    1. DNS Resolution
       - IP addresses
       - Hostname mapping
    2. NGINX Configuration
       - Server blocks
       - Location directives
       - Proxy settings
    3. Service Discovery
       - Port mappings
       - Process management (systemd/pm2)
       - Backend services

Output:
    Creates <url>-report/ directory with:
    ├── dns/            # DNS resolution data
    ├── nginx/          # NGINX configurations
    ├── services/       # Service mappings
    └── meta/          # Metadata and logs
        ├── trace.env   # Main trace metadata
        └── *.env       # Component-specific metadata
EOF
    return 1
}

# Global variable to control logging detail level
TRACE_DETAIL=${TRACE_DETAIL:-0}  # Default to basic logging if not set

log_status() {
    local message="$1"
    local timestamp
    timestamp=$(date +"%H:%M:%S")
    
    if [ "$TRACE_DETAIL" -eq 0 ]; then
        # Basic logging
        local func="${FUNCNAME[1]}"
        local line="${BASH_LINENO[0]}"
        local log_msg="$timestamp $func[$line]: $message"
    else
        # Detailed logging with call chain
        local stack=""
        local i=1
        while [ "${FUNCNAME[$i]}" != "" ]; do
            if [ "${FUNCNAME[$i]}" != "main" ]; then
                if [ -n "$stack" ]; then
                    stack="$stack->"
                fi
                stack="${stack}${FUNCNAME[$i]}[${BASH_LINENO[$((i-1))]}]"
            fi
            i=$((i+1))
        done
        local log_msg="$timestamp TRACE $stack: $message"
    fi
    
    # Print to stdout
    echo "$log_msg"
    
    # If REPORT_DIR exists, also log to file
    if [ -n "$REPORT_DIR" ]; then
        local log_file="$REPORT_DIR/trace.log"
        echo "$log_msg" >> "$log_file"
    fi
}

# Record service mapping
record_service_mapping() {
    local ip="$1"
    local port="$2"
    local service="$3"
    local manager="$4"  # systemd or pm2
    
    cat >> "$REPORT_DIR/services/${ip}_mappings.env" << EOF
PORT_${port}_SERVICE=${service}
PORT_${port}_MANAGER=${manager}
PORT_${port}_TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
EOF
    log_status "Recorded service mapping for IP $ip, port $port"
}

# Record NGINX proxy mapping
record_proxy_mapping() {
    local ip="$1"
    local server_name="$2"
    local location="$3"
    local backend="$4"
    
    cat >> "$REPORT_DIR/nginx/${ip}_proxy.env" << EOF
SERVER_NAME=${server_name}
LOCATION=${location}
BACKEND=${backend}
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
EOF
    log_status "Recorded NGINX proxy mapping for IP $ip, server_name $server_name"
}

# Add the following function to handle writing to location.env
record_location_info() {
    local ip="$1"
    local location_env_path="$2"
    
    if [ -f "$location_env_path" ]; then
        # Just log that we found it - the file is already in the right place
        log_status "Location information recorded for IP $ip"
    else
        log_status "No location.env found for IP $ip"
    fi
} 