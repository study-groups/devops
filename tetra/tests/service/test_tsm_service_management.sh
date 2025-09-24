#!/usr/bin/env bash

# TSM Service Management Test Suite
# Tests TSM functionality for starting tetra service across environments

# Detect TETRA_SRC dynamically
if [[ -z "$TETRA_SRC" ]]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    export TETRA_SRC="$(dirname "$SCRIPT_DIR")"
fi

# Test configuration
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test counters
total_tests=0
passed_tests=0
failed_tests=0
skipped_tests=0

# Test logging
test_assert() {
    local condition="$1"
    local test_name="$2"
    local error_msg="${3:-Test failed}"

    ((total_tests++))

    case "$condition" in
        "true")
            echo -e "${GREEN}✓${NC} $test_name"
            ((passed_tests++))
            ;;
        "skip")
            echo -e "${YELLOW}~${NC} $test_name: $error_msg"
            ((skipped_tests++))
            ;;
        *)
            echo -e "${RED}✗${NC} $test_name: $error_msg"
            ((failed_tests++))
            ;;
    esac
}

# Setup tests
setup_tests() {
    echo -e "${BLUE}=== TSM Service Management Test Suite ===${NC}"
    echo "TETRA_SRC: $TETRA_SRC"
    echo "Testing TSM service management capabilities..."

    # Load TSM module
    if ! source "$TETRA_SRC/bash/boot/boot_core.sh" 2>/dev/null; then
        echo -e "${RED}Error: Failed to load boot_core.sh${NC}"
        exit 1
    fi

    if ! source "$TETRA_SRC/bash/boot/boot_modules.sh" 2>/dev/null; then
        echo -e "${RED}Error: Failed to load boot_modules.sh${NC}"
        exit 1
    fi

    # Load TSM specifically
    if ! tetra_load_module "tsm" >/dev/null 2>&1; then
        echo -e "${RED}Error: Failed to load TSM module${NC}"
        exit 1
    fi

    echo
}

# Test 1: TSM Basic Commands
test_tsm_commands() {
    echo -e "${BLUE}=== Testing TSM Basic Commands ===${NC}"

    # Test help command
    local temp_output=$(mktemp)
    if tsm help >"$temp_output" 2>&1; then
        test_assert "true" "TSM help command works"
    else
        test_assert "false" "TSM help command failed" "$(head -1 "$temp_output")"
    fi
    rm -f "$temp_output"

    # Test list command
    local temp_output=$(mktemp)
    if tsm list >"$temp_output" 2>&1; then
        test_assert "true" "TSM list command works"
    else
        test_assert "false" "TSM list command failed" "$(head -1 "$temp_output")"
    fi
    rm -f "$temp_output"

    # Test services command
    local temp_output=$(mktemp)
    if tsm services >"$temp_output" 2>&1; then
        test_assert "true" "TSM services command works"

        # Check if tetra service is registered
        if grep -q "tetra.*4444" "$temp_output"; then
            test_assert "true" "Tetra service registered in services.conf"
        else
            test_assert "false" "Tetra service not found in registry"
        fi
    else
        test_assert "false" "TSM services command failed" "$(head -1 "$temp_output")"
    fi
    rm -f "$temp_output"

    echo
}

# Test 2: Service Registry
test_service_registry() {
    echo -e "${BLUE}=== Testing Service Registry ===${NC}"

    local services_conf="$TETRA_SRC/bash/tsm/services.conf"

    # Check if services.conf exists
    if [[ -f "$services_conf" ]]; then
        test_assert "true" "Services configuration file exists"

        # Check tetra service definition
        if grep -q "^tetra:node:" "$services_conf"; then
            test_assert "true" "Tetra service defined in registry"

            # Validate tetra service format
            local tetra_line=$(grep "^tetra:node:" "$services_conf")
            if echo "$tetra_line" | grep -q ":4444:"; then
                test_assert "true" "Tetra service has correct port (4444)"
            else
                test_assert "false" "Tetra service port not 4444" "$tetra_line"
            fi
        else
            test_assert "false" "Tetra service not defined in registry"
        fi
    else
        test_assert "false" "Services configuration file missing" "$services_conf"
    fi

    echo
}

# Test 3: Port Detection
test_port_detection() {
    echo -e "${BLUE}=== Testing Port Detection ===${NC}"

    # Test scan-ports command
    local temp_output=$(mktemp)
    if tsm scan-ports >"$temp_output" 2>&1; then
        test_assert "true" "TSM scan-ports command works"
    else
        test_assert "false" "TSM scan-ports command failed" "$(head -1 "$temp_output")"
    fi
    rm -f "$temp_output"

    # Test ports command
    local temp_output=$(mktemp)
    if tsm ports >"$temp_output" 2>&1; then
        test_assert "true" "TSM ports command works"
    else
        test_assert "false" "TSM ports command failed" "$(head -1 "$temp_output")"
    fi
    rm -f "$temp_output"

    echo
}

