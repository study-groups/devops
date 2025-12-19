#!/usr/bin/env bash
# Manifest parser for TERRAIN bundler
# Parses .manifest files (TOML-like format)

# Associative array to hold parsed manifest
declare -gA MANIFEST

# Parse a manifest file into MANIFEST associative array
# Usage: manifest_parse path/to/file.manifest
manifest_parse() {
    local file="$1"
    local section=""

    [[ ! -f "$file" ]] && {
        echo "Error: Manifest not found: $file" >&2
        return 1
    }

    # Clear previous manifest
    MANIFEST=()

    while IFS= read -r line || [[ -n "$line" ]]; do
        # Skip empty lines and comments
        [[ -z "${line// /}" ]] && continue
        [[ "$line" =~ ^[[:space:]]*# ]] && continue

        # Section header: [section]
        if [[ "$line" =~ ^\[([a-zA-Z0-9_-]+)\] ]]; then
            section="${BASH_REMATCH[1]}"
            continue
        fi

        # Key = value (with optional quotes)
        if [[ "$line" =~ ^[[:space:]]*([a-zA-Z0-9_-]+)[[:space:]]*=[[:space:]]*(.*) ]]; then
            local key="${BASH_REMATCH[1]}"
            local value="${BASH_REMATCH[2]}"

            # Strip leading/trailing whitespace and quotes
            value="${value#\"}"
            value="${value%\"}"
            value="${value#\'}"
            value="${value%\'}"

            # Handle arrays: key = [ "a", "b", "c" ]
            if [[ "$value" =~ ^\[ ]]; then
                # Multi-line array - collect until ]
                local array_value="$value"
                while [[ ! "$array_value" =~ \]$ ]] && IFS= read -r line; do
                    array_value+=" $line"
                done
                value="$array_value"
            fi

            # Store with section prefix
            if [[ -n "$section" ]]; then
                MANIFEST["${section}.${key}"]="$value"
            else
                MANIFEST["$key"]="$value"
            fi
        fi
    done < "$file"
}

# Get a manifest value
# Usage: manifest_get section.key [default]
manifest_get() {
    local key="$1"
    local default="${2:-}"
    echo "${MANIFEST[$key]:-$default}"
}

# Parse array value into bash array
# Usage: manifest_get_array section.key arrayname
manifest_get_array() {
    local key="$1"
    local -n arr="$2"  # nameref
    local value="${MANIFEST[$key]:-}"

    arr=()
    [[ -z "$value" ]] && return

    # Strip brackets
    value="${value#\[}"
    value="${value%\]}"

    # Split on commas, handling quoted strings
    local IFS=','
    local items
    read -ra items <<< "$value"

    for item in "${items[@]}"; do
        # Trim whitespace and quotes
        item="${item#"${item%%[![:space:]]*}"}"
        item="${item%"${item##*[![:space:]]}"}"
        item="${item#\"}"
        item="${item%\"}"
        [[ -n "$item" ]] && arr+=("$item")
    done
}

# Check if manifest has a key
# Usage: manifest_has section.key
manifest_has() {
    [[ -v "MANIFEST[$1]" ]]
}

# Debug: print all manifest entries
manifest_dump() {
    local key
    echo "=== Manifest Contents ==="
    for key in "${!MANIFEST[@]}"; do
        echo "  $key = ${MANIFEST[$key]}"
    done
    echo "========================="
}
