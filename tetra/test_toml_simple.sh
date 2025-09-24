#!/usr/bin/env bash

# Test just the TOML file parsing - no navigation

test_parse_toml() {
    local toml_file="$1"

    echo "Testing TOML parsing for: $toml_file"
    echo "=================================="

    if [[ ! -f "$toml_file" ]]; then
        echo "File not found: $toml_file"
        return 1
    fi

    echo "File exists ✓"

    # Parse sections
    local sections=()
    while IFS= read -r line; do
        if [[ $line =~ ^\[([^\]]+)\] ]]; then
            sections+=("${BASH_REMATCH[1]}")
            echo "Found section: [${BASH_REMATCH[1]}]"
        fi
    done < "$toml_file"

    echo ""
    echo "Total sections found: ${#sections[@]}"

    return 0
}

# Test with available file
test_parse_toml "templates/organizations/simple.toml"