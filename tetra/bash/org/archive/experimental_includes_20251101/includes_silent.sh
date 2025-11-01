#!/usr/bin/env bash
# SILENT VERSION - No output at all

ORG_SRC="${ORG_SRC:-$TETRA_SRC/bash/org}"

# Load core (required)
source "$ORG_SRC/tetra_org.sh" || return 1

# Load optional components
source "$ORG_SRC/discovery.sh" 2>/dev/null || true
source "$ORG_SRC/converter.sh" 2>/dev/null || true
source "$ORG_SRC/compiler.sh" 2>/dev/null || true
source "$ORG_SRC/refresh.sh" 2>/dev/null || true
source "$ORG_SRC/secrets_manager.sh" 2>/dev/null || true
source "$ORG_SRC/org_help.sh" 2>/dev/null || true

# SKIP org_repl_adapter.sh for now - TESTING IF THIS IS THE KILLER
# source "$ORG_SRC/org_repl_adapter.sh" 2>/dev/null || true

source "$TETRA_SRC/bash/nh/nh_bridge.sh" 2>/dev/null || true

tetra_create_lazy_function "tetra_org" "org" 2>/dev/null || true

# Minimal org function
org() {
    echo "org module loaded (minimal version - no REPL)"
    echo "Try: org help"
}

# Export
export -f org 2>/dev/null || true

return 0
