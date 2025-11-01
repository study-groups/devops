#!/usr/bin/env bash
# Test TDS token resolution in a fresh bash subprocess

export TETRA_SRC=/Users/mricos/src/devops/tetra
export TETRA_DIR=$HOME/tetra

echo "Testing TDS token system in fresh bash..."
echo ""

# Source TDS in a completely fresh bash
bash --noprofile --norc << 'INNEREOF'
export TETRA_SRC=/Users/mricos/src/devops/tetra
export TETRA_DIR=$HOME/tetra

source "$TETRA_SRC/bash/tds/tds.sh" 2>&1

echo "1. Testing token resolution:"
result=$(tds_resolve_color "repl.prompt.bracket")
echo "   repl.prompt.bracket → $result"

if [[ "$result" =~ ^[0-9A-F]+$ ]]; then
    echo "   ✓ Resolution works"
else
    echo "   ✗ Resolution failed"
    exit 1
fi

echo ""
echo "2. Testing prompt builder:"
tds_repl_build_prompt 'test-org' 'Production' 3 'Execute' 2 'deploy:config' 2>&1
echo ""

echo "3. Testing feedback:"
tds_repl_feedback_env 'Production' 2>&1
echo ""

echo ""
echo "✓ All tests passed in fresh bash!"
INNEREOF
