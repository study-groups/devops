#!/usr/bin/env bash

# Prompt module includes

# Load module utilities
source "$TETRA_SRC/bash/utils/module_init.sh"
source "$TETRA_SRC/bash/utils/function_helpers.sh"

# Initialize module with standard tetra conventions
tetra_module_init_with_alias "prompt" "PROMPT"

source "$PROMPT_SRC/prompt.sh"
