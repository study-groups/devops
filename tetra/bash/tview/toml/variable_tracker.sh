#!/usr/bin/env bash

# TOML Variable Tracker Micro-Module
# Tracks variables and their source locations in TOML files

# Build comprehensive variable tracking display
render_variable_tracking() {
    if [[ -z "$TRACKED_VARIABLES" ]]; then
        refresh_variable_tracking
    fi

    if [[ -z "$TRACKED_VARIABLES" ]]; then
        echo "   No tracked variables"
        return 1
    fi

    local var_count=$(echo "$TRACKED_VARIABLES" | wc -w)
    echo "   Tracking $var_count variables:"

    local output=""
    for var in $TRACKED_VARIABLES; do
        local clean_var=$(echo "$var" | sed 's/[{}$]//g')
        local source_location=$(find_variable_source "$clean_var")

        if [[ "$source_location" != "not_found" ]]; then
            output+="   ${UI_ACCENT_COLOR}▸${COLOR_RESET} $var ${UI_MUTED_COLOR}→ $source_location${COLOR_RESET}\n"
        fi
    done

    echo -e "$output"
}

# Show variable details for a specific variable
show_variable_details() {
    local var_name="$1"

    if [[ -z "$var_name" ]]; then
        echo "Variable name required"
        return 1
    fi

    local source_location=$(find_variable_source "$var_name")

    if [[ "$source_location" == "not_found" ]]; then
        echo "Variable '$var_name' not found in TOML sources"
        return 1
    fi

    local file_path=$(echo "$source_location" | cut -d: -f1)
    local line_num=$(echo "$source_location" | cut -d: -f2)

    if [[ -f "$file_path" ]]; then
        local var_line=$(sed -n "${line_num}p" "$file_path")
        local section_context=$(get_variable_section_context "$file_path" "$line_num")

        cat << EOF
Variable: $var_name
Source: $source_location
Section: $section_context
Definition: $var_line
EOF
    fi
}

# Get the section context for a variable at a specific line
get_variable_section_context() {
    local file_path="$1"
    local target_line="$2"

    # Find the most recent section header before the target line
    local section=""
    local line_num=1

    while IFS= read -r line && [[ $line_num -le $target_line ]]; do
        if [[ "$line" =~ ^\[([^\]]+)\]$ ]]; then
            section="${BASH_REMATCH[1]}"
        fi
        ((line_num++))
    done < "$file_path"

    echo "${section:-global}"
}

# List all variables in a specific section
list_section_variables() {
    local section_name="$1"

    if [[ -z "$section_name" ]]; then
        echo "Section name required"
        return 1
    fi

    local location="${MULTISPAN_LOCATIONS[$section_name]}"

    if [[ -z "$location" ]]; then
        echo "Section '$section_name' not found"
        return 1
    fi

    local file_path=$(echo "$location" | cut -d: -f1)
    local line_range=$(echo "$location" | cut -d: -f2)
    local start_line=$(echo "$line_range" | cut -d- -f1)
    local end_line=$(echo "$line_range" | cut -d- -f2)

    echo "Variables in [$section_name]:"

    # Extract variables from section
    sed -n "${start_line},${end_line}p" "$file_path" | while read -r line; do
        if [[ "$line" =~ ^([a-zA-Z_][a-zA-Z0-9_]*)[[:space:]]*=[[:space:]]*(.+)$ ]]; then
            local var_name="${BASH_REMATCH[1]}"
            local var_value="${BASH_REMATCH[2]}"
            echo "  ${UI_ACCENT_COLOR}▸${COLOR_RESET} $var_name = $var_value"
        fi
    done
}

# Find variables that reference other variables
find_variable_references() {
    if [[ ! -f "$ACTIVE_TOML" ]]; then
        echo "No active TOML file"
        return 1
    fi

    echo "Variable references:"

    # Look for ${VAR} patterns in values
    local references=$(grep -n '\${[^}]*}' "$ACTIVE_TOML" 2>/dev/null || true)

    if [[ -n "$references" ]]; then
        echo "$references" | while read -r ref_line; do
            local line_num=$(echo "$ref_line" | cut -d: -f1)
            local content=$(echo "$ref_line" | cut -d: -f2-)

            # Extract variable references
            local refs=$(echo "$content" | grep -o '\${[^}]*}' | tr '\n' ' ')
            echo "  Line $line_num: $refs"
        done
    else
        echo "  No variable references found"
    fi
}

# Export variable definitions for use in other environments
export_variables_for_env() {
    local target_env="$1"

    if [[ -z "$target_env" ]]; then
        echo "Target environment required"
        return 1
    fi

    echo "# Variables for $target_env environment"
    echo "# Generated from: $ACTIVE_TOML"
    echo ""

    # Look for environment-specific variables
    if [[ -f "$ACTIVE_TOML" ]]; then
        local env_vars=$(grep -i "${target_env}_\|${target_env,,}_" "$ACTIVE_TOML" 2>/dev/null || true)

        if [[ -n "$env_vars" ]]; then
            echo "$env_vars" | while read -r var_line; do
                if [[ "$var_line" =~ ^([a-zA-Z_][a-zA-Z0-9_]*)[[:space:]]*=[[:space:]]*(.+)$ ]]; then
                    local var_name="${BASH_REMATCH[1]}"
                    local var_value="${BASH_REMATCH[2]}"
                    # Convert to environment variable format
                    local env_var_name=$(echo "$var_name" | tr '[:lower:]' '[:upper:]')
                    echo "export ${env_var_name}=${var_value}"
                fi
            done
        else
            echo "# No environment-specific variables found for $target_env"
        fi
    fi
}

# Validate variable references
validate_variable_references() {
    if [[ ! -f "$ACTIVE_TOML" ]]; then
        echo "No active TOML file"
        return 1
    fi

    local errors=0

    echo "Validating variable references..."

    # Find all variable references
    local references=$(grep -o '\${[^}]*}' "$ACTIVE_TOML" 2>/dev/null | sort -u || true)

    if [[ -n "$references" ]]; then
        for ref in $references; do
            local var_name=$(echo "$ref" | sed 's/[{}$]//g')
            local source_location=$(find_variable_source "$var_name")

            if [[ "$source_location" == "not_found" ]]; then
                echo "  ${STATUS_ERROR_COLOR}✗${COLOR_RESET} $ref - undefined variable"
                ((errors++))
            else
                echo "  ${STATUS_SUCCESS_COLOR}✓${COLOR_RESET} $ref - defined at $source_location"
            fi
        done
    fi

    if [[ $errors -eq 0 ]]; then
        echo "All variable references are valid"
    else
        echo "Found $errors undefined variable references"
        return 1
    fi
}