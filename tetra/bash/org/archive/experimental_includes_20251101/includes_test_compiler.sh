#!/usr/bin/env bash
# Test: add compiler.sh

ORG_SRC="${ORG_SRC:-$TETRA_SRC/bash/org}"

source "$ORG_SRC/tetra_org.sh"
source "$ORG_SRC/discovery.sh" 2>/dev/null || true
source "$ORG_SRC/converter.sh" 2>/dev/null || true
echo "TESTING: Adding compiler.sh..." >&2
source "$ORG_SRC/compiler.sh" 2>/dev/null && echo "✓ compiler.sh loaded" >&2 || echo "- compiler.sh skipped" >&2

source "$ORG_SRC/org_help.sh" 2>/dev/null || true
source "$ORG_SRC/org_repl_adapter.sh" 2>/dev/null || true

export -f org 2>/dev/null || true
