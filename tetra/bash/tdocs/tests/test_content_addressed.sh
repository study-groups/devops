#!/usr/bin/env bash
# Test content-addressed metadata system

set -e

# Setup test environment
TEST_DIR=$(mktemp -d)
cd "$TEST_DIR"

echo "Test Directory: $TEST_DIR"
echo ""

# Source tetra environment
source ~/tetra/tetra.sh 2>/dev/null || {
    echo "Error: Failed to load tetra environment"
    exit 1
}

# Load tdocs
tmod load tdocs 2>/dev/null || {
    echo "Error: Failed to load tdocs module"
    exit 1
}

# Test 1: Initialize local context
echo "=== Test 1: Initialize local context ==="
export TDOCS_REPL_CONTEXT="local"

# Initialize using the index init function
tdoc_index_init

if [[ -d ".tdocs" ]]; then
    echo "✓ .tdocs directory created"
else
    echo "✗ .tdocs directory not created"
    exit 1
fi

if [[ -f ".tdocs/index.json" ]]; then
    echo "✓ index.json created"
else
    echo "✗ index.json not created"
    exit 1
fi
echo ""

# Test 2: Create a test file and scan
echo "=== Test 2: Create test file and scan ==="
cat > TEST.md <<'EOF'
# Test Document

This is a test document for content-addressed metadata.

## Features
- Content hashing
- Move detection
- Metadata tracking
EOF

tdoc_scan_dir "."

# Check if file was indexed
TEST_HASH=$(tdoc_hash_file "TEST.md")
echo "File hash: $TEST_HASH"

if [[ -n "$TEST_HASH" ]]; then
    echo "✓ File hashed successfully"
else
    echo "✗ File hashing failed"
    exit 1
fi

# Check if metadata was created
META_FILE=$(tdoc_meta_file "$TEST_HASH")
if [[ -f "$META_FILE" ]]; then
    echo "✓ Metadata file created: $META_FILE"
else
    echo "✗ Metadata file not created"
    exit 1
fi

# Check index
INDEXED_PATH=$(tdoc_index_get_path "$TEST_HASH")
if [[ "$INDEXED_PATH" == "TEST.md" ]]; then
    echo "✓ File indexed correctly: $INDEXED_PATH"
else
    echo "✗ Index lookup failed (expected 'TEST.md', got '$INDEXED_PATH')"
    exit 1
fi
echo ""

# Test 3: Move file and detect
echo "=== Test 3: Move file and detect move ==="
mkdir -p docs
mv TEST.md docs/TEST.md

tdoc_scan_dir "."

# Check if move was detected
NEW_INDEXED_PATH=$(tdoc_index_get_path "$TEST_HASH")
if [[ "$NEW_INDEXED_PATH" == "docs/TEST.md" ]]; then
    echo "✓ Move detected and updated: $NEW_INDEXED_PATH"
else
    echo "✗ Move detection failed (expected 'docs/TEST.md', got '$NEW_INDEXED_PATH')"
    exit 1
fi

# Check if metadata path was updated
CURRENT_PATH=$(grep "^current_path:" "$META_FILE" | cut -d' ' -f2)
if [[ "$CURRENT_PATH" == "docs/TEST.md" ]]; then
    echo "✓ Metadata path updated: $CURRENT_PATH"
else
    echo "✗ Metadata path not updated (expected 'docs/TEST.md', got '$CURRENT_PATH')"
    exit 1
fi

# Check path history
PATH_COUNT=$(grep -c "^  - path:" "$META_FILE" || echo 0)
if [[ $PATH_COUNT -eq 2 ]]; then
    echo "✓ Path history tracked ($PATH_COUNT entries)"
else
    echo "✗ Path history incomplete (expected 2 entries, got $PATH_COUNT)"
fi
echo ""

# Test 4: Modify file and detect change
echo "=== Test 4: Modify file and detect change ==="
echo "## New Section" >> docs/TEST.md

NEW_HASH=$(tdoc_hash_file "docs/TEST.md")
echo "New hash: $NEW_HASH"

if [[ "$NEW_HASH" != "$TEST_HASH" ]]; then
    echo "✓ Content change detected (hash changed)"
else
    echo "✗ Content change not detected (hash unchanged)"
    exit 1
fi

tdoc_scan_dir "."

# Check if new metadata was created
NEW_META_FILE=$(tdoc_meta_file "$NEW_HASH")
if [[ -f "$NEW_META_FILE" ]]; then
    echo "✓ New metadata created for changed file"
else
    echo "✗ New metadata not created"
    exit 1
fi

# Check if old path was removed from index
OLD_INDEXED_PATH=$(tdoc_index_get_path "$TEST_HASH")
if [[ -z "$OLD_INDEXED_PATH" ]]; then
    echo "✓ Old hash removed from index"
else
    echo "✗ Old hash still in index"
fi
echo ""

# Test 5: List index
echo "=== Test 5: List index entries ==="
INDEX_COUNT=$(tdoc_index_list | wc -l | tr -d ' ')
echo "Index entries: $INDEX_COUNT"

if [[ $INDEX_COUNT -gt 0 ]]; then
    echo "✓ Index contains entries"
    tdoc_index_list
else
    echo "✗ Index is empty"
    exit 1
fi
echo ""

# Cleanup
echo "=== Cleanup ==="
cd /tmp
rm -rf "$TEST_DIR"
echo "✓ Test directory removed"
echo ""

echo "=== All Tests Passed! ==="
