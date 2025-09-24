#!/usr/bin/env bash

# Comprehensive Test Suite Runner
# Runs all comprehensive systemd integration tests as outlined in next.md

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${BOLD}${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${BLUE}║            COMPREHENSIVE SYSTEMD INTEGRATION            ║${NC}"
echo -e "${BOLD}${BLUE}║                     TEST SUITE                          ║${NC}"
echo -e "${BOLD}${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo

# Test environment info
echo -e "${CYAN}Test Environment Information:${NC}"
echo "Platform: $(uname -s) $(uname -r)"
echo "User: $(whoami)"
echo "UID/GID: $(id)"
echo "Date: $(date)"
echo "TETRA_SRC: ${TETRA_SRC:-${PWD%/tests}}"
echo

# Check platform compatibility
if [[ "$(uname -s)" != "Linux" ]]; then
    echo -e "${YELLOW}⚠️  Warning: Full systemd integration requires Linux environment${NC}"
    echo -e "${YELLOW}   Running in mock mode on $(uname -s)${NC}"
    echo
fi

# Test suite tracking
TOTAL_SUITES=0
PASSED_SUITES=0
FAILED_SUITES=0
SUITE_RESULTS=()

run_test_suite() {
    local test_script="$1"
    local test_name="$2"

    ((TOTAL_SUITES++))

    echo -e "${BOLD}${BLUE}═══ Running: $test_name ═══${NC}"

    if [[ -f "$test_script" && -x "$test_script" ]]; then
        if ./"$test_script"; then
            ((PASSED_SUITES++))
            SUITE_RESULTS+=("✓ $test_name")
            echo -e "${GREEN}✓ $test_name completed successfully${NC}"
        else
            ((FAILED_SUITES++))
            SUITE_RESULTS+=("✗ $test_name")
            echo -e "${RED}✗ $test_name failed${NC}"
        fi
    else
        ((FAILED_SUITES++))
        SUITE_RESULTS+=("✗ $test_name (not found)")
        echo -e "${RED}✗ $test_name - test script not found or not executable${NC}"
    fi

    echo
}

# Core systemd tests
echo -e "${BOLD}${CYAN}🔧 CORE SYSTEMD INTEGRATION TESTS${NC}"
echo "Testing fundamental systemd components and integration..."
echo

run_test_suite "test_systemd_simple.sh" "Basic Systemd Integration"

# TSM service management tests
echo -e "${BOLD}${CYAN}⚙️  TSM SERVICE MANAGEMENT TESTS${NC}"
echo "Testing nginx-style service enable/disable system..."
echo

run_test_suite "test_tsm_service_management_comprehensive.sh" "TSM Service Management"

# Environment management tests
echo -e "${BOLD}${CYAN}🌍 ENVIRONMENT MANAGEMENT TESTS${NC}"
echo "Testing environment promotion workflow (dev → staging → prod)..."
echo

run_test_suite "test_environment_management_comprehensive.sh" "Environment Management"

# Template validation tests
echo -e "${BOLD}${CYAN}📋 TEMPLATE VALIDATION TESTS${NC}"
echo "Testing SystemD and nginx template validation..."
echo

run_test_suite "test_template_validation_comprehensive.sh" "Template Validation"

# Additional existing tests
echo -e "${BOLD}${CYAN}🔍 ADDITIONAL INTEGRATION TESTS${NC}"
echo "Running other relevant integration tests..."
echo

# Check for and run other relevant tests
if [[ -f "test_organization_system.sh" ]]; then
    run_test_suite "test_organization_system.sh" "Organization System"
fi

if [[ -f "test_tdash_integration.sh" ]]; then
    run_test_suite "test_tdash_integration.sh" "TDash Integration"
fi

if [[ -f "test_secure_env_management.sh" ]]; then
    run_test_suite "test_secure_env_management.sh" "Secure Environment Management"
fi

# Summary and results
echo -e "${BOLD}${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${BLUE}║                    FINAL RESULTS                        ║${NC}"
echo -e "${BOLD}${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo

echo -e "${BOLD}Test Suite Summary:${NC}"
echo "Total test suites: $TOTAL_SUITES"
echo -e "Passed: ${GREEN}$PASSED_SUITES${NC}"
echo -e "Failed: ${RED}$FAILED_SUITES${NC}"

if [[ $TOTAL_SUITES -gt 0 ]]; then
    SUCCESS_RATE=$(( (PASSED_SUITES * 100) / TOTAL_SUITES ))
    echo -e "Success rate: ${YELLOW}${SUCCESS_RATE}%${NC}"
fi

echo
echo -e "${BOLD}Individual Results:${NC}"
for result in "${SUITE_RESULTS[@]}"; do
    if [[ "$result" =~ ^✓ ]]; then
        echo -e "${GREEN}$result${NC}"
    else
        echo -e "${RED}$result${NC}"
    fi
done

echo
echo -e "${BOLD}${CYAN}Testing Coverage Summary:${NC}"
echo "🔧 Systemd Integration: Daemon startup, service discovery, monitoring"
echo "⚙️  TSM Service Mgmt: Save, enable/disable, persistence, validation"
echo "🌍 Environment Mgmt: Promotion workflow, adaptations, validation"
echo "📋 Template Validation: SystemD services, nginx configs, security"
echo "🏢 Organization System: Multi-client infrastructure support"
echo "📊 TDash Integration: 5-mode navigation dashboard"
echo "🔒 Security Management: Environment templates, secret handling"

echo
if [[ "$(uname -s)" == "Linux" ]]; then
    echo -e "${BOLD}${CYAN}Linux Platform Specific Tests:${NC}"
    echo "✓ Native systemd integration available"
    echo "✓ Real service start/stop testing possible"
    echo "✓ Actual daemon installation testing"
else
    echo -e "${BOLD}${YELLOW}Platform Limitations:${NC}"
    echo "⚠️  Running on $(uname -s) - systemd tests use mock mode"
    echo "⚠️  For full testing, run on Linux with systemd"
    echo "⚠️  Some daemon integration tests are simulated"
fi

echo
echo -e "${BOLD}${CYAN}Next Steps:${NC}"
if [[ $FAILED_SUITES -gt 0 ]]; then
    echo -e "${RED}❌ Some test suites failed - review and address issues${NC}"
    echo "• Check failed test output for specific problems"
    echo "• Verify system dependencies and permissions"
    echo "• Ensure all required files and directories exist"
else
    echo -e "${GREEN}✅ All test suites passed successfully!${NC}"
    echo "• System is ready for production deployment"
    echo "• Systemd integration is properly configured"
    echo "• Service management system is functional"
fi

echo
echo -e "${BOLD}${CYAN}Production Deployment Commands:${NC}"
echo "# Install systemd service (Linux only):"
echo "sudo ln -s \$TETRA_SRC/systemd/tetra.service /etc/systemd/system/"
echo "sudo systemctl daemon-reload"
echo "sudo systemctl enable tetra.service"
echo "sudo systemctl start tetra.service"
echo
echo "# Monitor service:"
echo "sudo systemctl status tetra.service"
echo "sudo journalctl -u tetra.service -f"

if [[ $FAILED_SUITES -gt 0 ]]; then
    exit 1
else
    echo -e "${BOLD}${GREEN}🎉 All comprehensive systemd integration tests completed successfully!${NC}"
fi