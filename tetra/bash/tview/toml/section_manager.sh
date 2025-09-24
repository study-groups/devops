#!/usr/bin/env bash

# TOML Section Manager
# Handles section expansion, variable extraction, and section operations

# Global section state
declare -gA SECTION_EXPANDED=()

# Get variables from a specific TOML section
get_section_variables() {
    local section="$1"
    local toml_file="${2:-$ACTIVE_TOML}"

    if [[ -z "$section" || ! -f "$toml_file" ]]; then
        return 1
    fi

    local in_section=false
    local variables=()

    while IFS= read -r line; do
        # Check for section header
        if [[ "$line" =~ ^\[([^\]]+)\] ]]; then
            local current_section="${BASH_REMATCH[1]}"
            if [[ "$current_section" == "$section" ]]; then
                in_section=true
            else
                in_section=false
            fi
        # Extract variables if we're in the target section
        elif [[ "$in_section" == "true" && "$line" =~ ^[[:space:]]*([a-zA-Z_][a-zA-Z0-9_]*)[[:space:]]*=[[:space:]]*(.+)$ ]]; then
            local var_name="${BASH_REMATCH[1]}"
            local var_value="${BASH_REMATCH[2]}"
            # Remove quotes from value if present
            var_value=$(echo "$var_value" | sed 's/^"\(.*\)"$/\1/')
            variables+=("$var_name=$var_value")
        fi
    done < "$toml_file"

    # Output variables
    for var in "${variables[@]}"; do
        echo "$var"
    done

    return 0
}

# Toggle section expansion state
toggle_section_expansion() {
    local section="$1"

    if [[ -z "$section" ]]; then
        return 1
    fi

    # Initialize if not set
    if [[ -z "${SECTION_EXPANDED[$section]}" ]]; then
        SECTION_EXPANDED["$section"]=false
    fi

    # Toggle state
    if [[ "${SECTION_EXPANDED[$section]}" == "true" ]]; then
        SECTION_EXPANDED["$section"]=false
        echo "Collapsed section [$section]"
    else
        SECTION_EXPANDED["$section"]=true
        echo "Expanded section [$section]"
    fi

    return 0
}

# Check if section is expanded
is_section_expanded() {
    local section="$1"

    if [[ -z "$section" ]]; then
        return 1
    fi

    [[ "${SECTION_EXPANDED[$section]}" == "true" ]]
}

# Get section expansion indicator
get_section_indicator() {
    local section="$1"

    if is_section_expanded "$section"; then
        echo "▼"  # Expanded
    else
        echo "▶"  # Collapsed
    fi
}

# Render section with variables (if expanded)
render_section() {
    local section="$1"
    local indent="${2:-  }"
    local toml_file="${3:-$ACTIVE_TOML}"

    local indicator
    indicator=$(get_section_indicator "$section")

    echo "${indent}${indicator} [$section]"

    # Show variables if section is expanded
    if is_section_expanded "$section"; then
        local variables
        variables=$(get_section_variables "$section" "$toml_file")

        if [[ -n "$variables" ]]; then
            while IFS= read -r var_line; do
                echo "${indent}  ${var_line}"
            done <<< "$variables"
        else
            echo "${indent}  (no variables)"
        fi
    fi
}

# Count variables in section
count_section_variables() {
    local section="$1"
    local toml_file="${2:-$ACTIVE_TOML}"

    local count=0
    local variables
    variables=$(get_section_variables "$section" "$toml_file")

    if [[ -n "$variables" ]]; then
        count=$(echo "$variables" | wc -l)
    fi

    echo "$count"
}

# Get section purpose/description (for context)
get_section_purpose() {
    local section="$1"

    case "$section" in
        "database")
            echo "Database connection configuration"
            ;;
        "servers."*)
            echo "Server instance configuration"
            ;;
        "clients")
            echo "Client connection settings"
            ;;
        "debug")
            echo "Debugging and logging configuration"
            ;;
        "auth"*)
            echo "Authentication and authorization settings"
            ;;
        "cache"*)
            echo "Caching configuration"
            ;;
        *)
            echo "Configuration section"
            ;;
    esac
}

# Find section by partial name
find_section_by_name() {
    local partial_name="$1"
    local toml_file="${2:-$ACTIVE_TOML}"

    if [[ -z "$partial_name" ]]; then
        return 1
    fi

    # Get all sections
    local sections
    sections=$(awk -F'[][]' '/^\[/{print $2}' "$toml_file")

    # Find matching sections
    local matches=()
    while IFS= read -r section; do
        if [[ "$section" =~ $partial_name ]]; then
            matches+=("$section")
        fi
    done <<< "$sections"

    # Output matches
    for match in "${matches[@]}"; do
        echo "$match"
    done

    [[ ${#matches[@]} -gt 0 ]]
}

# Add new variable to section
add_variable_to_section() {
    local section="$1"
    local var_name="$2"
    local var_value="$3"
    local toml_file="${4:-$ACTIVE_TOML}"

    if [[ -z "$section" || -z "$var_name" || -z "$var_value" || ! -f "$toml_file" ]]; then
        return 1
    fi

    # Find section and add variable
    local temp_file=$(mktemp)
    local in_section=false
    local section_found=false

    while IFS= read -r line; do
        # Check for section header
        if [[ "$line" =~ ^\[([^\]]+)\] ]]; then
            local current_section="${BASH_REMATCH[1]}"
            if [[ "$current_section" == "$section" ]]; then
                in_section=true
                section_found=true
                echo "$line" >> "$temp_file"
            else
                # If we were in target section, add variable before next section
                if [[ "$in_section" == "true" ]]; then
                    echo "$var_name = \"$var_value\"" >> "$temp_file"
                    in_section=false
                fi
                echo "$line" >> "$temp_file"
            fi
        else
            echo "$line" >> "$temp_file"
        fi
    done < "$toml_file"

    # If section was found and we're still in it, add variable at end
    if [[ "$in_section" == "true" ]]; then
        echo "$var_name = \"$var_value\"" >> "$temp_file"
    fi

    if [[ "$section_found" == "true" ]]; then
        mv "$temp_file" "$toml_file"
        echo "Added variable '$var_name' to section [$section]"
        return 0
    else
        rm -f "$temp_file"
        echo "Section [$section] not found"
        return 1
    fi
}