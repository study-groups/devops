#!/usr/bin/env bash
# Test GlyphGrid integration - Basic functionality

set -euo pipefail

# Bootstrap tetra
source ~/tetra/tetra.sh

# Load game module
tmod load game

echo "=== GlyphGrid Basic Integration Test ==="
echo ""

# Check if GlyphGrid is available
if [[ "$GAME_GLYPHGRID_AVAILABLE" != "true" ]]; then
    echo "ERROR: GlyphGrid not available"
    exit 1
fi

echo "✓ GlyphGrid module loaded"

# Test 1: Start/stop engine
echo ""
echo "Test 1: Start/stop GlyphGrid engine"
glyphgrid_start 80 24
if glyphgrid_running; then
    echo "✓ GlyphGrid started successfully (PID $GLYPHGRID_PID)"
else
    echo "✗ Failed to start GlyphGrid"
    exit 1
fi

glyphgrid_stop
if ! glyphgrid_running; then
    echo "✓ GlyphGrid stopped successfully"
else
    echo "✗ Failed to stop GlyphGrid"
    exit 1
fi

# Test 2: Coordinate conversion
echo ""
echo "Test 2: Coordinate conversion"
coords=$(glyphgrid_cell_to_micro 10 5)
mx=${coords%% *}
my=${coords##* }
echo "  Cell (10, 5) → Micro ($mx, $my)"
[[ "$mx" == "20" && "$my" == "20" ]] && echo "✓ Coordinate conversion correct" || {
    echo "✗ Expected (20, 20), got ($mx, $my)"
    exit 1
}

# Test 3: Valence mapping
echo ""
echo "Test 3: Valence mapping"
val=$(glyphgrid_valence_to_int "accent")
[[ "$val" == "5" ]] && echo "✓ Valence 'accent' → 5" || {
    echo "✗ Expected 5, got $val"
    exit 1
}

# Test 4: Spawn and kill sprite
echo ""
echo "Test 4: Spawn and kill Pulsar8 sprite"
glyphgrid_start 80 24

glyph_id=$(glyphgrid_spawn_pulsar 80 48 18 6 0.6 0.9 5)
if [[ -n "$glyph_id" && "$glyph_id" =~ ^[0-9]+$ ]]; then
    echo "✓ Spawned Pulsar8 (ID $glyph_id)"
else
    echo "✗ Failed to spawn Pulsar8"
    glyphgrid_stop
    exit 1
fi

glyphgrid_kill "$glyph_id"
echo "✓ Killed Pulsar8 (ID $glyph_id)"

glyphgrid_stop

# Test 5: Entity integration
echo ""
echo "Test 5: Entity-to-glyph mapping"
glyphgrid_start 80 24

entity_id=999
glyph_id=123
glyphgrid_entity_register "$entity_id" "$glyph_id"

mapped_id=$(glyphgrid_entity_get_id "$entity_id")
[[ "$mapped_id" == "$glyph_id" ]] && echo "✓ Entity mapping works" || {
    echo "✗ Expected $glyph_id, got $mapped_id"
    glyphgrid_stop
    exit 1
}

glyphgrid_stop

echo ""
echo "=== All tests passed! ==="
