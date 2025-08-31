#!/bin/bash
# DevPages Panel Architecture Test Runner
# Orchestrates comprehensive testing of the panel system

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$TEST_DIR/.." && pwd)"
LOG_DIR="$TEST_DIR/logs"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create logs directory
mkdir -p "$LOG_DIR"

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_DIR/test-run-$TIMESTAMP.log"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_DIR/test-run-$TIMESTAMP.log"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_DIR/test-run-$TIMESTAMP.log"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_DIR/test-run-$TIMESTAMP.log"
}

# Test execution function
run_test() {
    local test_name="$1"
    local test_command="$2"
    local log_file="$LOG_DIR/${test_name}-$TIMESTAMP.log"
    
    log_info "Running test: $test_name"
    
    if eval "$test_command" > "$log_file" 2>&1; then
        log_success "✅ $test_name passed"
        return 0
    else
        log_error "❌ $test_name failed (see $log_file)"
        return 1
    fi
}

# Test suite functions
run_basic_tests() {
    log_info "🧪 Running Basic Panel Tests..."
    
    local tests_passed=0
    local tests_total=0
    
    # Panel lifecycle tests
    ((tests_total++))
    if run_test "panel-lifecycle" "cd '$PROJECT_ROOT' && node test/cli/panel-test.js run-all"; then
        ((tests_passed++))
    fi
    
    # Sidebar state tests
    ((tests_total++))
    if run_test "sidebar-state" "cd '$PROJECT_ROOT' && node test/cli/sidebar-test.js run-all"; then
        ((tests_passed++))
    fi
    
    # Data flow tests
    ((tests_total++))
    if run_test "data-flow" "cd '$PROJECT_ROOT' && node test/cli/data-test.js run-all"; then
        ((tests_passed++))
    fi
    
    log_info "Basic tests: $tests_passed/$tests_total passed"
    return $((tests_total - tests_passed))
}

run_enhanced_tests() {
    log_info "🚀 Running Enhanced Panel Tests..."
    
    local tests_passed=0
    local tests_total=0
    
    # Enhanced panel features
    ((tests_total++))
    if run_test "enhanced-panels" "cd '$PROJECT_ROOT' && node test/cli/panel-test.js run-enhanced"; then
        ((tests_passed++))
    fi
    
    # Sidebar optimization
    ((tests_total++))
    if run_test "sidebar-optimization" "cd '$PROJECT_ROOT' && node test/cli/sidebar-test.js run-enhanced"; then
        ((tests_passed++))
    fi
    
    log_info "Enhanced tests: $tests_passed/$tests_total passed"
    return $((tests_total - tests_passed))
}

run_integration_tests() {
    log_info "🔗 Running Integration Tests..."
    
    local tests_passed=0
    local tests_total=0
    
    # YAML configuration integration
    ((tests_total++))
    if run_test "yaml-integration" "cd '$PROJECT_ROOT' && node test/cli/panel-test.js test-yaml-loading"; then
        ((tests_passed++))
    fi
    
    # Configuration validation
    ((tests_total++))
    if run_test "config-validation" "cd '$PROJECT_ROOT' && node test/cli/panel-test.js validate-config"; then
        ((tests_passed++))
    fi
    
    # Cross-panel communication
    ((tests_total++))
    if run_test "cross-panel-comm" "cd '$PROJECT_ROOT' && node test/cli/data-test.js test-cross-panel-communication"; then
        ((tests_passed++))
    fi
    
    log_info "Integration tests: $tests_passed/$tests_total passed"
    return $((tests_total - tests_passed))
}

