#!/usr/bin/env bash

# Test the new game launcher REPL

source ~/tetra/tetra.sh

# Source game module
GAME_SRC="$TETRA_SRC/bash/game"
export GAME_SRC

# Test loading
echo "Testing game module loading..."
source "$GAME_SRC/game.sh"

echo ""
echo "Testing game list function..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
game_list

echo ""
echo "Testing game status (no active game)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
game_status

echo ""
echo "Testing prompt builder..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Prompt with no active game:"
_game_repl_build_prompt
echo -e "$REPL_PROMPT"

echo ""
echo "Prompt with active game (simulated):"
GAME_ACTIVE="pulsar"
_game_repl_build_prompt
echo -e "$REPL_PROMPT"
GAME_ACTIVE=""

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✓ Game launcher components loaded successfully"
echo ""
echo "To launch the interactive REPL, run:"
echo "  game repl"
echo ""
