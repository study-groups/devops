#!/bin/bash
# Panel Configuration Tests
# Generated: Sun Aug 31 14:00:01 PDT 2025

# Source the panel variables
source "./panel_vars.sh"

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Test helper function
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_pattern="$3"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    local result
    result=$(eval "$test_command")
    
    if [[ "$result" =~ $expected_pattern ]]; then
        echo "✅ PASS: $test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo "❌ FAIL: $test_name"
        echo "   Expected pattern: $expected_pattern"
        echo "   Got: $result"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

echo "🧪 RUNNING PANEL CONFIGURATION TESTS"
echo "===================================="

# Test panel file existence
for panel_file in "${PANEL_FILES[@]}"; do
    if [ -f "$panel_file" ]; then
        echo "✅ Panel file exists: $panel_file"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo "❌ Panel file missing: $panel_file"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    TESTS_RUN=$((TESTS_RUN + 1))
done

# Test panel data extraction
run_test "Panel FileBrowserPanel has class" "get_panel_class 'FileBrowserPanel'" ".*"
run_test "Panel FileBrowserPanel has title" "get_panel_title 'FileBrowserPanel'" ".*"
run_test "Panel FileBrowserPanel has type" "get_panel_type 'FileBrowserPanel'" ".*"
run_test "Panel PDataAuthPanel has class" "get_panel_class 'PDataAuthPanel'" ".*"
run_test "Panel PDataAuthPanel has title" "get_panel_title 'PDataAuthPanel'" ".*"
run_test "Panel PDataAuthPanel has type" "get_panel_type 'PDataAuthPanel'" ".*"
run_test "Panel DesignTokensPanel has class" "get_panel_class 'DesignTokensPanel'" ".*"
run_test "Panel DesignTokensPanel has title" "get_panel_title 'DesignTokensPanel'" ".*"
run_test "Panel DesignTokensPanel has type" "get_panel_type 'DesignTokensPanel'" ".*"
run_test "Panel index has class" "get_panel_class 'index'" ".*"
run_test "Panel index has title" "get_panel_title 'index'" ".*"
run_test "Panel index has type" "get_panel_type 'index'" ".*"
run_test "Panel BasePanel has class" "get_panel_class 'BasePanel'" ".*"
run_test "Panel BasePanel has title" "get_panel_title 'BasePanel'" ".*"
run_test "Panel BasePanel has type" "get_panel_type 'BasePanel'" ".*"
run_test "Panel ThemePanel has class" "get_panel_class 'ThemePanel'" ".*"
run_test "Panel ThemePanel has title" "get_panel_title 'ThemePanel'" ".*"
run_test "Panel ThemePanel has type" "get_panel_type 'ThemePanel'" ".*"
run_test "Panel UIInspectorPanel has class" "get_panel_class 'UIInspectorPanel'" ".*"
run_test "Panel UIInspectorPanel has title" "get_panel_title 'UIInspectorPanel'" ".*"
run_test "Panel UIInspectorPanel has type" "get_panel_type 'UIInspectorPanel'" ".*"
run_test "Panel PublishPanel has class" "get_panel_class 'PublishPanel'" ".*"
run_test "Panel PublishPanel has title" "get_panel_title 'PublishPanel'" ".*"
run_test "Panel PublishPanel has type" "get_panel_type 'PublishPanel'" ".*"
run_test "Panel DiagnosticPanel has class" "get_panel_class 'DiagnosticPanel'" ".*"
run_test "Panel DiagnosticPanel has title" "get_panel_title 'DiagnosticPanel'" ".*"
run_test "Panel DiagnosticPanel has type" "get_panel_type 'DiagnosticPanel'" ".*"

# Summary
echo
echo "📊 TEST SUMMARY"
echo "==============="
echo "Tests run: $TESTS_RUN"
echo "Passed: $TESTS_PASSED"
echo "Failed: $TESTS_FAILED"

if [ $TESTS_FAILED -eq 0 ]; then
    echo "✅ All tests passed!"
    exit 0
else
    echo "❌ $TESTS_FAILED tests failed"
    exit 1
fi
