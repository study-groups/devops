#!/usr/bin/env bash

# Comprehensive test runner for TSM Analytics and EMFILE fixes

set -euo pipefail

TEST_DIR="$(dirname "${BASH_SOURCE[0]}")"
TETRA_SRC="${TETRA_SRC:-$(realpath "$TEST_DIR/../..")}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

# Test results
TOTAL_TESTS=0
TOTAL_PASSED=0
TOTAL_FAILED=0
TEST_SUITES=0

echo -e "${BOLD}${BLUE}🧪 TSM Analytics Test Suite${NC}"
echo -e "${BOLD}${BLUE}============================${NC}"

print_system_info() {
    echo -e "\n${BLUE}💻 System Information:${NC}"
    echo "OS: $(uname -s) $(uname -r)"
    echo "Architecture: $(uname -m)"
    echo "Shell: $SHELL"
    echo "Date: $(date)"

    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo -e "\n${YELLOW}🍎 macOS Detected - Running EMFILE-specific tests${NC}"
    fi
}

run_test_suite() {
    local test_script="$1"
    local test_name="$2"

    if [[ ! -f "$test_script" ]]; then
        echo -e "${YELLOW}⚠️  Skipping $test_name: test script not found${NC}"
        return 0
    fi

    echo -e "\n${BOLD}${BLUE}🔬 Running: $test_name${NC}"
    echo "=================================="

    TEST_SUITES=$((TEST_SUITES + 1))

    if bash "$test_script"; then
        echo -e "${GREEN}✅ $test_name: PASSED${NC}"

        # Extract test counts from the output if possible
        # This is a simple heuristic - tests should output their counts
        local passed_count=$(grep -o "Passed: [0-9]*" <<< "$(bash "$test_script" 2>&1)" | tail -1 | grep -o "[0-9]*" || echo "1")
        local failed_count=$(grep -o "Failed: [0-9]*" <<< "$(bash "$test_script" 2>&1)" | tail -1 | grep -o "[0-9]*" || echo "0")

        TOTAL_PASSED=$((TOTAL_PASSED + passed_count))
        TOTAL_FAILED=$((TOTAL_FAILED + failed_count))
        TOTAL_TESTS=$((TOTAL_TESTS + passed_count + failed_count))
    else
        echo -e "${RED}❌ $test_name: FAILED${NC}"
        TOTAL_FAILED=$((TOTAL_FAILED + 1))
        TOTAL_TESTS=$((TOTAL_TESTS + 1))
    fi
}

run_quick_verification() {
    echo -e "\n${BOLD}${BLUE}🔍 Quick Verification Tests${NC}"
    echo "=================================="

    local verifications=0
    local verification_passes=0

    # Verify resource manager
    echo -n "Resource Manager exists: "
    if [[ -f "$TETRA_SRC/bash/tsm/tsm_resource_manager.sh" ]]; then
        echo -e "${GREEN}✅${NC}"
        verification_passes=$((verification_passes + 1))
    else
        echo -e "${RED}❌${NC}"
    fi
    verifications=$((verifications + 1))

    # Verify analytics scripts are updated
    echo -n "Analytics scripts use resource manager: "
    if grep -q "tsm_resource_manager.sh" "$TETRA_SRC/bash/tsm/tsm_analytics.sh" 2>/dev/null; then
        echo -e "${GREEN}✅${NC}"
        verification_passes=$((verification_passes + 1))
    else
        echo -e "${YELLOW}⚠️${NC}"
    fi
    verifications=$((verifications + 1))

    # Verify API routes are updated
    echo -n "API routes use safe execution: "
    if grep -q "safeExecAsync" "$TETRA_SRC/../devpages/server/routes/tetraRoutes.js" 2>/dev/null; then
        echo -e "${GREEN}✅${NC}"
        verification_passes=$((verification_passes + 1))
    else
        echo -e "${YELLOW}⚠️${NC}"
    fi
    verifications=$((verifications + 1))

    # Verify tetra.js exists
    echo -n "Tetra.js module exists: "
    if [[ -f "$TETRA_SRC/tetra.js" ]]; then
        echo -e "${GREEN}✅${NC}"
        verification_passes=$((verification_passes + 1))
    else
        echo -e "${RED}❌${NC}"
    fi
    verifications=$((verifications + 1))

    TOTAL_TESTS=$((TOTAL_TESTS + verifications))
    TOTAL_PASSED=$((TOTAL_PASSED + verification_passes))
    TOTAL_FAILED=$((TOTAL_FAILED + verifications - verification_passes))
}

