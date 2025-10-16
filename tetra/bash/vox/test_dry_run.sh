#!/usr/bin/env bash

# test_dry_run.sh - Test the dry-run feature
# Demonstrates various dry-run analysis capabilities

# Setup paths
export TETRA_SRC="${TETRA_SRC:-$HOME/src/devops/tetra}"
export TETRA_DIR="${TETRA_DIR:-$HOME/.tetra}"
export VOX_SRC="$TETRA_SRC/bash/vox"
export VOX_DIR="$TETRA_DIR/vox"
export QA_DIR="$TETRA_DIR/qa"

# Source vox
source "$VOX_SRC/vox.sh"

echo "======================================"
echo "Vox Dry-Run Test Suite"
echo "======================================"
echo ""

# Test 1: Show help
echo "Test 1: Dry-run help"
echo "--------------------"
vox dry-run help
echo ""
echo ""

# Test 2: Analyze stdin
echo "Test 2: Analyze stdin (short text)"
echo "-----------------------------------"
echo "Hello world! This is a short test message." | vox dry-run stdin alloy
echo ""
echo ""

# Test 3: Analyze stdin (long text)
echo "Test 3: Analyze stdin (longer text)"
echo "------------------------------------"
cat <<'EOF' | vox dry-run stdin sally
Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis
nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore
eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt
in culpa qui officia deserunt mollit anim id est laborum.

Section 1.10.32 of "de Finibus Bonorum et Malorum", written by Cicero in 45 BC
"Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium."
EOF
echo ""
echo ""

# Test 4: Analyze QA reference (if QA_DIR exists)
if [[ -d "$QA_DIR/db" ]] && [[ -n "$(ls -A "$QA_DIR/db"/*.answer 2>/dev/null)" ]]; then
    echo "Test 4: Analyze QA reference"
    echo "-----------------------------"
    vox dry-run qa qa:0 nova
    echo ""
    echo ""

    echo "Test 5: Batch analysis"
    echo "----------------------"
    vox dry-run batch alloy 0 3
    echo ""
    echo ""
else
    echo "Test 4: Skipped (no QA database found)"
    echo ""
    echo "Test 5: Skipped (no QA database found)"
    echo ""
fi

# Test 6: Create temp file and analyze
echo "Test 6: Analyze file"
echo "--------------------"
temp_file=$(mktemp /tmp/vox_test.XXXXXX.txt)
cat > "$temp_file" <<'EOF'
The quick brown fox jumps over the lazy dog.
This is a test file for vox dry-run analysis.
It contains multiple lines and demonstrates file analysis.

Testing 1, 2, 3...
EOF

vox dry-run file "$temp_file" echo
rm -f "$temp_file"
echo ""
echo ""

# Test 7: Test truncation warning (text > 4096 chars)
echo "Test 7: Analyze text that would be truncated"
echo "----------------------------------------------"
# Generate 5000 chars
long_text=$(python3 -c "print('A' * 5000)" 2>/dev/null || perl -e 'print "A" x 5000')
echo "$long_text" | vox dry-run stdin fable
echo ""
echo ""

# Summary
echo "======================================"
echo "Test suite completed!"
echo "======================================"
echo ""
echo "Key features demonstrated:"
echo "  ✓ Stdin analysis"
echo "  ✓ File analysis"
echo "  ✓ QA reference analysis (if available)"
echo "  ✓ Batch analysis (if QA available)"
echo "  ✓ Truncation detection"
echo "  ✓ Cache status checking"
echo "  ✓ Cost estimation"
echo "  ✓ Content preview"
echo ""
echo "Try it yourself:"
echo "  echo 'Your text here' | vox dry-run stdin sally"
echo "  vox dry-run qa qa:0 nova"
echo "  vox dry-run batch alloy 0 5"
echo "  vox dry-run file yourfile.txt echo"
