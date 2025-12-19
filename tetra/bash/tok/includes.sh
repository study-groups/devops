#!/usr/bin/env bash
# TOK Module - Token/JSON Utilities
#
# Provides JSON validation, template hydration, and schema management.
# Extracted from TUT module for cleaner separation of concerns.

# Load module utilities
source "$TETRA_SRC/bash/utils/module_init.sh"
source "$TETRA_SRC/bash/utils/function_helpers.sh"

# Initialize module with standard tetra conventions
tetra_module_init_with_alias "tok" "TOK" "generated"

# Core utilities
source "$TOK_SRC/core/json.sh"
source "$TOK_SRC/core/hydrate.sh"
source "$TOK_SRC/core/schema.sh"

# Main CLI
source "$TOK_SRC/tok.sh"

# Tab completion
tetra_source_if_exists "$TOK_SRC/tok_complete.sh"