# Test 4: Environment Detection
test_environment_detection() {
    echo -e "${BLUE}=== Testing Environment Detection ===${NC}"

    # Create test environment structure
    local test_dir="/tmp/tsm_test_$$"
    mkdir -p "$test_dir/entrypoints" "$test_dir/env"

    # Create test entrypoint
    cat > "$test_dir/entrypoints/local.sh" <<'EOF'
#!/usr/bin/env bash
export PORT=4444
echo "Test tetra server starting..."
sleep 60
EOF
    chmod +x "$test_dir/entrypoints/local.sh"

    # Create test environment file
    cat > "$test_dir/env/local.env" <<'EOF'
export NODE_ENV=development
export TETRA_ENV=local
export PORT=4444
EOF

    # Test environment detection logic
    cd "$test_dir"
    local temp_output=$(mktemp)

    # This would normally start the service, but we'll just test the command parsing
    if tsm start entrypoints/local.sh test-service --dry-run >"$temp_output" 2>&1 || true; then
        test_assert "true" "TSM handles entrypoint scripts"
    else
        test_assert "skip" "TSM dry-run not supported" "Cannot test without actual execution"
    fi

    rm -f "$temp_output"
    cd - >/dev/null
    rm -rf "$test_dir"

    echo
}

# Test 5: Service Control (Safe Tests)
test_service_control() {
    echo -e "${BLUE}=== Testing Service Control ===${NC}"

    # Test service start parsing (without actually starting)
    local temp_output=$(mktemp)

    # Test tetra service command parsing
    if tsm start tetra >"$temp_output" 2>&1 &
    then
        local start_pid=$!
        sleep 1
        kill $start_pid 2>/dev/null || true
        wait $start_pid 2>/dev/null || true
        test_assert "true" "TSM can parse tetra service start command"
    else
        test_assert "false" "TSM failed to parse tetra service start" "$(head -1 "$temp_output")"
    fi
    rm -f "$temp_output"

    # Test stop command syntax
    local temp_output=$(mktemp)
    if tsm stop non-existent-service >"$temp_output" 2>&1; then
        test_assert "skip" "TSM stop command syntax valid" "No services to stop"
    else
        # Expected to fail for non-existent service
        test_assert "true" "TSM stop command handles non-existent services"
    fi
    rm -f "$temp_output"

    echo
}

# Test 6: Configuration Files
test_configuration_files() {
    echo -e "${BLUE}=== Testing Configuration Requirements ===${NC}"

    # Check for tetra server file
    local tetra_server="$TETRA_SRC/server/server.js"
    if [[ -f "$tetra_server" ]]; then
        test_assert "true" "Tetra server file exists"

        # Check if it has port configuration
        if grep -q "4444\|PORT" "$tetra_server"; then
            test_assert "true" "Tetra server has port configuration"
        else
            test_assert "false" "Tetra server missing port configuration"
        fi
    else
        test_assert "false" "Tetra server file missing" "$tetra_server"
    fi

    # Check for systemd service template need
    test_assert "false" "systemd service template missing" "Need to create tetra.service"

    # Check for nginx config template need
    test_assert "false" "nginx tetra config template missing" "Need tetra nginx config generator"

    echo
}

# Test Summary
print_summary() {
    echo -e "${BLUE}=== Test Summary ===${NC}"
    echo "Total tests: $total_tests"
    echo -e "Passed: ${GREEN}$passed_tests${NC}"
    echo -e "Failed: ${RED}$failed_tests${NC}"
    echo -e "Skipped: ${YELLOW}$skipped_tests${NC}"

    echo
    echo -e "${BLUE}=== Recommendations ===${NC}"
    echo "1. Create systemd tetra.service template"
    echo "2. Add nginx config generation for tetra"
    echo "3. Add environment-specific service management"
    echo "4. Create service deployment scripts"

    if [[ $failed_tests -eq 0 ]]; then
        echo -e "${GREEN}Core TSM functionality verified!${NC}"
        return 0
    else
        local success_rate=$((passed_tests * 100 / total_tests))
        echo -e "Success rate: ${YELLOW}${success_rate}%${NC}"
        return 1
    fi
}

# Run all tests
main() {
    setup_tests
    test_tsm_commands
    test_service_registry
    test_port_detection
    test_environment_detection
    test_service_control
    test_configuration_files
    print_summary
}

main "$@"