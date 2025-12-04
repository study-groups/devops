#!/usr/bin/env bash

# Span module - Universal text analysis and cursor management

# Load module utilities
source "$TETRA_SRC/bash/utils/module_init.sh"
source "$TETRA_SRC/bash/utils/function_helpers.sh"

# Initialize module with standard tetra conventions
tetra_module_init_with_alias "span" "SPAN"

# Module metadata
SPAN_MODULE_VERSION="1.0.0"
SPAN_MODULE_DESC="Universal text analysis with multispan cursor management"

# Source span core if it exists
tetra_source_if_exists "$SPAN_SRC/span.sh"