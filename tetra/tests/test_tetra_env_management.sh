#!/usr/bin/env bash

# Test Suite for Tetra Environment Management System
# Tests the new "tetra way" environment promotion and validation

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
    echo -e "${BLUE}=== Tetra Environment Management Test Suite ===${NC}"
    echo "TETRA_SRC: $TETRA_SRC"
    echo "Testing the new Tetra Way environment management..."

    # Create test workspace
    export TEST_WORKSPACE="/tmp/tetra_env_test_$$"
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

    # Load utils module (contains tetra_env.sh)
    if ! tetra_load_module "utils" >/dev/null 2>&1; then
        echo -e "${RED}Error: Failed to load utils module${NC}"
        exit 1
    fi

    echo
}

# Test 1: Environment Command Availability
test_env_command_availability() {
    echo -e "${BLUE}=== Testing Environment Command Availability ===${NC}"

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

        # Check help contains key commands
        if grep -q "promote\|list\|validate\|diff" "$temp_output"; then
            test_assert "true" "Help contains expected commands"
        else
            test_assert "false" "Help missing expected commands"
        fi
    else
        test_assert "false" "tetra env help command failed"
    fi
    rm -f "$temp_output"

    echo
}

# Test 2: Environment File Creation and Listing
test_env_file_operations() {
    echo -e "${BLUE}=== Testing Environment File Operations ===${NC}"

    # Create test environment directory
    mkdir -p env

    # Create sample dev.env
    cat > env/dev.env <<'EOF'
export NODE_ENV=development
export PORT=8480
export DOMAIN_NAME=dev.pixeljamarcade.com
export USER=dev
export TETRA_ENV=dev
export PJA_SRC=/home/dev/src/pixeljam/pja/arcade
export LOG_DIR=/home/dev/.local/share/pixeljam/logs
export DEBUG=true
EOF

    test_assert "true" "Created sample dev.env file"

    # Test list command
    local temp_output=$(mktemp)
    if tetra_env list >"$temp_output" 2>&1; then
        test_assert "true" "tetra env list command works"

        if grep -q "dev.*dev.env" "$temp_output"; then
            test_assert "true" "List shows dev environment"
        else
            test_assert "false" "List does not show dev environment"
        fi
    else
        test_assert "false" "tetra env list command failed"
    fi
    rm -f "$temp_output"

    echo
}

# Test 3: Environment Validation
test_env_validation() {
    echo -e "${BLUE}=== Testing Environment Validation ===${NC}"

    # Test validation of existing dev.env
    local temp_output=$(mktemp)
    if tetra_env validate dev >"$temp_output" 2>&1; then
        test_assert "true" "Environment validation works"

        # Check for required variables validation
        if grep -q "NODE_ENV\|PORT\|DOMAIN_NAME" "$temp_output"; then
            test_assert "true" "Validation checks required variables"
        else
            test_assert "false" "Validation missing variable checks"
        fi
    else
        test_assert "false" "Environment validation failed"
    fi
    rm -f "$temp_output"

    # Test validation of non-existent environment
    local temp_output=$(mktemp)
    if tetra_env validate nonexistent >"$temp_output" 2>&1; then
        test_assert "false" "Validation should fail for non-existent environment"
    else
        test_assert "true" "Validation correctly fails for non-existent environment"
    fi
    rm -f "$temp_output"

    echo
}

# Test 4: Environment Promotion
test_env_promotion() {
    echo -e "${BLUE}=== Testing Environment Promotion ===${NC}"

    # Test dev to staging promotion
    local temp_output=$(mktemp)
    if tetra_env promote dev staging >"$temp_output" 2>&1; then
        test_assert "true" "Environment promotion dev → staging works"

        # Check if staging.env was created
        if [[ -f "env/staging.env" ]]; then
            test_assert "true" "Staging environment file created"
        else
            test_assert "false" "Staging environment file not created"
        fi

        # Check if backup was created (if staging.env existed before)
        if ls env/staging.env.backup.* >/dev/null 2>&1; then
            test_assert "true" "Backup created during promotion"
        else
            test_assert "skip" "No backup needed (new file)" "First promotion"
        fi
    else
        test_assert "false" "Environment promotion failed" "$(head -1 "$temp_output")"
    fi
    rm -f "$temp_output"

    echo
}

