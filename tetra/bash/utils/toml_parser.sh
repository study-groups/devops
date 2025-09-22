#!/usr/bin/env bash

# TOML Parser for Bash
# Lightweight TOML parsing for configuration files
# Supports sections, key-value pairs, and basic data types

# Parse TOML file into bash associative arrays
toml_parse() {
    local file="$1"
    local prefix="${2:-TOML}"

    if [[ ! -f "$file" ]]; then
        echo "Error: TOML file not found: $file" >&2
        return 1
    fi

    local current_section=""
    local line_num=0

    while IFS= read -r line || [[ -n "$line" ]]; do
        line_num=$((line_num + 1))

        # Remove leading/trailing whitespace
        line=$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

        # Skip empty lines and comments
        [[ -z "$line" || "$line" =~ ^# ]] && continue

        # Section headers [section]
        if [[ "$line" =~ ^\[([^\]]+)\]$ ]]; then
            current_section="${BASH_REMATCH[1]}"
            # Replace dots with underscores for valid bash identifiers
            local section_name="${current_section//\./_}"
            # Create associative array for this section
            declare -gA "${prefix}_${section_name}"
            continue
        fi

        # Key-value pairs
        if [[ "$line" =~ ^([^=]+)=(.*)$ ]]; then
            local key="${BASH_REMATCH[1]}"
            local value="${BASH_REMATCH[2]}"

            # Clean up key and value
            key=$(echo "$key" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
            value=$(echo "$value" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

            # Remove quotes from strings
            if [[ "$value" =~ ^\"(.*)\"$ ]]; then
                value="${BASH_REMATCH[1]}"
            elif [[ "$value" =~ ^\'(.*)\'$ ]]; then
                value="${BASH_REMATCH[1]}"
            fi

            # Handle arrays [item1, item2, item3]
            if [[ "$value" =~ ^\[(.+)\]$ ]]; then
                local array_content="${BASH_REMATCH[1]}"
                # Convert to space-separated list
                value=$(echo "$array_content" | sed 's/,/ /g' | sed 's/[[:space:]]*//g')
            fi

            # Store in appropriate array
            if [[ -n "$current_section" ]]; then
                local section_name="${current_section//\./_}"
                declare -gA "${prefix}_${section_name}"
                local array_name="${prefix}_${section_name}[$key]"
                eval "$array_name=\"\$value\""
            else
                declare -gA "${prefix}_root"
                eval "${prefix}_root[$key]=\"\$value\""
            fi
        else
            echo "Warning: Invalid TOML syntax at line $line_num: $line" >&2
        fi
    done < "$file"

    return 0
}

# Get value from parsed TOML
toml_get() {
    local section="$1"
    local key="$2"
    local prefix="${3:-TOML}"

    local array_name="${prefix}_${section}[$key]"
    local value

    if eval "value=\${$array_name}"; then
        echo "$value"
        return 0
    else
        return 1
    fi
}

# Set value in TOML structure
toml_set() {
    local section="$1"
    local key="$2"
    local value="$3"
    local prefix="${4:-TOML}"

    # Ensure section array exists
    declare -gA "${prefix}_${section}"

    local array_name="${prefix}_${section}[$key]"
    eval "$array_name=\"\$value\""
}

# Write TOML structure back to file
toml_write() {
    local file="$1"
    local prefix="${2:-TOML}"

    # Get all section names
    local sections=()
    for var in $(compgen -A variable | grep "^${prefix}_"); do
        local section_name="${var#${prefix}_}"
        # Skip internal variables
        [[ "$section_name" =~ ^(root|_) ]] && continue
        sections+=("$section_name")
    done

    # Write to temporary file first
    local temp_file="${file}.tmp"
    {
        echo "# TSM Named Port Registry Configuration"
        echo "# Auto-generated on $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
        echo ""

        # Write root section first if it exists
        if declare -p "${prefix}_root" >/dev/null 2>&1; then
            local -n root_array="${prefix}_root"
            for key in "${!root_array[@]}"; do
                echo "$key = \"${root_array[$key]}\""
            done
            echo ""
        fi

        # Write each section
        for section in "${sections[@]}"; do
            echo "[$section]"
            local -n section_array="${prefix}_${section}"
            for key in "${!section_array[@]}"; do
                local value="${section_array[$key]}"
                # Handle arrays
                if [[ "$value" =~ [[:space:]] ]]; then
                    echo "$key = [${value// /, }]"
                else
                    # Determine if value should be quoted
                    if [[ "$value" =~ ^[0-9]+$ ]]; then
                        echo "$key = $value"
                    else
                        echo "$key = \"$value\""
                    fi
                fi
            done
            echo ""
        done
    } > "$temp_file"

    # Atomic move
    if mv "$temp_file" "$file"; then
        return 0
    else
        rm -f "$temp_file"
        return 1
    fi
}

# List all sections in TOML
toml_sections() {
    local prefix="${1:-TOML}"

    for var in $(compgen -A variable | grep "^${prefix}_"); do
        local section_name="${var#${prefix}_}"
        [[ "$section_name" =~ ^(root|_) ]] && continue
        echo "$section_name"
    done | sort -u
}

# List all keys in a section
toml_keys() {
    local section="$1"
    local prefix="${2:-TOML}"

    if declare -p "${prefix}_${section}" >/dev/null 2>&1; then
        local -n section_array="${prefix}_${section}"
        printf '%s\n' "${!section_array[@]}" | sort
    fi
}

# Export functions
export -f toml_parse toml_get toml_set toml_write toml_sections toml_keys