#!/usr/bin/env bash
# classify_rules.sh - Melvin's classification rules for tetra
# These override/extend TETRA_CLASSIFY_RULES in tetra_classify.sh
#
# Format: "pattern=TYPE"
#   - Patterns are file checks joined by + (AND)
#   - * expands to module name (e.g., *_tui.sh -> modname_tui.sh)
#   - Order matters - first match wins
#
# Melvin can learn new patterns and add them here

# Extend the base rules with melvin-discovered patterns
TETRA_CLASSIFY_RULES=(
    # Hybrid types (most specific first)
    "actions.sh+*_tui.sh=APP+MODULE"
    "actions.sh+*_repl.sh=MODULE"

    # Primary types
    "actions.sh=MODULE"
    "*_tui.sh=APP"
    "tui.sh=APP"

    # Library patterns
    "includes.sh=LIBRARY"

    # Fallback: ANY.sh means "has at least one .sh file"
    "ANY.sh=SCRIPTS"
)

# Future: melvin could add learned patterns here
# MELVIN_LEARNED_RULES=(
#     "pipeline/+providers/=PROCESSOR"
#     "core/+engine/=FRAMEWORK"
# )
