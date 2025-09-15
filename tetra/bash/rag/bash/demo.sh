#!/usr/bin/env bash
# Demo script to show RAG tools working

# Source just the essentials without external interference
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export RAG_TOOLS_DIR="$SCRIPT_DIR"
export RAG_DIR="$HOME/.rag"
mkdir -p "$RAG_DIR"

# Load rag functions
source "$SCRIPT_DIR/rag_repl.sh"
source "$SCRIPT_DIR/rag_cursor.sh" 
source "$SCRIPT_DIR/rag_mcursor.sh"

echo "=== RAG Tools Demo ==="
echo "Functions loaded:"
echo "  rag_repl: $(declare -F rag_repl >/dev/null && echo "✓" || echo "✗")"
echo "  rag_cursor_create: $(declare -F rag_cursor_create >/dev/null && echo "✓" || echo "✗")"
echo "  rag_mcursor_create: $(declare -F rag_mcursor_create >/dev/null && echo "✓" || echo "✗")"
echo ""

echo "=== Testing rag_repl startup ==="
echo "Starting rag_repl in demo mode..."
echo ""

# Start rag_repl
rag_repl