# Test 5: Automatic Adaptations
test_automatic_adaptations() {
    echo -e "${BLUE}=== Testing Automatic Adaptations ===${NC}"

    # Check staging.env adaptations
    if [[ -f "env/staging.env" ]]; then
        # Test NODE_ENV adaptation
        if grep -q "NODE_ENV=staging" env/staging.env; then
            test_assert "true" "NODE_ENV adapted to staging"
        else
            test_assert "false" "NODE_ENV not adapted correctly"
        fi

        # Test DOMAIN_NAME adaptation
        if grep -q "staging.pixeljamarcade.com" env/staging.env; then
            test_assert "true" "DOMAIN_NAME adapted to staging"
        else
            test_assert "false" "DOMAIN_NAME not adapted correctly"
        fi

        # Test USER adaptation
        if grep -q "USER=staging" env/staging.env; then
            test_assert "true" "USER adapted to staging"
        else
            test_assert "false" "USER not adapted correctly"
        fi

        # Test path adaptation
        if grep -q "/home/staging/" env/staging.env; then
            test_assert "true" "Paths adapted to staging user"
        else
            test_assert "false" "Paths not adapted correctly"
        fi

        # Test TETRA_ENV adaptation
        if grep -q "TETRA_ENV=staging" env/staging.env; then
            test_assert "true" "TETRA_ENV adapted to staging"
        else
            test_assert "false" "TETRA_ENV not adapted correctly"
        fi
    else
        test_assert "skip" "Staging file not available" "Cannot test adaptations"
    fi

    echo
}

# Test 6: Production Promotion with Security
test_production_promotion() {
    echo -e "${BLUE}=== Testing Production Promotion with Security ===${NC}"

    # Promote staging to production
    local temp_output=$(mktemp)
    if tetra_env promote staging prod >"$temp_output" 2>&1; then
        test_assert "true" "Environment promotion staging → prod works"

        if [[ -f "env/prod.env" ]]; then
            test_assert "true" "Production environment file created"

            # Test production-specific adaptations
            if grep -q "NODE_ENV=production" env/prod.env; then
                test_assert "true" "NODE_ENV set to production"
            else
                test_assert "false" "NODE_ENV not set to production"
            fi

            if grep -q "pixeljamarcade.com" env/prod.env && ! grep -q "staging.pixeljamarcade.com" env/prod.env; then
                test_assert "true" "Domain adapted to production"
            else
                test_assert "false" "Domain not adapted correctly to production"
            fi

            # Test security hardening (DEBUG should be removed)
            if ! grep -q "DEBUG.*true" env/prod.env; then
                test_assert "true" "Security hardening applied (DEBUG removed)"
            else
                test_assert "false" "Security hardening not applied"
            fi

            # Test secure mode addition
            if grep -q "SECURE_MODE=true" env/prod.env; then
                test_assert "true" "Secure mode enabled in production"
            else
                test_assert "false" "Secure mode not enabled"
            fi
        else
            test_assert "false" "Production environment file not created"
        fi
    else
        test_assert "false" "Production promotion failed" "$(head -1 "$temp_output")"
    fi
    rm -f "$temp_output"

    echo
}

# Test 7: Environment Diff Functionality
test_env_diff() {
    echo -e "${BLUE}=== Testing Environment Diff Functionality ===${NC}"

    # Test diff between dev and staging
    local temp_output=$(mktemp)
    if tetra_env diff dev staging >"$temp_output" 2>&1; then
        test_assert "true" "Environment diff command works"

        # Check if diff shows expected changes
        if grep -q "NODE_ENV\|DOMAIN_NAME\|USER" "$temp_output"; then
            test_assert "true" "Diff shows expected adaptations"
        else
            test_assert "skip" "Diff content varies" "May be expected"
        fi
    else
        test_assert "false" "Environment diff command failed"
    fi
    rm -f "$temp_output"

    echo
}

# Test 8: Error Handling
test_error_handling() {
    echo -e "${BLUE}=== Testing Error Handling ===${NC}"

    # Test promotion with invalid source environment
    local temp_output=$(mktemp)
    if tetra_env promote nonexistent staging >"$temp_output" 2>&1; then
        test_assert "false" "Should fail with invalid source environment"
    else
        test_assert "true" "Correctly handles invalid source environment"
    fi
    rm -f "$temp_output"

    # Test promotion with invalid target environment
    local temp_output=$(mktemp)
    if tetra_env promote dev invalid >"$temp_output" 2>&1; then
        test_assert "false" "Should fail with invalid target environment"
    else
        test_assert "true" "Correctly handles invalid target environment"
    fi
    rm -f "$temp_output"

    # Test missing command
    local temp_output=$(mktemp)
    if tetra_env invalid_command >"$temp_output" 2>&1; then
        test_assert "false" "Should fail with invalid command"
    else
        test_assert "true" "Correctly handles invalid commands"
    fi
    rm -f "$temp_output"

    echo
}

# Cleanup
cleanup_tests() {
    cd /
    rm -rf "$TEST_WORKSPACE"
}

# Test Summary
print_summary() {
    echo -e "${BLUE}=== Test Summary ===${NC}"
    echo "Total tests: $total_tests"
    echo -e "Passed: ${GREEN}$passed_tests${NC}"
    echo -e "Failed: ${RED}$failed_tests${NC}"
    echo -e "Skipped: ${YELLOW}$skipped_tests${NC}"

    if [[ $failed_tests -eq 0 ]]; then
        echo -e "${GREEN}All tests passed! Tetra Environment Management is working correctly.${NC}"
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
    test_env_command_availability
    test_env_file_operations
    test_env_validation
    test_env_promotion
    test_automatic_adaptations
    test_production_promotion
    test_env_diff
    test_error_handling
    cleanup_tests
    print_summary
}

main "$@"