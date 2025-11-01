#!/usr/bin/env bash
# Test: tetra_org + discovery

ORG_SRC="${ORG_SRC:-$TETRA_SRC/bash/org}"

source "$ORG_SRC/tetra_org.sh"
echo "TESTING: Adding discovery.sh..." >&2
source "$ORG_SRC/discovery.sh" 2>/dev/null && echo "✓ discovery.sh loaded" >&2 || echo "- discovery.sh skipped" >&2

source "$ORG_SRC/org_help.sh" 2>/dev/null || true
source "$ORG_SRC/org_repl_adapter.sh" 2>/dev/null || true

export -f org 2>/dev/null || true
export -f org_list 2>/dev/null || true
