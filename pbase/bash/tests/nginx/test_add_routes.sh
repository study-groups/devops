local test_config="/tmp/test_nginx.conf"
local route_path="${NGINX_ROUTE:-/test-remove}"

# Create a dummy NGINX config file
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

# Remove alias route and capture the output
$VERBOSE && echo "Removing alias route..."
output=$(pbase_nginx_route_alias_remove "$route_path" "$test_config")
$VERBOSE && echo "Output of pbase_nginx_route_alias_remove:"
$VERBOSE && echo "$output"

$VERBOSE && echo "Contents of $test_config after removing alias route:"
$VERBOSE && cat "$test_config"

# Check if the alias route was removed
if ! grep -q "location $route_path" "$test_config"; then
    $VERBOSE && echo "Alias route removed successfully"
    return 0
else
    $VERBOSE && echo "Failed to remove alias route"
    return 1
fi