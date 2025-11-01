#!/usr/bin/env bash
# Test the new MIDI prompt format

# Setup test environment
export MIDI_SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export TETRA_SRC="$(cd "$MIDI_SRC/../.." && pwd)"
export TETRA_DIR="/tmp/test_midi_prompt"
export TMC_CONFIG_DIR="$TETRA_DIR/midi"

mkdir -p "$TMC_CONFIG_DIR"

# Source dependencies
source "$MIDI_SRC/core/state.sh"
source "$MIDI_SRC/core/repl.sh"

# Colors
TETRA_CYAN='\033[0;36m'
TETRA_YELLOW='\033[1;33m'
TETRA_GREEN='\033[0;32m'
TETRA_MAGENTA='\033[0;35m'
TETRA_DIM='\033[2m'
TETRA_NC='\033[0m'

echo "Testing MIDI Prompt Format: [controller x map][CC#][val]>"
echo "=========================================================="
echo ""

# Test 1: No controller, no CC
echo "Test 1: Initial state (no controller, no CC)"
tmc_state_init
prompt=$(midi_repl_prompt)
echo -e "Prompt: $prompt"
echo ""

# Test 2: Controller set, no map
echo "Test 2: Controller set (vmx8), no map"
tmc_state_set_controller "vmx8"
prompt=$(midi_repl_prompt)
echo -e "Prompt: $prompt"
echo ""

# Test 3: Controller and map set
echo "Test 3: Controller and map set (vmx8 x qpong)"
tmc_state_set_controller_and_map "vmx8" "qpong.cc.midi"
prompt=$(midi_repl_prompt)
echo -e "Prompt: $prompt"
echo ""

# Test 4: With CC value
echo "Test 4: First CC value (CC7 = 64)"
tmc_state_set_last_cc "1" "7" "64"
prompt=$(midi_repl_prompt)
echo -e "Prompt: $prompt"
echo ""

# Test 5: Different CC value
echo "Test 5: Different CC value (CC21 = 127)"
tmc_state_set_last_cc "1" "21" "127"
prompt=$(midi_repl_prompt)
echo -e "Prompt: $prompt"
echo ""

# Test 6: Another controller
echo "Test 6: Different controller (akai x drums)"
tmc_state_set_controller_and_map "akai" "drums"
tmc_state_set_last_cc "1" "10" "50"
prompt=$(midi_repl_prompt)
echo -e "Prompt: $prompt"
echo ""

# Test 7: Zero value
echo "Test 7: CC value at 0 (CC7 = 0)"
tmc_state_set_last_cc "1" "7" "0"
prompt=$(midi_repl_prompt)
echo -e "Prompt: $prompt"
echo ""

# Test 8: Max value
echo "Test 8: CC value at max (CC127 = 127)"
tmc_state_set_last_cc "1" "127" "127"
prompt=$(midi_repl_prompt)
echo -e "Prompt: $prompt"
echo ""

echo "=========================================================="
echo "Prompt format examples:"
echo ""
echo -e "Initial:       ${TETRA_DIM}[no map]${TETRA_NC}${TETRA_DIM}[--]${TETRA_NC}${TETRA_DIM}[--]${TETRA_NC}${TETRA_MAGENTA}>${TETRA_NC}"
echo -e "With map:      ${TETRA_CYAN}[vmx8 ${TETRA_DIM}x${TETRA_NC} ${TETRA_CYAN}qpong]${TETRA_NC}${TETRA_DIM}[--]${TETRA_NC}${TETRA_DIM}[--]${TETRA_NC}${TETRA_MAGENTA}>${TETRA_NC}"
echo -e "With CC:       ${TETRA_CYAN}[vmx8 ${TETRA_DIM}x${TETRA_NC} ${TETRA_CYAN}qpong]${TETRA_NC}${TETRA_YELLOW}[CC7]${TETRA_NC}${TETRA_GREEN}[64]${TETRA_NC}${TETRA_MAGENTA}>${TETRA_NC}"
echo -e "Active:        ${TETRA_CYAN}[akai ${TETRA_DIM}x${TETRA_NC} ${TETRA_CYAN}drums]${TETRA_NC}${TETRA_YELLOW}[CC21]${TETRA_NC}${TETRA_GREEN}[127]${TETRA_NC}${TETRA_MAGENTA}>${TETRA_NC}"
echo ""

# Cleanup
rm -rf "$TETRA_DIR"

echo "Test complete!"
