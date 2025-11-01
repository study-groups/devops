#!/usr/bin/env bash
# Unit Tests for TMC Mapper

CURRENT_TEST="mapper_init"

# Source the mapper (which sources state and errors)
export MIDI_SRC="$MIDI_SRC"
export TETRA_DIR="$TEST_TEMP_DIR/tetra"
export TMC_CONFIG_DIR="$TETRA_DIR/midi"
export TMC_LOG_LEVEL=0  # Errors only during tests

source "$MIDI_SRC/core/mapper.sh"

# Test 1: Mapper initialization
test_mapper_init() {
    CURRENT_TEST="mapper_init"

    tmc_mapper_init
    local result=$?

    assert_equals 0 $result "Mapper init should succeed"

    # Check directories exist
    if [[ -d "$TMC_CONFIG_DIR/devices" ]]; then
        ((TESTS_PASSED++))
        echo -e "${GREEN}✓${NC} $CURRENT_TEST: Devices directory exists"
    else
        ((TESTS_FAILED++))
        echo -e "${RED}✗${NC} $CURRENT_TEST: Devices directory missing"
    fi

    if [[ -d "$TMC_CONFIG_DIR/sessions" ]]; then
        ((TESTS_PASSED++))
        echo -e "${GREEN}✓${NC} $CURRENT_TEST: Sessions directory exists"
    else
        ((TESTS_FAILED++))
        echo -e "${RED}✗${NC} $CURRENT_TEST: Sessions directory missing"
    fi
}

# Test 2: Load hardware map
test_load_hardware_map() {
    CURRENT_TEST="load_hardware_map"

    # Copy test fixture
    cp "$FIXTURES_DIR/test_hardware_map.txt" "$TEST_TEMP_DIR/hw_map.txt"

    tmc_load_hardware_map "$TEST_TEMP_DIR/hw_map.txt"
    local result=$?

    assert_equals 0 $result "Load hardware map should succeed"
    assert_not_empty "${#TMC_HARDWARE_MAP[@]}" "Hardware map should have entries"

    # Test specific mapping
    local syntax=$(tmc_state_get_hardware_map "CC" "1" "7")
    assert_equals "p1" "$syntax" "CC 1 7 should map to p1"
}

# Test 3: Load semantic map
test_load_semantic_map() {
    CURRENT_TEST="load_semantic_map"

    # Copy test fixture
    cp "$FIXTURES_DIR/test_semantic_map.txt" "$TEST_TEMP_DIR/sem_map.txt"

    tmc_load_semantic_map "$TEST_TEMP_DIR/sem_map.txt"
    local result=$?

    assert_equals 0 $result "Load semantic map should succeed"
    assert_not_empty "${#TMC_SEMANTIC_MAP[@]}" "Semantic map should have entries"

    # Test specific mapping
    local sem_value=$(tmc_state_get_semantic_map "p1")
    assert_equals "VOLUME|0.0|1.0" "$sem_value" "p1 should map to VOLUME"
}

# Test 4: CC value normalization
test_normalize_value() {
    CURRENT_TEST="normalize_value"

    # Test 0-127 to 0.0-1.0
    local normalized=$(tmc_normalize_value 0 0.0 1.0)
    # bc may return "0" or "0.000000" depending on version
    if [[ "$normalized" == "0" || "$normalized" == "0.000000" || "$normalized" == ".000000" ]]; then
        ((TESTS_PASSED++))
        echo -e "${GREEN}✓${NC} $CURRENT_TEST: 0 normalizes to 0"
    else
        ((TESTS_FAILED++))
        echo -e "${RED}✗${NC} $CURRENT_TEST: 0 normalization failed: $normalized"
    fi

    normalized=$(tmc_normalize_value 127 0.0 1.0)
    assert_equals "1.000000" "$normalized" "127 should normalize to 1.000000"

    normalized=$(tmc_normalize_value 64 0.0 1.0)
    # 64/127 = 0.503937 approximately
    # bc may output ".503937" or "0.503937"
    if [[ "$normalized" == 0.503937* || "$normalized" == .503937* ]]; then
        ((TESTS_PASSED++))
        echo -e "${GREEN}✓${NC} $CURRENT_TEST: 64 normalizes to ~0.504"
    else
        ((TESTS_FAILED++))
        echo -e "${RED}✗${NC} $CURRENT_TEST: 64 normalization failed"
        echo -e "  Expected: ${YELLOW}~0.504${NC}"
        echo -e "  Actual:   ${YELLOW}$normalized${NC}"
    fi
}

# Test 5: Map CC event
test_map_cc_event() {
    CURRENT_TEST="map_cc_event"

    # Load test maps
    cp "$FIXTURES_DIR/test_hardware_map.txt" "$TEST_TEMP_DIR/hw_map.txt"
    cp "$FIXTURES_DIR/test_semantic_map.txt" "$TEST_TEMP_DIR/sem_map.txt"
    tmc_load_hardware_map "$TEST_TEMP_DIR/hw_map.txt" 2>/dev/null
    tmc_load_semantic_map "$TEST_TEMP_DIR/sem_map.txt" 2>/dev/null

    # Set mode to 'all'
    tmc_state_set "broadcast_mode" "all"

    # Map a CC event: CC 1 7 127
    local output=$(tmc_map_event "CC" "1" "7" "127")

    # Should contain: ALL CC 1 7 127 p1 VOLUME 1.000000
    if [[ "$output" == *"ALL"* && "$output" == *"CC 1 7 127"* && "$output" == *"p1"* && "$output" == *"VOLUME"* ]]; then
        ((TESTS_PASSED++))
        echo -e "${GREEN}✓${NC} $CURRENT_TEST: CC event mapped correctly"
    else
        ((TESTS_FAILED++))
        echo -e "${RED}✗${NC} $CURRENT_TEST: CC event mapping failed"
        echo -e "  Output: ${YELLOW}$output${NC}"
    fi
}

