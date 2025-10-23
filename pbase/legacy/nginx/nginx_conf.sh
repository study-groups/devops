#!/bin/bash

pbase_nginx_config() {
    pbase_nginx_config_create
    pbase_nginx_config_add_block
    pbase_nginx_config_add_alias
    pbase_nginx_config_report_aliases

    echo "NGINX configuration process completed."
}

pbase_nginx_config_create() {
    local config_file="${1:-}"

    # Prompt the user for the config file path if not provided
    if [ -z "$config_file" ]; then
        read -p "Enter the path for the NGINX config file (default: $NGINX_CONF_PATH): " user_input
        config_file="${user_input:-$NGINX_CONF_PATH}"
    fi

    # Ensure the config file exists
    if [ ! -f "$config_file" ]; then
        echo "Config file $config_file does not exist. Creating it..."
        cat <<EOF > "$config_file"
server {
    listen 80;
    server_name example.com;

    root /var/www/html;
    index index.html;

    location / {
        try_files \$uri \$uri/ =404;
    }
}
EOF
        echo "Initial NGINX configuration created at $config_file"
    else
        echo "Config file $config_file already exists."
    fi
}

pbase_nginx_config_add_alias() {
    # Step 3: Add an alias
    read -p "Enter the route you want to add the alias to (default: $NGINX_ROUTE): " route_path
    route_path=${route_path:-$NGINX_ROUTE}
    read -p "Enter the alias you want to add (default: $NGINX_ALIAS): " alias_path
    alias_path=${alias_path:-$NGINX_ALIAS}

    # Check if the alias already exists
    if grep -q "alias[[:space:]]\+$alias_path" "$NGINX_CONF_PATH"; then
        echo "Alias $alias_path already exists for route $route_path."
    else
        echo "Adding alias: $alias_path to route: $route_path..."
        pbase_nginx_route_alias_add "$route_path" "$alias_path" "$NGINX_CONF_PATH"
        echo "Alias added."
    fi
    echo "Contents of $NGINX_CONF_PATH after adding alias:"
    cat "$NGINX_CONF_PATH"
}

pbase_nginx_config_report_aliases() {
    # Step 4: Report the aliases
    echo "Current aliases in $NGINX_CONF_PATH:"
    grep "alias" "$NGINX_CONF_PATH"
}

pbase_nginx_config_add_block() {
    # Ensure NGINX_CONF_PATH is set from env.sh
    if [ -z "$NGINX_CONF_PATH" ]; then
        echo "Error: NGINX_CONF_PATH must be set in env.sh"
        return 1
    fi
    # Step 2: Add NGINX block to the config file
    echo "Adding NGINX block to $NGINX_CONF_PATH..."
    pbase_nginx_block_add "$NGINX_CONF_PATH" "Your new block content here"  # Adjust as needed
    echo "NGINX block added."
    echo "Contents of $NGINX_CONF_PATH after adding NGINX block:"
    cat "$NGINX_CONF_PATH"
}