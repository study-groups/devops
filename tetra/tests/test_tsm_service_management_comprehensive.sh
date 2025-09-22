#!/usr/bin/env bash

# TSM Service Management Comprehensive Test Suite
# Tests the nginx-style service enable/disable system as mentioned in next.md

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== TSM Service Management Comprehensive Test Suite ===${NC}"

# Test tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Setup test environment
TEST_DIR="/tmp/tsm_service_test_$$"
mkdir -p "$TEST_DIR"
export TETRA_SRC="${TETRA_SRC:-${PWD%/tests}}"
export TETRA_DIR="$TEST_DIR/tetra"

# Create test structure
mkdir -p "$TETRA_DIR"/{services,services/enabled,tsm/{logs,pids,processes}}

# Cleanup function
cleanup() {
    rm -rf "$TEST_DIR"
}
trap cleanup EXIT

test_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED_TESTS++))
}

test_fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED_TESTS++))
}

run_test() {
    ((TOTAL_TESTS++))
    if "$@"; then
        return 0
    else
        return 1
    fi
}

echo -e "${BLUE}=== Testing Service Definition Creation ===${NC}"

# Test 1: Service definition creation with tsm save
test_service_definition_creation() {
    cd "$TETRA_DIR"

    # Load TSM if available
    if [[ -f "$TETRA_SRC/bash/tsm/tsm.sh" ]]; then
        source "$TETRA_SRC/bash/tsm/tsm.sh" || return 1

        # Test tsm save command
        if tsm save "web-server" "python3 -m http.server 8080" 2>/dev/null; then
            if [[ -f "$TETRA_DIR/services/web-server.tsm.sh" ]]; then
                # Verify service file content
                if grep -q 'TSM_NAME="web-server"' "$TETRA_DIR/services/web-server.tsm.sh" && \
                   grep -q 'TSM_COMMAND="python3 -m http.server 8080"' "$TETRA_DIR/services/web-server.tsm.sh"; then
                    test_pass "Service definition creation with tsm save"
                    return 0
                fi
            fi
        fi
    fi

    test_fail "Service definition creation failed"
    return 1
}
run_test test_service_definition_creation

# Test 2: Enable/disable functionality with symlinks
test_service_enable_disable() {
    cd "$TETRA_DIR"

    if [[ -f "$TETRA_SRC/bash/tsm/tsm.sh" ]]; then
        source "$TETRA_SRC/bash/tsm/tsm.sh" || return 1

        # Test enable functionality
        if tsm enable "web-server" 2>/dev/null; then
            if [[ -L "$TETRA_DIR/services/enabled/web-server.tsm.sh" ]]; then
                # Verify symlink target
                local target=$(readlink "$TETRA_DIR/services/enabled/web-server.tsm.sh")
                if [[ "$target" == "../web-server.tsm.sh" ]]; then

                    # Test disable functionality
                    if tsm disable "web-server" 2>/dev/null; then
                        if [[ ! -L "$TETRA_DIR/services/enabled/web-server.tsm.sh" ]]; then
                            test_pass "Enable/disable functionality with symlinks"
                            return 0
                        fi
                    fi
                fi
            fi
        fi
    fi

    test_fail "Service enable/disable failed"
    return 1
}
run_test test_service_enable_disable

# Test 3: Service persistence across restarts
test_service_persistence() {
    cd "$TETRA_DIR"

    if [[ -f "$TETRA_SRC/bash/tsm/tsm.sh" ]]; then
        source "$TETRA_SRC/bash/tsm/tsm.sh" || return 1

        # Create and enable a service
        if tsm save "persistent-service" "node app.js" 2>/dev/null && \
           tsm enable "persistent-service" 2>/dev/null; then

            # Verify enabled service persists
            if [[ -L "$TETRA_DIR/services/enabled/persistent-service.tsm.sh" ]] && \
               [[ -f "$TETRA_DIR/services/persistent-service.tsm.sh" ]]; then

                # Simulate restart by sourcing TSM again
                source "$TETRA_SRC/bash/tsm/tsm.sh" || return 1

                # Check if service is still enabled
                if [[ -L "$TETRA_DIR/services/enabled/persistent-service.tsm.sh" ]]; then
                    test_pass "Service persistence across restarts"
                    return 0
                fi
            fi
        fi
    fi

    test_fail "Service persistence failed"
    return 1
}
run_test test_service_persistence

