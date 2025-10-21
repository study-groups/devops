#!/usr/bin/env bash
# Test script for Tetra REPL

set -e

# Source tetra
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/tetra.sh"

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║              TETRA REPL - MANUAL TEST GUIDE                   ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "This will launch the interactive REPL. Test these features:"
echo ""
echo "1. LINE EDITING (via readline):"
echo "   - Type some text"
echo "   - Press Ctrl-A to jump to beginning"
echo "   - Press Ctrl-E to jump to end"
echo "   - Press Ctrl-W to delete word"
echo "   - Press Ctrl-U to clear line"
echo "   - Use Arrow keys to navigate history"
echo "   - Use Backspace to delete"
echo ""
echo "2. SLASH COMMANDS:"
echo "   - /help"
echo "   - /status"
echo "   - /env Dev"
echo "   - /mode rag"
echo "   - /context"
echo "   - /history"
echo "   - /clear"
echo ""
echo "3. ACTION DISPATCH:"
echo "   - list modules"
echo "   - list actions"
echo "   - rag list agents"
echo ""
echo "4. EXIT:"
echo "   - /exit (or Ctrl-D on empty line)"
echo ""
echo "5. ENHANCED MODE (optional):"
echo "   - Exit and run: tetra repl --rlwrap"
echo "   - Or: rlwrap tetra repl"
echo ""
echo "Press Enter to launch REPL..."
read

# Launch REPL
tetra repl
