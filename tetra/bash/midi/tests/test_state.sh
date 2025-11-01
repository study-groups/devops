#!/usr/bin/env bash
# Unit Tests for TMC State Management

CURRENT_TEST="state_init"

# Source the state module
export MIDI_SRC="$MIDI_SRC"
export TETRA_DIR="$TEST_TEMP_DIR/tetra"
export TMC_CONFIG_DIR="$TETRA_DIR/midi"

source "$MIDI_SRC/core/state.sh"

# Test 1: State initialization
test_state_init() {
    CURRENT_TEST="state_init"

    tmc_state_init
    local result=$?

    assert_equals 0 $result "State init should succeed"
    assert_not_empty "${#TMC_STATE[@]}" "State container should have entries"
}

# Test 2: State get/set
test_state_get_set() {
    CURRENT_TEST="state_get_set"

    tmc_state_set "broadcast_mode" "raw"
    local result=$?

    assert_equals 0 $result "State set should succeed"

    local value=$(tmc_state_get "broadcast_mode")
    assert_equals "raw" "$value" "State get should return set value"
}

# Test 3: Invalid key handling
test_invalid_key() {
    CURRENT_TEST="invalid_key"

    tmc_state_set "invalid_key_that_doesnt_exist" "value" 2>/dev/null
    local result=$?

    if [[ $result -ne 0 ]]; then
        ((TESTS_PASSED++))
        echo -e "${GREEN}✓${NC} $CURRENT_TEST: Invalid key rejected"
    else
        ((TESTS_FAILED++))
        echo -e "${RED}✗${NC} $CURRENT_TEST: Should reject invalid key"
    fi
}

# Test 4: CC value tracking
test_cc_tracking() {
    CURRENT_TEST="cc_tracking"

    tmc_state_set_last_cc "1" "7" "64"
    local result=$?

    assert_equals 0 $result "CC tracking should succeed"

    local channel=$(tmc_state_get "last_cc_channel")
    assert_equals "1" "$channel" "Channel should be tracked"

    local controller=$(tmc_state_get "last_cc_controller")
    assert_equals "7" "$controller" "Controller should be tracked"

    local value=$(tmc_state_get "last_cc_value")
    assert_equals "64" "$value" "Value should be tracked"

    local cc_count=$(tmc_state_get "cc_events_processed")
    assert_equals "1" "$cc_count" "CC event count should increment"
}

# Test 5: Invalid CC value rejection
test_cc_validation() {
    CURRENT_TEST="cc_validation"

    # Test out of range
    tmc_state_set_last_cc "1" "7" "200" 2>/dev/null
    local result=$?

    if [[ $result -ne 0 ]]; then
        ((TESTS_PASSED++))
        echo -e "${GREEN}✓${NC} $CURRENT_TEST: CC value > 127 rejected"
    else
        ((TESTS_FAILED++))
        echo -e "${RED}✗${NC} $CURRENT_TEST: Should reject CC > 127"
    fi

    # Test negative
    tmc_state_set_last_cc "1" "7" "-5" 2>/dev/null
    result=$?

    if [[ $result -ne 0 ]]; then
        ((TESTS_PASSED++))
        echo -e "${GREEN}✓${NC} $CURRENT_TEST: Negative CC value rejected"
    else
        ((TESTS_FAILED++))
        echo -e "${RED}✗${NC} $CURRENT_TEST: Should reject negative CC"
    fi
}

# Test 6: Learning state with lock
test_learning_lock() {
    CURRENT_TEST="learning_lock"

    tmc_state_start_learning "p1" "VOLUME" "0" "1"
    local result=$?

    assert_equals 0 $result "Learning start should succeed"

    local active=$(tmc_state_get "learning_active")
    assert_equals "1" "$active" "Learning should be active"

    # Try to start again (should fail)
    tmc_state_start_learning "p2" "PAN" "-1" "1" 2>/dev/null
    result=$?

    if [[ $result -ne 0 ]]; then
        ((TESTS_PASSED++))
        echo -e "${GREEN}✓${NC} $CURRENT_TEST: Concurrent learning prevented"
    else
        ((TESTS_FAILED++))
        echo -e "${RED}✗${NC} $CURRENT_TEST: Should prevent concurrent learning"
    fi

    # Stop learning
    tmc_state_stop_learning
    result=$?

    assert_equals 0 $result "Learning stop should succeed"

    active=$(tmc_state_get "learning_active")
    assert_equals "0" "$active" "Learning should be inactive"
}

# Test 7: Hardware map operations
test_hardware_map() {
    CURRENT_TEST="hardware_map"

    tmc_state_set_hardware_map "p1" "CC" "1" "7"

    local syntax=$(tmc_state_get_hardware_map "CC" "1" "7")
    assert_equals "p1" "$syntax" "Hardware map should store and retrieve"

    # Verify reverse map
    local key="${TMC_HARDWARE_REV[p1]}"
    assert_equals "CC|1|7" "$key" "Reverse hardware map should work"
}

# Test 8: Semantic map operations
test_semantic_map() {
    CURRENT_TEST="semantic_map"

    tmc_state_set_semantic_map "p1" "VOLUME" "0.0" "1.0"

    local value=$(tmc_state_get_semantic_map "p1")
    assert_equals "VOLUME|0.0|1.0" "$value" "Semantic map should store and retrieve"

    # Verify reverse map
    local syntax="${TMC_SEMANTIC_REV[VOLUME]}"
    assert_equals "p1" "$syntax" "Reverse semantic map should work"
}

# Test 9: Subscriber cache
test_subscriber_cache() {
    CURRENT_TEST="subscriber_cache"

    tmc_state_add_subscriber "/tmp/test_subscriber.sock"

    local valid=$(tmc_state_get "subscribers_cache_valid")
    assert_equals "1" "$valid" "Subscriber cache should be valid"

    # Check subscriber exists
    if [[ -n "${TMC_SUBSCRIBERS_CACHE[/tmp/test_subscriber.sock]:-}" ]]; then
        ((TESTS_PASSED++))
        echo -e "${GREEN}✓${NC} $CURRENT_TEST: Subscriber added"
    else
        ((TESTS_FAILED++))
        echo -e "${RED}✗${NC} $CURRENT_TEST: Subscriber not found"
    fi

    tmc_state_remove_subscriber "/tmp/test_subscriber.sock"

    if [[ -z "${TMC_SUBSCRIBERS_CACHE[/tmp/test_subscriber.sock]:-}" ]]; then
        ((TESTS_PASSED++))
        echo -e "${GREEN}✓${NC} $CURRENT_TEST: Subscriber removed"
    else
        ((TESTS_FAILED++))
        echo -e "${RED}✗${NC} $CURRENT_TEST: Subscriber still exists"
    fi
}

# Test 10: Event counter
test_event_counter() {
    CURRENT_TEST="event_counter"

    local initial=$(tmc_state_get "events_processed")

    tmc_state_increment_events
    tmc_state_increment_events
    tmc_state_increment_events

    local final=$(tmc_state_get "events_processed")
    local expected=$((initial + 3))

    assert_equals "$expected" "$final" "Event counter should increment"
}

# Run all tests
test_state_init
test_state_get_set
test_invalid_key
test_cc_tracking
test_cc_validation
test_learning_lock
test_hardware_map
test_semantic_map
test_subscriber_cache
test_event_counter
