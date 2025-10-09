#!/usr/bin/env bash

# Test-driven development for color system refactor
# Run this script to validate color system functionality

source ./colors.sh

# Test framework
TESTS_PASSED=0
TESTS_FAILED=0

assert_equals() {
    local expected="$1"
    local actual="$2"
    local test_name="$3"

    if [[ "$expected" == "$actual" ]]; then
        echo "✅ PASS: $test_name"
        ((TESTS_PASSED++))
    else
        echo "❌ FAIL: $test_name"
        echo "   Expected: $expected"
        echo "   Actual: $actual"
        ((TESTS_FAILED++))
    fi
}

assert_contains() {
    local substring="$1"
    local string="$2"
    local test_name="$3"

    if [[ "$string" == *"$substring"* ]]; then
        echo "✅ PASS: $test_name"
        ((TESTS_PASSED++))
    else
        echo "❌ FAIL: $test_name"
        echo "   Expected '$substring' in: $string"
        ((TESTS_FAILED++))
    fi
}

# Test Suite 1: Color Function Output
test_color_functions() {
    echo "🧪 Testing Color Functions..."

    # Test hex to RGB conversion
    local result=$(hex_to_rgb "FF0000")
    assert_equals "255 0 0" "$result" "hex_to_rgb converts FF0000 to RGB"

    # Test RGB to hex conversion
    result=$(rgb_to_hex 255 0 0)
    assert_equals "FF0000" "$result" "rgb_to_hex converts 255,0,0 to hex"

    # Test color function output contains ANSI codes
    result=$(env_color forest primary 2>&1)
    assert_contains "[38;2;" "$result" "env_color outputs ANSI escape sequence"
}

# Test Suite 2: Theme System
test_theme_system() {
    echo "🧪 Testing Theme System..."

    # Test theme color retrieval
    CURRENT_THEME="dark"
    local result=$(get_theme_color bg)
    assert_equals "1E1E1E" "$result" "get_theme_color returns dark theme bg"

    # Test theme switching
    set_theme "light"
    result=$(get_theme_color bg)
    assert_equals "FFFFFF" "$result" "set_theme switches to light theme"
    assert_equals "" "$SCREEN_BACKGROUND" "set_theme clears custom background"
}

# Test Suite 3: Background System
test_background_system() {
    echo "🧪 Testing Background System..."

    # Test custom background setting
    set_screen_background "001122"
    assert_equals "001122" "$SCREEN_BACKGROUND" "set_screen_background sets variable"
    assert_equals "" "$CURRENT_THEME" "set_screen_background clears theme"
}

# Test Suite 4: UI Color Assignments
test_ui_assignments() {
    echo "🧪 Testing UI Color Assignments..."

    # Test UI assignment modification
    UI_ASSIGNMENTS[env_label]="mint"
    local result=$(ui_env_label 2>&1)
    assert_contains "[38;2;" "$result" "ui_env_label outputs ANSI sequence"

    # Test assignment retrieval
    assert_equals "mint" "${UI_ASSIGNMENTS[env_label]}" "UI assignment stores correctly"
}

# Test Suite 5: Integration Tests
test_integration() {
    echo "🧪 Testing Integration..."

    # Test that color functions don't use background colors
    local fg_result=$(env_color forest primary 2>&1)
    assert_contains "[38;2;" "$fg_result" "env_color uses foreground codes only"

    # Ensure no background color codes in UI elements
    if [[ "$fg_result" == *"[48;2;"* ]]; then
        echo "❌ FAIL: env_color contains background codes"
        ((TESTS_FAILED++))
    else
        echo "✅ PASS: env_color contains no background codes"
        ((TESTS_PASSED++))
    fi
}

# Run all tests
main() {
    echo "🚀 Starting Color System Tests..."
    echo "=================================="

    test_color_functions
    echo
    test_theme_system
    echo
    test_background_system
    echo
    test_ui_assignments
    echo
    test_integration
    echo

    echo "=================================="
    echo "📊 Test Results:"
    echo "   Passed: $TESTS_PASSED"
    echo "   Failed: $TESTS_FAILED"

    if [[ $TESTS_FAILED -eq 0 ]]; then
        echo "🎉 All tests passed!"
        exit 0
    else
        echo "💥 Some tests failed!"
        exit 1
    fi
}

main "$@"