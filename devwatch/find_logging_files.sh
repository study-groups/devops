#!/bin/bash

# A generic script to find files in a codebase based on patterns.
#
# --- Configuration ---
# Customize the arrays below to tailor the search.

# Keywords to search for (using extended regex for OR conditions)
SEARCH_PATTERNS="log|logger|logging|console\.log|console\.error|console\.warn|winston|pino|bunyan|systemLog|addSystemLog|logActivity"

# Directories to include in the search.
# Example: INCLUDE_DIRS=("./server" "./common")
INCLUDE_DIRS=(".")

# Directories to exclude from the search.
EXCLUDE_DIRS=("node_modules" "dist" "build" "coverage" ".git" "logs" "test-results")

# File patterns (globs) to exclude from the search.
EXCLUDE_FILES=("*.md" "*.html" "*.css")

# --- Script Logic ---

echo "🔍 Searching for files containing patterns: \"$SEARCH_PATTERNS\"..."

# Start building the grep command
cmd="grep -r -i -E -l \"$SEARCH_PATTERNS\""

# Add exclude directory patterns
for dir in "${EXCLUDE_DIRS[@]}"; do
    cmd+=" --exclude-dir=\"$dir\""
done

# Add exclude file patterns
for file_pattern in "${EXCLUDE_FILES[@]}"; do
    cmd+=" --exclude=\"$file_pattern\""
done

# Add the search directories
cmd+=" ${INCLUDE_DIRS[*]}"

# Execute the final command
eval $cmd

echo "✅ Search complete."
