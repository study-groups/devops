#!/usr/bin/env bash

# Chroma Module - Terminal Markdown Viewer (Modular Architecture)

# Load module utilities
source "$TETRA_SRC/bash/utils/module_init.sh"
source "$TETRA_SRC/bash/utils/function_helpers.sh"

# Initialize module with standard tetra conventions
tetra_module_init_with_alias "chroma" "CHROMA"

#==============================================================================
# LOAD CHROMA MODULAR CORE
#==============================================================================

# Source the modular loader which handles all dependencies
source "$CHROMA_SRC/chroma_modular.sh"

#==============================================================================
# TAB COMPLETION
#==============================================================================

# Source completion (completion functions are local - no exports)
source "$CHROMA_SRC/chroma_complete.sh"

#==============================================================================
# RELOAD SUPPORT
#==============================================================================

# Reload chroma module (for development)
chroma_reload() {
    echo "Reloading chroma..."

    # Re-source the modular loader
    source "$CHROMA_SRC/chroma_modular.sh"
    source "$CHROMA_SRC/chroma_complete.sh"

    echo "Chroma reloaded"
    chroma --help 2>/dev/null | head -3
}
