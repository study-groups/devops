#!/usr/bin/env bash

# QA Module Includes - Controls what gets loaded for QA functionality

# Load module utilities
source "$TETRA_SRC/bash/utils/module_init.sh"
source "$TETRA_SRC/bash/utils/function_helpers.sh"

# Initialize module with standard tetra conventions
tetra_module_init_with_alias "qa" "QA"

# Source the main QA module
source "$QA_SRC/qa.sh"

# Source tab completion
source "$QA_SRC/qa_complete.sh"
