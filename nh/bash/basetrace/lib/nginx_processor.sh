#!/bin/bash

collect_nginx_configs() {
    source "$REPORT_DIR/resolved.env"
    mkdir -p "$REPORT_DIR/nginx"
    log_status "Collecting NGINX configs from RESOLVED_IP: $RESOLVED_IP"
    ssh -o ConnectTimeout=10 root@"$RESOLVED_IP" bash << 'ENDSSH' \
    | grep -v '^$' > "$REPORT_DIR/nginx/all_configs.txt"
if [ -d "/etc/nginx/sites-enabled" ]; then
    for conf in /etc/nginx/sites-enabled/*; do
        if [ -f "$conf" ]; then
            echo "FILE: $conf"
            cat "$conf"
            echo "END_FILE"
        fi
    done
fi
ENDSSH
    log_status "NGINX configs collected and written to $REPORT_DIR/nginx/all_configs.txt"
}

find_location_block() {
    source "$REPORT_DIR/resolved.env"
    local url_path="$1"
    local url_host="$2"
    
    log_status "Searching for server_name '$url_host' in nginx virtual hosts"
    
    # Execute search on remote server
    ssh -o ConnectTimeout=10 root@"$RESOLVED_IP" bash << ENDSSH
    found_vhost=false
    found_location=false
    
    for conf in /etc/nginx/sites-enabled/*; do
        if [ ! -f "\$conf" ]; then
            continue
        fi
        
        # First check if this vhost is for our domain
        if grep -q "server_name.*${url_host}" "\$conf"; then
            echo "VHOST_FILE=\$conf"
            found_vhost=true
            
            # Now look for matching location block
            while read -r line; do
                if [[ "\$line" =~ ^[[:space:]]*location[[:space:]]+(.*)[[:space:]]+\{ ]]; then
                    location_path=\${BASH_REMATCH[1]}
                    # Store each location block we find
                    echo "LOCATION_BLOCK={\$location_path}"
                    echo "\$line"
                    # Capture the next lines until closing '}'
                    while IFS= read -r inner_line; do
                        echo "\$inner_line"
                        if [[ "\$inner_line" =~ ^[[:space:]]*\} ]]; then
                            break
                        fi
                    done
                    echo "}"
                fi
            done < "\$conf"
            
            break
        fi
    done
    
    if [ "\$found_vhost" = false ]; then
        echo "FOUND_VHOST=false"
        echo "ERROR=No virtual host found for server_name $url_host"
    fi
ENDSSH
    log_status "Location block search completed"
} > "$REPORT_DIR/nginx/location_blocks.env"

process_nginx() {
    source "$REPORT_DIR/resolved.env"
    log_status "Inspecting nginx virtual host configurations"
    
    # Get configs first
    collect_nginx_configs
    
    # Source URL components
    source "$REPORT_DIR/url.env"
    log_status "Sourced URL components from $REPORT_DIR/url.env"
    
    # Search for location blocks
    find_location_block "$URL_PATH" "$URL_HOST"
    
    # Report results
    if grep -q "FOUND_VHOST=false" "$REPORT_DIR/nginx/location_blocks.env"; then
        local error
        error=$(grep "ERROR=" "$REPORT_DIR/nginx/location_blocks.env" | cut -d= -f2-)
        log_status "$error"
    else
        local vhost_file
        vhost_file=$(grep "VHOST_FILE=" "$REPORT_DIR/nginx/location_blocks.env" | cut -d= -f2)
        log_status "Found virtual host configuration in $vhost_file"
        
        # Now we need to find the most specific location match
        log_status "Analyzing location directives for URI path '$URL_PATH'"
        if grep -q "LOCATION_BLOCK=" "$REPORT_DIR/nginx/location_blocks.env"; then
            while read -r line; do
                [[ "$line" =~ LOCATION_BLOCK=\{(.*)\} ]] && \
                    log_status "Found location directive: ${BASH_REMATCH[1]}"
            done < <(grep "LOCATION_BLOCK=" "$REPORT_DIR/nginx/location_blocks.env")
            
            # Extract and write to location.env
            extract_and_write_location_env "$REPORT_DIR/nginx/location_blocks.env"
        else
            log_status "No explicit location directives found, default location '/' will be used"
        fi
    fi
}

update_proxy_pass_and_capture_endpoint() {
    # Logic to update proxy_pass and capture endpoint information
    # This is a placeholder for your actual implementation
    local next_ip="192.34.62.148"
    local next_port="4404"
    
    echo "ENDPOINT_IP=$next_ip" > "$REPORT_DIR/endpoint.env"
    echo "ENDPOINT_PORT=$next_port" >> "$REPORT_DIR/endpoint.env"
    log_status "Captured endpoint information in $REPORT_DIR/endpoint.env"
    # Add logic to update proxy_pass in the NGINX configuration
}

# Add the following function to extract parameters and write to location.env
extract_and_write_location_env() {
    local env_file="$1"
    local location_env_path="$REPORT_DIR/nginx/location.env"
    
    # Initialize or clear the location.env file
    > "$location_env_path"
    log_status "Initialized location.env file: $location_env_path"
    
    # Extract each LOCATION_BLOCK and parse parameters
    awk -v location_env_path="$location_env_path" '
    BEGIN {
        print "#!/bin/bash" >> location_env_path
        print "# Generated location environment variables" >> location_env_path
        print "declare -A NGINX_VARS" >> location_env_path
    }
    /^LOCATION_BLOCK=\{(.*)\}$/ {
        in_block = 1
        location = gensub(/^LOCATION_BLOCK=\{(.*)\}$/, "\\1", "g", $0)
        print "# Location: " location >> location_env_path
        next
    }
    /}/ && in_block {
        in_block = 0
        next
    }
    in_block {
        if ($1 == "proxy_pass") {
            split($2, arr, "//")
            protocol = arr[1]
            split(arr[2], arr2, "/")
            host_port = arr2[1]
            split(host_port, hp, ":")
            host = hp[1]
            port = hp[2]
            print "NGINX_VARS[\"PROXY_PASS_PROTOCOL\"]=\"" protocol "\"" >> location_env_path
            print "NGINX_VARS[\"PROXY_PASS_HOST\"]=\"" host "\"" >> location_env_path
            print "NGINX_VARS[\"PROXY_PASS_PORT\"]=\"" port "\"" >> location_env_path
        }
        if ($1 == "proxy_set_header") {
            header = $2
            value = substr($0, index($0, $3))
            gsub(/[";]/, "", value)
            print "NGINX_VARS[\"PROXY_SET_HEADER_" header "\"]=\"" value "\"" >> location_env_path
        }
        if ($1 == "root") {
            print "NGINX_VARS[\"ROOT\"]=\"" $2 "\"" >> location_env_path
        }
        if ($1 == "index") {
            print "NGINX_VARS[\"INDEX\"]=\"" $2 "\"" >> location_env_path
        }
        if ($1 == "try_files") {
            try_files = ""
            for(i=2;i<=NF;i++) {
                try_files = try_files $i " "
            }
            sub(/ $/, "", try_files)
            print "NGINX_VARS[\"TRY_FILES\"]=\"" try_files "\"" >> location_env_path
        }
    }
    ' "$env_file"
    
    log_status "location.env written to $location_env_path"
}

# Function to read the env file into an associative array
read_env_to_array() {
    local env_file="$1"
    declare -A env_vars
    while IFS='=' read -r key value; do
        # Skip empty lines and comments
        [[ -z "$key" || "$key" =~ ^# ]] && continue
        # Trim whitespace from key and value
        key=$(echo "$key" | xargs)
        value=$(echo "$value" | xargs)
        # Store the key-value pair in the associative array
        env_vars["$key"]="$value"
    done < "$env_file"
    
    # Example usage of the associative array
    echo "Proxy pass is set to: ${env_vars["PROXY_PASS"]}"
    echo "X-Real-IP header is set to: ${env_vars["PROXY_SET_HEADER_X-REAL-IP"]}"
    echo "X-Forwarded-Proto header is set to: ${env_vars["PROXY_SET_HEADER_X-FORWARDED-PROTO"]}"
}


# Access the variables using the original names
echo "Proxy pass is set to: ${env_vars["PROXY_PASS"]}"
echo "X-Real-IP header is set to: ${env_vars["PROXY_SET_HEADER_X-REAL-IP"]}"
echo "X-Forwarded-Proto header is set to: ${env_vars["PROXY_SET_HEADER_X-FORWARDED-PROTO"]}" 