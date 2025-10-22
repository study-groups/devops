#!/usr/bin/env bash

# TOML Environment Generator
# Generates environment variable exports from TOML configuration
# Uses centralized toml_parser.sh for all TOML operations

# Source the centralized TOML parser
TOML_PARSER="${TETRA_SRC}/bash/utils/toml_parser.sh"
if [[ -f "$TOML_PARSER" ]]; then
    source "$TOML_PARSER"
else
    echo "Error: toml_parser.sh not found at $TOML_PARSER" >&2
    return 1
fi

# Generate environment exports from TOML file
# Supports:
# - Common section (shared across environments)
# - Environment-specific sections
# - Variable reference resolution ${variables.*}
# - Infrastructure reference resolution ${infrastructure.*}
# - Secret injection (var.* patterns)
tetra_toml_generate_env() {
    local toml_file="$1"
    local environment="$2"

    if [[ ! -f "$toml_file" ]]; then
        echo "Error: TOML file not found: $toml_file" >&2
        return 1
    fi

    if [[ -z "$environment" ]]; then
        echo "Error: Environment name required" >&2
        return 1
    fi

    # Parse TOML file into memory
    toml_parse "$toml_file" "ENV" || {
        echo "Error: Failed to parse TOML file: $toml_file" >&2
        return 1
    }

    # Process common section first (if exists)
    if toml_sections "ENV" | grep -q "^common$"; then
        _generate_exports_from_section "common" "ENV"
    fi

    # Process environment-specific section
    local env_section="environments_${environment}"
    if toml_sections "ENV" | grep -q "^${env_section}$"; then
        _generate_exports_from_section "$env_section" "ENV"
    else
        echo "Error: Environment section [environments.${environment}] not found" >&2
        return 1
    fi

    return 0
}

# Helper: Generate exports from a specific section
_generate_exports_from_section() {
    local section="$1"
    local prefix="$2"

    # Get all keys in this section
    local keys
    keys=$(toml_keys "$section" "$prefix")

    if [[ -z "$keys" ]]; then
        return 0
    fi

    while IFS= read -r key; do
        local value
        value=$(toml_get "$section" "$key" "$prefix")

        # Resolve variable references
        value=$(_resolve_toml_references "$value" "$prefix")

        # Handle secret injection
        value=$(_handle_secret_injection "$value")

        # Convert key to uppercase for env var name
        local env_var_name
        env_var_name=$(echo "$key" | tr '[:lower:]' '[:upper:]')

        echo "export ${env_var_name}=\"${value}\""
    done <<< "$keys"
}

# Resolve ${variables.*} and ${infrastructure.*} references
_resolve_toml_references() {
    local value="$1"
    local prefix="$2"

    # Resolve ${variables.*} references
    while [[ "$value" =~ \$\{variables\.([^}]+)\} ]]; do
        local var_name="${BASH_REMATCH[1]}"
        local var_value

        if var_value=$(toml_get "variables" "$var_name" "$prefix" 2>/dev/null); then
            value="${value/\${variables.${var_name}}/$var_value}"
        else
            echo "Warning: Undefined variable reference: \${variables.${var_name}}" >&2
            break
        fi
    done

    # Resolve ${infrastructure.*} references
    while [[ "$value" =~ \$\{infrastructure\.([^}]+)\} ]]; do
        local infra_name="${BASH_REMATCH[1]}"
        local infra_value

        if infra_value=$(toml_get "infrastructure" "$infra_name" "$prefix" 2>/dev/null); then
            value="${value/\${infrastructure.${infra_name}}/$infra_value}"
        else
            echo "Warning: Undefined infrastructure reference: \${infrastructure.${infra_name}}" >&2
            break
        fi
    done

    echo "$value"
}

# Handle secret injection for var.* patterns
_handle_secret_injection() {
    local value="$1"

    if [[ "$value" =~ ^var\.(.+)$ ]]; then
        local secret_var="${BASH_REMATCH[1]}"

        # Try to get from environment variable
        if [[ -n "${!secret_var:-}" ]]; then
            value="${!secret_var}"
            echo "✓ Injected secret from \$${secret_var}" >&2
        else
            echo "⚠️  Secret placeholder: $value (set \$${secret_var} environment variable)" >&2
            value="PLACEHOLDER_${secret_var}_HERE"
        fi
    fi

    echo "$value"
}

# Legacy function name - now just calls the main function
tetra_toml_generate_env_enhanced() {
    tetra_toml_generate_env "$@"
}

# Export functions
export -f tetra_toml_generate_env
export -f tetra_toml_generate_env_enhanced
