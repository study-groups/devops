#!/usr/bin/env bash
# Estovox Test Suite - Basic functionality tests

SCRIPT_DIR="${BASH_SOURCE[0]%/*}"
source "$SCRIPT_DIR/estovox.sh"

# Test counter
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

test_result() {
    local test_name=$1
    local result=$2

    TESTS_RUN=$((TESTS_RUN + 1))

    if [[ "$result" == "PASS" ]]; then
        echo "✓ $test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo "✗ $test_name"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

# === TESTS ===

test_module_init() {
    if estovox_module_init 2>/dev/null; then
        test_result "Module initialization" "PASS"
    else
        test_result "Module initialization" "FAIL"
    fi
}

test_state_management() {
    estovox_set_param "ESTOVOX_JAW_OPENNESS" 0.5
    local value=$(estovox_get_param "ESTOVOX_JAW_OPENNESS")

    if [[ "$value" == "0.5" ]]; then
        test_result "State get/set" "PASS"
    else
        test_result "State get/set" "FAIL"
    fi
}

test_target_system() {
    estovox_set_target "ESTOVOX_JAW_OPENNESS" 0.8 0.5

    if estovox_has_target "ESTOVOX_JAW_OPENNESS"; then
        test_result "Target system" "PASS"
    else
        test_result "Target system" "FAIL"
    fi

    estovox_clear_target "ESTOVOX_JAW_OPENNESS"
}

test_phoneme_presets() {
    local preset=$(estovox_get_phoneme_preset "a")

    if [[ -n "$preset" ]]; then
        test_result "Phoneme preset (a)" "PASS"
    else
        test_result "Phoneme preset (a)" "FAIL"
    fi
}

test_expression_presets() {
    local preset=$(estovox_get_expression_preset "happy")

    if [[ -n "$preset" ]]; then
        test_result "Expression preset (happy)" "PASS"
    else
        test_result "Expression preset (happy)" "FAIL"
    fi
}

test_apply_preset() {
    if estovox_apply_preset "neutral" 0.5 2>/dev/null; then
        test_result "Apply preset" "PASS"
    else
        test_result "Apply preset" "FAIL"
    fi
}

test_lerp() {
    local result=$(estovox_lerp 0.0 1.0 0.5)

    # Check if result is approximately 0.5
    if (( $(bc -l <<< "$result > 0.49 && $result < 0.51") )); then
        test_result "Linear interpolation" "PASS"
    else
        test_result "Linear interpolation" "FAIL"
    fi
}

test_clamp() {
    local result=$(estovox_clamp 1.5 0.0 1.0)

    if [[ "$result" == "1.0" ]]; then
        test_result "Value clamping" "PASS"
    else
        test_result "Value clamping" "FAIL"
    fi
}

test_update_frame() {
    estovox_set_target "ESTOVOX_EYE_OPENNESS" 0.5 0.5
    estovox_update_frame

    # Should have updated towards target
    local value=$(estovox_get_param "ESTOVOX_EYE_OPENNESS")
    if (( $(bc -l <<< "$value < 1.0") )); then
        test_result "Frame update" "PASS"
    else
        test_result "Frame update" "FAIL"
    fi
}

test_reset_state() {
    estovox_set_param "ESTOVOX_JAW_OPENNESS" 0.9
    estovox_reset_state
    local value=$(estovox_get_param "ESTOVOX_JAW_OPENNESS")

    if [[ "$value" == "0.0" ]]; then
        test_result "State reset" "PASS"
    else
        test_result "State reset" "FAIL"
    fi
}

test_command_processing() {
    # Test help command (shouldn't fail)
    if estovox_process_command "help" >/dev/null 2>&1; then
        test_result "Command processing (help)" "PASS"
    else
        test_result "Command processing (help)" "FAIL"
    fi
}

test_clear_command() {
    # Test clear command (shouldn't fail)
    if estovox_process_command "clear" >/dev/null 2>&1; then
        test_result "Command processing (clear)" "PASS"
    else
        test_result "Command processing (clear)" "FAIL"
    fi
}

test_phoneme_list() {
    local phonemes=$(estovox_list_phonemes)

    if [[ -n "$phonemes" ]]; then
        test_result "List phonemes" "PASS"
    else
        test_result "List phonemes" "FAIL"
    fi
}

test_expression_list() {
    local expressions=$(estovox_list_expressions)

    if [[ -n "$expressions" ]]; then
        test_result "List expressions" "PASS"
    else
        test_result "List expressions" "FAIL"
    fi
}

# === RUN TESTS ===

echo "╔═══════════════════════════════════════╗"
echo "║       Estovox Test Suite              ║"
echo "╚═══════════════════════════════════════╝"
echo ""

test_module_init
test_state_management
test_target_system
test_phoneme_presets
test_expression_presets
test_apply_preset
test_lerp
test_clamp
test_update_frame
test_reset_state
test_command_processing
test_clear_command
test_phoneme_list
test_expression_list

# === SUMMARY ===

echo ""
echo "═══════════════════════════════════════"
echo "Tests run:    $TESTS_RUN"
echo "Tests passed: $TESTS_PASSED"
echo "Tests failed: $TESTS_FAILED"
echo "═══════════════════════════════════════"

if (( TESTS_FAILED == 0 )); then
    echo "✓ All tests passed!"
    exit 0
else
    echo "✗ Some tests failed"
    exit 1
fi
