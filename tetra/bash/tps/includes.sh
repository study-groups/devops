#!/usr/bin/env bash
# tps/includes.sh - Tetra Prompt System module loader
# Follows tetra module pattern from MODULE_SYSTEM_SPECIFICATION.md

source "$TETRA_SRC/bash/utils/module_init.sh"
source "$TETRA_SRC/bash/utils/function_helpers.sh"

tetra_module_init_with_alias "tps" "TPS"

# Core systems (order matters)
source "$TPS_SRC/core/hooks.sh"       # Hook registry first
source "$TPS_SRC/core/colors.sh"      # Color system
source "$TPS_SRC/core/context.sh"     # Context slot providers
source "$TPS_SRC/core/segments.sh"    # Segment area registry
source "$TPS_SRC/core/metrics.sh"     # Command metrics
source "$TPS_SRC/core/osc.sh"         # OSC escape sequences (pwd/document)

# Main module (must come after core)
source "$TPS_SRC/tps.sh"

# Tab completion
tetra_source_if_exists "$TPS_SRC/tps_complete.sh"

# Set PROMPT_COMMAND
PROMPT_COMMAND="tps_prompt"
