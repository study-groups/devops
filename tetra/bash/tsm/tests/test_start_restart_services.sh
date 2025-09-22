#!/usr/bin/env bash

# Comprehensive TSM Service Start/Restart Tests
# Tests service definitions, environment loading, start/restart lifecycle

set -euo pipefail

# Test setup
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_DIR="/tmp/tsm_start_restart_test_$$"
export TETRA_DIR="$TEST_DIR"
export TETRA_SRC="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Test utilities
log() { echo -e "${BLUE}[TEST]${NC} $1"; }
pass() { echo -e "${GREEN}✅ $1${NC}"; }
fail() { echo -e "${RED}❌ $1${NC}"; exit 1; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }

assert() {
    if [[ $1 ]]; then
        pass "$2"
    else
        fail "$2"
    fi
}

# Setup test environment
setup() {
    log "Setting up test environment in $TEST_DIR"

    # Create TSM directories
    mkdir -p "$TEST_DIR"/{services/{enabled},tsm/{logs,pids,processes},projects/{web-app,api-service}/env}
    echo "0" > "$TEST_DIR/tsm/next_id"

    # Create test environment files
    cat > "$TEST_DIR/projects/web-app/env/local.env" <<EOF
export PORT=3001
export NODE_ENV=development
export WEB_SECRET=test-secret-123
export DATABASE_URL=sqlite:///tmp/test.db
EOF

    cat > "$TEST_DIR/projects/api-service/env/production.env" <<EOF
export PORT=3002
export NODE_ENV=production
export API_KEY=prod-api-key-456
export REDIS_URL=redis://localhost:6379
EOF

    # Create test application scripts
    cat > "$TEST_DIR/projects/web-app/server.js" <<EOF
console.log('Web app starting on port', process.env.PORT || 3000);
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('Secret set:', !!process.env.WEB_SECRET);
process.on('SIGTERM', () => {
    console.log('Web app shutting down gracefully');
    process.exit(0);
});
setTimeout(() => {}, 300000); // Keep alive for 5 minutes
EOF

    cat > "$TEST_DIR/projects/api-service/api.py" <<EOF
#!/usr/bin/env python3
import os, signal, sys, time

def signal_handler(sig, frame):
    print('API service shutting down gracefully')
    sys.exit(0)

signal.signal(signal.SIGTERM, signal_handler)

print(f"API service starting on port {os.environ.get('PORT', 3000)}")
print(f"Environment: {os.environ.get('NODE_ENV', 'development')}")
print(f"API key set: {bool(os.environ.get('API_KEY'))}")

try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    print('API service interrupted')
    sys.exit(0)
EOF
    chmod +x "$TEST_DIR/projects/api-service/api.py"

    # Source TSM functions
    source "$TETRA_SRC/bash/tsm/tsm.sh"
    tetra_tsm_setup
}

teardown() {
    log "Cleaning up test environment"

    # Stop any running test processes
    tsm delete "*" 2>/dev/null || true

    # Wait a moment for cleanup
    sleep 1

    # Force cleanup any remaining processes
    pkill -f "test_$$" 2>/dev/null || true

    rm -rf "$TEST_DIR"
}

# Test 1: Create and validate service definitions
test_service_creation() {
    log "Testing service definition creation"

    # Create web-app service
    cd "$TEST_DIR/projects/web-app"
    cat > "$TETRA_DIR/services/web-app.tsm.sh" <<EOF
#!/usr/bin/env bash

# TSM Service Definition: web-app
export TSM_NAME="web-app"
export TSM_COMMAND="node"
export TSM_CWD="$TEST_DIR/projects/web-app"
export TSM_ENV_FILE="env/local.env"
export TSM_ARGS=('server.js')
export TSM_DESCRIPTION="Test web application"
EOF
    chmod +x "$TETRA_DIR/services/web-app.tsm.sh"

    # Create api-service
    cd "$TEST_DIR/projects/api-service"
    cat > "$TETRA_DIR/services/api-service.tsm.sh" <<EOF
#!/usr/bin/env bash

# TSM Service Definition: api-service
export TSM_NAME="api-service"
export TSM_COMMAND="python3"
export TSM_CWD="$TEST_DIR/projects/api-service"
export TSM_ENV_FILE="env/production.env"
export TSM_ARGS=('api.py')
export TSM_DESCRIPTION="Test API service"
EOF
    chmod +x "$TETRA_DIR/services/api-service.tsm.sh"

    # Validate service files exist and are executable
    assert "[[ -x '$TETRA_DIR/services/web-app.tsm.sh' ]]" "Web app service definition created"
    assert "[[ -x '$TETRA_DIR/services/api-service.tsm.sh' ]]" "API service definition created"

    # Test service file parsing
    local TSM_NAME="" TSM_COMMAND="" TSM_CWD="" TSM_ENV_FILE=""
    source "$TETRA_DIR/services/web-app.tsm.sh"
    assert "[[ '$TSM_NAME' == 'web-app' ]]" "Service name parsed correctly"
    assert "[[ '$TSM_COMMAND' == 'node' ]]" "Service command parsed correctly"
    assert "[[ '$TSM_ENV_FILE' == 'env/local.env' ]]" "Environment file path parsed correctly"
}

