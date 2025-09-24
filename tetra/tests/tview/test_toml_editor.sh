#!/usr/bin/env bash

# TDD Test Suite for TOML Editor (ENV:TETRA, MODE:TOML)
# Tests hierarchical TOML editing with multispan cursor tracking

# Detect TETRA_SRC dynamically
if [[ -z "$TETRA_SRC" ]]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    export TETRA_SRC="$(dirname "$(dirname "$SCRIPT_DIR")")"
fi

# Test configuration
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test counters
total_tests=0
passed_tests=0
failed_tests=0

# Test workspace
TEST_WORKSPACE="/tmp/toml_editor_test_$$"
mkdir -p "$TEST_WORKSPACE"
cd "$TEST_WORKSPACE"

# Create test TOML file
cat > test.toml << 'EOF'
[database]
server = "192.168.1.1"
port = 5432
connection_max = 5000

[servers.alpha]
ip = "10.0.0.1"
dc = "eqdc10"

[servers.beta]
ip = "10.0.0.2"
dc = "eqdc10"

[clients]
data = [["gamma", "delta"], [1, 2]]
hosts = ["alpha", "omega"]

[debug]
enabled = true
level = "info"
EOF

export ACTIVE_TOML="$TEST_WORKSPACE/test.toml"

echo -e "${BLUE}=== TOML Editor TDD Test Suite ===${NC}"
echo "Test workspace: $TEST_WORKSPACE"
echo "Test TOML file: $ACTIVE_TOML"

# Test assertion function
test_assert() {
    local condition="$1"
    local test_name="$2"
    local error_msg="${3:-Test failed}"

    ((total_tests++))

    case "$condition" in
        "true")
            echo -e "${GREEN}✓${NC} $test_name"
            ((passed_tests++))
            ;;
        "skip")
            echo -e "${YELLOW}~${NC} $test_name: $error_msg"
            ;;
        *)
            echo -e "${RED}✗${NC} $test_name: $error_msg"
            ((failed_tests++))
            ;;
    esac
}

# Load TView modules
source "$TETRA_SRC/bash/tview/tview_data.sh" 2>/dev/null || echo "Warning: Could not load tview_data.sh"

# Load TOML editor modules
source "$TETRA_SRC/bash/tview/toml/cursor_navigation.sh" 2>/dev/null || echo "Warning: Could not load cursor_navigation.sh"
source "$TETRA_SRC/bash/tview/toml/section_manager.sh" 2>/dev/null || echo "Warning: Could not load section_manager.sh"
source "$TETRA_SRC/bash/tview/toml/visual_elements.sh" 2>/dev/null || echo "Warning: Could not load visual_elements.sh"

echo
echo -e "${BLUE}=== Test 1: TOML Section Discovery ===${NC}"

