#!/usr/bin/env bash
# Test defensive checks in org REPL

source "bash/org/org_repl_tui.sh"

echo "Testing Defensive Checks..."
echo "======================================"
echo

# Test 1: Initialization with valid constants
echo "Test 1: Normal initialization with valid constants"
if _org_repl_init_state 2>&1; then
    echo "✓ Init succeeded with ${#ORG_REPL_ENVIRONMENTS[@]} environments"
else
    echo "✗ Init failed unexpectedly"
fi
echo

# Test 2: Prompt building with valid state
echo "Test 2: Prompt building with initialized state"
prompt=$(_org_build_prompt_text)
if [[ -n "$prompt" ]]; then
    echo "✓ Prompt built successfully"
else
    echo "✗ Prompt building failed"
fi
echo

# Test 3: Navigation with valid state
echo "Test 3: Navigation with initialized state"
if _org_cycle_env 2>&1 >/dev/null; then
    echo "✓ Cycle env succeeded (now at: ${ORG_REPL_ENVIRONMENTS[$ORG_REPL_ENV_INDEX]})"
else
    echo "✗ Cycle env failed"
fi
echo

# Test 4: Input length limit
echo "Test 4: Input length validation"
ORG_REPL_INPUT=$(printf 'a%.0s' {1..1001})  # 1001 chars
ORG_REPL_CURSOR_POS=${#ORG_REPL_INPUT}
if ! _org_handle_char "x" 2>&1 | grep -q "Input limit"; then
    echo "✗ Should have hit input limit"
else
    echo "✓ Input limit enforced"
fi
echo

# Test 5: Simulate empty arrays (edge case)
echo "Test 5: Handling empty arrays gracefully"
saved_envs=("${ORG_REPL_ENVIRONMENTS[@]}")
ORG_REPL_ENVIRONMENTS=()
prompt=$(_org_build_prompt_text 2>/dev/null)
if [[ "$prompt" =~ UNKNOWN ]]; then
    echo "✓ Handles empty arrays gracefully (shows UNKNOWN)"
else
    echo "✗ Failed to handle empty arrays"
fi
ORG_REPL_ENVIRONMENTS=("${saved_envs[@]}")
echo

# Test 6: Division by zero prevention
echo "Test 6: Division by zero prevention"
saved_envs=("${ORG_REPL_ENVIRONMENTS[@]}")
ORG_REPL_ENVIRONMENTS=()
if _org_cycle_env 2>&1 | grep -q "No environments"; then
    echo "✓ Prevented division by zero with helpful error"
else
    echo "✗ Failed to prevent division by zero"
fi
ORG_REPL_ENVIRONMENTS=("${saved_envs[@]}")
echo

# Test 7: Array bounds checking
echo "Test 7: Array bounds checking in prompt"
ORG_REPL_ENV_INDEX=999  # Way out of bounds
prompt=$(_org_build_prompt_text 2>/dev/null)
if [[ "$prompt" =~ UNKNOWN ]]; then
    echo "✓ Handles out-of-bounds index safely"
else
    echo "✗ Failed to handle out-of-bounds index"
fi
ORG_REPL_ENV_INDEX=0  # Reset
echo

echo "======================================"
echo "Defensive checks test complete!"
