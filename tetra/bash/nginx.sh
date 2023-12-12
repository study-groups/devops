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

    cat <<EOF
    location $location {
       proxy_http_version 1.1;
       proxy_set_header X-Real-IP \$remote_addr;
       proxy_set_header X-Forwarded-Proto https;
       proxy_ssl_server_name on;
       proxy_set_header Host \$host;
       proxy_redirect off;
       proxy_pass http://$proxy_host:$proxy_port/;
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
