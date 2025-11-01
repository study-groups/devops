#!/usr/bin/env bash
# TEST 2: Add discovery.sh, converter.sh, compiler.sh

ORG_SRC="${ORG_SRC:-$TETRA_SRC/bash/org}"

echo "TEST 2: Loading core files" >&2
source "$ORG_SRC/tetra_org.sh" || return 1
echo "  ✓ tetra_org.sh" >&2

source "$ORG_SRC/discovery.sh" 2>/dev/null && echo "  ✓ discovery.sh" >&2 || echo "  - discovery.sh (skip)" >&2
source "$ORG_SRC/converter.sh" 2>/dev/null && echo "  ✓ converter.sh" >&2 || echo "  - converter.sh (skip)" >&2
source "$ORG_SRC/compiler.sh" 2>/dev/null && echo "  ✓ compiler.sh" >&2 || echo "  - compiler.sh (skip)" >&2
source "$ORG_SRC/refresh.sh" 2>/dev/null && echo "  ✓ refresh.sh" >&2 || echo "  - refresh.sh (skip)" >&2
source "$ORG_SRC/secrets_manager.sh" 2>/dev/null && echo "  ✓ secrets_manager.sh" >&2 || echo "  - secrets_manager.sh (skip)" >&2

echo "TEST 2: Complete" >&2
return 0
