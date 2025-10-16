#!/usr/bin/env bash
# Test: Universal Command Starter (tsm_start_any_command)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TSM_DIR="$(dirname "$SCRIPT_DIR")"

export TETRA_SRC="$(dirname "$(dirname "$TSM_DIR")")"
export TETRA_DIR="/tmp/tsm-test-$$"
export TSM_PROCESSES_DIR="$TETRA_DIR/tsm/runtime/processes"
export TSM_PORTS_DIR="$TETRA_DIR/tsm/runtime/ports"

source "$TSM_DIR/core/start.sh"
source "$TSM_DIR/core/runtime.sh"
source "$TSM_DIR/core/metadata.sh"
source "$TSM_DIR/core/utils.sh"
source "$TSM_DIR/system/ports.sh"

TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

test() {
    TESTS_RUN=$((TESTS_RUN + 1))
    echo -n "  [$TESTS_RUN] $1 ... "
}

pass() {
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo "✓"
}

fail() {
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo "✗ - $1"
}

cleanup() {
    # Kill all test processes
    for process_dir in "$TSM_PROCESSES_DIR"/*/; do
        [[ -d "$process_dir" ]] || continue
        local meta_file="${process_dir}meta.json"
        if [[ -f "$meta_file" ]]; then
            local pid=$(jq -r '.pid // empty' "$meta_file" 2>/dev/null)
            [[ -n "$pid" ]] && kill -9 "$pid" 2>/dev/null || true
        fi
    done
    rm -rf "$TETRA_DIR"
}

trap cleanup EXIT
mkdir -p "$TSM_PROCESSES_DIR" "$TSM_PORTS_DIR"

echo "Testing: Universal Command Starter"
echo "==================================="

# Test 1: Discover port from command
test "Discover port from command (node app.js 3000)"
port=$(tsm_discover_port "node app.js 3000" "" "")
if [[ "$port" == "3000" ]]; then
    pass
else
    fail "Expected 3000, got $port"
fi

# Test 2: Discover port with colon syntax
test "Discover port with colon (python -m http.server :8080)"
port=$(tsm_discover_port "python -m http.server :8080" "" "")
if [[ "$port" == "8080" ]]; then
    pass
else
    fail "Expected 8080, got $port"
fi

# Test 3: Discover port with --port flag
test "Discover port with --port flag"
port=$(tsm_discover_port "app --port 4000" "" "")
if [[ "$port" == "4000" ]]; then
    pass
else
    fail "Expected 4000, got $port"
fi

# Test 4: Explicit port overrides
test "Explicit port overrides discovery"
port=$(tsm_discover_port "node app.js 3000" "" "9999")
if [[ "$port" == "9999" ]]; then
    pass
else
    fail "Explicit port not used"
fi

# Test 5: Generate process name from command
test "Generate process name (node server.js → server)"
name=$(tsm_generate_process_name "node server.js" "3000" "" "")
if [[ "$name" == "server-3000" ]]; then
    pass
else
    fail "Expected 'server-3000', got '$name'"
fi

# Test 6: Generate name from module
test "Generate name from Python module (python -m http → http)"
name=$(tsm_generate_process_name "python -m http.server 8000" "8000" "" "")
if [[ "$name" == "http-8000" ]]; then
    pass
else
    fail "Expected 'http-8000', got '$name'"
fi

# Test 7: Detect process type
test "Detect process type (node)"
type=$(tsm_detect_type "node app.js")
if [[ "$type" == "node" ]]; then
    pass
else
    fail "Expected 'node', got '$type'"
fi

# Test 8: Detect process type (python)
test "Detect process type (python)"
type=$(tsm_detect_type "python3 script.py")
if [[ "$type" == "python" ]]; then
    pass
else
    fail "Expected 'python', got '$type'"
fi

# Test 9: Resolve interpreter
test "Resolve interpreter (bash)"
interpreter=$(tsm_resolve_interpreter "bash")
if [[ "$interpreter" == *"bash" ]]; then
    pass
else
    fail "Bash interpreter not found"
fi

# Test 10: Start actual process
test "Start a real sleep process"
if tsm_start_any_command "sleep 30" "" "none" "test-sleeper"; then
    sleep 1
    if tsm_process_exists "test-sleeper-"*; then
        pass
    else
        fail "Process not created"
    fi
else
    fail "Start command failed"
fi

echo ""
echo "Results: $TESTS_PASSED/$TESTS_RUN passed, $TESTS_FAILED failed"
[[ $TESTS_FAILED -eq 0 ]]
