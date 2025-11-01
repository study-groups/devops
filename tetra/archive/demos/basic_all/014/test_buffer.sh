#!/usr/bin/env bash

# Test buffer system without full tetra bootstrap

# Simple mocks
TUI_HEIGHT=24
TUI_WIDTH=80
HEADER_SIZE="max"

# Source only what we need
source "./bash/tui/oscillator.sh"
source "./bash/tui/line_animator.sh"
source "./bash/tui/buffer.sh"

# Mock functions
header_get_lines() { echo 7; }
center_text() { printf "%s" "$1"; }

# Initialize
osc_init
line_init
tui_buffer_init

echo "Testing buffer system..."

# Test 1: Write to buffer
tui_buffer_set_line 0 "Line 0: Header"
tui_buffer_set_line 1 "Line 1: Environment"
tui_buffer_set_line 7 "Line 7: Separator ─────○─────"
tui_buffer_set_line 8 "Line 8: Content starts here"

echo "Initial render (full):"
tui_buffer_render_full

sleep 1

# Test 2: Update only separator (differential)
echo ""
echo "Updating only separator..."
osc_set_position 75
local new_sep=$(line_animate_from_osc "$(osc_get_position)" | tr -d '\n')
tui_buffer_set_line 7 "$new_sep"

tui_buffer_render_diff
echo ""
echo "✓ Only separator line should have updated"

sleep 1

# Test 3: Animate oscillator
echo ""
echo "Animating oscillator for 3 seconds..."
osc_start

for i in {1..30}; do
    osc_tick
    local animated_sep=$(line_animate_from_osc "$(osc_get_position)" | tr -d '\n')
    tui_buffer_clear
    tui_buffer_set_line 0 "Line 0: Header"
    tui_buffer_set_line 1 "Line 1: Environment"
    tui_buffer_set_line 7 "$animated_sep"
    tui_buffer_set_line 8 "Line 8: Content (frame $i)"

    tui_buffer_render_diff
    sleep 0.1
done

osc_stop

echo ""
echo "✓ Test complete!"
