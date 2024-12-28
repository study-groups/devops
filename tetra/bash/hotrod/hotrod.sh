hotrod_remote() {
    # Arguments for server and user with default values
    local server="${1:-$TETRA_REMOTE}"
    local user="${2:-root}"

    # Check if server is provided or TETRA_REMOTE is set
    if [ -z "$server" ]; then
        echo "Server is not specified and TETRA_REMOTE is not set."
        return 1
    fi

    # SSH and execute the hotrod function remotely using a here-document
    ssh "${user}@${server}" bash << 'EOF'
hotrod() {
    local fifo_path="/tmp/myfifo"
    
    # Ensure the FIFO exists; create it if it doesn't
    if [[ ! -p "$fifo_path" ]]; then
        mkfifo "$fifo_path"
        echo "FIFO created at $fifo_path"
    fi

    # Read from stdin and write to the FIFO
    cat > "$fifo_path"
}
hotrod
EOF
}
hotrod_multi_remote() {
    # Arguments for server and user with default values
    local server="${1:-$TETRA_REMOTE}"
    local user="${2:-root}"

    # Check if server is provided or TETRA_REMOTE is set
    if [ -z "$server" ]; then
        echo "Server is not specified and TETRA_REMOTE is not set."
        return 1
    fi

    # Generate a unique FIFO name using the current timestamp
    local fifo_name="myfifo_$(date +%s)"

    # SSH and execute the hotrod function remotely using a here-document
    ssh "${user}@${server}" bash << EOF
hotrod_multi() {
    local fifo_path="/tmp/${fifo_name}"
    
    # Ensure the FIFO exists; create it if it doesn't
    if [[ ! -p "\$fifo_path" ]]; then
        mkfifo "\$fifo_path"
        echo "FIFO created at \$fifo_path"
    fi

    # Output the FIFO path for user information
    echo "Writing to FIFO at \$fifo_path. To read from this FIFO, use 'cat \$fifo_path' on the server."

    # Read from stdin and write to the FIFO
    cat > "\$fifo_path"
}
hotrod
EOF
}
