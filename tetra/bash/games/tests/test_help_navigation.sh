#!/usr/bin/env bash

# Demonstrate the narrow and deep help tree navigation

source ~/tetra/tetra.sh
TDS_SRC="$TETRA_SRC/bash/tds"
source "$TDS_SRC/tds.sh"
GAME_SRC="$TETRA_SRC/bash/game"
export GAME_SRC
source "$GAME_SRC/core/pulsar_help.sh"

PULSAR_REPL_GRID_W=160
PULSAR_REPL_GRID_H=96

echo ""
echo "╔════════════════════════════════════════════════════════════════════╗"
echo "║  PULSAR REPL HELP SYSTEM - Narrow and Deep Navigation Demo        ║"
echo "╚════════════════════════════════════════════════════════════════════╝"
echo ""

echo "NARROW TOP LEVEL (6 topics instead of 50+ items):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
pulsar_help | grep -A 10 "Help Topics"
echo ""

echo "DEEP DIVE: help engine → Focused engine-only commands"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
pulsar_help engine | head -20
echo ""

echo "DEEP DIVE: help sprite → All sprite management in one place"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
pulsar_help sprite | head -20
echo ""

echo "DEEP DIVE: help params → Comprehensive parameter reference"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
pulsar_help params | head -25
echo ""

echo "CROSS-REFERENCES: Topics link to related help pages"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
pulsar_help engine | tail -3
pulsar_help sprite | tail -3
pulsar_help script | tail -3
echo ""

echo "╔════════════════════════════════════════════════════════════════════╗"
echo "║  KEY FEATURES                                                      ║"
echo "╠════════════════════════════════════════════════════════════════════╣"
echo "║  ✓ Narrow: 6 top-level topics (not 20+ flat commands)             ║"
echo "║  ✓ Deep: Each topic has comprehensive focused help                ║"
echo "║  ✓ Progressive: Quick actions up front, details on demand         ║"
echo "║  ✓ Colored: TDS integration with dim/bright hierarchy             ║"
echo "║  ✓ Cross-referenced: Topics link to related help pages            ║"
echo "╚════════════════════════════════════════════════════════════════════╝"
echo ""
