#!/usr/bin/env bash
# =============================================================================
# SCANSPEC - Declarative pattern scanning for magicfind
# =============================================================================
#
# Provides deterministic grep/find commands from .scanspec files,
# bypassing LLM generation for known patterns.
#
# Format: .scanspec files
#   name: <scan name>
#   alias: <comma-separated aliases for matching>
#   path: <base path>
#   type: <file extensions, comma-separated>
#   exclude: <dir patterns, comma-separated>
#   mode: summary|files|detail|count
#
#   [patterns]
#   <category>: <regex>
#
#   [replace]
#   <old>: <new>
#

SCANSPEC_SRC="${BASH_SOURCE[0]%/*}/scanspec"

# Source components
source "$SCANSPEC_SRC/core.sh"
source "$SCANSPEC_SRC/commands.sh"
source "$SCANSPEC_SRC/complete.sh"
