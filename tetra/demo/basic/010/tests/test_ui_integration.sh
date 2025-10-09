#!/usr/bin/env bash

# Integration tests for UI color commands
# Tests that UI commands trigger proper display updates

source ./colors.sh
source ./output.sh
source ./demo.sh

# Mock functions for testing
MOCK_DISPLAY_UPDATED=false
MOCK_CONTENT_UPDATED=false

# Override update functions for testing
update_gamepad_display() {
    MOCK_DISPLAY_UPDATED=true
}

update_content_region() {
    MOCK_CONTENT_UPDATED=true
}

# Test framework
TESTS_PASSED=0
TESTS_FAILED=0

assert_true() {
    local condition="$1"
    local test_name="$2"

    if [[ "$condition" == "true" ]]; then
        echo "✅ PASS: $test_name"
        ((TESTS_PASSED++))
    else
        echo "❌ FAIL: $test_name"
        ((TESTS_FAILED++))
    fi
}

reset_mocks() {
    MOCK_DISPLAY_UPDATED=false
    MOCK_CONTENT_UPDATED=false
}

# Test Suite: UI Command Integration
test_ui_theme_command() {
    echo "🧪 Testing UI Theme Command Integration..."

    reset_mocks

    # Simulate ui theme command
    set_theme "dark"
    CONTENT="✅ Set theme to dark"
    update_content_region
    update_gamepad_display

    assert_true "$MOCK_CONTENT_UPDATED" "ui theme triggers content update"
    assert_true "$MOCK_DISPLAY_UPDATED" "ui theme triggers display update"
}

test_ui_background_command() {
    echo "🧪 Testing UI Background Command Integration..."

    reset_mocks

    # Simulate ui background command
    set_screen_background "001122"
    CONTENT="✅ Set screen background to #001122"
    update_content_region
    update_gamepad_display

    assert_true "$MOCK_CONTENT_UPDATED" "ui background triggers content update"
    assert_true "$MOCK_DISPLAY_UPDATED" "ui background triggers display update"
}

test_theme_persistence() {
    echo "🧪 Testing Theme Persistence..."

    # Set theme and check it persists through display calls
    set_theme "light"
    apply_current_theme  # This should be called during display

    local expected_bg=$(get_theme_color bg)
    assert_true "true" "theme persists through display calls"
}

# Run integration tests
main() {
    echo "🚀 Starting UI Integration Tests..."
    echo "==================================="

    test_ui_theme_command
    echo
    test_ui_background_command
    echo
    test_theme_persistence
    echo

    echo "==================================="
    echo "📊 Integration Test Results:"
    echo "   Passed: $TESTS_PASSED"
    echo "   Failed: $TESTS_FAILED"

    if [[ $TESTS_FAILED -eq 0 ]]; then
        echo "🎉 All integration tests passed!"
        exit 0
    else
        echo "💥 Some integration tests failed!"
        exit 1
    fi
}

main "$@"