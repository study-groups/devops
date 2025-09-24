#!/usr/bin/env bash

# TOML Editor Visual Elements
# Provides colorization, indicators, and visual feedback

# Color definitions
if [[ -z "$COLOR_RESET" ]]; then
    export COLOR_RESET='\033[0m'
    export COLOR_SECTION='\033[1;34m'      # Bold Blue for sections
    export COLOR_VARIABLE='\033[0;36m'     # Cyan for variables
    export COLOR_VALUE='\033[0;33m'        # Yellow for values
    export COLOR_CURRENT='\033[1;32m'      # Bold Green for current selection
    export COLOR_EXPANDED='\033[0;35m'     # Magenta for expanded sections
    export COLOR_COMMENT='\033[0;90m'      # Dark Gray for comments
fi

# Colorize section name
colorize_section() {
    local section="$1"
    local is_current="${2:-false}"
    local is_expanded="${3:-false}"

    local color="$COLOR_SECTION"

    if [[ "$is_current" == "true" ]]; then
        color="$COLOR_CURRENT"
    elif [[ "$is_expanded" == "true" ]]; then
        color="$COLOR_EXPANDED"
    fi

    echo -e "${color}${section}${COLOR_RESET}"
}

# Colorize variable line (name=value)
colorize_variable() {
    local var_line="$1"
    local is_current="${2:-false}"

    if [[ "$var_line" =~ ^([^=]+)=(.+)$ ]]; then
        local var_name="${BASH_REMATCH[1]// /}"  # Remove spaces
        local var_value="${BASH_REMATCH[2]}"

        local name_color="$COLOR_VARIABLE"
        local value_color="$COLOR_VALUE"

        if [[ "$is_current" == "true" ]]; then
            name_color="$COLOR_CURRENT"
            value_color="$COLOR_CURRENT"
        fi

        echo -e "${name_color}${var_name}${COLOR_RESET}=${value_color}${var_value}${COLOR_RESET}"
    else
        echo "$var_line"
    fi
}

# Render section with full visual formatting
render_section_visual() {
    local section="$1"
    local is_current="${2:-false}"
    local indent="${3:-  }"
    local toml_file="${4:-$ACTIVE_TOML}"

    # Check if section is expanded
    local is_expanded="false"
    if [[ "${SECTION_EXPANDED[$section]}" == "true" ]]; then
        is_expanded="true"
    fi

    # Get section indicator and colorize
    local indicator
    indicator=$(get_section_indicator "$section")
    local colored_section
    colored_section=$(colorize_section "$section" "$is_current" "$is_expanded")

    # Current selection gets highlight prefix
    local prefix=""
    if [[ "$is_current" == "true" ]]; then
        prefix="→ "
    fi

    echo -e "${indent}${prefix}${indicator} [${colored_section}]"

    # Show variables if section is expanded
    if [[ "$is_expanded" == "true" ]]; then
        local variables
        variables=$(get_section_variables "$section" "$toml_file")

        if [[ -n "$variables" ]]; then
            while IFS= read -r var_line; do
                local colored_var
                colored_var=$(colorize_variable "$var_line")
                echo -e "${indent}  ${colored_var}"
            done <<< "$variables"
        else
            echo -e "${indent}  ${COLOR_COMMENT}(no variables)${COLOR_RESET}"
        fi
    fi
}

# Render full TOML tree with navigation state
render_toml_tree_visual() {
    local toml_file="${1:-$ACTIVE_TOML}"
    local current_item="${2:-$CURRENT_ITEM}"

    if [[ ! -f "$toml_file" ]]; then
        echo -e "${COLOR_COMMENT}No TOML file loaded${COLOR_RESET}"
        return 1
    fi

    echo -e "${COLOR_SECTION}TOML Configuration: $(basename "$toml_file")${COLOR_RESET}"
    echo

    # Render each section
    for i in "${!ACTIVE_MULTISPANS[@]}"; do
        local section="${ACTIVE_MULTISPANS[$i]}"
        local is_current="false"

        if [[ $i -eq $current_item ]]; then
            is_current="true"
        fi

        render_section_visual "$section" "$is_current" "  " "$toml_file"
        echo
    done

    # Show navigation help
    echo -e "${COLOR_COMMENT}Navigation: j/k (up/down), Enter (expand/collapse), e (edit)${COLOR_RESET}"
}

