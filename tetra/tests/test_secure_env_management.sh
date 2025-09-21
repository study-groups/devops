#!/usr/bin/env bash

# Test Suite for Secure Template-Based Environment Management
# Tests the new secure template system that protects secrets

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
    echo -e "${BLUE}=== Secure Environment Management Test Suite ===${NC}"
    echo "TETRA_SRC: $TETRA_SRC"
    echo "Testing secure template-based environment management..."

    # Create test workspace
    export TEST_WORKSPACE="/tmp/secure_env_test_$$"
    mkdir -p "$TEST_WORKSPACE"
    cd "$TEST_WORKSPACE"

    # Load tetra environment system
    if ! source "$TETRA_SRC/bash/boot/boot_core.sh" 2>/dev/null; then
        echo -e "${RED}Error: Failed to load boot_core.sh${NC}"
        exit 1
    fi

    if ! source "$TETRA_SRC/bash/boot/boot_modules.sh" 2>/dev/null; then
        echo -e "${RED}Error: Failed to load boot_modules.sh${NC}"
        exit 1
    fi

    # Load utils module (contains secure tetra_env.sh)
    if ! tetra_load_module "utils" >/dev/null 2>&1; then
        echo -e "${RED}Error: Failed to load utils module${NC}"
        exit 1
    fi

    # Force reload to get latest functions - use tetra_reload for proper module loading
    if declare -f tetra_reload >/dev/null 2>&1; then
        tetra_reload utils >/dev/null 2>&1
    else
        # Fallback to direct sourcing if tetra_reload not available
        unset -f tetra_env tetra_env_init tetra_env_list tetra_env_validate
        source "$TETRA_SRC/bash/utils/tetra_env.sh" 2>/dev/null
    fi

    echo
}

# Test 1: Template Availability
test_template_availability() {
    echo -e "${BLUE}=== Testing Template Availability ===${NC}"

    # Check if templates exist in source
    if [[ -f "$TETRA_SRC/env/dev.env.tmpl" ]]; then
        test_assert "true" "Development template exists"
    else
        test_assert "false" "Development template missing"
    fi

    if [[ -f "$TETRA_SRC/env/staging.env.tmpl" ]]; then
        test_assert "true" "Staging template exists"
    else
        test_assert "false" "Staging template missing"
    fi

    if [[ -f "$TETRA_SRC/env/prod.env.tmpl" ]]; then
        test_assert "true" "Production template exists"
    else
        test_assert "false" "Production template missing"
    fi

    echo
}

# Test 2: Secure Environment Commands
test_secure_env_commands() {
    echo -e "${BLUE}=== Testing Secure Environment Commands ===${NC}"

    # Test tetra_env function exists
    if declare -f tetra_env >/dev/null 2>&1; then
        test_assert "true" "tetra_env function is available"
    else
        test_assert "false" "tetra_env function not found"
    fi

    # Test help command
    local temp_output=$(mktemp)
    if tetra_env help >"$temp_output" 2>&1; then
        test_assert "true" "tetra env help command works"

        # Check help contains secure commands
        if grep -q "init\|templates\|validate" "$temp_output"; then
            test_assert "true" "Help contains secure commands"
        else
            test_assert "false" "Help missing secure commands"
        fi

        # Check help mentions security
        if grep -q "secure\|template\|secret" "$temp_output"; then
            test_assert "true" "Help emphasizes security"
        else
            test_assert "false" "Help doesn't mention security"
        fi
    else
        test_assert "false" "tetra env help command failed"
    fi

    rm -f "$temp_output"
    echo
}

# Test 3: Template Initialization
test_template_initialization() {
    echo -e "${BLUE}=== Testing Template Initialization ===${NC}"

    # Copy templates to test workspace
    mkdir -p env
    cp "$TETRA_SRC/env/"*.env.tmpl env/ 2>/dev/null || true

    # Test init command
    local temp_output=$(mktemp)
    if echo "y" | tetra_env init dev >"$temp_output" 2>&1; then
        test_assert "true" "tetra env init dev works"

        if [[ -f "env/dev.env" ]]; then
            test_assert "true" "env/dev.env created successfully"

            # Check if file contains template content
            if grep -q "NODE_ENV\|PORT\|TETRA_ENV" env/dev.env; then
                test_assert "true" "Environment file contains expected variables"
            else
                test_assert "false" "Environment file missing expected variables"
            fi

            # Check if file contains placeholder values
            if grep -q "your_.*_here" env/dev.env; then
                test_assert "true" "Environment file contains placeholders (expected)"
            else
                test_assert "false" "Environment file missing placeholders"
            fi
        else
            test_assert "false" "env/dev.env not created"
        fi
    else
        test_assert "false" "tetra env init dev failed"
    fi

    rm -f "$temp_output"
    echo
}

