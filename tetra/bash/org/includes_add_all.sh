#!/usr/bin/env bash
# Add ALL files to find which one kills

ORG_SRC="${ORG_SRC:-$TETRA_SRC/bash/org}"

echo "Loading tetra_org.sh..." >&2
source "$ORG_SRC/tetra_org.sh"
echo "  ✓ tetra_org.sh" >&2

echo "Loading discovery.sh..." >&2
source "$ORG_SRC/discovery.sh" 2>/dev/null && echo "  ✓ discovery.sh" >&2 || echo "  - discovery.sh" >&2

echo "Loading converter.sh..." >&2
source "$ORG_SRC/converter.sh" 2>/dev/null && echo "  ✓ converter.sh" >&2 || echo "  - converter.sh" >&2

echo "Loading compiler.sh..." >&2
source "$ORG_SRC/compiler.sh" 2>/dev/null && echo "  ✓ compiler.sh" >&2 || echo "  - compiler.sh" >&2

echo "Loading refresh.sh..." >&2
source "$ORG_SRC/refresh.sh" 2>/dev/null && echo "  ✓ refresh.sh" >&2 || echo "  - refresh.sh" >&2

echo "Loading secrets_manager.sh..." >&2
source "$ORG_SRC/secrets_manager.sh" 2>/dev/null && echo "  ✓ secrets_manager.sh" >&2 || echo "  - secrets_manager" >&2

echo "Loading org_help.sh..." >&2
source "$ORG_SRC/org_help.sh" 2>/dev/null && echo "  ✓ org_help.sh" >&2 || echo "  - org_help.sh" >&2

echo "Loading org_repl_adapter.sh..." >&2
source "$ORG_SRC/org_repl_adapter.sh" 2>/dev/null && echo "  ✓ org_repl_adapter.sh" >&2 || echo "  - org_repl_adapter.sh" >&2

echo "Loading nh_bridge.sh..." >&2
source "$TETRA_SRC/bash/nh/nh_bridge.sh" 2>/dev/null && echo "  ✓ nh_bridge.sh" >&2 || echo "  - nh_bridge.sh" >&2

echo "ALL FILES LOADED" >&2

# Export functions
export -f org 2>/dev/null || true
export -f org_list 2>/dev/null || true
export -f org_active 2>/dev/null || true
export -f org_switch 2>/dev/null || true
export -f org_create 2>/dev/null || true