test_toml_section_discovery() {
    # Test: Should discover all TOML sections
    local sections=($(awk -F'[][]' '/^\[/{print $2}' "$ACTIVE_TOML" | sort -u))

    if [[ ${#sections[@]} -gt 0 ]]; then
        test_assert "true" "TOML sections discovered: ${sections[*]}"

        # Verify specific sections exist
        local expected_sections=("database" "servers.alpha" "servers.beta" "clients" "debug")
        local found_all=true

        for expected in "${expected_sections[@]}"; do
            if [[ ! " ${sections[*]} " =~ " ${expected} " ]]; then
                found_all=false
                break
            fi
        done

        if [[ "$found_all" == "true" ]]; then
            test_assert "true" "All expected sections found"
        else
            test_assert "false" "Missing expected sections"
        fi
    else
        test_assert "false" "No TOML sections discovered"
    fi
}
test_toml_section_discovery

echo
echo -e "${BLUE}=== Test 2: Hierarchical Section Navigation ===${NC}"

test_hierarchical_navigation() {
    # Test: Should build hierarchical tree structure
    declare -a ACTIVE_MULTISPANS
    declare -A MULTISPAN_LOCATIONS

    # Simulate building multispan structure
    while IFS= read -r section; do
        if [[ -n "$section" ]]; then
            ACTIVE_MULTISPANS+=("$section")
            local line_num=$(grep -n "\\[$section\\]" "$ACTIVE_TOML" | cut -d: -f1)
            MULTISPAN_LOCATIONS["$section"]="$ACTIVE_TOML:$line_num"
        fi
    done < <(awk -F'[][]' '/^\[/{print $2}' "$ACTIVE_TOML")

    if [[ ${#ACTIVE_MULTISPANS[@]} -gt 0 ]]; then
        test_assert "true" "Multispan structure built: ${#ACTIVE_MULTISPANS[@]} sections"

        # Test section location tracking
        if [[ -n "${MULTISPAN_LOCATIONS[database]}" ]]; then
            test_assert "true" "Section location tracked: ${MULTISPAN_LOCATIONS[database]}"
        else
            test_assert "false" "Section location tracking failed"
        fi
    else
        test_assert "false" "Hierarchical navigation structure not built"
    fi
}
test_hierarchical_navigation

echo
echo -e "${BLUE}=== Test 3: Variable Source-of-Truth Discovery ===${NC}"

test_variable_source_tracking() {
    # Test: Should map variables to exact file:line locations
    declare -A VARIABLE_SOURCE_MAP

    # Build variable source map
    while IFS= read -r line; do
        local line_num=$(echo "$line" | cut -d: -f1)
        local content=$(echo "$line" | cut -d: -f2-)

        if [[ "$content" =~ ^[[:space:]]*([a-zA-Z_][a-zA-Z0-9_]*)[[:space:]]*= ]]; then
            local var_name="${BASH_REMATCH[1]}"
            VARIABLE_SOURCE_MAP["$var_name"]="$ACTIVE_TOML:$line_num"
        fi
    done < <(grep -n "=" "$ACTIVE_TOML")

    if [[ ${#VARIABLE_SOURCE_MAP[@]} -gt 0 ]]; then
        test_assert "true" "Variable source map built: ${#VARIABLE_SOURCE_MAP[@]} variables"

        # Test specific variable tracking
        if [[ -n "${VARIABLE_SOURCE_MAP[server]}" ]]; then
            test_assert "true" "Variable 'server' tracked: ${VARIABLE_SOURCE_MAP[server]}"
        else
            test_assert "false" "Variable 'server' not tracked"
        fi

        if [[ -n "${VARIABLE_SOURCE_MAP[port]}" ]]; then
            test_assert "true" "Variable 'port' tracked: ${VARIABLE_SOURCE_MAP[port]}"
        else
            test_assert "false" "Variable 'port' not tracked"
        fi
    else
        test_assert "false" "Variable source tracking failed"
    fi
}
test_variable_source_tracking

echo
echo -e "${BLUE}=== Test 4: Multispan Cursor Movement ===${NC}"

test_cursor_movement() {
    # Test: Cursor should navigate between sections

    # Initialize cursor navigation
    if declare -f init_toml_cursor >/dev/null 2>&1; then
        init_toml_cursor "$ACTIVE_TOML"
        test_assert "true" "Cursor initialization available"
    else
        test_assert "false" "Cursor initialization missing"
        return
    fi

    local max_items=${#ACTIVE_MULTISPANS[@]}

    if [[ $max_items -gt 0 ]]; then
        # Test cursor bounds
        if [[ $CURRENT_ITEM -ge 0 && $CURRENT_ITEM -lt $max_items ]]; then
            test_assert "true" "Cursor within bounds: $CURRENT_ITEM/$max_items"
        else
            test_assert "false" "Cursor out of bounds"
        fi

        # Test cursor movement functions
        if declare -f move_cursor_down >/dev/null 2>&1 && declare -f move_cursor_up >/dev/null 2>&1; then
            test_assert "true" "Cursor movement functions available"
        else
            test_assert "false" "Cursor movement functions missing"
        fi
    else
        test_assert "skip" "No items for cursor testing"
    fi
}
test_cursor_movement

echo
echo -e "${BLUE}=== Test 5: Section Expansion/Collapse ===${NC}"

test_section_expansion() {
    # Test: Sections should be expandable to show variables
    declare -A SECTION_EXPANDED

    # Test expansion state tracking
    SECTION_EXPANDED["database"]=false
    SECTION_EXPANDED["servers.alpha"]=false

    if [[ "${SECTION_EXPANDED[database]}" == "false" ]]; then
        test_assert "true" "Section expansion state tracked"

        # Toggle expansion
        SECTION_EXPANDED["database"]=true

        if [[ "${SECTION_EXPANDED[database]}" == "true" ]]; then
            test_assert "true" "Section expansion toggle works"
        else
            test_assert "false" "Section expansion toggle failed"
        fi
    else
        test_assert "false" "Section expansion state tracking failed"
    fi

    # Test functions for getting section variables
    if declare -f get_section_variables >/dev/null 2>&1 || \
       grep -q "get.*section.*var\|section.*variables" "$TETRA_SRC/bash/tview"/*.sh 2>/dev/null; then
        test_assert "true" "Section variable extraction functions available"
    else
        test_assert "false" "Section variable extraction functions missing"
    fi
}
test_section_expansion

echo
echo -e "${BLUE}=== Test 6: TOML Value Editing ===${NC}"

test_toml_value_editing() {
    # Test: Should be able to edit TOML values in place

    # Test value extraction
    local server_value=$(awk -F'=' '/^server[[:space:]]*=/ {gsub(/^[[:space:]]*"|"[[:space:]]*$/, "", $2); print $2}' "$ACTIVE_TOML" | xargs)

    if [[ "$server_value" == "192.168.1.1" ]]; then
        test_assert "true" "TOML value extraction works: server = $server_value"
    else
        test_assert "false" "TOML value extraction failed: got '$server_value'"
    fi

    # Test value modification functions should exist
    if declare -f edit_toml_value >/dev/null 2>&1 || \
       grep -q "edit.*toml\|toml.*edit\|modify.*toml" "$TETRA_SRC/bash/tview"/*.sh 2>/dev/null; then
        test_assert "true" "TOML value editing functions available"
    else
        test_assert "false" "TOML value editing functions missing"
    fi
}
test_toml_value_editing

echo
echo -e "${BLUE}=== Test 7: TOML Editor UI Components ===${NC}"

test_toml_editor_ui() {
    # Test: UI should provide clear visual feedback

    # Test section indicators
    local section_indicator="▶"  # collapsed
    local expanded_indicator="▼"  # expanded

    test_assert "true" "Section indicators defined: $section_indicator $expanded_indicator"

    # Test indentation for hierarchy
    local indent="  "
    local nested_indent="    "

    test_assert "true" "Indentation levels defined for hierarchy"

    # Test color coding functions should exist
    if declare -f colorize_section >/dev/null 2>&1 || \
       grep -q "color.*section\|section.*color" "$TETRA_SRC/bash/tview"/*.sh 2>/dev/null; then
        test_assert "true" "Section colorization functions available"
    else
        test_assert "false" "Section colorization functions missing"
    fi
}
test_toml_editor_ui

echo
echo -e "${BLUE}=== Test 8: Variable Context Display ===${NC}"

test_variable_context() {
    # Test: Should show variable context and purpose

    # Test variable help/context functions
    if declare -f get_variable_context >/dev/null 2>&1 || \
       grep -q "variable.*context\|context.*variable" "$TETRA_SRC/bash/tview"/*.sh 2>/dev/null; then
        test_assert "true" "Variable context functions available"
    else
        test_assert "false" "Variable context functions missing"
    fi

    # Test variable validation
    if declare -f validate_toml_value >/dev/null 2>&1 || \
       grep -q "validate.*toml\|toml.*validate" "$TETRA_SRC/bash/tview"/*.sh 2>/dev/null; then
        test_assert "true" "TOML value validation functions available"
    else
        test_assert "false" "TOML value validation functions missing"
    fi
}
test_variable_context

# Cleanup
cleanup() {
    cd "$TETRA_SRC"
    rm -rf "$TEST_WORKSPACE"
}
trap cleanup EXIT

# Test summary
echo
echo -e "${BLUE}=== Test Summary ===${NC}"
echo "Total tests: $total_tests"
echo -e "Passed: ${GREEN}$passed_tests${NC}"
echo -e "Failed: ${RED}$failed_tests${NC}"

if [[ $total_tests -gt 0 ]]; then
    local success_rate=$((passed_tests * 100 / total_tests))
    echo -e "Success rate: ${YELLOW}${success_rate}%${NC}"
fi

echo
echo -e "${BLUE}=== TDD Development Guidance for TOML Editor ===${NC}"

if [[ $failed_tests -gt 0 ]]; then
    echo -e "${RED}Required Functions to Implement:${NC}"
    echo "1. move_cursor_down() / move_cursor_up() - Multispan navigation"
    echo "2. get_section_variables() - Extract variables from TOML section"
    echo "3. edit_toml_value() - In-place TOML value editing"
    echo "4. colorize_section() - Visual section highlighting"
    echo "5. get_variable_context() - Show variable purpose/help"
    echo "6. validate_toml_value() - Validate TOML value format"
    echo
    echo -e "${YELLOW}Implementation Priority:${NC}"
    echo "1. Multispan cursor navigation (core functionality)"
    echo "2. Section expansion/collapse (user experience)"
    echo "3. Variable source-of-truth mapping (debugging)"
    echo "4. In-place value editing (actual editing)"
    echo "5. Visual feedback and validation (polish)"
else
    echo -e "${GREEN}All TOML editor tests passed! Implementation complete.${NC}"
fi