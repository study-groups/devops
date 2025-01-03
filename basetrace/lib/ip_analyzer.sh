#!/bin/bash

# Global variable declaration
DIGOCEAN_JSON=""

# Source validation functions
source "$(dirname "${BASH_SOURCE[0]}")/validate.sh"

update_trace_env() {
    local key="$1"
    local value="$2"
    local trace_file="$REPORT_DIR/trace.env"
    
    # If key exists, update it; otherwise append it
    if grep -q "^${key}=" "$trace_file"; then
        sed -i "s|^${key}=.*|${key}=${value}|" "$trace_file"
    else
        echo "${key}=${value}" >> "$trace_file"
    fi
}

validate_environment() {
    # Check for required environment variables
    if [ -z "$NH_DIR" ]; then
        log_status "NH_DIR environment variable is not set"
        return 1
    fi
    if [ -z "$NH_CONTEXT" ]; then
        log_status "NH_CONTEXT environment variable is not set"
        return 1
    fi

    log_status "NH_DIR: $NH_DIR"
    log_status "NH_CONTEXT: $NH_CONTEXT"

    # Construct and validate the DIGOCEAN_JSON path
    DIGOCEAN_JSON="$NH_DIR/$NH_CONTEXT/digocean.json"
    log_status "Using DigitalOcean JSON file at: $DIGOCEAN_JSON"
    
    if [ ! -f "$DIGOCEAN_JSON" ]; then
        log_status "DigitalOcean JSON file not found at: $DIGOCEAN_JSON"
        return 1
    fi

    if [ ! -r "$DIGOCEAN_JSON" ]; then
        log_status "DigitalOcean JSON file is not readable: $DIGOCEAN_JSON"
        return 1
    fi
    
    return 0
}

query_floating_ip() {
    local ip="$1"
    
    if [ ! -f "$DIGOCEAN_JSON" ]; then
        log_status "Cannot query floating IP: DIGOCEAN_JSON file not found"
        return 1
    fi
    
    log_status "Checking if $ip is a floating IP in $DIGOCEAN_JSON"
    
    # Debug: Show the JSON structure we're querying
    log_status "JSON structure: $(jq '.[] | select(.FloatingIPs != null) | .FloatingIPs' "$DIGOCEAN_JSON")"
    
    # Use proper JSON path for floating IPs
    local result
    result=$(jq -r ".[] | select(.FloatingIPs != null) | .FloatingIPs[] | select(.ip == \"$ip\")" "$DIGOCEAN_JSON")
    
    if [ -n "$result" ]; then
        log_status "Found floating IP data: $result"
    else
        log_status "No floating IP data found for $ip"
    fi
    
    echo "$result"
}

query_droplet_by_id() {
    local droplet_id="$1"
    
    if [ ! -f "$DIGOCEAN_JSON" ]; then
        log_status "Cannot query droplet: DIGOCEAN_JSON file not found"
        return 1
    fi
    
    if [ -z "$droplet_id" ]; then
        log_status "ERROR: No droplet ID provided"
        return 1
    fi
    
    log_status "Querying droplet by ID: $droplet_id"
    
    # First validate JSON format
    if ! jq '.' "$DIGOCEAN_JSON" > /dev/null 2>&1; then
        log_status "ERROR: Invalid JSON format in $DIGOCEAN_JSON"
        return 1
    fi
    
    # Query matching the exact structure from digocean.json example
    jq -r --arg id "$droplet_id" '
        .[0].Droplets[] | 
        select(.id == ($id|tonumber))
    ' "$DIGOCEAN_JSON"
}

query_droplet_by_ip() {
    local ip="$1"
    if [ ! -f "$DIGOCEAN_JSON" ]; then
        log_status "Cannot query droplet: DIGOCEAN_JSON file not found"
        return 1
    fi
    log_status "Querying droplet by IP: $ip"
    jq -r '.[] | select(.Droplets != null) | .Droplets[] | select(.networks.v4[].ip_address == "'$ip'")' "$DIGOCEAN_JSON"
}

extract_public_ip() {
    local droplet_data="$1"
    echo "$droplet_data" | jq -r '.networks.v4[] | select(.type == "public") | .ip_address' | head -1
}

extract_private_ip() {
    local droplet_data="$1"
    echo "$droplet_data" | jq -r '.networks.v4[] | select(.type == "private") | .ip_address' | head -1
}

