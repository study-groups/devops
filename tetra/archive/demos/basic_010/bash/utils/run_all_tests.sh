#!/usr/bin/env bash

# Test suite runner for color system
# Runs all color-related tests and reports results

echo "🚀 Running Complete Color System Test Suite..."
echo "=============================================="

TOTAL_PASSED=0
TOTAL_FAILED=0
SUITE_FAILURES=0

run_test_suite() {
    local test_file="$1"
    local suite_name="$2"

    echo
    echo "📋 Running $suite_name..."
    echo "$(printf '=%.0s' {1..50})"

    if [[ -x "$test_file" ]]; then
        if ./"$test_file"; then
            echo "✅ $suite_name: PASSED"
        else
            echo "❌ $suite_name: FAILED"
            ((SUITE_FAILURES++))
        fi
    else
        echo "⚠️  $suite_name: Test file not executable or missing"
        ((SUITE_FAILURES++))
    fi
}

# Make all test files executable
chmod +x test_colors.sh 2>/dev/null || true
chmod +x test_ui_integration.sh 2>/dev/null || true
chmod +x test_no_topbar_background.sh 2>/dev/null || true

# Run all test suites
run_test_suite "test_colors.sh" "Core Color Functions"
run_test_suite "test_ui_integration.sh" "UI Integration Tests"
run_test_suite "test_no_topbar_background.sh" "Topbar Background Prevention"

echo
echo "=============================================="
echo "📊 FINAL TEST RESULTS:"
echo "   Test Suites: $((3 - SUITE_FAILURES))/3 passed"
echo "   Failures: $SUITE_FAILURES"

if [[ $SUITE_FAILURES -eq 0 ]]; then
    echo
    echo "🎉 ALL COLOR SYSTEM TESTS PASSED!"
    echo "✅ Color system is working correctly"
    echo "✅ No background colors in topbar"
    echo "✅ UI commands trigger display updates"
    echo "✅ Theme system is unified"
    exit 0
else
    echo
    echo "💥 SOME TEST SUITES FAILED!"
    echo "❌ Please fix failing tests before proceeding"
    exit 1
fi