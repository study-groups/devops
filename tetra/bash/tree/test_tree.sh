#!/usr/bin/env bash
# Test script for bash/tree

set -e

echo "=== Testing bash/tree ==="
echo ""

# Setup TETRA_SRC if not set
: "${TETRA_SRC:=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
export TETRA_SRC

# Load tree library
source "$TETRA_SRC/bash/tree/core.sh"
source "$TETRA_SRC/bash/tree/complete.sh"
source "$TETRA_SRC/bash/tree/help.sh"

echo "✓ Loaded tree libraries"
echo ""

# Test 1: Basic tree operations
echo "Test 1: Basic tree operations"
tree_insert "test.foo" category title="Foo Category" help="Testing foo"
tree_insert "test.foo.bar" command title="Bar Command" help="Testing bar" handler="bar_handler"
tree_insert "test.foo.baz" command title="Baz Command" help="Testing baz"

if tree_exists "test.foo"; then
    echo "  ✓ tree_insert and tree_exists"
else
    echo "  ✗ tree_insert/exists failed"
    exit 1
fi

title=$(tree_get "test.foo" "title")
if [[ "$title" == "Foo Category" ]]; then
    echo "  ✓ tree_get metadata"
else
    echo "  ✗ tree_get failed: got '$title'"
    exit 1
fi

type=$(tree_type "test.foo.bar")
if [[ "$type" == "command" ]]; then
    echo "  ✓ tree_type"
else
    echo "  ✗ tree_type failed: got '$type'"
    exit 1
fi

echo ""

# Test 2: Children and traversal
echo "Test 2: Children and traversal"
children=$(tree_children "test.foo")
child_count=$(echo "$children" | wc -l | tr -d ' ')

if [[ $child_count -eq 2 ]]; then
    echo "  ✓ tree_children ($child_count children)"
else
    echo "  ✗ tree_children failed: got $child_count, expected 2"
    exit 1
fi

parent=$(tree_parent "test.foo.bar")
if [[ "$parent" == "test.foo" ]]; then
    echo "  ✓ tree_parent"
else
    echo "  ✗ tree_parent failed: got '$parent'"
    exit 1
fi

echo ""

# Test 3: Query
echo "Test 3: Query operations"
commands=$(tree_query --type command)
command_count=$(echo "$commands" | wc -l | tr -d ' ')

if [[ $command_count -ge 2 ]]; then
    echo "  ✓ tree_query --type ($command_count commands found)"
else
    echo "  ✗ tree_query failed"
    exit 1
fi

echo ""

# Test 4: Completion
echo "Test 4: Tab-completion"
tree_insert "test.foo.bar.--flag" flag title="Test flag" help="A test flag"
tree_insert "test.foo.bar.--option" option title="Test option" help="A test option"

completions=$(tree_complete "test.foo")
if echo "$completions" | grep -q "bar"; then
    echo "  ✓ tree_complete (found 'bar')"
else
    echo "  ✗ tree_complete failed"
    exit 1
fi

type_completions=$(tree_complete_by_type "test.foo.bar" "flag")
if echo "$type_completions" | grep -q "\-\-flag"; then
    echo "  ✓ tree_complete_by_type (found '--flag')"
else
    echo "  ✗ tree_complete_by_type failed"
    exit 1
fi

echo ""

# Test 5: Help display
echo "Test 5: Help display"
echo "--- Help output for 'test.foo' ---"
tree_help_show "test.foo" --no-pagination
echo "--- End help output ---"
echo ""

# Test 6: Path normalization
echo "Test 6: Path normalization"
normalized=$(tree_normalize_path "test/foo/bar")
if [[ "$normalized" == "test.foo.bar" ]]; then
    echo "  ✓ Slash to dot conversion"
else
    echo "  ✗ Path normalization failed: got '$normalized'"
    exit 1
fi

echo ""

# Test 7: Breadcrumb
echo "Test 7: Breadcrumb trail"
crumbs=$(tree_breadcrumb "test.foo.bar.--flag")
crumb_count=$(echo "$crumbs" | wc -l | tr -d ' ')
# Should have 4 levels: test, test.foo, test.foo.bar, test.foo.bar.--flag
if [[ $crumb_count -eq 4 ]]; then
    echo "  ✓ tree_breadcrumb ($crumb_count levels)"
else
    echo "  ✗ tree_breadcrumb failed: got $crumb_count levels, expected 4"
    exit 1
fi

echo ""

echo "=== All tests passed! ==="
echo ""
echo "Try interactive help:"
echo "  source bash/tree/help.sh"
echo "  tree_help_navigate test"
echo ""
echo "Or quick lookup:"
echo "  help test.foo"
