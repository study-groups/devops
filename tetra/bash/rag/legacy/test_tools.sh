#!/usr/bin/env bash
# Test script to debug tools.sh loading

echo "=== Testing RAG Tools Loading ==="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "SCRIPT_DIR: $SCRIPT_DIR"

# Set up environment
export RAG_TOOLS_DIR="$SCRIPT_DIR"
export RAG_DIR="$HOME/.rag"
mkdir -p "$RAG_DIR"

echo "=== Loading rag_*.sh files individually ==="

for f in "$SCRIPT_DIR"/rag_*.sh; do
  if [[ -f "$f" ]]; then
    echo "Loading: $(basename "$f")"
    if source "$f"; then
      echo "  ✓ Success"
    else
      echo "  ✗ Failed"
    fi
  fi
done

echo ""
echo "=== Function Check ==="
echo "rag_repl function: $(declare -F | grep rag_repl | wc -l) found"
echo "rag_cursor functions: $(declare -F | grep rag_cursor | wc -l) found"
echo "rag_mcursor functions: $(declare -F | grep rag_mcursor | wc -l) found"

echo ""
echo "=== Testing rag_repl ==="
if declare -F rag_repl >/dev/null; then
    echo "✓ rag_repl function is available"
else
    echo "✗ rag_repl function not found"
fi