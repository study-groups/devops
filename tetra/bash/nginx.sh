# nginx.sh
# This script provides functions for setting up Nginx server blocks
# with reverse proxy and SSL configurations. It encapsulates three key
# functions: tetra_nginx_proxy, tetra_nginx_tls, and 
# tetra_nginx_server for a comprehensive server setup.

# Function: tetra_nginx_proxy
# Generates a location block for reverse proxying in Nginx. It sets
# necessary headers and proxy settings tailored for a specified host
# and port.
# Parameters:
# - proxy_host: Host or IP address to proxy requests to.
# - proxy_port: Port number on the proxy host.
# - location: (Optional) Location path, defaults to '/'.
tetra_nginx_proxy() {
    local proxy_host=$1
    local proxy_port=$2
    local location=${3:-"/"}
    local protocol="http"

    # Check if the port is 443, set protocol to https
    if [ "$proxy_port" -eq 443 ]; then
        protocol="https"
    fi

    cat <<EOF
    location $location {
       proxy_http_version 1.1;
       proxy_set_header X-Real-IP \$remote_addr;
       proxy_set_header X-Forwarded-Proto $protocol;
       proxy_ssl_server_name on;
       proxy_set_header Host \$host;
       proxy_redirect off;
       proxy_pass $protocol://$proxy_host:$proxy_port/;
    }
EOF
}

# Function: tetra_nginx_tls
# Outputs a TLS (SSL) configuration snippet for Nginx, using 
# placeholders for SSL certificates. This setup is intended for use
# with Certbot-managed certificates.
tetra_nginx_tls() {
    cat <<EOF
    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/your_domain/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/your_domain/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
EOF
}

# Function: tetra_nginx_server
# Assembles a complete Nginx server block. It combines a server header,
# a reverse proxy configuration from tetra_nginx_proxy, and TLS settings
# from tetra_nginx_tls. The function creates both SSL (port 443) and
# HTTP to HTTPS redirect (port 80) server blocks.
# Parameters:
# - server_name: The domain name for the server block.
# - proxy_host: Host or IP for the reverse proxy target.
# - proxy_port: Port number for the reverse proxy target.
# - location: (Optional) Location path for the proxy, defaults to '/'.
tetra_nginx_server() {
    local server_name=$1
    local proxy_host=$2
    local proxy_port=$3
    local location=${4:-"/"}

    # Server header
    echo "server {"
    echo "    server_name $server_name;"
    echo "    server_name *.$server_name;"
    echo ""
    echo "    # Rewrite rule to add trailing slash"
    echo "    rewrite ^([^.]*[^/])\$ \$1/ permanent;"
    echo ""

    # Proxy location
    tetra_nginx_proxy "$proxy_host" "$proxy_port" "$location"

    # TLS configuration
    tetra_nginx_tls

    # Server footer
    echo "}"
    echo ""
    echo "server {"
    echo "    if (\$host = $server_name) {"
    echo "        return 301 https://\$host\$request_uri;"
    echo "    } # managed by Certbot"
    echo ""
    echo "    server_name $server_name;"
    echo "    server_name *.$server_name;"
    echo "    listen 80;"
    echo "    return 404; # managed by Certbot"
    echo "}"
}

# Example usage of tetra_nginx_server:
# tetra_nginx_server "placeholdermedia.com" "192.34.62.148" "4404" "/example_location"
#
# Note: Ensure to back up your existing Nginx configuration files
# before applying new configurations. Test in a controlled 
# environment.


