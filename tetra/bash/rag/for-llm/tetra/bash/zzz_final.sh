#!/usr/bin/env bash
# This script runs last (alphabetically) to ensure tsm function takes precedence

# Override PROMPT_COMMAND to include unalias
original_prompt_command="$PROMPT_COMMAND"
PROMPT_COMMAND="unalias tsm 2>/dev/null || true; $original_prompt_command"