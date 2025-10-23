#!/usr/bin/env bash

# Test that TDS panel_header handles emoji correctly

source ~/tetra/tetra.sh
TDS_SRC="$TETRA_SRC/bash/tds"
source "$TDS_SRC/tds.sh"

echo ""
echo "Testing TDS panel_header with emoji (should be aligned):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Use TDS panel_header (+1 for emoji width)
tds_panel_header "⚡ GAME REPL v1.0" 51

echo ""
tds_panel_header "🔊 ESTOVOX REPL v0.1 (Skeleton)" 51

echo ""
tds_panel_header "⚡ PULSAR REPL v1.0" 46

echo ""
echo "✓ All borders should be perfectly aligned now!"
echo ""
