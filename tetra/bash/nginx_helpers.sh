# Function to create an NGINX server block for a new subdomain
tetra_nginx_create_server_block() {
    local subdomain="$1"
    local root_dir="$2"
    local port="${3:-9900}"
    local config_file="/etc/nginx/sites-available/${subdomain}.conf"

    cat <<EOF > "$config_file"
server {
    listen 80;
    server_name ${subdomain}.pixeljamarcade.com;

    root ${root_dir};
    index index.html index.htm;

    location / {
        try_files \$uri \$uri/ =404;
    }

    location /api/ {
        proxy_pass http://localhost:$port; #Adjust to your application's address
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

    ln -s "$config_file" /etc/nginx/sites-enabled/
}

tetra_nginx_remove_server_block() {
    local subdomain="$1"
    local config_file="/etc/nginx/sites-available/${subdomain}.conf"

    rm -f "$config_file"
    rm -f "/etc/nginx/sites-enabled/${subdomain}.conf"
    nginx -t && systemctl reload nginx
}

# Function to test an NGINX route
tetra_nginx_test_route() {
    local url="$1"
    curl -I "$url"
}

# Function to configure an NGINX redirect
tetra_nginx_configure_redirect() {
    local from_subdomain="$1"
    local to_subdomain="$2"
    local config_file="/etc/nginx/sites-available/${from_subdomain}.conf"

    cat <<EOF > "$config_file"
server {
    listen 80;
    server_name ${from_subdomain}.pixeljamarcade.com;

    location / {
        return 301 http://${to_subdomain}.pixeljamarcade.com\$request_uri;
    }
}
EOF

    ln -s "$config_file" /etc/nginx/sites-enabled/
    nginx -t && systemctl reload nginx
}

# Function to list available server blocks
tetra_nginx_list_server_blocks() {
    ls /etc/nginx/sites-available/
}

# Function to walk through options for NGINX redirects
tetra_nginx_walkthrough_redirect_options() {
    echo "Options for configuring NGINX redirects:"
    echo "1. Permanent Redirect (301)"
    echo "   Example: tetra_nginx_configure_redirect source_subdomain destination_subdomain"
    echo "2. Temporary Redirect (302)"
    echo "   Example: tetra_nginx_configure_redirect_temp source_subdomain destination_subdomain"
    echo "3. Redirect with query string"
    echo "   Example: tetra_nginx_configure_redirect_with_query source_subdomain destination_subdomain"
}

# Function to configure a temporary NGINX redirect (302)
tetra_nginx_configure_redirect_temp() {
    local from_subdomain="$1"
    local to_subdomain="$2"
    local config_file="/etc/nginx/sites-available/${from_subdomain}.conf"

    cat <<EOF > "$config_file"
server {
    listen 80;
    server_name ${from_subdomain}.pixeljamarcade.com;

    location / {
        return 302 http://${to_subdomain}.pixeljamarcade.com\$request_uri;
    }
}
EOF

    ln -s "$config_file" /etc/nginx/sites-enabled/
    nginx -t && systemctl reload nginx
}

# Function to configure an NGINX redirect with query string
tetra_nginx_configure_redirect_with_query() {
    local from_subdomain="$1"
    local to_subdomain="$2"
    local config_file="/etc/nginx/sites-available/${from_subdomain}.conf"

    cat <<EOF > "$config_file"
server {
    listen 80;
    server_name ${from_subdomain}.pixeljamarcade.com;

    location / {
        return 301 http://${to_subdomain}.pixeljamarcade.com\$request_uri?\$args;
    }
}
EOF

    ln -s "$config_file" /etc/nginx/sites-enabled/
    nginx -t && systemctl reload nginx
}


# Function to test an NGINX route, print the IP address from which the request came, and display the DNS IP value for the domain name
tetra_nginx_test_route_long() {
    local input="$1"
    local url
    local temp_file=$(mktemp)

    # Prepend http:// if not already present
    if [[ "$input" =~ ^https?:// ]]; then
        url="$input"
    else
        url="http://$input"
    fi

    # Make the request and dump headers to a temporary file
    curl -s -o /dev/null -D "$temp_file" "$url"

    # Extract the IP address from the headers
    local x_real_ip=$(grep -i "X-Real-IP" "$temp_file" | awk '{print $2}')

    # Extract the domain from the URL
    local domain=$(echo "$url" | awk -F[/:] '{print $4}')

    # Get the DNS IP address for the domain
    local dns_ip=""
    if [ -n "$domain" ]; then
        dns_ip=$(dig +short "$domain" | head -n 1)
    fi

    # Print the response headers
    cat "$temp_file"

    # Print the extracted X-Real-IP
    if [ -n "$x_real_ip" ]; then
        echo "X-Real-IP: $x_real_ip"
    else
        echo "No X-Real-IP found in the response headers."
    fi

    # Print the DNS IP address for the domain
    if [ -n "$dns_ip" ]; then
        echo "DNS IP for $domain: $dns_ip"
    else
        echo "No DNS IP address found for the domain $domain."
    fi

    # Clean up the temporary file
    rm "$temp_file"
}

# Usage example
# tetra_nginx_test_route_long "dev.pixeljamarcade.com"

