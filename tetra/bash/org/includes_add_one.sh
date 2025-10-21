#!/usr/bin/env bash
# Add files ONE AT A TIME to find the killer

ORG_SRC="${ORG_SRC:-$TETRA_SRC/bash/org}"

echo "Loading tetra_org.sh ONLY..." >&2
source "$ORG_SRC/tetra_org.sh"

echo "tetra_org.sh loaded successfully" >&2

# Export key functions
export -f org_list 2>/dev/null || true
export -f org_active 2>/dev/null || true
export -f org_switch 2>/dev/null || true
export -f org_create 2>/dev/null || true

# Simple org command
org() {
    echo "org module loaded with tetra_org.sh"
    echo "Try: org list, org active, org create, etc."
}
export -f org
