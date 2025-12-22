#!/usr/bin/env bash
# tps/includes.sh - Tetra Prompt System module loader
# Follows tetra module pattern from MODULE_SYSTEM_SPECIFICATION.md

source "$TETRA_SRC/bash/utils/module_init.sh"
source "$TETRA_SRC/bash/utils/function_helpers.sh"

tetra_module_init_with_alias "tps" "TPS"

# Core systems (order matters)
source "$TPS_SRC/core/hooks.sh"       # Hook registry first
source "$TPS_SRC/core/colors.sh"      # Color system
source "$TPS_SRC/core/context.sh"        # Context slot providers
source "$TPS_SRC/core/context_module.sh" # Module integration helper
source "$TPS_SRC/core/segments.sh"    # Segment area registry
source "$TPS_SRC/core/metrics.sh"     # Command metrics
source "$TPS_SRC/core/osc.sh"         # OSC escape sequences (pwd/document)
source "$TPS_SRC/core/render.sh"      # Common render utilities

# Main module (must come after core)
source "$TPS_SRC/tps.sh"

# Tab completion
tetra_source_if_exists "$TPS_SRC/tps_complete.sh"

# Set PROMPT_COMMAND (chain with existing, don't replace)
# tps_prompt runs first to capture exit code, then existing commands
if [[ -z "${PROMPT_COMMAND:-}" ]]; then
    PROMPT_COMMAND="tps_prompt"
elif [[ "$PROMPT_COMMAND" != *"tps_prompt"* ]]; then
    # Prepend tps_prompt (needs to run first to capture $?)
    PROMPT_COMMAND="tps_prompt; $PROMPT_COMMAND"
fi
