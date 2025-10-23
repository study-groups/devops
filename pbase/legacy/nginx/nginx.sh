#!/bin/bash

# Function to determine who NGINX is running as
pbase_nginx_user() {
    local nginx_user=$(ps -eo user,comm | grep nginx | awk 'NR==1{print $1}')
    if [ -z "$nginx_user" ]; then
        echo "NGINX is not running."
    else
        echo "NGINX is running as user: $nginx_user"
    fi
}

# Function to log changes and store diffs
pbase_nginx_log_change() {
    local action="$1"
    local route_path="$2"
    local config_file="$3"
    local log_file="/var/log/pbase_nginx_changes.log"
    local diff_file="/var/log/pbase_nginx_diffs.log"

    echo "$(date): $action - Route: $route_path, File: $config_file" >> "$log_file"
    
    # Generate and store diff
    diff -u "/tmp/$(basename "$config_file").bak" "$config_file" | tee -a "$diff_file"
}

# Function to summarize NGINX configurations, especially pbase-specific information
pbase_nginx_summarize_configs() {
    echo "Summarizing NGINX configurations in $NGINX_CONF_DIR..."
    for config_file in "$NGINX_CONF_DIR"/*; do
        echo "Processing $config_file"
        
        # Basic server block summary
        server_name=$(grep -m 1 "server_name" "$config_file" | awk '{print $2}')
        echo "  Server Name: $server_name"

        # Check for the PBASE block
        if pbase_nginx_block_exists "$config_file"; then
            echo "  PBASE Block Found:"
            pbase_nginx_find_block "$config_file"
        else
            echo "  No PBASE Block Found"
        fi

        echo "-----------------------------------"
    done
}

# Helper function to generate SSL certificate lines based on domain
pbase_nginx_ssl_cert_lines() {
    local domain="${1:-$NGINX_DOMAIN}"
    local cert_path="/etc/letsencrypt/live/$domain/fullchain.pem"
    local key_path="/etc/letsencrypt/live/$domain/privkey.pem"

    echo "    ssl_certificate $cert_path;"
    echo "    ssl_certificate_key $key_path;"
}

# Function to create an NGINX server block with a default static file route
pbase_nginx_server() {
    local domain="${1:-$NGINX_DOMAIN}"      # Default to NGINX_DOMAIN
    local subdomain="${2:-$NGINX_SUBDOMAIN}" # Default to NGINX_SUBDOMAIN
    local webroot="${3:-$NGINX_WEBROOT}"     # Default to NGINX_WEBROOT
    local server_name="$subdomain.$domain"  # Combine subdomain and domain

    # Output the server block
    cat <<EOF
server {
    listen 80;
    listen 443 ssl;

    server_name
        $server_name;

$(pbase_nginx_ssl_cert_lines "$domain")

    if (\$scheme = http) {
        return 301 https://\$host\$request_uri;
    }

    location / {
        root $webroot;
        index index.html;
    }
}
EOF
}

# Function to check the status of the NGINX web root in the local file system
pbase_nginx_status() {
    local webroot="${1:-$NGINX_WEBROOT}"  # Default to NGINX_WEBROOT

    echo "Checking status of NGINX web root at $webroot..."

    # Print NGINX_ variables
    echo "NGINX_WEBROOT: $NGINX_WEBROOT"
    echo "NGINX_TAG_START: $NGINX_TAG_START"
    echo "NGINX_TAG_END: $NGINX_TAG_END"
    echo "NGINX_CONF_FILE: $NGINX_CONF_FILE"

    if [ -d "$webroot" ]; then
        if [ -f "$webroot/index.html" ]; then
            echo "NGINX web root exists and index.html is present at $webroot."
        else
            echo -e "\e[31mNGINX web root exists but index.html is missing at $webroot.\e[0m"
        fi
    else
        echo -e "\e[31mNGINX web root does not exist at $webroot.\e[0m"
    fi
}

# Example usage:
# pbase_nginx_server "qa.pixeljamarcade.com" "pbase" "/var/www/pbase/"
# pbase_nginx_status "/var/www/pbase/"