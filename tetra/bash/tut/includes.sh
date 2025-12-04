#!/usr/bin/env bash
# TUT Module - Data-Driven Tutorial Generator
#
# Converts JSON tutorial definitions to multiple output formats (HTML, Markdown).
# Designed for LLM-generated content workflows.

# Load module utilities
source "$TETRA_SRC/bash/utils/module_init.sh"
source "$TETRA_SRC/bash/utils/function_helpers.sh"

# Initialize module with standard tetra conventions
tetra_module_init_with_alias "tut" "TUT" "generated"

# Core utilities
source "$TUT_SRC/core/validators.sh"
source "$TUT_SRC/core/parser.sh"

# Renderers
source "$TUT_SRC/renderers/html.sh"
source "$TUT_SRC/renderers/markdown.sh"
tetra_source_if_exists "$TUT_SRC/tut_reference.sh"

# Main CLI
source "$TUT_SRC/tut.sh"

# Tab completion
tetra_source_if_exists "$TUT_SRC/tut_complete.sh"
