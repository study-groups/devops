#!/usr/bin/env bash

# Comprehensive Handler System Test Suite
# Tests all aspects of the handler architecture

set -e  # Exit on any error

# Test configuration
TEST_DIR="$(dirname "${BASH_SOURCE[0]}")"
PROJECT_ROOT="$(realpath "$TEST_DIR/../..")"
HANDLER_DIR="$PROJECT_ROOT/bash/app/handlers"

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Test utilities
test_assert() {
    local description="$1"
    local condition="$2"
    TESTS_RUN=$((TESTS_RUN + 1))

    if eval "$condition"; then
        echo "✅ $description"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo "❌ $description"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

test_assert_output() {
    local description="$1"
    local expected="$2"
    local actual="$3"

    TESTS_RUN=$((TESTS_RUN + 1))

    if [[ "$actual" == *"$expected"* ]]; then
        echo "✅ $description"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo "❌ $description"
        echo "   Expected: '$expected'"
        echo "   Actual: '$actual'"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

setup_test_environment() {
    echo "🏗️  Setting up test environment..."

    # Change to project root
    cd "$PROJECT_ROOT"

    # Mock required functions for isolated testing
    refresh_color_state_cached() { echo "Color state refreshed for $1:$2" >&2; }
    get_action_routing() { echo "input_keyboard → output_display"; }
    render_action_verb_noun() { echo "[$1×$2]"; }
    render_response_type() { echo " → response"; }
    generate_section_separator() { echo "=========================================="; }
    get_action_description() { echo "Test description for $1:$2"; }
    log_action() { echo "LOG: $*" >&2; }
    handler_log() { echo "HANDLER LOG: $*" >&2; }
    get_env_nouns() { echo -e "demo\ncolors\ninput\ntui"; }
    get_mode_verbs() { echo -e "show\nconfigure\ntest"; }

    # Export mock functions
    export -f refresh_color_state_cached get_action_routing render_action_verb_noun
    export -f render_response_type generate_section_separator get_action_description
    export -f log_action handler_log get_env_nouns get_mode_verbs

    # Source the handler system
    source "$HANDLER_DIR/registry.sh" 2>/dev/null

    echo "✅ Test environment ready"
}

test_file_structure() {
    echo ""
    echo "📁 Testing File Structure"
    echo "========================="

    test_assert "Base handler exists" "[[ -f '$HANDLER_DIR/base_handler.sh' ]]"
    test_assert "Registry exists" "[[ -f '$HANDLER_DIR/registry.sh' ]]"
    test_assert "Show handler exists" "[[ -f '$HANDLER_DIR/show_handler.sh' ]]"
    test_assert "Configure handler exists" "[[ -f '$HANDLER_DIR/configure_handler.sh' ]]"
    test_assert "Test handler exists" "[[ -f '$HANDLER_DIR/test_handler.sh' ]]"
    test_assert "Default handler exists" "[[ -f '$HANDLER_DIR/default_handler.sh' ]]"
    test_assert "Config file exists" "[[ -f '$PROJECT_ROOT/config/tui_actions.conf' ]]"
}

test_syntax_validation() {
    echo ""
    echo "🔍 Testing Syntax Validation"
    echo "============================"

    for handler_file in "$HANDLER_DIR"/*.sh; do
        if [[ -f "$handler_file" ]]; then
            local filename=$(basename "$handler_file")
            test_assert "Syntax valid: $filename" "bash -n '$handler_file'"
        fi
    done
}

test_registry_functionality() {
    echo ""
    echo "🗂️  Testing Registry Functionality"
    echo "=================================="

    # Initialize registry
    init_handler_registry 2>/dev/null

    test_assert "Registry initialized" "[[ ${#HANDLER_REGISTRY[@]} -gt 0 ]]"

    # Test handler discovery
    local show_handler
    show_handler=$(find_handler show demo APP Learn 2>/dev/null)
    test_assert "Found show handler" "[[ '$show_handler' == *'show_handler.sh' ]]"

    local configure_handler
    configure_handler=$(find_handler configure colors APP Try 2>/dev/null)
    test_assert "Found configure handler" "[[ '$configure_handler' == *'configure_handler.sh' ]]"

    local default_handler
    default_handler=$(find_handler unknown action APP Learn 2>/dev/null)
    test_assert "Found default handler for unknown action" "[[ '$default_handler' == *'default_handler.sh' ]]"
}

test_handler_interface_compliance() {
    echo ""
    echo "🔌 Testing Handler Interface Compliance"
    echo "======================================="

    for handler_file in "$HANDLER_DIR"/*_handler.sh; do
        if [[ -f "$handler_file" && "$(basename "$handler_file")" != "base_handler.sh" ]]; then
            local filename=$(basename "$handler_file")

            # Source the handler
            source "$handler_file" 2>/dev/null

            test_assert "$filename implements handler_execute" "command -v handler_execute >/dev/null"
            test_assert "$filename implements handler_can_execute" "command -v handler_can_execute >/dev/null"
            test_assert "$filename implements handler_describe" "command -v handler_describe >/dev/null"
            test_assert "$filename implements handler_validate" "command -v handler_validate >/dev/null"
        fi
    done
}

test_show_handler_execution() {
    echo ""
    echo "📺 Testing Show Handler Execution"
    echo "================================="

    # Source show handler
    source "$HANDLER_DIR/show_handler.sh" 2>/dev/null

    # Test can_execute
    test_assert "Show handler accepts show actions" "handler_can_execute show demo APP Learn"
    test_assert "Show handler rejects non-show actions" "! handler_can_execute configure demo APP Learn"

    # Test validation
    test_assert "Show handler validates correct input" "handler_validate show demo APP Learn"
    test_assert "Show handler rejects invalid input" "! handler_validate '' demo APP Learn"

    # Test execution
    local result
    result=$(handler_execute show demo APP Learn 2>/dev/null)
    test_assert_output "Show demo produces content" "TUI Demo Application" "$result"

    result=$(handler_execute show colors APP Learn 2>/dev/null)
    test_assert_output "Show colors produces content" "Color System Status" "$result"

    result=$(handler_execute show inspect APP Learn 2>/dev/null)
    test_assert_output "Show inspect produces content" "System Inspection" "$result"
}

test_configure_handler_execution() {
    echo ""
    echo "⚙️  Testing Configure Handler Execution"
    echo "======================================="

    # Source configure handler
    source "$HANDLER_DIR/configure_handler.sh" 2>/dev/null

    # Test can_execute
    test_assert "Configure handler accepts configure actions" "handler_can_execute configure colors APP Try"
    test_assert "Configure handler rejects non-configure actions" "! handler_can_execute show colors APP Try"

    # Test execution
    local result
    result=$(handler_execute configure colors APP Try 2>/dev/null)
    test_assert_output "Configure colors produces content" "Configuration: configure × colors" "$result"

    result=$(handler_execute configure demo APP Try 2>/dev/null)
    test_assert_output "Configure demo produces content" "Auto-execute show actions" "$result"
}

test_default_handler_fallback() {
    echo ""
    echo "🔄 Testing Default Handler Fallback"
    echo "==================================="

    # Source default handler
    source "$HANDLER_DIR/default_handler.sh" 2>/dev/null

    # Test can_execute (should accept anything)
    test_assert "Default handler accepts any action" "handler_can_execute unknown action APP Learn"

    # Test execution
    local result
    result=$(handler_execute unknown action APP Learn 2>/dev/null)
    test_assert_output "Default handler produces fallback content" "Default Handler Response" "$result"
}

test_end_to_end_execution() {
    echo ""
    echo "🔗 Testing End-to-End Execution"
    echo "==============================="

    # Test complete execution flow
    local result
    result=$(execute_action_with_handler show demo APP Learn 2>/dev/null)
    test_assert_output "End-to-end show:demo execution" "TUI Demo Application" "$result"

    result=$(execute_action_with_handler configure colors APP Try 2>/dev/null)
    test_assert_output "End-to-end configure:colors execution" "Configuration: configure × colors" "$result"

    result=$(execute_action_with_handler unknown action APP Learn 2>/dev/null)
    test_assert_output "End-to-end unknown action fallback" "Default Handler Response" "$result"
}

run_performance_tests() {
    echo ""
    echo "⚡ Testing Performance"
    echo "===================="

    # Test registry initialization time
    local start_time end_time duration
    start_time=$(date +%s%N)
    init_handler_registry >/dev/null 2>&1
    end_time=$(date +%s%N)
    duration=$(( (end_time - start_time) / 1000000 ))  # Convert to milliseconds

    test_assert "Registry initialization < 100ms" "[[ $duration -lt 100 ]]"
    echo "   Registry init time: ${duration}ms"

    # Test handler execution time
    start_time=$(date +%s%N)
    execute_action_with_handler show demo APP Learn >/dev/null 2>&1
    end_time=$(date +%s%N)
    duration=$(( (end_time - start_time) / 1000000 ))

    test_assert "Handler execution < 50ms" "[[ $duration -lt 50 ]]"
    echo "   Execution time: ${duration}ms"
}

print_test_summary() {
    echo ""
    echo "📊 Test Summary"
    echo "=============="
    echo "Tests Run: $TESTS_RUN"
    echo "Passed: $TESTS_PASSED"
    echo "Failed: $TESTS_FAILED"

    if [[ $TESTS_FAILED -eq 0 ]]; then
        echo "🎉 All tests passed!"
        return 0
    else
        echo "💥 Some tests failed!"
        return 1
    fi
}

# Main test execution
main() {
    echo "🧪 Handler System Test Suite"
    echo "============================"

    setup_test_environment
    test_file_structure
    test_syntax_validation
    test_registry_functionality
    test_handler_interface_compliance
    test_show_handler_execution
    test_configure_handler_execution
    test_default_handler_fallback
    test_end_to_end_execution
    run_performance_tests

    print_test_summary
}

# Run tests if called directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi