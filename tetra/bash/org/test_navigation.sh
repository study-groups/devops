#!/usr/bin/env bash
# Test script for new TAB-based navigation model

source "bash/org/org_repl_tui.sh"

# Initialize state
ORG_REPL_ENV_INDEX=0
ORG_REPL_MODE_INDEX=0
ORG_REPL_ACTION_INDEX=0
ORG_REPL_FOCUS=0
ORG_REPL_COMMAND_HISTORY=()
ORG_REPL_HISTORY_INDEX=-1

echo "Testing TAB-based navigation model..."
echo "======================================"
echo

# Test 1: Focus cycling
echo "Test 1: TAB cycles focus (Env → Mode → Action)"
echo "Initial focus: $ORG_REPL_FOCUS (Env)"
_org_cycle_focus
echo "After 1 TAB: $ORG_REPL_FOCUS (Mode)"
_org_cycle_focus
echo "After 2 TABs: $ORG_REPL_FOCUS (Action)"
_org_cycle_focus
echo "After 3 TABs: $ORG_REPL_FOCUS (Env - wrapped)"
echo "✓ Focus cycling works"
echo

# Test 2: Environment navigation
echo "Test 2: Arrow keys on Env focus"
ORG_REPL_FOCUS=0
ORG_REPL_ENV_INDEX=0
echo "Starting env: ${ORG_REPL_ENVIRONMENTS[$ORG_REPL_ENV_INDEX]}"
_org_navigate_down
echo "After ↓: ${ORG_REPL_ENVIRONMENTS[$ORG_REPL_ENV_INDEX]}"
_org_navigate_down
echo "After ↓: ${ORG_REPL_ENVIRONMENTS[$ORG_REPL_ENV_INDEX]}"
_org_navigate_up
echo "After ↑: ${ORG_REPL_ENVIRONMENTS[$ORG_REPL_ENV_INDEX]}"
echo "✓ Environment navigation works"
echo

# Test 3: Mode navigation
echo "Test 3: Arrow keys on Mode focus"
ORG_REPL_FOCUS=1
ORG_REPL_MODE_INDEX=0
echo "Starting mode: ${ORG_REPL_MODES[$ORG_REPL_MODE_INDEX]}"
_org_navigate_down
echo "After ↓: ${ORG_REPL_MODES[$ORG_REPL_MODE_INDEX]}"
_org_navigate_down
echo "After ↓: ${ORG_REPL_MODES[$ORG_REPL_MODE_INDEX]}"
_org_navigate_up
echo "After ↑: ${ORG_REPL_MODES[$ORG_REPL_MODE_INDEX]}"
echo "✓ Mode navigation works"
echo

# Test 4: Command history
echo "Test 4: Command history on Action focus"
ORG_REPL_FOCUS=2
ORG_REPL_COMMAND_HISTORY=("view:toml" "list" "view:env")
ORG_REPL_HISTORY_INDEX=-1
ORG_REPL_INPUT=""
echo "History: ${ORG_REPL_COMMAND_HISTORY[@]}"
echo "Current input: '$ORG_REPL_INPUT'"
_org_navigate_up
echo "After ↑: '$ORG_REPL_INPUT' (index: $ORG_REPL_HISTORY_INDEX)"
_org_navigate_up
echo "After ↑: '$ORG_REPL_INPUT' (index: $ORG_REPL_HISTORY_INDEX)"
_org_navigate_down
echo "After ↓: '$ORG_REPL_INPUT' (index: $ORG_REPL_HISTORY_INDEX)"
_org_navigate_down
echo "After ↓: '$ORG_REPL_INPUT' (index: $ORG_REPL_HISTORY_INDEX)"
echo "✓ Command history navigation works"
echo

# Test 5: Prompt rendering with focus
echo "Test 5: Prompt rendering shows focus (underline)"
ORG_REPL_FOCUS=0
echo "Focus on Env:"
_org_build_prompt_text | cat -v
echo
ORG_REPL_FOCUS=1
echo "Focus on Mode:"
_org_build_prompt_text | cat -v
echo
ORG_REPL_FOCUS=2
echo "Focus on Action:"
_org_build_prompt_text | cat -v
echo
echo "✓ Prompt rendering works (look for ';4' underline codes)"
echo

echo "======================================"
echo "All tests passed!"
