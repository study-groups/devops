
# Set up test variables
route_path="${NGINX_ROUTE:-/test-remove}"
config_file="/tmp/test_nginx.conf"
VERBOSE=true

# Create a test config file with a location block
cat <<EOF > "$config_file"
server {
    listen 80;
    server_name test.local;

    ${NGINX_TAG_START}
    location $route_path {
        alias /var/www/test-remove;
    }
    ${NGINX_TAG_END}
}
EOF

# Call the function with VERBOSE set to true
pbase_nginx_route_alias_remove "$route_path" "$config_file" "$VERBOSE"

# Output the contents of the config file after the function call
echo "Contents of $config_file after removing alias route:"
cat "$config_file"