# Test 4: Service configuration validation
test_service_config_validation() {
    cd "$TETRA_DIR"

    # Create a malformed service definition
    cat > "$TETRA_DIR/services/bad-service.tsm.sh" << 'EOF'
# Missing required TSM_NAME
TSM_COMMAND="invalid command"
# Missing TSM_CWD
EOF

    # Create a valid service definition
    cat > "$TETRA_DIR/services/good-service.tsm.sh" << 'EOF'
TSM_NAME="good-service"
TSM_COMMAND="python3 -m http.server 9000"
TSM_CWD="/tmp"
TSM_PORT="9000"
EOF

    if [[ -f "$TETRA_SRC/bash/tsm/tsm.sh" ]]; then
        source "$TETRA_SRC/bash/tsm/tsm.sh" || return 1

        # Valid service should work
        if tsm show "good-service" 2>/dev/null >/dev/null; then
            test_pass "Service configuration validation"
            return 0
        fi
    fi

    test_fail "Service configuration validation failed"
    return 1
}
run_test test_service_config_validation

# Test 5: Error handling for missing services
test_error_handling() {
    cd "$TETRA_DIR"

    if [[ -f "$TETRA_SRC/bash/tsm/tsm.sh" ]]; then
        source "$TETRA_SRC/bash/tsm/tsm.sh" || return 1

        # Test enable non-existent service
        if ! tsm enable "non-existent-service" 2>/dev/null; then
            # Test show non-existent service
            if ! tsm show "non-existent-service" 2>/dev/null; then
                # Test disable non-existent service
                if ! tsm disable "non-existent-service" 2>/dev/null; then
                    test_pass "Error handling for missing services"
                    return 0
                fi
            fi
        fi
    fi

    test_fail "Error handling failed"
    return 1
}
run_test test_error_handling

echo -e "${BLUE}=== Testing Service Templates ===${NC}"

# Test 6: Service template files exist
test_service_templates_exist() {
    local template_dir="$TETRA_SRC/templates"
    local systemd_templates="$template_dir/systemd"
    local nginx_templates="$template_dir/nginx"

    local template_count=0

    if [[ -d "$systemd_templates" ]]; then
        template_count=$((template_count + $(find "$systemd_templates" -name "*.service" | wc -l)))
    fi

    if [[ -d "$nginx_templates" ]]; then
        template_count=$((template_count + $(find "$nginx_templates" -name "*.conf" | wc -l)))
    fi

    if [[ $template_count -gt 0 ]]; then
        test_pass "Service templates exist ($template_count templates found)"
        return 0
    else
        test_fail "No service templates found"
        return 1
    fi
}
run_test test_service_templates_exist

echo -e "${BLUE}=== Test Summary ===${NC}"
echo "Total tests: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"

if [[ $TOTAL_TESTS -gt 0 ]]; then
    SUCCESS_RATE=$(( (PASSED_TESTS * 100) / TOTAL_TESTS ))
    echo -e "Success rate: ${YELLOW}${SUCCESS_RATE}%${NC}"
fi

echo -e "${BLUE}=== TSM Service Management Status ===${NC}"
echo "Service directory: $TETRA_DIR/services/"
echo "Enabled services: $TETRA_DIR/services/enabled/"
echo "Templates: $TETRA_SRC/templates/"

if [[ $FAILED_TESTS -gt 0 ]]; then
    echo -e "${RED}Some TSM service management tests failed${NC}"
    exit 1
else
    echo -e "${GREEN}All TSM service management tests passed!${NC}"
fi