# Get variable context and help text
get_variable_context() {
    local var_name="$1"
    local section="${2:-}"

    # Provide context based on variable name patterns
    case "$var_name" in
        "server"|"host"|"hostname")
            echo "Server hostname or IP address for connections"
            ;;
        "port")
            echo "Network port number for service connections"
            ;;
        "database"|"db_name")
            echo "Database name for data storage"
            ;;
        "username"|"user")
            echo "Username for authentication"
            ;;
        "password"|"pass")
            echo "Password for authentication (secure storage recommended)"
            ;;
        "enabled"|"enable")
            echo "Boolean flag to enable/disable this feature"
            ;;
        "debug"|"debug_mode")
            echo "Enable debug logging and verbose output"
            ;;
        "timeout")
            echo "Connection timeout in seconds"
            ;;
        "max_connections"|"connection_max")
            echo "Maximum number of concurrent connections"
            ;;
        "ssl"|"tls"|"secure")
            echo "Enable SSL/TLS encryption for secure connections"
            ;;
        *)
            # Try to infer from section context
            if [[ -n "$section" ]]; then
                case "$section" in
                    "database"*)
                        echo "Database configuration parameter"
                        ;;
                    "server"*)
                        echo "Server configuration setting"
                        ;;
                    "auth"*)
                        echo "Authentication/authorization setting"
                        ;;
                    *)
                        echo "Configuration parameter for $section"
                        ;;
                esac
            else
                echo "Configuration parameter"
            fi
            ;;
    esac
}

# Show detailed variable information
show_variable_details() {
    local var_name="$1"
    local var_value="$2"
    local section="${3:-}"
    local location="${4:-}"

    echo -e "${COLOR_VARIABLE}Variable: $var_name${COLOR_RESET}"
    echo -e "${COLOR_VALUE}Value: $var_value${COLOR_RESET}"

    if [[ -n "$section" ]]; then
        echo -e "${COLOR_SECTION}Section: [$section]${COLOR_RESET}"
    fi

    if [[ -n "$location" ]]; then
        echo -e "${COLOR_COMMENT}Location: $location${COLOR_RESET}"
    fi

    local context
    context=$(get_variable_context "$var_name" "$section")
    echo -e "${COLOR_COMMENT}Purpose: $context${COLOR_RESET}"
}

# Validate TOML value format
validate_toml_value() {
    local value="$1"
    local expected_type="${2:-auto}"

    case "$expected_type" in
        "string")
            # String should be quoted or simple
            if [[ "$value" =~ ^\".*\"$ ]] || [[ "$value" =~ ^[a-zA-Z0-9._-]+$ ]]; then
                echo "valid"
                return 0
            fi
            ;;
        "number")
            # Should be numeric
            if [[ "$value" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
                echo "valid"
                return 0
            fi
            ;;
        "boolean")
            # Should be true/false
            if [[ "$value" =~ ^(true|false)$ ]]; then
                echo "valid"
                return 0
            fi
            ;;
        "array")
            # Should be bracket-enclosed
            if [[ "$value" =~ ^\[.*\]$ ]]; then
                echo "valid"
                return 0
            fi
            ;;
        "auto"|*)
            # Auto-detect and validate
            if [[ "$value" =~ ^\".*\"$ ]] || \
               [[ "$value" =~ ^[0-9]+(\.[0-9]+)?$ ]] || \
               [[ "$value" =~ ^(true|false)$ ]] || \
               [[ "$value" =~ ^\[.*\]$ ]] || \
               [[ "$value" =~ ^[a-zA-Z0-9._-]+$ ]]; then
                echo "valid"
                return 0
            fi
            ;;
    esac

    echo "invalid"
    return 1
}

# Format value for TOML output
format_toml_value() {
    local value="$1"
    local force_type="${2:-auto}"

    case "$force_type" in
        "string")
            # Ensure string is quoted
            if [[ ! "$value" =~ ^\".*\"$ ]]; then
                echo "\"$value\""
            else
                echo "$value"
            fi
            ;;
        "number")
            # Remove quotes if present
            echo "${value//\"/}"
            ;;
        "boolean")
            # Normalize to lowercase
            echo "${value,,}"
            ;;
        "auto"|*)
            # Keep as-is for auto-detection
            echo "$value"
            ;;
    esac
}