check_dependencies() {
    echo -e "\n${BLUE}🔧 Dependency Check:${NC}"

    local deps=("bash" "grep" "awk" "tail" "head" "sort" "uniq")
    local missing_deps=()

    for dep in "${deps[@]}"; do
        if command -v "$dep" >/dev/null 2>&1; then
            echo "  ✅ $dep"
        else
            echo "  ❌ $dep (missing)"
            missing_deps+=("$dep")
        fi
    done

    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        echo -e "\n${RED}⚠️  Missing dependencies: ${missing_deps[*]}${NC}"
        echo "Some tests may fail due to missing dependencies."
    fi
}

show_recommendations() {
    echo -e "\n${BLUE}💡 Recommendations:${NC}"

    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "📱 macOS Specific:"
        echo "  • If you still see EMFILE errors, try: ulimit -n 1024"
        echo "  • Monitor file descriptors: lsof -p \$\$ | wc -l"
        echo "  • Check process count: pgrep -U \$(id -u) | wc -l"
    fi

    echo ""
    echo "🔧 Usage:"
    echo "  • Test EMFILE fix: ./tests/tsm/test_emfile_fix.sh"
    echo "  • Monitor resources: source tsm_resource_manager.sh && tsm_check_system_limits detailed"
    echo "  • Stream analytics: tsm stream devpages"
    echo "  • Safe analytics: tsm sessions devpages"

    echo ""
    echo "📊 API Endpoints:"
    echo "  • GET /api/tetra/sessions/devpages"
    echo "  • GET /api/tetra/users/devpages"
    echo "  • GET /api/tetra/live/devpages"
}

main() {
    print_system_info
    check_dependencies

    # Run test suites
    run_test_suite "$TEST_DIR/test_emfile_fix.sh" "EMFILE Fix Tests"
    run_test_suite "$TEST_DIR/test_analytics_resource_management.sh" "Resource Management Tests"

    # Quick verification tests
    run_quick_verification

    # Show results
    echo -e "\n${BOLD}${BLUE}📊 Overall Test Results:${NC}"
    echo "================================="
    echo -e "Test Suites: $TEST_SUITES"
    echo -e "Total Tests: $TOTAL_TESTS"
    echo -e "${GREEN}Passed: $TOTAL_PASSED${NC}"
    echo -e "${RED}Failed: $TOTAL_FAILED${NC}"

    local success_rate=0
    if [[ $TOTAL_TESTS -gt 0 ]]; then
        success_rate=$(( (TOTAL_PASSED * 100) / TOTAL_TESTS ))
    fi

    echo -e "Success Rate: $success_rate%"

    if [[ $TOTAL_FAILED -eq 0 ]]; then
        echo -e "\n${BOLD}${GREEN}🎉 All tests passed! The system should be stable.${NC}"
        show_recommendations
        exit 0
    elif [[ $success_rate -ge 80 ]]; then
        echo -e "\n${BOLD}${YELLOW}⚠️  Most tests passed, but some issues remain.${NC}"
        show_recommendations
        exit 1
    else
        echo -e "\n${BOLD}${RED}💥 Significant test failures detected.${NC}"
        echo "Please review the test output above and fix the issues before using the analytics system."
        exit 2
    fi
}

# Handle command line arguments
case "${1:-all}" in
    "emfile")
        run_test_suite "$TEST_DIR/test_emfile_fix.sh" "EMFILE Fix Tests"
        ;;
    "resource")
        run_test_suite "$TEST_DIR/test_analytics_resource_management.sh" "Resource Management Tests"
        ;;
    "verify"|"quick")
        print_system_info
        run_quick_verification
        ;;
    "help"|"-h"|"--help")
        echo "TSM Analytics Test Runner"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  all       Run all test suites (default)"
        echo "  emfile    Run EMFILE fix tests only"
        echo "  resource  Run resource management tests only"
        echo "  verify    Run quick verification tests"
        echo "  help      Show this help"
        exit 0
        ;;
    *)
        main
        ;;
esac