#!/usr/bin/env bash

# Melvin Module - Extracted from QA module

# Utility functions from qa.sh that might be useful standalone
echo64() {
    if [[ $# -eq 0 ]]; then
        # Handle case where no arguments are given (maybe read stdin?)
        echo -n "" # Or echo "Error: echo64 requires arguments." >&2; return 1
    else
        # Concatenate all arguments and pipe to base64
        # The -w 0 option prevents line wrapping in the base64 output
        echo -n "$@" | base64 -w 0
    fi
}

# _truncate_middle function removed - now handled by QA module

# Functions available when module is loaded via lazy loading
