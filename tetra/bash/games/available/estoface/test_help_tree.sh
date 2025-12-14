#!/usr/bin/env bash
# test_help_tree.sh - Test estoface help tree navigation

# Source tetra environment
source ~/tetra/tetra.sh

# Source TDS-bordered help
source "$TETRA_SRC/bash/game/games/estoface/estoface_help_tds.sh"

echo "Estoface Help Tree Test (TDS Bordered)"
echo "======================================="
echo ""
echo "Usage:"
echo "  estoface_help_tds                - Main help"
echo "  estoface_help_tds gamepad        - Gamepad control"
echo "  estoface_help_tds gamepad.mapping - Controller mapping"
echo "  estoface_help_tds model.facs     - FACS action units"
echo ""

# Example: Show main help with TDS borders
estoface_help_tds

echo ""
echo "=== Gamepad Mapping (bordered) ==="
estoface_help_tds gamepad.mapping

echo ""
echo "=== Non-bordered navigation ==="
echo "For interactive navigation:"
echo "  tree_help_navigate help.estoface"
echo ""
echo "For plain text:"
echo "  tree_help_show help.estoface.model.phonemes"
