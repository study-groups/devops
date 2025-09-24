#!/usr/bin/env bash

# Simplest possible TOML viewer - no navigation yet

show_toml() {
    local toml_file="$1"

    if [[ ! -f "$toml_file" ]]; then
        echo "File not found: $toml_file"
        return 1
    fi

    # Parse sections
    local sections=()
    while IFS= read -r line; do
        if [[ $line =~ ^\[([^\]]+)\] ]]; then
            sections+=("${BASH_REMATCH[1]}")
        fi
    done < "$toml_file"

    # Show sections
    echo "TOML File: $(basename "$toml_file")"
    echo "=========================="
    for i in "${!sections[@]}"; do
        echo "$i: [${sections[$i]}]"
    done
    echo ""
    echo "Found ${#sections[@]} sections"
}

show_toml "templates/organizations/simple.toml"