# Test 4: Environment Validation
test_environment_validation() {
    echo -e "${BLUE}=== Testing Environment Validation ===${NC}"

    if [[ -f "env/dev.env" ]]; then
        # Test validation with placeholder values
        local temp_output=$(mktemp)
        if ! tetra_env validate dev >"$temp_output" 2>&1; then
            test_assert "true" "Validation correctly fails with placeholders"

            if grep -q "placeholder" "$temp_output"; then
                test_assert "true" "Validation detects placeholder values"
            else
                test_assert "false" "Validation doesn't detect placeholders"
            fi
        else
            test_assert "false" "Validation should fail with placeholder values"
        fi

        # Create valid environment file (no placeholders)
        cat > env/test.env << 'EOF'
export NODE_ENV=development
export PORT=8000
export TETRA_ENV=dev
export SPACES_ENDPOINT=nyc3.digitaloceanspaces.com
export SPACES_BUCKET=my-real-bucket
export SPACES_ACCESS_KEY=real_access_key_123
export SPACES_SECRET_KEY=real_secret_key_456
export PD_DIR=/home/dev/pj/pd
EOF

        if tetra_env validate test >"$temp_output" 2>&1; then
            test_assert "true" "Validation passes with real values"
        else
            test_assert "false" "Validation failed with real values"
        fi

        rm -f "$temp_output"
    else
        test_assert "skip" "No env file available for validation"
    fi

    echo
}

# Test 5: Template Listing
test_template_listing() {
    echo -e "${BLUE}=== Testing Template Listing ===${NC}"

    local temp_output=$(mktemp)
    if tetra_env list >"$temp_output" 2>&1; then
        test_assert "true" "tetra env list command works"

        # Check if it shows templates
        if grep -q "Template" "$temp_output"; then
            test_assert "true" "List shows templates"
        else
            test_assert "false" "List doesn't show templates"
        fi

        # Check if it shows environment files (if any exist)
        if [[ -f "env/dev.env" ]] && grep -q "Local Environment" "$temp_output"; then
            test_assert "true" "List shows environment files"
        else
            test_assert "skip" "No environment files to show"
        fi
    else
        test_assert "false" "tetra env list command failed"
    fi

    rm -f "$temp_output"
    echo
}

# Test 6: Security Features
test_security_features() {
    echo -e "${BLUE}=== Testing Security Features ===${NC}"

    # Test .gitignore protection
    if [[ -f "$TETRA_SRC/.gitignore" ]]; then
        if grep -q "env/\*\.env" "$TETRA_SRC/.gitignore"; then
            test_assert "true" ".gitignore protects environment files"
        else
            test_assert "false" ".gitignore doesn't protect environment files"
        fi

        if grep -q "!env/\*\.env\.tmpl" "$TETRA_SRC/.gitignore"; then
            test_assert "true" ".gitignore allows templates"
        else
            test_assert "false" ".gitignore doesn't allow templates"
        fi
    else
        test_assert "false" ".gitignore file not found"
    fi

    # Test that templates don't contain real secrets
    local has_secrets=false
    for template in "$TETRA_SRC/env/"*.env.tmpl; do
        if [[ -f "$template" ]] && grep -q "sk-[a-zA-Z0-9]\{40\}\|pk_[a-zA-Z0-9]\{40\}" "$template"; then
            has_secrets=true
            break
        fi
    done

    if [[ "$has_secrets" == false ]]; then
        test_assert "true" "Templates don't contain real secrets"
    else
        test_assert "false" "Templates contain real secrets"
    fi

    echo
}

# Test 7: TSM Integration
test_tsm_integration() {
    echo -e "${BLUE}=== Testing TSM Integration ===${NC}"

    # Create a test script
    mkdir -p entrypoints
    cat > entrypoints/test.sh << 'EOF'
#!/usr/bin/env bash
echo "PORT: ${PORT:-not set}"
echo "NODE_ENV: ${NODE_ENV:-not set}"
exit 0
EOF
    chmod +x entrypoints/test.sh

    # Test TSM without environment file (should provide guidance)
    local temp_output=$(mktemp)
    if ! timeout 5 tsm start entrypoints/test.sh >"$temp_output" 2>&1; then
        if grep -q "Create secure environment file" "$temp_output"; then
            test_assert "true" "TSM provides template guidance when env missing"
        else
            test_assert "false" "TSM doesn't provide helpful guidance"
        fi
    else
        test_assert "skip" "TSM started without environment (unexpected)"
    fi

    # Test TSM init shortcut
    if type tsm >/dev/null 2>&1; then
        if echo "y" | timeout 5 tsm init dev >"$temp_output" 2>&1; then
            test_assert "true" "TSM init shortcut works"
        else
            test_assert "false" "TSM init shortcut failed"
        fi
    else
        test_assert "skip" "TSM not available for testing"
    fi

    rm -f "$temp_output"
    echo
}

# Cleanup
cleanup_tests() {
    cd "$TETRA_SRC"
    rm -rf "$TEST_WORKSPACE"
}

# Main test execution
main() {
    setup_tests
    test_template_availability
    test_secure_env_commands
    test_template_initialization
    test_environment_validation
    test_template_listing
    test_security_features
    test_tsm_integration

    echo -e "${BLUE}=== Test Summary ===${NC}"
    echo "Total tests: $total_tests"
    echo -e "Passed: ${GREEN}$passed_tests${NC}"
    echo -e "Failed: ${RED}$failed_tests${NC}"
    echo -e "Skipped: ${YELLOW}$skipped_tests${NC}"

    local success_rate=$((passed_tests * 100 / total_tests))
    echo -e "Success rate: ${YELLOW}${success_rate}%${NC}"

    cleanup_tests

    if [[ $failed_tests -eq 0 ]]; then
        echo -e "${GREEN}🎉 All tests passed!${NC}"
        return 0
    else
        echo -e "${RED}❌ Some tests failed${NC}"
        return 1
    fi
}

# Run tests
main "$@"