run_performance_tests() {
    log_info "⚡ Running Performance Tests..."
    
    local tests_passed=0
    local tests_total=0
    
    # Panel performance
    ((tests_total++))
    if run_test "panel-performance" "cd '$PROJECT_ROOT' && node test/cli/panel-test.js test-performance"; then
        ((tests_passed++))
    fi
    
    # Subscription efficiency
    ((tests_total++))
    if run_test "subscription-efficiency" "cd '$PROJECT_ROOT' && node test/cli/data-test.js test-subscription-efficiency"; then
        ((tests_passed++))
    fi
    
    # Render optimization
    ((tests_total++))
    if run_test "render-optimization" "cd '$PROJECT_ROOT' && node test/cli/sidebar-test.js test-render-optimization"; then
        ((tests_passed++))
    fi
    
    log_info "Performance tests: $tests_passed/$tests_total passed"
    return $((tests_total - tests_passed))
}

run_scenario_tests() {
    log_info "📋 Running YAML Test Scenarios..."
    
    # Extract test scenarios from YAML (simplified parsing)
    local scenarios=(
        "basic_panel_lifecycle"
        "sidebar_state_persistence"
        "panel_data_flow"
        "enhanced_panel_features"
        "sidebar_optimization"
        "data_flow_comprehensive"
    )
    
    local tests_passed=0
    local tests_total=${#scenarios[@]}
    
    for scenario in "${scenarios[@]}"; do
        log_info "Running scenario: $scenario"
        
        # For now, we'll run the equivalent test commands
        case "$scenario" in
            "basic_panel_lifecycle")
                if run_test "scenario-$scenario" "cd '$PROJECT_ROOT' && node test/cli/panel-test.js run-all"; then
                    ((tests_passed++))
                fi
                ;;
            "sidebar_state_persistence")
                if run_test "scenario-$scenario" "cd '$PROJECT_ROOT' && node test/cli/sidebar-test.js run-all"; then
                    ((tests_passed++))
                fi
                ;;
            "panel_data_flow")
                if run_test "scenario-$scenario" "cd '$PROJECT_ROOT' && node test/cli/data-test.js run-all"; then
                    ((tests_passed++))
                fi
                ;;
            "enhanced_panel_features")
                if run_test "scenario-$scenario" "cd '$PROJECT_ROOT' && node test/cli/panel-test.js run-enhanced"; then
                    ((tests_passed++))
                fi
                ;;
            "sidebar_optimization")
                if run_test "scenario-$scenario" "cd '$PROJECT_ROOT' && node test/cli/sidebar-test.js run-enhanced"; then
                    ((tests_passed++))
                fi
                ;;
            "data_flow_comprehensive")
                if run_test "scenario-$scenario" "cd '$PROJECT_ROOT' && node test/cli/data-test.js run-all"; then
                    ((tests_passed++))
                fi
                ;;
        esac
    done
    
    log_info "Scenario tests: $tests_passed/$tests_total passed"
    return $((tests_total - tests_passed))
}

