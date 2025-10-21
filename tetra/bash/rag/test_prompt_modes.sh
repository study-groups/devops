#!/usr/bin/env bash
# Test script for RAG REPL prompt modes

# Set up environment
export TETRA_SRC="${TETRA_SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
export RAG_SRC="$TETRA_SRC/bash/rag"
export RAG_DIR="${RAG_DIR:-$HOME/.tetra/rag}"

echo "TETRA_SRC: $TETRA_SRC"
echo "RAG_SRC: $RAG_SRC"
echo ""

# Source dependencies
source "$TETRA_SRC/bash/color/color_core.sh"
source "$TETRA_SRC/bash/color/color_palettes.sh"
source "$TETRA_SRC/bash/color/color_elements.sh"
COLOR_ENABLED=1

source "$RAG_SRC/core/flow_manager.sh"
source "$RAG_SRC/core/stats_manager.sh"
source "$RAG_SRC/core/prompt_manager.sh"

echo "Testing Prompt Mode System"
echo "=========================="
echo ""

# Test 1: Minimal prompt (no flow)
echo "Test 1: Minimal Prompt (no active flow)"
echo "----------------------------------------"
export RAG_PROMPT_MODE="minimal"
prompt=$(build_minimal_prompt)
echo -n "Prompt: "
echo -e "$prompt"
echo ""

# Test 2: Normal prompt (no flow)
echo "Test 2: Normal Prompt (no active flow)"
echo "---------------------------------------"
export RAG_PROMPT_MODE="normal"
prompt=$(build_normal_prompt)
echo -n "Prompt: "
echo -e "$prompt"
echo ""

# Test 3: Create test flow
echo "Test 3: Creating test flow"
echo "--------------------------"
mkdir -p "$RAG_DIR/flows"
test_flow_id="test-flow-$(date +%Y%m%dT%H%M%S)"
test_flow_dir="$RAG_DIR/flows/$test_flow_id"
mkdir -p "$test_flow_dir/ctx/evidence"

# Create state.json
cat > "$test_flow_dir/state.json" <<EOF
{
  "flow_id": "$test_flow_id",
  "description": "Test flow for prompt modes",
  "stage": "SELECT",
  "iteration": 1,
  "agent": "base",
  "prompt_mode": "normal",
  "last_checkpoint": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
}
EOF

# Set as active
ln -sf "$test_flow_dir" "$RAG_DIR/flows/active"
echo "Created: $test_flow_id"
echo ""

# Test 4: Normal prompt with flow
echo "Test 4: Normal Prompt (with active flow)"
echo "-----------------------------------------"
export RAG_PROMPT_MODE="normal"
prompt=$(build_normal_prompt)
echo -n "Prompt: "
echo -e "$prompt"
echo ""

# Test 5: Add some test evidence
echo "Test 5: Adding test evidence"
echo "-----------------------------"
for i in {1..5}; do
    echo "Test evidence file $i" > "$test_flow_dir/ctx/evidence/${i}00_test_${i}.evidence.md"
done

# Add a pinned file
cat > "$test_flow_dir/ctx/evidence/000_policy.evidence.md" <<EOF
## Policy
<!-- pinned=true -->

Test policy content
EOF

# Add a selection file
cat > "$test_flow_dir/ctx/evidence/110_selection.evidence.md" <<EOF
## Selection
<!-- source_uri=file://test.sh; span=lines=100:200 -->

Test selection content
EOF

echo "Added 7 evidence files (5 regular, 1 pinned, 1 selection)"
echo ""

# Test 6: TwoLine prompt with stats
echo "Test 6: TwoLine Prompt (with stats)"
echo "------------------------------------"
export RAG_PROMPT_MODE="twoline"
prompt=$(build_twoline_prompt)
echo -e "$prompt"
echo ""

# Test 7: Stats breakdown
echo "Test 7: Stats Breakdown"
echo "-----------------------"
stats=$(get_context_stats "$test_flow_dir")
read pinned evidence selections external total_files total_lines total_chars <<< "$stats"
echo "Pinned: $pinned"
echo "Evidence: $evidence"
echo "Selections: $selections"
echo "External: $external"
echo "Total files: $total_files"
echo "Total lines: $total_lines"
echo "Total chars: $total_chars"
echo ""

# Test 8: Brightness levels
echo "Test 8: Brightness Levels"
echo "-------------------------"
for count in 0 1 3 7 15 25 55; do
    echo -n "Count $count: "
    echo -n "$(get_symbol_brightness "7AA2F7" $count)■$(reset_color) "
    echo "(brightness level based on count)"
done
echo ""

# Test 9: Superscript numbers
echo "Test 9: Superscript Numbers"
echo "---------------------------"
for num in 0 1 5 10 25 99; do
    super=$(to_superscript $num)
    echo "Number $num → $super"
done
echo ""

# Test 10: Toggle modes
echo "Test 10: Mode Toggle"
echo "--------------------"
echo "Current mode: $(get_prompt_mode)"
set_prompt_mode "minimal" "flow"
echo "After set to minimal: $(get_prompt_mode)"
toggle_prompt_mode
echo "After toggle: $(get_prompt_mode)"
toggle_prompt_mode
echo "After toggle: $(get_prompt_mode)"
toggle_prompt_mode
echo "After toggle: $(get_prompt_mode)"
echo ""

# Test 11: All three prompts side by side
echo "Test 11: All Three Prompt Modes"
echo "================================"
echo ""
echo "MINIMAL:"
set_prompt_mode "minimal" "flow" >/dev/null
prompt=$(build_prompt)
echo -e "$prompt"
echo ""

echo "NORMAL:"
set_prompt_mode "normal" "flow" >/dev/null
prompt=$(build_prompt)
echo -e "$prompt"
echo ""

echo "TWOLINE:"
set_prompt_mode "twoline" "flow" >/dev/null
prompt=$(build_prompt)
echo -e "$prompt"
echo ""

# Cleanup
echo "Test Complete!"
echo ""
echo "To clean up test flow:"
echo "  rm -rf $test_flow_dir"
echo "  rm $RAG_DIR/flows/active"
