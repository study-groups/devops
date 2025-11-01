#!/usr/bin/env bash
# Test tdocs discover functionality

# Set up environment
export TETRA_SRC="${TETRA_SRC:-/Users/mricos/src/devops/tetra}"
export TETRA_DIR="${TETRA_DIR:-$HOME/.tetra}"

# Load tdocs
source "$TETRA_SRC/bash/tdocs/tdocs.sh"

echo "======================================"
echo "Testing tdocs discover"
echo "======================================"
echo ""

# Clear existing database for clean test
echo "Clearing existing database..."
rm -f "$TETRA_DIR/tdocs/db"/*.meta 2>/dev/null
echo ""

# Test 1: Discover without auto-init
echo "Test 1: Discovery scan (no auto-init)"
echo "--------------------------------------"
tdocs discover
echo ""

# Test 2: Auto-init all documents
echo ""
echo "Test 2: Auto-init all documents"
echo "--------------------------------------"
tdocs discover --auto-init
echo ""

# Test 3: List documents
echo ""
echo "Test 3: List indexed documents"
echo "--------------------------------------"
tdocs ls | head -20
echo ""

# Test 4: Count documents in database
echo ""
echo "Test 4: Database statistics"
echo "--------------------------------------"
db_count=$(find "$TETRA_DIR/tdocs/db" -name "*.meta" 2>/dev/null | wc -l | tr -d ' ')
echo "Total documents in database: $db_count"
echo ""

echo "======================================"
echo "Test complete!"
echo "======================================"
