#!/usr/bin/env bash
# TEST 3: Add files ONE AT A TIME to find killer

ORG_SRC="${ORG_SRC:-$TETRA_SRC/bash/org}"

echo "TEST 3: Adding files one by one" >&2
source "$ORG_SRC/tetra_org.sh" || return 1
echo "  ✓ tetra_org.sh" >&2

echo "  Loading discovery.sh..." >&2
source "$ORG_SRC/discovery.sh" 2>/dev/null && echo "  ✓ discovery.sh" >&2 || echo "  - discovery.sh (skip)" >&2
echo "  After discovery.sh - still alive" >&2

echo "  Loading converter.sh..." >&2
source "$ORG_SRC/converter.sh" 2>/dev/null && echo "  ✓ converter.sh" >&2 || echo "  - converter.sh (skip)" >&2
echo "  After converter.sh - still alive" >&2

echo "  Loading compiler.sh..." >&2
source "$ORG_SRC/compiler.sh" 2>/dev/null && echo "  ✓ compiler.sh" >&2 || echo "  - compiler.sh (skip)" >&2
echo "  After compiler.sh - still alive" >&2

echo "  Loading refresh.sh..." >&2
source "$ORG_SRC/refresh.sh" 2>/dev/null && echo "  ✓ refresh.sh" >&2 || echo "  - refresh.sh (skip)" >&2
echo "  After refresh.sh - still alive" >&2

echo "  Loading secrets_manager.sh..." >&2
source "$ORG_SRC/secrets_manager.sh" 2>/dev/null && echo "  ✓ secrets_manager.sh" >&2 || echo "  - secrets_manager.sh (skip)" >&2
echo "  After secrets_manager.sh - still alive" >&2

echo "TEST 3: ALL FILES LOADED SUCCESSFULLY" >&2
return 0
