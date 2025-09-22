#!/usr/bin/env bash

# Test script for TSM ID functionality
# Creates test server and validates TSM ID operations

TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TSM_DIR="$(dirname "$TEST_DIR")"

# Source tsm functions
source "$TSM_DIR/tsm.sh"

# Test server script
create_test_server() {
    local port="$1"
    cat > "$TEST_DIR/test_server_$port.sh" << EOF
#!/usr/bin/env bash
export PORT=$port

echo "Test server starting on port \$PORT"
while true; do
    echo "\$(date): Server running on port \$PORT"
    sleep 5
done
EOF
    chmod +x "$TEST_DIR/test_server_$port.sh"
}

cleanup() {
    echo "Cleaning up test processes..."
    tsm delete "*" 2>/dev/null || true
    rm -f "$TEST_DIR"/test_server_*.sh 2>/dev/null || true
}

# Test TSM ID functionality
test_tsm_id() {
    echo "=== Testing TSM ID functionality =="
    
    # Setup
    tsm setup
    cleanup
    
    # Create test servers
    create_test_server 3001
    create_test_server 3002
    
    echo "Starting test servers..."
    tsm start "$TEST_DIR/test_server_3001.sh"
    tsm start "$TEST_DIR/test_server_3002.sh"
    
    echo "Process list:"
    tsm list
    
    echo "Testing logs by ID..."
    tsm logs 0 --lines 2 --nostream
    
    echo "Testing stop by ID..."
    tsm stop 0
    
    echo "Testing restart by ID..."
    tsm restart 1
    
    echo "Final process list:"
    tsm list
    
    echo "Cleaning up..."
    cleanup
    
    echo "=== TSM ID tests completed ==="
}

# Run tests if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    test_tsm_id
fi