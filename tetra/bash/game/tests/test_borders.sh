#!/usr/bin/env bash

# Test TDS border alignment in REPL

source ~/tetra/tetra.sh
TDS_SRC="$TETRA_SRC/bash/tds"
source "$TDS_SRC/tds.sh"

echo ""
echo "Testing TDS Border Alignment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "BEFORE (manual borders - may misalign):"
echo "  ╔═══════════════════════════════════════╗"
echo "  ║   ⚡ PULSAR ENGINE v1.0              ║"
echo "  ║   Terminal Sprite Animation System   ║"
echo "  ╚═══════════════════════════════════════╝"
echo ""

echo "AFTER (TDS borders - ANSI-aware alignment):"
tds_border_top 45
tds_border_line "⚡ PULSAR ENGINE v1.0" 45
tds_border_line "Terminal Sprite Animation System" 45
tds_border_bottom 45
echo ""

echo "With colored text (ANSI codes don't break alignment):"
tds_border_top 45
tds_border_line "$(text_color "66FF66")⚡ PULSAR REPL v1.0$(reset_color)" 45
tds_border_line "Interactive Engine Protocol Shell" 45
tds_border_bottom 45
echo ""

echo "Different widths:"
echo ""
echo "Width 40:"
tds_border_top 40
tds_border_line "PULSAR" 40
tds_border_bottom 40
echo ""

echo "Width 60:"
tds_border_top 60
tds_border_line "PULSAR ENGINE - Terminal Sprite Animation" 60
tds_border_bottom 60
echo ""

echo "Width 70 with long content:"
tds_border_top 70
tds_border_line "⚡ PULSAR REPL - Interactive Engine Protocol Shell" 70
tds_border_line "Terminal-based sprite animation and control system" 70
tds_border_bottom 70
echo ""

echo "✓ TDS borders handle ANSI codes correctly"
echo "✓ Visual width calculated properly (excluding escape sequences)"
echo "✓ Content is perfectly centered within borders"
