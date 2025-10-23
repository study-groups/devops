export test_config="/tmp/test_nginx.conf"
export route_path="${NGINX_ROUTE:-/test-add}"
export alias_path="${NGINX_ALIAS:-/var/www/test-add}"

# Create a dummy NGINX config file
cat <<EOF > "$test_config"
server {
    listen 80;
    server_name test.local;

    ${NGINX_TAG_START}
    ${NGINX_TAG_END}
}
EOF

$VERBOSE && echo "Initial contents of $test_config:"
$VERBOSE && cat "$test_config"

# Add alias route and capture the output
$VERBOSE && echo "Adding alias route..."
$VERBOSE && echo " route_path=$route_path"
$VERBOSE && echo " alias_path=$alias_path"
$VERBOSE && echo " test_config=$test_config"

output=$(pbase_nginx_route_alias_add "$route_path" "$alias_path" "$test_config")
$VERBOSE && echo "Output of pbase_nginx_route_alias_add:"
$VERBOSE && echo "$output"

$VERBOSE && echo "Contents of $test_config after adding alias route:"
$VERBOSE && cat "$test_config"
$VERBOSE && echo "Checking if alias route was added..."
if grep -q "location $route_path" "$test_config"; then
    $VERBOSE && echo "Alias route added successfully"
    return 0
else
    $VERBOSE && echo "Failed to add alias route"
    return 1
fi