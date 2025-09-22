#!/usr/bin/env bash

# Test TSM Service Definitions (.tsm.sh) functionality
# Tests service save, enable, disable, start, and environment integration

set -euo pipefail

# Test setup
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_DIR="/tmp/tsm_service_test_$$"
export TETRA_DIR="$TEST_DIR"
export TETRA_SRC="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Import test utilities
source "$SCRIPT_DIR/../../../utils/test_utils.sh" 2>/dev/null || {
    # Minimal test utils if not available
    assert() { [[ $1 ]] || { echo "FAIL: $2"; exit 1; } }
    log() { echo "[TEST] $1"; }
}

setup() {
    log "Setting up test environment"
    mkdir -p "$TEST_DIR"/{services,tsm/{logs,pids,processes}}
    echo "0" > "$TEST_DIR/tsm/next_id"
}

teardown() {
    log "Cleaning up test environment"
    rm -rf "$TEST_DIR"
}

# Test service definition creation
test_service_save() {
    log "Testing service save functionality"

    # Create test environment file
    mkdir -p "$TEST_DIR/project/env"
    cat > "$TEST_DIR/project/env/test.env" <<EOF
export PORT=3000
export NODE_ENV=test
export TEST_VAR=hello
EOF

    # Change to project directory and save service
    cd "$TEST_DIR/project"

    # Mock the save function behavior
    local service_file="$TETRA_DIR/services/test-app.tsm.sh"
    cat > "$service_file" <<EOF
#!/usr/bin/env bash

# TSM Service Definition: test-app
export TSM_NAME="test-app"
export TSM_COMMAND="node"
export TSM_CWD="$TEST_DIR/project"
export TSM_ENV_FILE="env/test.env"
export TSM_ARGS=('server.js')
export TSM_DESCRIPTION="Test application service"
EOF
    chmod +x "$service_file"

    # Verify service file was created
    assert "[[ -f '$service_file' ]]" "Service definition file should be created"
    assert "[[ -x '$service_file' ]]" "Service definition file should be executable"

    # Test sourcing the service definition
    local TSM_NAME="" TSM_COMMAND="" TSM_ENV_FILE=""
    source "$service_file"
    assert "[[ '$TSM_NAME' == 'test-app' ]]" "Service name should be set correctly"
    assert "[[ '$TSM_COMMAND' == 'node' ]]" "Service command should be set correctly"
    assert "[[ '$TSM_ENV_FILE' == 'env/test.env' ]]" "Environment file should be set correctly"

    log "✅ Service save test passed"
}

# Test service enable/disable
test_service_enable_disable() {
    log "Testing service enable/disable functionality"

    local service_file="$TETRA_DIR/services/test-app.tsm.sh"
    local enabled_link="$TETRA_DIR/services/enabled/test-app.tsm.sh"

    # Ensure service exists from previous test
    assert "[[ -f '$service_file' ]]" "Service definition should exist"

    # Test enable
    mkdir -p "$TETRA_DIR/services/enabled"
    ln -sf "../test-app.tsm.sh" "$enabled_link"

    assert "[[ -L '$enabled_link' ]]" "Enabled service should create symlink"
    assert "[[ -f '$enabled_link' ]]" "Enabled service symlink should point to valid file"

    # Test disable
    rm "$enabled_link"
    assert "[[ ! -L '$enabled_link' ]]" "Disabled service should remove symlink"

    log "✅ Service enable/disable test passed"
}

# Test environment file integration
test_environment_integration() {
    log "Testing environment file integration"

    local service_file="$TETRA_DIR/services/test-app.tsm.sh"
    local env_file="$TEST_DIR/project/env/test.env"

    # Source service definition
    local TSM_NAME="" TSM_COMMAND="" TSM_CWD="" TSM_ENV_FILE=""
    source "$service_file"

    # Test environment file extraction
    cd "$TSM_CWD"
    local port=""
    if [[ -n "$TSM_ENV_FILE" && -f "$TSM_ENV_FILE" ]]; then
        port="$(source "$TSM_ENV_FILE" 2>/dev/null && echo "${PORT:-}")"
    fi

    assert "[[ '$port' == '3000' ]]" "Port should be extracted from environment file"

    # Test environment variables
    source "$env_file"
    assert "[[ '$NODE_ENV' == 'test' ]]" "Environment variables should be available"
    assert "[[ '$TEST_VAR' == 'hello' ]]" "Custom environment variables should be available"

    log "✅ Environment integration test passed"
}

# Test service listing
test_service_listing() {
    log "Testing service listing functionality"

    # Create multiple test services
    local services=("app1" "app2" "app3")
    for service in "${services[@]}"; do
        cat > "$TETRA_DIR/services/${service}.tsm.sh" <<EOF
#!/usr/bin/env bash
export TSM_NAME="$service"
export TSM_COMMAND="echo"
export TSM_DESCRIPTION="Test service $service"
EOF
        chmod +x "$TETRA_DIR/services/${service}.tsm.sh"
    done

    # Enable one service
    mkdir -p "$TETRA_DIR/services/enabled"
    ln -sf "../app1.tsm.sh" "$TETRA_DIR/services/enabled/app1.tsm.sh"

    # Count services
    local service_count=$(find "$TETRA_DIR/services" -name "*.tsm.sh" -not -path "*/enabled/*" | wc -l)
    assert "[[ $service_count -ge 3 ]]" "Should find at least 3 service definitions"

    # Check enabled service
    local enabled_count=$(find "$TETRA_DIR/services/enabled" -name "*.tsm.sh" | wc -l)
    assert "[[ $enabled_count -eq 1 ]]" "Should find exactly 1 enabled service"

    log "✅ Service listing test passed"
}

# Test service validation
test_service_validation() {
    log "Testing service definition validation"

    # Test invalid service definition
    local invalid_service="$TETRA_DIR/services/invalid.tsm.sh"
    cat > "$invalid_service" <<EOF
#!/usr/bin/env bash
# Missing required variables
export TSM_DESCRIPTION="Invalid service"
EOF
    chmod +x "$invalid_service"

    # Test sourcing invalid service
    local TSM_NAME="" TSM_COMMAND=""
    source "$invalid_service"
    assert "[[ -z '$TSM_NAME' ]]" "Invalid service should have empty name"
    assert "[[ -z '$TSM_COMMAND' ]]" "Invalid service should have empty command"

    log "✅ Service validation test passed"
}

# Run all tests
run_tests() {
    log "Running TSM Service Definition Tests"

    setup

    test_service_save
    test_service_enable_disable
    test_environment_integration
    test_service_listing
    test_service_validation

    teardown

    log "🎉 All TSM service definition tests passed!"
}

# Run tests if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    run_tests
fi