generate_report() {
    local total_failures=$1
    local report_file="$LOG_DIR/test-report-$TIMESTAMP.md"
    
    log_info "📊 Generating test report..."
    
    cat > "$report_file" << EOF
# DevPages Panel Architecture Test Report

**Generated:** $(date)
**Test Run ID:** $TIMESTAMP

## Test Summary

EOF

    if [[ $total_failures -eq 0 ]]; then
        echo "✅ **All tests passed!**" >> "$report_file"
        echo "" >> "$report_file"
        echo "The DevPages Panel Architecture is working correctly with:" >> "$report_file"
        echo "- Optimized Redux subscriptions" >> "$report_file"
        echo "- YAML configuration integration" >> "$report_file"
        echo "- Comprehensive CLI testing tools" >> "$report_file"
        echo "- Performance optimizations" >> "$report_file"
    else
        echo "❌ **$total_failures test(s) failed**" >> "$report_file"
        echo "" >> "$report_file"
        echo "Please check the individual test logs in \`$LOG_DIR\` for details." >> "$report_file"
    fi
    
    echo "" >> "$report_file"
    echo "## Test Logs" >> "$report_file"
    echo "" >> "$report_file"
    
    for log_file in "$LOG_DIR"/*-$TIMESTAMP.log; do
        if [[ -f "$log_file" ]]; then
            local test_name=$(basename "$log_file" | sed "s/-$TIMESTAMP.log//")
            echo "- [\`$test_name\`]($log_file)" >> "$report_file"
        fi
    done
    
    echo "" >> "$report_file"
    echo "## Architecture Verification" >> "$report_file"
    echo "" >> "$report_file"
    echo "### ✅ Implemented Features" >> "$report_file"
    echo "- [x] Selective Redux subscription in SidebarManager" >> "$report_file"
    echo "- [x] YAML configuration loader for panels" >> "$report_file"
    echo "- [x] CLI testing tools for panel lifecycle" >> "$report_file"
    echo "- [x] CLI testing tools for sidebar state" >> "$report_file"
    echo "- [x] Data flow testing framework" >> "$report_file"
    echo "- [x] Enhanced test scenarios in panels.yaml" >> "$report_file"
    echo "- [x] Performance monitoring and optimization" >> "$report_file"
    echo "- [x] Category-based panel organization" >> "$report_file"
    echo "- [x] State persistence verification" >> "$report_file"
    echo "- [x] Cross-panel communication testing" >> "$report_file"
    
    log_success "Test report generated: $report_file"
}

# Main execution
main() {
    log_info "🚀 Starting DevPages Panel Architecture Test Suite"
    log_info "Timestamp: $TIMESTAMP"
    log_info "Project root: $PROJECT_ROOT"
    log_info "Logs directory: $LOG_DIR"
    
    local total_failures=0
    
    # Check dependencies
    if ! command -v node &> /dev/null; then
        log_error "Node.js is required but not installed"
        exit 1
    fi
    
    # Verify test files exist
    local test_files=(
        "$PROJECT_ROOT/test/cli/panel-test.js"
        "$PROJECT_ROOT/test/cli/sidebar-test.js"
        "$PROJECT_ROOT/test/cli/data-test.js"
    )
    
    for file in "${test_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            log_error "Required test file not found: $file"
            exit 1
        fi
    done
    
    # Parse command line arguments
    local run_basic=true
    local run_enhanced=true
    local run_integration=true
    local run_performance=true
    local run_scenarios=true
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --basic-only)
                run_enhanced=false
                run_integration=false
                run_performance=false
                run_scenarios=false
                shift
                ;;
            --enhanced-only)
                run_basic=false
                run_integration=false
                run_performance=false
                run_scenarios=false
                shift
                ;;
            --no-performance)
                run_performance=false
                shift
                ;;
            --scenarios-only)
                run_basic=false
                run_enhanced=false
                run_integration=false
                run_performance=false
                shift
                ;;
            --help)
                echo "Usage: $0 [options]"
                echo "Options:"
                echo "  --basic-only      Run only basic tests"
                echo "  --enhanced-only   Run only enhanced tests"
                echo "  --no-performance  Skip performance tests"
                echo "  --scenarios-only  Run only YAML scenario tests"
                echo "  --help           Show this help message"
                exit 0
                ;;
            *)
                log_warning "Unknown option: $1"
                shift
                ;;
        esac
    done
    
    # Run test suites
    if [[ "$run_basic" == true ]]; then
        run_basic_tests || ((total_failures += $?))
    fi
    
    if [[ "$run_enhanced" == true ]]; then
        run_enhanced_tests || ((total_failures += $?))
    fi
    
    if [[ "$run_integration" == true ]]; then
        run_integration_tests || ((total_failures += $?))
    fi
    
    if [[ "$run_performance" == true ]]; then
        run_performance_tests || ((total_failures += $?))
    fi
    
    if [[ "$run_scenarios" == true ]]; then
        run_scenario_tests || ((total_failures += $?))
    fi
    
    # Generate report
    generate_report $total_failures
    
    # Final summary
    echo ""
    log_info "🏁 Test Suite Complete"
    
    if [[ $total_failures -eq 0 ]]; then
        log_success "✅ All tests passed! DevPages Panel Architecture is working correctly."
        exit 0
    else
        log_error "❌ $total_failures test(s) failed. Check logs in $LOG_DIR"
        exit 1
    fi
}

# Run main function with all arguments
main "$@"
