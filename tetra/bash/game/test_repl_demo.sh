#!/usr/bin/env bash
# Automated REPL demo - simulates user interaction

# Set up environment
export TETRA_SRC="${TETRA_SRC:-$HOME/src/devops/tetra}"
export TETRA_DIR="${TETRA_DIR:-$HOME/tetra}"
export GAME_SRC="$TETRA_SRC/bash/game"

mkdir -p "$TETRA_DIR/game"

# Minimal color setup
COLOR_RESET=$'\033[0m'
COLOR_BOLD=$'\033[1m'
COLOR_DIM=$'\033[2m'
COLOR_RED=$'\033[31m'
COLOR_GREEN=$'\033[32m'
COLOR_CYAN=$'\033[36m'

# Source pulsar core
source "$GAME_SRC/core/pulsar.sh"

# Source REPL functions
source "$GAME_SRC/core/pulsar_repl.sh"

echo "╔═══════════════════════════════════════╗"
echo "║   ⚡ PULSAR REPL Demo                ║"
echo "║   Automated Test Sequence            ║"
echo "╚═══════════════════════════════════════╝"
echo ""

# Test 1: Start engine
echo "Test 1: Starting engine..."
pulsar_repl_start_engine
echo ""

# Test 2: Check status
echo "Test 2: Checking status..."
pulsar_repl_status
echo ""

# Test 3: Spawn a pulsar
echo "Test 3: Spawning pulsar 'mystar'..."
pulsar_repl_spawn "mystar" 80 48 18 6 0.5 0.6 0
echo ""

# Test 4: Spawn trinity preset
echo "Test 4: Spawning trinity preset..."
pulsar_repl_preset_trinity
echo ""

# Test 5: List sprites
echo "Test 5: Listing sprites..."
for name in "${!PULSAR_REPL_SPRITE_IDS[@]}"; do
    echo "  $name → ID ${PULSAR_REPL_SPRITE_IDS[$name]}"
done
echo ""

# Test 6: Update a sprite
echo "Test 6: Updating mystar rotation..."
pulsar_repl_set "mystar" "dtheta" "1.5"
echo ""

# Test 7: Load a script
if [[ -f "$GAME_SRC/engine/scripts/hello.pql" ]]; then
    echo "Test 7: Loading hello.pql script..."
    pulsar_repl_load_script "$GAME_SRC/engine/scripts/hello.pql"
    echo ""
fi

# Test 8: Send raw command
echo "Test 8: Sending raw LIST_PULSARS..."
pulsar_repl_send_raw "LIST_PULSARS"
echo ""

# Test 9: Final status
echo "Test 9: Final status..."
pulsar_repl_status
echo ""

# Test 10: Stop engine
echo "Test 10: Stopping engine..."
pulsar_repl_stop_engine
echo ""

echo "╔═══════════════════════════════════════╗"
echo "║   ✓ Demo Complete                    ║"
echo "╚═══════════════════════════════════════╝"
