#!/usr/bin/env bash
# bash/tree/tree_repl_complete.sh - COMPATIBILITY SHIM
#
# This file now sources bash/nav/nav_repl.sh which provides all REPL completion.
# tree_repl_* functions continue to work via shims.
#
# For new code, prefer nav_repl_* functions directly.

TREE_REPL_COMPLETE_SRC="${TREE_REPL_COMPLETE_SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
NAV_SRC="${NAV_SRC:-$(dirname "$TREE_REPL_COMPLETE_SRC")/nav}"

if [[ -f "$NAV_SRC/nav_repl.sh" ]]; then
    source "$NAV_SRC/nav_repl.sh"
else
    echo "Error: nav_repl module not found at $NAV_SRC/nav_repl.sh" >&2
    return 1
fi
