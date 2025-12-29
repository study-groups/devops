#!/usr/bin/env bash
# MagicFind Module Actions - LLM-assisted file search

if ! declare -f magicfind >/dev/null; then
    MAGICFIND_SRC="${MAGICFIND_SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
    source "$MAGICFIND_SRC/includes.sh"
fi
