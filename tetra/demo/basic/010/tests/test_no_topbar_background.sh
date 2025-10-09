#!/usr/bin/env bash

# Test to ensure topbar elements never use background colors
# This prevents UI element background conflicts

source ./colors.sh
source ./demo.sh

# Test framework
TESTS_PASSED=0
TESTS_FAILED=0

assert_no_background() {
    local output="$1"
    local test_name="$2"

    # Check for background color ANSI codes ([48;2; or [4Xm)
    if [[ "$output" == *"[48;2;"* ]] || [[ "$output" == *"[4"*"m"* ]]; then
        echo "❌ FAIL: $test_name"
        echo "   Found background color in: $output"
        ((TESTS_FAILED++))
        return 1
    else
        echo "✅ PASS: $test_name"
        ((TESTS_PASSED++))
        return 0
    fi
}

assert_has_foreground() {
    local output="$1"
    local test_name="$2"

    # Check for foreground color ANSI codes ([38;2;)
    if [[ "$output" == *"[38;2;"* ]] || [[ "$output" == *"[3"*"m"* ]]; then
        echo "✅ PASS: $test_name"
        ((TESTS_PASSED++))
        return 0
    else
        echo "❌ FAIL: $test_name"
        echo "   No foreground color found in: $output"
        ((TESTS_FAILED++))
        return 1
    fi
}

# Test Suite: Topbar Background Prevention
test_env_line_no_background() {
    echo "🧪 Testing Environment Line - No Background..."

    # Test all environment states
    for ENV_INDEX in 0 1 2; do
        local env_output=$(render_environment_line 2>&1)
        assert_no_background "$env_output" "Environment line (index $ENV_INDEX) has no background"
        assert_has_foreground "$env_output" "Environment line (index $ENV_INDEX) has foreground colors"
    done
}

test_mode_line_no_background() {
    echo "🧪 Testing Mode Line - No Background..."

    # Test all mode states
    for MODE_INDEX in 0 1 2; do
        local mode_output=$(render_mode_line)
        assert_no_background "$mode_output" "Mode line (index $MODE_INDEX) has no background"
        assert_has_foreground "$mode_output" "Mode line (index $MODE_INDEX) has foreground colors"
    done
}

test_action_line_no_background() {
    echo "🧪 Testing Action Line - No Background..."

    # Test action line with different action indices
    for ACTION_INDEX in 0 1 2 3; do
        local action_output=$(render_action_line)
        assert_no_background "$action_output" "Action line (index $ACTION_INDEX) has no background"
        assert_has_foreground "$action_output" "Action line (index $ACTION_INDEX) has foreground colors"
    done
}

test_ui_color_functions() {
    echo "🧪 Testing UI Color Functions - No Background..."

    # Test all UI color functions
    local functions=(
        "ui_env_label"
        "ui_env_selected"
        "ui_env_other"
        "ui_mode_label"
        "ui_mode_selected"
        "ui_mode_other"
        "ui_action_label"
        "ui_action_selected"
        "ui_action_other"
    )

    for func in "${functions[@]}"; do
        if declare -f "$func" > /dev/null; then
            local output=$($func)
            assert_no_background "$output" "$func() produces no background"
            assert_has_foreground "$output" "$func() produces foreground color"
        fi
    done
}

test_color_category_functions() {
    echo "🧪 Testing Color Category Functions - No Background..."

    # Test env_color function
    local colors=(forest sage moss mint jade pine lime teal)
    for color in "${colors[@]}"; do
        local output=$(env_color "$color" primary)
        assert_no_background "$output" "env_color $color has no background"
        assert_has_foreground "$output" "env_color $color has foreground"
    done

    # Test mode_color function
    colors=(azure cobalt indigo navy royal steel powder slate)
    for color in "${colors[@]}"; do
        local output=$(mode_color "$color" primary)
        assert_no_background "$output" "mode_color $color has no background"
        assert_has_foreground "$output" "mode_color $color has foreground"
    done

    # Test tetra_color function
    colors=(crimson coral rust amber bronze copper gold flame)
    for color in "${colors[@]}"; do
        local output=$(tetra_color "$color" primary)
        assert_no_background "$output" "tetra_color $color has no background"
        assert_has_foreground "$output" "tetra_color $color has foreground"
    done
}

test_complete_topbar_output() {
    echo "🧪 Testing Complete Topbar Output..."

    # Generate complete header buffer and check for background codes
    generate_header_buffer
    assert_no_background "$SCREEN_BUFFER" "Complete header buffer has no background colors"
}

# Run all tests
main() {
    echo "🚀 Testing Topbar Background Prevention..."
    echo "========================================="

    test_env_line_no_background
    echo
    test_mode_line_no_background
    echo
    test_action_line_no_background
    echo
    test_ui_color_functions
    echo
    test_color_category_functions
    echo
    test_complete_topbar_output
    echo

    echo "========================================="
    echo "📊 Topbar Background Test Results:"
    echo "   Passed: $TESTS_PASSED"
    echo "   Failed: $TESTS_FAILED"

    if [[ $TESTS_FAILED -eq 0 ]]; then
        echo "🎉 All topbar background tests passed!"
        echo "✅ No UI elements use background colors"
        exit 0
    else
        echo "💥 Some topbar background tests failed!"
        echo "❌ UI elements are setting background colors"
        exit 1
    fi
}

main "$@"