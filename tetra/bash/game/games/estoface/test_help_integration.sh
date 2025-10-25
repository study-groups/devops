#!/usr/bin/env bash
# test_help_integration.sh - Test help integration in existing estoface REPL

source ~/tetra/tetra.sh
source "$TETRA_SRC/bash/game/games/estoface/core/estoface_repl.sh"

echo "=== Estoface Help Integration Test ==="
echo ""
echo "Testing help via :: command mode"
echo ""

# Test help function directly
echo "--- help ---"
estoface_repl_show_help estoface

echo "--- help gamepad ---"
estoface_repl_show_help gamepad

echo "--- help model.facs ---"
estoface_repl_show_help model.facs

echo ""
echo "=== Tab Completion ==="
echo "Completions for 'help gamepad':"
tree_complete "help.estoface.gamepad"

echo ""
echo "=== Architecture ==="
echo "estoface uses:"
echo "  • C binary: bin/estoface (TUI)"
echo "  • core/estoface_repl.sh (:: command wrapper)"
echo "  • estoface_help.sh (30+ help nodes)"
echo "  • bash/tree (help + tab completion)"
echo ""
echo "Access help via:"
echo "  :: help [topic]"
echo "  :: help gamepad"
echo "  :: help model.facs"
echo "  Press TAB for completion"
