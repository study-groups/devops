#!/usr/bin/env bash

# TDOCS Utilities
# Common helper functions for tdocs core

# Convert CSV string to JSON array
# Usage: _tdocs_csv_to_json_array "tag1,tag2,tag3"
# Returns: ["tag1","tag2","tag3"]
_tdocs_csv_to_json_array() {
    local csv="$1"

    # Empty input → empty array
    [[ -z "$csv" ]] && { echo "[]"; return 0; }

    local json="["
    local first=true

    # Handle both comma-separated and single values
    if [[ "$csv" =~ , ]]; then
        # Comma-separated list
        IFS=',' read -ra items <<< "$csv"
        for item in "${items[@]}"; do
            # Trim whitespace
            item=$(echo "$item" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
            [[ -z "$item" ]] && continue  # Skip empty items

            [[ "$first" == false ]] && json+=", "
            first=false
            json+="\"$item\""
        done
    else
        # Single item
        csv=$(echo "$csv" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
        json+="\"$csv\""
    fi

    json+="]"
    echo "$json"
}

# Get file modification time as Unix timestamp
# Cross-platform (macOS and Linux)
_tdocs_file_mtime() {
    local file="$1"
    [[ ! -f "$file" ]] && return 1

    # Try macOS stat first, then Linux stat
    stat -f %m "$file" 2>/dev/null || stat -c %Y "$file" 2>/dev/null
}

# Convert Unix timestamp to ISO 8601 format
# Cross-platform
_tdocs_timestamp_to_iso() {
    local timestamp="$1"

    # Try macOS date first, then Linux date
    date -r "$timestamp" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || \
    date -d "@$timestamp" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || \
    date +%Y-%m-%dT%H:%M:%SZ  # Fallback to current time
}

# Calculate SHA256 hash of file
# Usage: _tdocs_file_hash <file> [length]
#   length: number of chars to return (default: 64 = full hash, use 12 for short)
_tdocs_file_hash() {
    local file="$1"
    local length="${2:-64}"

    [[ ! -f "$file" ]] && return 1

    if command -v shasum >/dev/null 2>&1; then
        shasum -a 256 "$file" | awk -v len="$length" '{print substr($1, 1, len)}'
    elif command -v sha256sum >/dev/null 2>&1; then
        sha256sum "$file" | awk -v len="$length" '{print substr($1, 1, len)}'
    else
        return 1
    fi
}

# Ensure tok JSON utilities are available
if ! command -v tok_str_get >/dev/null 2>&1; then
    source "${TETRA_SRC}/bash/tok/core/json.sh"
fi

# JSON helpers - thin wrappers around tok_str_get/tok_str_get_multi
# Usage: _tdocs_json_get "$json_string" '.field' [default]
_tdocs_json_get() { tok_str_get "$@"; }

# Usage: IFS=$'\t' read -r a b c <<< "$(_tdocs_json_get_multi "$json" '.a' '.b' '.c')"
_tdocs_json_get_multi() { tok_str_get_multi "$@"; }

# Export utilities
export -f _tdocs_csv_to_json_array
export -f _tdocs_file_mtime
export -f _tdocs_timestamp_to_iso
export -f _tdocs_file_hash
export -f _tdocs_json_get
export -f _tdocs_json_get_multi