analyze_digital_ocean_ip() {
    local ip="$1"
    log_status "DigitalOcean resolving IP: $ip"
    
    # First validate environment
    validate_environment
    local validation_status=$?
    
    # Check for floating IP regardless of validation status
    log_status "Checking if $ip is a floating IP in $DIGOCEAN_JSON"
    
    local floating_ip_data
    # Look for the IP in the Droplets array
    floating_ip_data=$(jq -r --arg ip "$ip" '
        .[] | select(.Droplets != null) | .Droplets[] | 
        select(.networks.v4[] | select(.ip_address == $ip and .type == "public"))
    ' "$DIGOCEAN_JSON")
    
    local jq_status=$?
    
    log_status "JQ exit status: $jq_status"
    log_status "Floating IP data: $floating_ip_data"
    
    if [ $jq_status -eq 0 ] && [ -n "$floating_ip_data" ]; then
        log_status "Found floating/reserved IP: $ip"
        
        # Get all public IPs except the current one
        local actual_ip
        actual_ip=$(echo "$floating_ip_data" | jq -r --arg ip "$ip" '.networks.v4[] | select(.type == "public" and .ip_address != $ip) | .ip_address' | head -1)
        log_status "Found actual IP: $actual_ip"
        
        if [ -n "$actual_ip" ] && [ "$actual_ip" != "null" ]; then
            log_status "Floating IP $ip points to droplet IP $actual_ip"
            
            # Get hostname using actual IP, not floating IP
            local hostname
            hostname=$(ssh -o ConnectTimeout=10 root@"$actual_ip" "hostname -f" 2>/dev/null || echo "")
            
            # Source current resolved.env to preserve the name
            source "$REPORT_DIR/resolved.env"
            
            # Update resolved.env with actual IP and floating IP info
            update_resolved_env "$actual_ip" "$RESOLVED_NAME" "$ip" "$hostname" ""
            
            # Only gather info using actual IP
            gather_server_info "$actual_ip"
            return 0
        else
            log_status "Could not find actual IP different from floating IP"
        fi
    else
        log_status "No floating IP data found"
    fi
    
    # If validation failed and we didn't find a floating IP, return error
    if [ $validation_status -ne 0 ]; then
        log_status "Environment validation failed - proceeding as non-DO IP"
        # Even if validation fails, preserve the name and update resolved.env
        source "$REPORT_DIR/resolved.env"
        update_resolved_env "$ip" "$RESOLVED_NAME" "" "" ""
        gather_server_info "$ip"
        return 1
    fi
    
    # If we get here, it's a direct droplet IP
    log_status "IP $ip is a direct droplet IP"
    local hostname
    hostname=$(ssh -o ConnectTimeout=10 root@"$ip" "hostname -f" 2>/dev/null || echo "")
    
    # Source current resolved.env to preserve the name
    source "$REPORT_DIR/resolved.env"
    
    update_resolved_env "$ip" "$RESOLVED_NAME" "" "$hostname" ""
    gather_server_info "$ip"
    return 0
}

process_floating_ip() {
    local float_ip="$1"
    local floating_ip_data="$2"
    
    log_status "processing floating IP: $float_ip"
    
    # Extract droplet data directly from floating IP data
    local droplet_data
    droplet_data=$(echo "$floating_ip_data" | jq -r '.droplet')
    
    if [ -z "$droplet_data" ] || [ "$droplet_data" = "null" ]; then
        log_status "ERROR: Could not extract droplet data from floating IP"
        return 1
    fi
    
    # Find the actual host IP (what floating IP resolves to)
    local host_ip
    host_ip=$(echo "$droplet_data" | jq -r '.networks.v4[] | select(.type == "public" and .ip_address != "'$float_ip'") | .ip_address' | head -1)
    
    if [ -z "$host_ip" ] || [ "$host_ip" = "null" ]; then
        log_status "ERROR: Could not resolve floating IP to host IP"
        return 1
    fi
    
    # Get hostname from the actual host
    local hostname
    hostname=$(ssh -o ConnectTimeout=10 root@"$host_ip" "hostname -f")
    
    # Update resolved.env with both IPs
    update_resolved_env "$host_ip" "$RESOLVED_NAME" "$float_ip" "$hostname" ""
    log_status "DigitalOcean resolved floating IP $float_ip to host IP $host_ip"
    
    # Gather info from the actual host
    gather_server_info "$host_ip"
}

process_direct_ip() {
    local ip="$1"
    
    log_status "processing direct IP: $ip"
    
    local droplet_data
    droplet_data=$(query_droplet_by_ip "$ip")
    
    if [ -n "$droplet_data" ]; then
        local private_ip
        private_ip=$(extract_private_ip "$droplet_data")
        if [ -n "$private_ip" ]; then
            log_status "Found private IP: $private_ip for droplet IP: $ip"
        fi
    fi
}

gather_server_info() {
    local ip="$1"
    
    log_status "gathering server info for: $ip"
    if ssh -o ConnectTimeout=10 root@"$ip" "true" 2>/dev/null; then
        log_status "SSH connection established"
        
        # Get hostname and update resolved.env
        local hostname
        hostname=$(ssh -o ConnectTimeout=10 root@"$ip" "hostname -f" 2>/dev/null || echo "unknown")
        
        # Create a temporary file for server info
        local server_info_file="$REPORT_DIR/server_info.tmp"
        
        # Gather server information
        ssh -o ConnectTimeout=10 root@"$ip" bash << 'ENDSSH' > "$server_info_file"
echo "HOSTNAME=$(hostname -f)"
echo "SERVICE_PORTS={"
netstat -tlpn 2>/dev/null | grep LISTEN | while read -r line; do
    port="$(echo "$line" | awk '{print $4}' | rev | cut -d: -f1 | rev)"
    service="$(echo "$line" | awk '{print $7}' | cut -d/ -f2)"
    echo "PORT_${port}=${service}"
done
echo "}"
echo "RUNNING_SERVICES={"
systemctl list-units --type=service --state=running
if command -v pm2 &>/dev/null; then
    echo "PM2_PROCESSES:"
    pm2 list
fi
echo "}"
ENDSSH

        # Update resolved.env with the hostname if we got one
        if [ -n "$hostname" ] && [ "$hostname" != "unknown" ]; then
            # Source current resolved.env
            source "$REPORT_DIR/resolved.env"
            # Update with new hostname while preserving other values
            update_resolved_env "$RESOLVED_IP" "$RESOLVED_NAME" "$RESOLVED_VIA_FLOAT" "$hostname" "$RESOLVED_PUBLIC_KEY_NAME"
        fi
        
        log_status "Server information gathered successfully"
        return 0
    else
        log_status "SSH connection failed"
        return 1
    fi
}

process_ip_analysis() {
    local ip="$1"
    local status=0
    local actual_ip="$ip"  # Default to input IP

    log_status "processing IP: $ip"
    
    # First try to analyze as DigitalOcean IP
    if analyze_digital_ocean_ip "$ip"; then
        # If it was a floating IP, analyze_digital_ocean_ip updated resolved.env
        # Get the actual IP to use for further operations
        source "$REPORT_DIR/resolved.env"
        if [ -n "$RESOLVED_VIA_FLOAT" ]; then
            actual_ip="$RESOLVED_IP"
            log_status "Using actual droplet IP $actual_ip instead of floating IP $ip"
        fi
    else
        log_status "DigitalOcean IP analysis failed"
        status=1
    fi

    # Always use actual_ip for server info gathering
    if ! gather_server_info "$actual_ip"; then
        log_status "Server info gathering failed"
        status=1
    fi

    return $status
}

analyze_ip() {
    local ip="$1"
    
    # Check for empty input
    if [ -z "$ip" ]; then
        log_status "Empty IP address provided"
        return 1
    fi
    
    log_status "analyzing IP: $ip"
    
    # Validate IP format
    if ! validate_ip_format "$ip"; then
        return 1
    fi
    
    # Process the IP analysis
    if ! process_ip_analysis "$ip"; then
        log_status "Analysis steps partially failed"
        return 1
    fi
    
    return 0
}

collect_nginx_configs() {
    source "$REPORT_DIR/resolved.env"
    log_status "Collecting NGINX configs from RESOLVED_IP: $RESOLVED_IP"
    
    # Create the nginx config directory
    mkdir -p "$REPORT_DIR/nginx"
    
    # Collect all nginx configs using RESOLVED_IP
    ssh -o ConnectTimeout=10 root@"$RESOLVED_IP" "find /etc/nginx -type f -name '*.conf' -exec cat {} \;" > "$REPORT_DIR/nginx/all_configs.txt"
    
    if [ -s "$REPORT_DIR/nginx/all_configs.txt" ]; then
        log_status "NGINX configs collected and written to $REPORT_DIR/nginx/all_configs.txt"
        return 0
    else
        log_status "No NGINX configs found or error collecting configs"
        return 1
    fi
}

process_nginx() {
    source "$REPORT_DIR/resolved.env"
    log_status "Inspecting nginx virtual host configurations"
    
    if ! collect_nginx_configs; then
        log_status "Failed to collect nginx configs"
        return 1
    fi

    # Source URL components if they exist
    if [ -f "$REPORT_DIR/url.env" ]; then
        source "$REPORT_DIR/url.env"
    fi

    # Find virtual host configuration using RESOLVED_IP
    local vhost_config
    vhost_config=$(ssh -o ConnectTimeout=10 root@"$RESOLVED_IP" "find /etc/nginx/sites-enabled -type f -exec grep -l '$RESOLVED_NAME' {} \;" 2>/dev/null | head -1)
    
    if [ -n "$vhost_config" ]; then
        log_status "Found virtual host configuration in $vhost_config"
        # ... rest of nginx processing using $RESOLVED_IP
    fi
}
