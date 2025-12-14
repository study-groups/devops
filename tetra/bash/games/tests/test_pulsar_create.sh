#!/usr/bin/env bash

# Auto-detect TETRA_SRC if not set (relative to this script)
: "${TETRA_SRC:=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
export TETRA_SRC

source "$TETRA_SRC/bash/game/game.sh"

echo "=== Test direct entity create ==="
game_entity_create "test" test_id
echo "Created ID: $test_id"
echo "Entity count: $(game_entity_count)"

echo ""
echo "=== Test pulsar create ==="
pulsar_create 25 15 "\033[96m" 2000 pulsar_id
echo "Pulsar ID: $pulsar_id"
echo "Entity count: $(game_entity_count)"
echo "Pulsar X: $(game_entity_get "$pulsar_id" x)"
echo "Pulsar Y: $(game_entity_get "$pulsar_id" y)"
