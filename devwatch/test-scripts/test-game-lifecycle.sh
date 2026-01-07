#!/bin/bash

# PJA Game API Lifecycle Test Script
# Tests the complete game lifecycle with multiple scenarios

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TEST_RESULTS_DIR="$PROJECT_ROOT/test-results/game-api"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create test results directory
mkdir -p "$TEST_RESULTS_DIR"

echo -e "${BLUE}=== PJA Game API Lifecycle Tests ===${NC}"
echo "Test Results Directory: $TEST_RESULTS_DIR"
echo "Timestamp: $(date)"
echo ""

# Test counter
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_exit_code="${3:-0}"
    
    echo -e "${YELLOW}Running: $test_name${NC}"
    TESTS_RUN=$((TESTS_RUN + 1))
    
    local log_file="$TEST_RESULTS_DIR/${test_name//[ \/]/_}.log"
    
    if eval "$test_command" > "$log_file" 2>&1; then
        local actual_exit_code=$?
        if [ $actual_exit_code -eq $expected_exit_code ]; then
            echo -e "${GREEN}✓ PASSED: $test_name${NC}"
            TESTS_PASSED=$((TESTS_PASSED + 1))
        else
            echo -e "${RED}✗ FAILED: $test_name (exit code: $actual_exit_code, expected: $expected_exit_code)${NC}"
            TESTS_FAILED=$((TESTS_FAILED + 1))
            echo "  Log: $log_file"
        fi
    else
        local actual_exit_code=$?
        if [ $actual_exit_code -eq $expected_exit_code ]; then
            echo -e "${GREEN}✓ PASSED: $test_name (expected failure)${NC}"
            TESTS_PASSED=$((TESTS_PASSED + 1))
        else
            echo -e "${RED}✗ FAILED: $test_name (exit code: $actual_exit_code, expected: $expected_exit_code)${NC}"
            TESTS_FAILED=$((TESTS_FAILED + 1))
            echo "  Log: $log_file"
        fi
    fi
    echo ""
}

# Test 1: Basic Game Initialization
run_test "Game Initialization" \
    "node $SCRIPT_DIR/game-test-runner.js --test=init --game=pong"

# Test 2: Single Player Lifecycle
run_test "Single Player Lifecycle" \
    "node $SCRIPT_DIR/game-test-runner.js --test=lifecycle --game=pong --players=1"

# Test 3: Multiplayer Join Sequence
run_test "Multiplayer Join Sequence" \
    "node $SCRIPT_DIR/game-test-runner.js --test=multiplayer-join --game=pong --players=4"

# Test 4: Input Processing
run_test "Input Processing" \
    "node $SCRIPT_DIR/game-test-runner.js --test=input-processing --game=pong --duration=5"

# Test 5: State Machine Transitions
run_test "State Machine Transitions" \
    "node $SCRIPT_DIR/game-test-runner.js --test=state-transitions --game=pong"

# Test 6: Game Over Conditions
run_test "Game Over Conditions" \
    "node $SCRIPT_DIR/game-test-runner.js --test=game-over --game=pong --win-condition=score"

# Test 7: Error Handling
run_test "Error Handling" \
    "node $SCRIPT_DIR/game-test-runner.js --test=error-handling --game=invalid-game" 1

# Test 8: Performance Metrics
run_test "Performance Metrics" \
    "node $SCRIPT_DIR/game-test-runner.js --test=performance --game=pong --duration=10"

# Test 9: Network Simulation
run_test "Network Latency Simulation" \
    "node $SCRIPT_DIR/game-test-runner.js --test=network-sim --game=pong --latency=100"

# Test 10: Tick Rate Validation
run_test "Tick Rate Validation" \
    "node $SCRIPT_DIR/game-test-runner.js --test=tick-rate --game=pong --tick-rate=30"

# Generate summary report
echo -e "${BLUE}=== Test Summary ===${NC}"
echo "Tests Run: $TESTS_RUN"
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed. Check logs in $TEST_RESULTS_DIR${NC}"
    exit 1
fi
