# RAG Tools Porcelain Functions
# These functions provide friendly wrappers around the core RAG tools

# Use tetra convention paths
RAG_CORE_DIR="$RAG_SRC/core"

# Multicat (mc) - concatenate files into MULTICAT format
mc() {
    "$RAG_CORE_DIR/multicat/multicat.sh" "$@"
}

# Multisplit (ms) - split MULTICAT files back to individual files
ms() {
    "$RAG_CORE_DIR/multicat/multisplit.sh" "$@"
}

# MULTICAT info (mi) - show info about MULTICAT files
mi() {
    "$RAG_CORE_DIR/multicat/mcinfo.sh" "$@"
}

# Multifind (mf) - advanced file search with ranking
mf() {
    "$RAG_CORE_DIR/search/multifind.sh" "$@"
}

# Replace - file content replacement
replace() {
    "$RAG_CORE_DIR/utils/replace.sh" "$@"
}

# Get code utility
getcode() {
    "$RAG_CORE_DIR/utils/getcode.sh" "$@"
}

# Quick patch tool
qpatch() {
    "$RAG_CORE_DIR/patch/qpatch.sh" "$@"
}

# Interactive fuzzy grep
fzgrep() {
    "$RAG_CORE_DIR/search/fzfgrep.sh" "$@"
}