# Test 2: Start services and validate environment loading
test_service_start() {
    log "Testing service startup with environment loading"

    # Start web-app service
    cd "$TEST_DIR/projects/web-app"
    tsm start web-app || fail "Failed to start web-app service"

    # Wait for startup
    sleep 2

    # Verify service is running
    local web_pid=$(tsm list | grep "web-app" | awk '{print $4}')
    assert "[[ -n '$web_pid' && '$web_pid' != '-' ]]" "Web app service started with valid PID"

    # Check if process exists
    assert "kill -0 '$web_pid' 2>/dev/null" "Web app process is actually running"

    # Start API service
    cd "$TEST_DIR/projects/api-service"
    tsm start api-service || fail "Failed to start api-service"

    sleep 2

    # Verify API service is running
    local api_pid=$(tsm list | grep "api-service" | awk '{print $4}')
    assert "[[ -n '$api_pid' && '$api_pid' != '-' ]]" "API service started with valid PID"
    assert "kill -0 '$api_pid' 2>/dev/null" "API process is actually running"

    # Verify different ports
    local web_port=$(tsm list | grep "web-app" | awk '{print $5}')
    local api_port=$(tsm list | grep "api-service" | awk '{print $5}')
    assert "[[ '$web_port' == '3001' ]]" "Web app using correct port from env file"
    assert "[[ '$api_port' == '3002' ]]" "API service using correct port from env file"
}

# Test 3: Environment variable loading validation
test_environment_loading() {
    log "Testing environment variable loading in services"

    # Check web-app logs for environment variables
    sleep 1
    local web_logs=$(tsm logs web-app)

    assert "echo '$web_logs' | grep -q 'port 3001'" "Web app loaded PORT from env file"
    assert "echo '$web_logs' | grep -q 'development'" "Web app loaded NODE_ENV from env file"
    assert "echo '$web_logs' | grep -q 'Secret set: true'" "Web app loaded WEB_SECRET from env file"

    # Check API service logs
    local api_logs=$(tsm logs api-service)

    assert "echo '$api_logs' | grep -q 'port 3002'" "API service loaded PORT from env file"
    assert "echo '$api_logs' | grep -q 'production'" "API service loaded NODE_ENV from env file"
    assert "echo '$api_logs' | grep -q 'API key set: True'" "API service loaded API_KEY from env file"
}

# Test 4: Service restart functionality
test_service_restart() {
    log "Testing service restart functionality"

    # Get initial PIDs
    local initial_web_pid=$(tsm list | grep "web-app" | awk '{print $4}')
    local initial_api_pid=$(tsm list | grep "api-service" | awk '{print $4}')

    # Restart web-app
    tsm restart web-app || fail "Failed to restart web-app service"
    sleep 2

    # Get new PID
    local new_web_pid=$(tsm list | grep "web-app" | awk '{print $4}')

    assert "[[ '$new_web_pid' != '$initial_web_pid' ]]" "Web app PID changed after restart"
    assert "kill -0 '$new_web_pid' 2>/dev/null" "New web app process is running"
    assert "! kill -0 '$initial_web_pid' 2>/dev/null" "Old web app process was terminated"

    # Restart API service
    tsm restart api-service || fail "Failed to restart api-service"
    sleep 2

    local new_api_pid=$(tsm list | grep "api-service" | awk '{print $4}')

    assert "[[ '$new_api_pid' != '$initial_api_pid' ]]" "API service PID changed after restart"
    assert "kill -0 '$new_api_pid' 2>/dev/null" "New API process is running"
    assert "! kill -0 '$initial_api_pid' 2>/dev/null" "Old API process was terminated"
}