# Test 6: Invalid CC value handling
test_invalid_cc_value() {
    CURRENT_TEST="invalid_cc_value"

    # Test out of range (should fail)
    tmc_map_event "CC" "1" "7" "200" 2>/dev/null
    local result=$?

    if [[ $result -ne 0 ]]; then
        ((TESTS_PASSED++))
        echo -e "${GREEN}✓${NC} $CURRENT_TEST: Invalid CC value rejected"
    else
        ((TESTS_FAILED++))
        echo -e "${RED}✗${NC} $CURRENT_TEST: Should reject CC value > 127"
    fi

    # Test negative value (should fail)
    tmc_map_event "CC" "1" "7" "-5" 2>/dev/null
    result=$?

    if [[ $result -ne 0 ]]; then
        ((TESTS_PASSED++))
        echo -e "${GREEN}✓${NC} $CURRENT_TEST: Negative CC value rejected"
    else
        ((TESTS_FAILED++))
        echo -e "${RED}✗${NC} $CURRENT_TEST: Should reject negative CC value"
    fi
}

# Test 7: Learn hardware mapping
test_learn_hardware() {
    CURRENT_TEST="learn_hardware"

    tmc_learn_hardware "p1" "CC" "1" "10" 2>/dev/null
    local result=$?

    assert_equals 0 $result "Learn hardware should succeed"

    # Verify mapping was added
    local syntax=$(tmc_state_get_hardware_map "CC" "1" "10")
    assert_equals "p1" "$syntax" "p1 should be mapped to CC 1 10"
}

# Test 8: Save and load session
test_session_save_load() {
    CURRENT_TEST="session_save_load"

    # Create a test mapping
    tmc_learn_hardware "p1" "CC" "1" "20" 2>/dev/null
    tmc_learn_semantic "p1" "TEST_PARAM" "0" "100" 2>/dev/null

    # Save session
    tmc_save_session "test_session" 2>/dev/null
    local result=$?

    assert_equals 0 $result "Save session should succeed"

    # Clear maps
    TMC_HARDWARE_MAP=()
    TMC_HARDWARE_REV=()
    TMC_SEMANTIC_MAP=()
    TMC_SEMANTIC_REV=()

    # Load session
    tmc_load_session "test_session" 2>/dev/null
    result=$?

    assert_equals 0 $result "Load session should succeed"

    # Verify mappings restored
    local syntax=$(tmc_state_get_hardware_map "CC" "1" "20")
    assert_equals "p1" "$syntax" "Session should restore hardware map"

    local sem_value=$(tmc_state_get_semantic_map "p1")
    assert_equals "TEST_PARAM|0|100" "$sem_value" "Session should restore semantic map"
}

# Test 9: Broadcast modes
test_broadcast_modes() {
    CURRENT_TEST="broadcast_modes"

    # Load test maps
    cp "$FIXTURES_DIR/test_hardware_map.txt" "$TEST_TEMP_DIR/hw_map.txt"
    cp "$FIXTURES_DIR/test_semantic_map.txt" "$TEST_TEMP_DIR/sem_map.txt"
    tmc_load_hardware_map "$TEST_TEMP_DIR/hw_map.txt" 2>/dev/null
    tmc_load_semantic_map "$TEST_TEMP_DIR/sem_map.txt" 2>/dev/null

    # Test raw mode
    tmc_state_set "broadcast_mode" "raw"
    local output=$(tmc_map_event "CC" "1" "7" "100")
    if [[ "$output" == "RAW CC 1 7 100" ]]; then
        ((TESTS_PASSED++))
        echo -e "${GREEN}✓${NC} $CURRENT_TEST: Raw mode works"
    else
        ((TESTS_FAILED++))
        echo -e "${RED}✗${NC} $CURRENT_TEST: Raw mode failed: $output"
    fi

    # Test syntax mode
    tmc_state_set "broadcast_mode" "syntax"
    output=$(tmc_map_event "CC" "1" "7" "100")
    if [[ "$output" == "SYNTAX p1 100" ]]; then
        ((TESTS_PASSED++))
        echo -e "${GREEN}✓${NC} $CURRENT_TEST: Syntax mode works"
    else
        ((TESTS_FAILED++))
        echo -e "${RED}✗${NC} $CURRENT_TEST: Syntax mode failed: $output"
    fi

    # Test semantic mode
    tmc_state_set "broadcast_mode" "semantic"
    output=$(tmc_map_event "CC" "1" "7" "127")
    if [[ "$output" == *"SEMANTIC VOLUME"* ]]; then
        ((TESTS_PASSED++))
        echo -e "${GREEN}✓${NC} $CURRENT_TEST: Semantic mode works"
    else
        ((TESTS_FAILED++))
        echo -e "${RED}✗${NC} $CURRENT_TEST: Semantic mode failed: $output"
    fi
}

# Run all tests
test_mapper_init
test_load_hardware_map
test_load_semantic_map
test_normalize_value
test_map_cc_event
test_invalid_cc_value
test_learn_hardware
test_session_save_load
test_broadcast_modes
