local test_config="/tmp/test_nginx.conf"
local route_path="${NGINX_ROUTE:-/test-remove}"

# Create a dummy NGINX config file with a route
cat <<EOF > "$test_config"
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

$VERBOSE && echo "Initial contents of $test_config:"
$VERBOSE && cat "$test_config"

# Remove the route and capture the output
$VERBOSE && echo "Removing route..."
output=$(pbase_nginx_route_alias_remove "$route_path" "$test_config")
$VERBOSE && echo "Output of pbase_nginx_route_remove:"
$VERBOSE && echo "$output"

$VERBOSE && echo "Contents of $test_config after removal attempt:"
$VERBOSE && cat "$test_config"

# Check if the route was removed
if grep -q "location $route_path" "$test_config"; then
    return 1
else
    return 0
fi
