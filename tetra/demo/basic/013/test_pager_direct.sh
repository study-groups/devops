#!/usr/bin/env bash

# Direct test of pager functionality

echo "Testing pager directly..."
echo ""

# Create test content
TEST_CONTENT="# Test Content

This is a test of the pager system.

## Section 1
Some content here.

## Section 2
More content here.

## Section 3
Even more content to make it scroll.

---

$(for i in {1..50}; do echo "Line $i of test content"; done)
"

# Test 1: Check if glow exists
echo "Test 1: Check glow availability"
if command -v glow &>/dev/null; then
    echo "✓ glow found: $(which glow)"
    glow --version
else
    echo "✗ glow NOT found"
    exit 1
fi
echo ""

# Test 2: Try glow with --pager
echo "Test 2: Testing 'glow --pager'"
echo "Press 'q' to exit glow and continue..."
sleep 2

echo "$TEST_CONTENT" | glow --pager

echo ""
echo "Did glow open? (y/n)"
read -n1 response
echo ""

if [[ "$response" == "y" ]]; then
    echo "✓ Pager worked!"
else
    echo "✗ Pager failed"
    echo ""
    echo "Trying with less instead..."
    sleep 1
    echo "$TEST_CONTENT" | less -R
fi