tetra_nginx_location_replace_old() {
    local config_file=$1
    local temp_file=$(mktemp)
    local location_block_started=false

    # Read new location block from stdin into a variable
    local new_location_block=$(</dev/stdin)

    # Check if the configuration file exists
    if [[ ! -f "$config_file" ]]; then
        echo "Error: Configuration file does not exist."
        return 1
    fi

    # Process the file
    while IFS= read -r line; do
        if [[ "$line" =~ ^location\ /the/location\ \{ ]]; then
            location_block_started=true
            echo "$new_location_block" >> "$temp_file"
            continue
        fi

        if [[ "$location_block_started" = true && "$line" == "}" ]]; then
            location_block_started=false
            continue
        fi

        if [[ "$location_block_started" = false ]]; then
            echo "$line" >> "$temp_file"
        fi
    done < "$config_file"

    # Replace the original file with the temporary file
    mv "$temp_file" "$config_file"
    echo "Location block in '$config_file' updated."
}


# Example usage (assuming new location block is in 'new_location.txt'):
# cat new_location.txt | tetra_nginx_location_replace /etc/nginx/nginx.conf

tetra_nginx_location_replace() {
    local config_file=$1
    local temp_file=$(mktemp)
    local backup_file="${config_file}.backup"
    local location_block_started=false

    # Read new location block from stdin into a variable
    local new_location_block=$(</dev/stdin)

    # Check if the configuration file exists
    if [[ ! -f "$config_file" ]]; then
        echo "Error: Configuration file does not exist."
        return 1
    fi

    # Create a backup of the original configuration file
    cp "$config_file" "$backup_file"

    # Process the file
    while IFS= read -r line; do
        if [[ "$line" =~ ^location\ /the/location\ \{ ]]; then
            location_block_started=true
            echo "$new_location_block" >> "$temp_file"
            continue
        fi

        if [[ "$location_block_started" = true && "$line" == "}" ]]; then
            location_block_started=false
            continue
        fi

        if [[ "$location_block_started" = false ]]; then
            echo "$line" >> "$temp_file"
        fi
    done < "$config_file"

    # Replace the original file with the temporary file
    mv "$temp_file" "$config_file"
    echo "Location block in '$config_file' updated. Backup created at '$backup_file'."
}

# Undo function
tetra_nginx_undo_replace() {
    local config_file=$1
    local backup_file="${config_file}.backup"

    if [[ -f "$backup_file" ]]; then
        mv "$backup_file" "$config_file"
        echo "Reverted to backup configuration for '$config_file'."
    else
        echo "Error: Backup file does not exist."
    fi
}

# Example usage:
# cat new_location.txt | tetra_nginx_location_replace /etc/nginx/nginx.conf
# To undo:
# tetra_nginx_undo_replace /etc/nginx/nginx.conf


tetra_nginx_list_sites()
{
  cat /etc/nginx/sites-enabled/* \
	 | grep " server_name "  \
	 | grep -v "*." \
	 | sort \
	 | uniq 
}

tetra_nginx_install_crossplane(){
  # must have python enabled via tetra_python_activate
  pip install crossplane
}

tetra_nginx_crossplane_parse_nginx(){
  crossplane parse /etc/nginx/sites-enabled/*nodeholder*
}


# Function to generate NGINX proxy configuration
tetra_nginx_proxy_long() {
    local proxy_host="$1"
    local proxy_port="$2"
    local location="${3:-"/"}"
    local protocol="http"
    
    if [ "$proxy_port" -eq 443 ]; then
        protocol="https"
    fi
    
    cat <<EOF
location $location {
    proxy_http_version 1.1;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $protocol;
    proxy_set_header X-Forwarded-Host \$host;
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-Server \$host;
    proxy_set_header X-Forwarded-URI \$request_uri;
    proxy_set_header X-Original-URI \$request_uri;
    proxy_set_header X-Forwarded-Scheme \$scheme;
    proxy_set_header X-Forwarded-Port \$server_port;
    proxy_set_header X-Request-ID \$request_id;
    proxy_set_header Connection "";
    proxy_pass $protocol://$proxy_host:$proxy_port;
    proxy_redirect off;
    proxy_buffering off;
}
EOF
}

# Usage example to print the configuration to the terminal
# tetra_nginx_proxy "example.com" 80

# Usage example to save the configuration to a file
# tetra_nginx_proxy "example.com" 80 > /etc/nginx/sites-available/example_proxy.conf

