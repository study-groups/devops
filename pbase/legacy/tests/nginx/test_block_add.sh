export test_config="/tmp/test_nginx.conf"
export block_content="Your new block content here"

# Create a dummy NGINX config file
cat <<EOF > "$test_config"
server {
    listen 80;
    server_name test.local;
}
EOF

$VERBOSE && echo "Initial contents of $test_config:"
$VERBOSE && cat "$test_config"

# Add block and capture the output
$VERBOSE && echo "Adding block..."
$VERBOSE && echo " block_content=$block_content"
$VERBOSE && echo " test_config=$test_config"

output=$(pbase_nginx_block_add "$test_config" "$block_content")
$VERBOSE && echo "Output of pbase_nginx_block_add:"
$VERBOSE && echo "$output"

$VERBOSE && echo "Contents of $test_config after adding block:"
$VERBOSE && cat "$test_config"
$VERBOSE && echo "Checking if block was added within server block..."
if grep -q "server {" "$test_config" && grep -q "$block_content" "$test_config" && \
   awk '/server {/,/}/ {if ($0 ~ /'"$block_content"'/) found=1} END {exit !found}' "$test_config"; then
    $VERBOSE && echo "Block added successfully within server block"
    return 0
else
    $VERBOSE && echo "Failed to add block within server block"
    return 1
fi