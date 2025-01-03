#!/bin/bash

# Global variables
TARGET_URL=""
EXTRACTED_DOMAIN=""
REPORT_DIR=""
INFO_FILE=""
LOG_FILE=""
SUMMARY_FILE=""
public_ip=""

# Initialize global variables
initialize_globals() {
    TARGET_URL="$1"
    DIGOCEAN_JSON="$NH_DIR/$NH_CONTEXT/digocean.json"

    # Check if the URL includes a scheme; if not, prepend "http://"
    if [[ ! "$TARGET_URL" =~ ^https?:// ]]; then
        TARGET_URL="http://$TARGET_URL"
    fi

    EXTRACTED_DOMAIN=$(echo "$TARGET_URL" | awk -F[/:] '{print $4}')

    # Ensure EXTRACTED_DOMAIN is not empty
    if [ -z "$EXTRACTED_DOMAIN" ]; then
        log_status "Error: Could not extract domain from URL: $TARGET_URL"
        exit 1
    fi

    REPORT_DIR="${EXTRACTED_DOMAIN}-report"
    mkdir -p "$REPORT_DIR"

    INFO_FILE="$REPORT_DIR/info.sh"
    LOG_FILE="$REPORT_DIR/log.txt"
    SUMMARY_FILE="$REPORT_DIR/summary.txt"

    # Clear old logs and files
    > "$LOG_FILE"
    > "$INFO_FILE"
    > "$SUMMARY_FILE"
}

# Log status messages
log_status() {
    local message="$1"
    echo "$message" | tee -a "$LOG_FILE" >&2
}

# Check prerequisites
check_prereqs() {
    log_status "Checking prerequisites..."

    # Check for required commands
    for cmd in jq ssh dig; do
        if ! command -v "$cmd" &> /dev/null; then
            log_status "Error: $cmd is not installed."
            exit 1
        fi
    done

    # Check for required environment variables
    for var in DIGOCEAN_JSON NH_DIR NH_CONTEXT; do
        if [ -z "${!var}" ]; then
            log_status "Error: Environment variable $var is not set."
            exit 1
        else
            log_status "$var is set to ${!var}"
        fi
    done

    log_status "All prerequisites are satisfied."
}

# Resolve DNS to get IP addresses
resolve_dns() {
    log_status "Resolving DNS for $EXTRACTED_DOMAIN..."
    local ips
    ips=$(dig +short "$EXTRACTED_DOMAIN")
    if [ -z "$ips" ]; then
        log_status "Error: Could not resolve DNS for $EXTRACTED_DOMAIN"
        exit 1
    fi
    echo "$ips"
}

# Check IP type and gather information
check_ip_type_and_gather() {
    local ip="$1"
    log_status "Analyzing IP: $ip"
    local floating_ip_data
    floating_ip_data=$(jq -r --arg ip "$ip" '.[] | select(.FloatingIPs != null) 
        | .FloatingIPs[] | select(.ip == $ip)' "$DIGOCEAN_JSON")
    
    if [ -n "$floating_ip_data" ]; then
        log_status "$ip is a floating IP"
        echo "IS_FLOATING_IP_$ip=true" >> "$INFO_FILE"
        local droplet_id
        droplet_id=$(echo "$floating_ip_data" | jq -r '.droplet.id')
        local droplet_data
        droplet_data=$(jq -r --arg droplet_id "$droplet_id" '.[] | select(.Droplets != null) 
            | .Droplets[] | select(.id == ($droplet_id | tonumber))' "$DIGOCEAN_JSON")
        
        public_ip=$(echo "$droplet_data" | jq -r '.networks.v4[] 
            | select(.type == "public") | .ip_address' | head -1)
        echo "PUBLIC_ENDPOINT_$ip=$public_ip" >> "$INFO_FILE"
        
        local private_ip
        private_ip=$(echo "$droplet_data" | jq -r '.networks.v4[] 
            | select(.type == "private") | .ip_address' | head -1)
        if [ -n "$private_ip" ]; then
            echo "PRIVATE_IP_$ip=$private_ip" >> "$INFO_FILE"
        fi
    else
        log_status "$ip is a direct public IP"
        echo "IS_FLOATING_IP_$ip=false" >> "$INFO_FILE"
        echo "PUBLIC_ENDPOINT_$ip=$ip" >> "$INFO_FILE"
        
        local droplet_data
        droplet_data=$(jq -r --arg ip "$ip" '.[] | select(.Droplets != null) 
            | .Droplets[] | select(.networks.v4[].ip_address == $ip)' "$DIGOCEAN_JSON")
        if [ -n "$droplet_data" ]; then
            local private_ip
            private_ip=$(echo "$droplet_data" | jq -r '.networks.v4[] 
                | select(.type == "private") | .ip_address' | head -1)
            if [ -n "$private_ip" ]; then
                echo "PRIVATE_IP_$ip=$private_ip" >> "$INFO_FILE"
            fi
        fi
    fi
}

# Check SSH connection
check_ssh_connection() {
    log_status "Checking SSH connection to root@$public_ip..."
    
    echo "Debug: SSH target is '$public_ip'" | tee -a "$LOG_FILE"
    
    if ssh -o ConnectTimeout=10 root@"$public_ip" "true" 2>/dev/null; then
        log_status "SSH connection successful to root@$public_ip"
    else
        log_status "SSH connection failed to root@$public_ip"
        exit 1
    fi
}

# Create placeholder report files
create_placeholder_reports() {
    log_status "Creating placeholder report files..."
    touch "$INFO_FILE" "$SUMMARY_FILE"
}

# Main script execution
if [ -z "$1" ]; then
    echo "Usage: $0 <url>"
    exit 1
fi

initialize_globals "$1"

log_status "Starting nh_analyzer script for URL: $TARGET_URL"

check_prereqs

# Resolve DNS and gather information
dns_info=($(resolve_dns))
for ip in "${dns_info[@]}"; do
    check_ip_type_and_gather "$ip"
    if [ -z "$public_ip" ]; then
        public_ip="$ip"
    fi
    if [ -n "$public_ip" ]; then
        break
    fi
done

check_ssh_connection

create_placeholder_reports

# Placeholder for additional functions
# traceurl "$TARGET_URL"
# gather_nginx_services
# gather_filesystem_info

log_status "Done. Results in: ${REPORT_DIR}" 