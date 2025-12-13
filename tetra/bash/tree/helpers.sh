#!/usr/bin/env bash
# bash/tree/helpers.sh - COMPATIBILITY SHIM
#
# This file now sources bash/nav/nav_helpers.sh which provides all helper functions.
# tree_* helper functions continue to work via shims.
#
# For new code, prefer nav_* functions directly.

TREE_HELPERS_SRC="${TREE_HELPERS_SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
NAV_SRC="${NAV_SRC:-$(dirname "$TREE_HELPERS_SRC")/nav}"

if [[ -f "$NAV_SRC/nav_helpers.sh" ]]; then
    source "$NAV_SRC/nav_helpers.sh"
else
    echo "Error: nav_helpers module not found at $NAV_SRC/nav_helpers.sh" >&2
    return 1
fi
