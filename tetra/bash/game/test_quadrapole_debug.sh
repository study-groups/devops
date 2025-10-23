#!/usr/bin/env bash

# Debug test for quadrapole

export TETRA_SRC="/Users/mricos/src/devops/tetra"
source "$TETRA_SRC/bash/game/game.sh"

echo "=== Before init ==="
echo "Entity count: $(game_entity_count)"

echo ""
echo "=== Calling quadrapole_init ==="
quadrapole_init

echo ""
echo "=== After init ==="
echo "Entity count: $(game_entity_count)"
echo "Entities: ${GAME_ENTITIES[@]}"

if [[ ${#GAME_ENTITIES[@]} -gt 0 ]]; then
    for eid in "${GAME_ENTITIES[@]}"; do
        echo "Entity $eid:"
        echo "  Type: $(game_entity_get "$eid" type)"
        echo "  X: $(game_entity_get "$eid" x)"
        echo "  Y: $(game_entity_get "$eid" y)"
    done
else
    echo "NO ENTITIES CREATED!"
fi
