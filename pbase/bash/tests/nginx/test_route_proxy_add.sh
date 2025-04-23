local test_config="/tmp/test_nginx.conf"
local route_path="/test-add"
local proxy_pass="http://localhost:8080"

# Create a dummy NGINX config file
cat <<EOF > "$test_config"
server {
    listen 80;
    server_name test.local;

    # PBASE_START
    # PBASE_END
}
EOF

$VERBOSE && echo "Initial contents of $test_config:"
$VERBOSE && cat "$test_config"

# Add route and capture the output
output=$(pbase_nginx_route_proxy_add "$route_path" "$proxy_pass" "$test_config")

# Check if the route was added
if grep -q "location $route_path" "$test_config"; then
    $VERBOSE && echo "Route found in config file. Test passed."
    return 0
else
    echo "Failed to find route in config file. Test failed."
    return 1
fi