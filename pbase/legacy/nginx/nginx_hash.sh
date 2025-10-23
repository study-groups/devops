
# Function to generate a secure hash
pbase_nginx_generate_hash() {
    local username="$1"
    local hash=$(openssl rand -hex 32)
    echo "$username:$hash" >> "$PBASE_HASH_FILE"
    echo "Generated hash for $username: $hash"
}

# Function to get a hash by username
pbase_nginx_get_hash() {
    local username="$1"
    grep "^$username:" "$PBASE_HASH_FILE" | cut -d':' -f2
}

# Function to revoke a hash by username
pbase_nginx_revoke_hash() {
    local username="$1"
    sed -i "/^$username:/d" "$PBASE_HASH_FILE"
    echo "Revoked hash for $username."
}