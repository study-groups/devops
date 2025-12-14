#!/usr/bin/env bash
# Test GlyphGrid pulsar entity - Single rotating pulsar

set -euo pipefail

# Bootstrap tetra
source ~/tetra/tetra.sh

# Load game module
tmod load game

echo "=== GlyphGrid Pulsar Entity Test ==="
echo "Starting in 2 seconds... Press 'q' to quit"
sleep 2

# Initialize GlyphGrid game loop
game_loop_glyphgrid_init 60 80 24

# Init function - create pulsar entity
test_init() {
    echo "Spawning GlyphGrid pulsar..." >&2

    # Create pulsar at center
    local pulsar_id
    pulsar_glyphgrid_create 40 12 "accent" 2000 pulsar_id

    if [[ -z "$pulsar_id" ]]; then
        echo "ERROR: Failed to create pulsar" >&2
        return 1
    fi

    echo "Pulsar created (entity ID: $pulsar_id)" >&2

    # Customize pulsar
    pulsar_glyphgrid_set_rotation "$pulsar_id" 0.9  # rad/s
    pulsar_glyphgrid_set_arm_count "$pulsar_id" 8

    echo "Pulsar configured" >&2
}

# Update function - no-op for GlyphGrid (C engine handles animation)
test_update() {
    local delta=$1
    # Entity updates happen here if needed
    # For GlyphGrid pulsars, animation is handled by C engine
}

# Run the game loop
game_loop_glyphgrid_run test_init test_update

echo ""
echo "Test complete!"
