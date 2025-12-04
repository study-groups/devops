#!/usr/bin/env bash
# bash/tree/core.sh - COMPATIBILITY SHIM
#
# This file now sources bash/nav/nav.sh which provides all tree_* functions
# via compatibility shims. Existing code using tree_* continues to work.
#
# For new code, prefer using nav_* functions directly:
#   nav_define, nav_get, nav_type, nav_children, nav_options, nav_complete, etc.

TREE_SRC="${TREE_SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
NAV_SRC="${NAV_SRC:-$(dirname "$TREE_SRC")/nav}"

# Source the new nav module (provides tree_* shims)
if [[ -f "$NAV_SRC/nav.sh" ]]; then
    source "$NAV_SRC/nav.sh"
else
    echo "Error: nav module not found at $NAV_SRC/nav.sh" >&2
    return 1
fi
