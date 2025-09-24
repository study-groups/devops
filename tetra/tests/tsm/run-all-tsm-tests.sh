#!/bin/bash

# Unified TSM Test Runner
# Consolidates and runs all TSM tests from various locations
# Provides a single entry point for comprehensive TSM testing

# Load our test framework
source "$(dirname "$0")/tsm-test-framework.sh"

# Configuration
TSM_TEST_LOCATIONS=(
    "$(dirname "$0")"                                    # devpages/tests/tsm
    "$TETRA_SRC/bash/tsm/tests"                         # tetra TSM tests
    "$TETRA_SRC/tests"                                  # tetra general tests
)

# Test discovery and execution
discover_and_run_tests() {
    local test_category="$1"

    tsm_log_section "Discovering $test_category Tests"

    local total_discovered=0
    local total_executed=0
    local total_passed=0
    local total_failed=0

    for location in "${TSM_TEST_LOCATIONS[@]}"; do
        if [[ -d "$location" ]]; then
            tsm_log_info "Scanning: $location"

            # Find test files
            local test_files=()
            while IFS= read -r -d '' file; do
                test_files+=("$file")
            done < <(find "$location" -maxdepth 1 -name "test*.sh" -print0 2>/dev/null)

            tsm_log_debug "Found ${#test_files[@]} test files in $location"
            ((total_discovered += ${#test_files[@]}))

            # Execute tests based on category
            for test_file in "${test_files[@]}"; do
                local test_name=$(basename "$test_file" .sh)

                # Filter by category
                case "$test_category" in
                    "unit")
                        if [[ "$test_name" =~ (mechanics|env-parsing|framework) ]]; then
                            run_individual_test "$test_file" "$test_name"
                            ((total_executed++))
                        fi
                        ;;
                    "integration")
                        if [[ "$test_name" =~ (lifecycle|service|comprehensive) ]]; then
                            run_individual_test "$test_file" "$test_name"
                            ((total_executed++))
                        fi
                        ;;
                    "legacy")
                        if [[ "$location" =~ /tetra/ ]]; then
                            run_individual_test "$test_file" "$test_name"
                            ((total_executed++))
                        fi
                        ;;
                    "all")
                        run_individual_test "$test_file" "$test_name"
                        ((total_executed++))
                        ;;
                esac
            done
        else
            tsm_log_warning "Test location not found: $location"
        fi
    done

    tsm_log_info "Discovery complete: $total_discovered found, $total_executed executed"
}

# Run individual test with error handling
run_individual_test() {
    local test_file="$1"
    local test_name="$2"

    tsm_log_info "Running: $test_name"

    # Check if test file is executable
    if [[ ! -x "$test_file" ]]; then
        chmod +x "$test_file"
        tsm_log_debug "Made $test_file executable"
    fi

    # Run test with timeout to prevent hangs
    local start_time=$(date +%s)
    local test_output
    local test_exit_code

    # Use timeout to prevent hanging tests
    if timeout 60s bash "$test_file" --no-cleanup 2>&1; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        tsm_log_success "$test_name (${duration}s)"
        return 0
    else
        test_exit_code=$?
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))

        if [[ $test_exit_code -eq 124 ]]; then
            tsm_log_failure "$test_name (timeout after ${duration}s)"
        else
            tsm_log_failure "$test_name (exit code: $test_exit_code, ${duration}s)"
        fi
        return 1
    fi
}

# Safe test execution with proper isolation
safe_test_execution() {
    local test_type="$1"

    tsm_log_section "Safe $test_type Test Execution"

    # Pre-test cleanup
    pkill -f "tsm-test" 2>/dev/null || true

    # Run tests based on type
    case "$test_type" in
        "quick")
            # Only run our proven unit tests
            run_test "Start Mechanics" "run_safe_unit_test test-start-mechanics.sh"
            run_test "Env Parsing" "run_safe_unit_test test-env-parsing.sh"
            run_test "Framework Example" "run_safe_unit_test example-framework-test.sh"
            ;;
        "legacy")
            # Run existing tetra tests carefully
            discover_and_run_tests "legacy"
            ;;
        "comprehensive")
            discover_and_run_tests "all"
            ;;
    esac
}

# Run unit test safely
run_safe_unit_test() {
    local test_name="$1"
    local test_path="$(dirname "$0")/$test_name"

    if [[ -f "$test_path" ]]; then
        # Run without integration to avoid hangs
        timeout 30s "$test_path" --verbose --no-cleanup 2>/dev/null
        return $?
    else
        tsm_log_warning "Test file not found: $test_path"
        return 1
    fi
}

# Main execution
main() {
    local test_mode="${1:-quick}"

    # Parse arguments
    tsm_parse_test_args "${@:2}"

    # Setup (but don't force integration)
    TSM_TEST_INTEGRATION=false  # Disable integration by default
    tsm_test_setup "Unified TSM Test Suite"

    case "$test_mode" in
        "quick"|"q")
            tsm_log_info "Running quick unit tests only"
            safe_test_execution "quick"
            ;;
        "legacy"|"l")
            tsm_log_info "Running legacy tetra tests"
            safe_test_execution "legacy"
            ;;
        "comprehensive"|"c")
            tsm_log_info "Running all discovered tests"
            safe_test_execution "comprehensive"
            ;;
        "discover"|"d")
            tsm_log_info "Discovering all available tests"
            for location in "${TSM_TEST_LOCATIONS[@]}"; do
                echo "=== $location ==="
                find "$location" -name "test*.sh" 2>/dev/null | sort || echo "  (not found)"
            done
            ;;
        *)
            cat << EOF
Usage: $0 <mode> [options]

Test Modes:
  quick, q         Run proven unit tests only (safe, fast)
  legacy, l        Run existing tetra tests
  comprehensive, c Run all discovered tests
  discover, d      Show all available test files

Options:
  --verbose        Verbose output
  --no-cleanup     Don't clean up test files

Examples:
  $0 quick --verbose     # Run safe unit tests with details
  $0 discover           # Show all available tests
  $0 legacy             # Run existing tetra tests
EOF
            exit 0
            ;;
    esac

    # Results
    tsm_test_results "Unified TSM Test Results"
}

# Run main if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi