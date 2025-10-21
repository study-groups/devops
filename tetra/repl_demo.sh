#!/usr/bin/env bash
# Quick REPL demo

cd /Users/mricos/src/devops/tetra
source bash/tetra/tetra.sh

echo "Starting Tetra REPL..."
echo "Try these:"
echo "  - Type something, use Ctrl-A (home), Ctrl-E (end)"
echo "  - Type @ to trigger fuzzy finder (needs fzf)"
echo "  - Type file.sh:: to trigger endpoint selector"
echo "  - /help, /status, /env, /mode commands"
echo "  - list modules, list actions"
echo "  - Ctrl-D or /exit to quit"
echo ""

tetra repl