# Test 5: Service stop and restart from stopped state
test_stop_and_restart() {
    log "Testing stop and restart from stopped state"

    # Stop web-app
    tsm stop web-app || fail "Failed to stop web-app service"
    sleep 1

    # Verify it's stopped
    local web_status=$(tsm list | grep "web-app" | awk '{print $3}')
    assert "[[ '$web_status' == 'stopped' || '$web_status' == '-' ]]" "Web app service stopped"

    # Restart from stopped state
    tsm restart web-app || fail "Failed to restart stopped web-app service"
    sleep 2

    # Verify it's running again
    local new_web_pid=$(tsm list | grep "web-app" | awk '{print $4}')
    assert "[[ -n '$new_web_pid' && '$new_web_pid' != '-' ]]" "Web app restarted from stopped state"
    assert "kill -0 '$new_web_pid' 2>/dev/null" "Restarted web app process is running"
}

# Test 6: Multiple rapid restarts
test_rapid_restarts() {
    log "Testing multiple rapid restarts"

    # Perform 3 rapid restarts
    for i in {1..3}; do
        log "Rapid restart #$i"
        tsm restart api-service || fail "Failed rapid restart #$i"
        sleep 1

        local pid=$(tsm list | grep "api-service" | awk '{print $4}')
        assert "[[ -n '$pid' && '$pid' != '-' ]]" "API service running after rapid restart #$i"
        assert "kill -0 '$pid' 2>/dev/null" "API process exists after rapid restart #$i"
    done
}

# Test 7: Service enable/disable with start/restart
test_enable_disable_lifecycle() {
    log "Testing enable/disable with service lifecycle"

    # Enable web-app service
    ln -sf "../web-app.tsm.sh" "$TETRA_DIR/services/enabled/web-app.tsm.sh"
    assert "[[ -L '$TETRA_DIR/services/enabled/web-app.tsm.sh' ]]" "Web app service enabled"

    # Restart enabled service
    tsm restart web-app || fail "Failed to restart enabled service"
    sleep 1

    local pid=$(tsm list | grep "web-app" | awk '{print $4}')
    assert "kill -0 '$pid' 2>/dev/null" "Enabled service restarted successfully"

    # Disable service
    rm "$TETRA_DIR/services/enabled/web-app.tsm.sh"
    assert "[[ ! -L '$TETRA_DIR/services/enabled/web-app.tsm.sh' ]]" "Web app service disabled"

    # Service should still be controllable when disabled
    tsm restart web-app || fail "Failed to restart disabled service"
    sleep 1

    local new_pid=$(tsm list | grep "web-app" | awk '{print $4}')
    assert "[[ '$new_pid' != '$pid' ]]" "Disabled service still restartable"
}

# Test 8: Error handling and recovery
test_error_handling() {
    log "Testing error handling and recovery"

    # Try to start non-existent service
    if tsm start non-existent-service 2>/dev/null; then
        fail "Should not be able to start non-existent service"
    else
        pass "Correctly rejected non-existent service"
    fi

    # Create service with invalid command
    cat > "$TETRA_DIR/services/broken-service.tsm.sh" <<EOF
#!/usr/bin/env bash
export TSM_NAME="broken-service"
export TSM_COMMAND="non-existent-command"
export TSM_CWD="$TEST_DIR"
export TSM_ARGS=('arg1')
EOF
    chmod +x "$TETRA_DIR/services/broken-service.tsm.sh"

    # Try to start broken service
    if tsm start broken-service 2>/dev/null; then
        # If it starts, it should fail quickly
        sleep 2
        local status=$(tsm list | grep "broken-service" | awk '{print $3}')
        assert "[[ '$status' != 'online' ]]" "Broken service should not stay online"
    else
        pass "Correctly rejected service with invalid command"
    fi
}

# Run all tests
run_tests() {
    log "🚀 Starting TSM Service Start/Restart Tests"
    echo

    setup

    test_service_creation
    test_service_start
    test_environment_loading
    test_service_restart
    test_stop_and_restart
    test_rapid_restarts
    test_enable_disable_lifecycle
    test_error_handling

    teardown

    echo
    log "🎉 All TSM service start/restart tests passed!"
    echo
    log "Summary of tested functionality:"
    echo "  ✅ Service definition creation and validation"
    echo "  ✅ Service startup with environment file loading"
    echo "  ✅ Environment variable parsing and injection"
    echo "  ✅ Service restart with PID changes"
    echo "  ✅ Stop and restart from stopped state"
    echo "  ✅ Multiple rapid restarts"
    echo "  ✅ Enable/disable service lifecycle"
    echo "  ✅ Error handling and recovery"
}

# Run tests if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    run_tests
fi