#!/usr/bin/env bash
# Chroma - Modular markdown renderer for bash
# This loader sources all modules in dependency order

# Determine source directory
CHROMA_SRC="${CHROMA_SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"

# Source modules in dependency order
source "$CHROMA_SRC/core/globals.sh"
source "$CHROMA_SRC/core/plugins.sh"
source "$CHROMA_SRC/core/config.sh"
source "$CHROMA_SRC/core/themes.sh"
source "$CHROMA_SRC/render/colors.sh"
source "$CHROMA_SRC/render/text.sh"
source "$CHROMA_SRC/render/patterns.sh"
source "$CHROMA_SRC/render/tables.sh"
source "$CHROMA_SRC/render/parser.sh"
source "$CHROMA_SRC/render/line.sh"
source "$CHROMA_SRC/main.sh"

# If executed directly (not sourced), run chroma
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    chroma "$@"
fi
