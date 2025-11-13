#!/usr/bin/env bash

# Tetra Secrets Manager
# Manages secrets.env files for organizations
# Location: $TETRA_DIR/orgs/${org_name}/secrets.env

# Initialize secrets.env for an organization
tetra_secrets_init() {
    local org_name="$1"
    local force="${2:-false}"

    if [[ -z "$org_name" ]]; then
        echo "Error: Organization name required" >&2
        return 1
    fi

    local org_dir="$TETRA_DIR/orgs/$org_name"
    local secrets_file="$org_dir/secrets.env"

    if [[ ! -d "$org_dir" ]]; then
        echo "Error: Organization directory not found: $org_dir" >&2
        return 1
    fi

    # Check if secrets file already exists
    if [[ -f "$secrets_file" && "$force" != "true" ]]; then
        echo "⚠️  Secrets file already exists: $secrets_file"
        echo "Use --force to overwrite"
        return 1
    fi

    # Create secrets template
    cat > "$secrets_file" << 'EOF'
# Secrets for organization: {{ORG_NAME}}
# IMPORTANT: Do NOT commit this file to git
# Add to .gitignore: org/*/secrets.env

# ═══════════════════════════════════════════════════════════
# DATABASE CREDENTIALS
# ═══════════════════════════════════════════════════════════
DB_HOST=
DB_PORT=5432
DB_NAME=
DB_USER=
DB_PASSWORD=

# ═══════════════════════════════════════════════════════════
# API KEYS & TOKENS
# ═══════════════════════════════════════════════════════════
API_KEY=
API_SECRET=
JWT_SECRET=
SESSION_SECRET=

# ═══════════════════════════════════════════════════════════
# EXTERNAL SERVICES
# ═══════════════════════════════════════════════════════════
STRIPE_SECRET_KEY=
SENDGRID_API_KEY=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# ═══════════════════════════════════════════════════════════
# OAUTH CREDENTIALS
# ═══════════════════════════════════════════════════════════
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# ═══════════════════════════════════════════════════════════
# ENVIRONMENT OVERRIDES
# ═══════════════════════════════════════════════════════════
# DEV_DB_PASSWORD=
# STAGING_DB_PASSWORD=
# PROD_DB_PASSWORD=
EOF

    # Replace placeholders
    sed -i '' "s/{{ORG_NAME}}/$org_name/g" "$secrets_file"

    # Set restrictive permissions
    chmod 600 "$secrets_file"

    echo "✅ Secrets file initialized: $secrets_file"
    echo "📝 Edit this file to add your secrets"
    echo "🔒 File permissions set to 600 (owner read/write only)"
    echo ""
    echo "⚠️  IMPORTANT: Add to .gitignore:"
    echo "    echo 'org/*/secrets.env' >> .gitignore"

    return 0
}

# Validate secrets.env exists and has required secrets
tetra_secrets_validate() {
    local org_name="$1"
    local required_vars="${2:-}"

    if [[ -z "$org_name" ]]; then
        echo "Error: Organization name required" >&2
        return 1
    fi

    local org_dir="$TETRA_DIR/orgs/$org_name"
    local secrets_file="$org_dir/secrets.env"

    if [[ ! -f "$secrets_file" ]]; then
        echo "❌ Secrets file not found: $secrets_file"
        echo "Run: tetra org secrets init $org_name"
        return 1
    fi

    # Check file permissions
    local perms
    perms=$(stat -f "%Lp" "$secrets_file" 2>/dev/null || stat -c "%a" "$secrets_file" 2>/dev/null)
    if [[ "$perms" != "600" ]]; then
        echo "⚠️  WARNING: Secrets file has insecure permissions: $perms"
        echo "Fixing permissions to 600..."
        chmod 600 "$secrets_file"
    fi

    # Check for empty values
    local empty_secrets=()
    while IFS='=' read -r key value; do
        # Skip comments and empty lines
        [[ "$key" =~ ^[[:space:]]*# ]] && continue
        [[ -z "$key" ]] && continue

        # Check if value is empty
        value=$(echo "$value" | xargs)
        if [[ -z "$value" ]]; then
            empty_secrets+=("$key")
        fi
    done < "$secrets_file"

    if [[ ${#empty_secrets[@]} -gt 0 ]]; then
        echo "⚠️  Found ${#empty_secrets[@]} empty secret(s):"
        for secret in "${empty_secrets[@]}"; do
            echo "  - $secret"
        done
        echo ""
        echo "Edit: $secrets_file"
        return 1
    fi

    echo "✅ Secrets file validated: $secrets_file"
    return 0
}

# Load secrets into environment
tetra_secrets_load() {
    local org_name="$1"
    local environment="${2:-}"

    if [[ -z "$org_name" ]]; then
        echo "Error: Organization name required" >&2
        return 1
    fi

    local org_dir="$TETRA_DIR/orgs/$org_name"
    local secrets_file="$org_dir/secrets.env"

    if [[ ! -f "$secrets_file" ]]; then
        echo "Error: Secrets file not found: $secrets_file" >&2
        return 1
    fi

    # Load secrets into environment
    set -a
    source "$secrets_file"
    set +a

    # Load environment-specific overrides if specified
    if [[ -n "$environment" ]]; then
        local env_prefix="${environment^^}_"
        while IFS='=' read -r key value; do
            # Skip comments and empty lines
            [[ "$key" =~ ^[[:space:]]*# ]] && continue
            [[ -z "$key" ]] && continue

            # Check if this is an environment-specific variable
            if [[ "$key" =~ ^${env_prefix} ]]; then
                local base_var="${key#$env_prefix}"
                export "$base_var=$value"
            fi
        done < "$secrets_file"
    fi

    echo "✅ Secrets loaded for: $org_name${environment:+ ($environment)}"
    return 0
}

# List available secrets (keys only, no values)
tetra_secrets_list() {
    local org_name="$1"

    if [[ -z "$org_name" ]]; then
        echo "Error: Organization name required" >&2
        return 1
    fi

    local org_dir="$TETRA_DIR/orgs/$org_name"
    local secrets_file="$org_dir/secrets.env"

    if [[ ! -f "$secrets_file" ]]; then
        echo "Error: Secrets file not found: $secrets_file" >&2
        return 1
    fi

    echo "Secrets for $org_name:"
    echo ""

    local current_section=""
    while IFS='=' read -r key value; do
        # Check for section headers
        if [[ "$key" =~ ^#[[:space:]]*═+ ]]; then
            continue
        fi

        if [[ "$key" =~ ^#[[:space:]]*([A-Z][A-Z\ ]+)$ ]]; then
            current_section="${BASH_REMATCH[1]}"
            echo "[$current_section]"
            continue
        fi

        # Skip other comments and empty lines
        [[ "$key" =~ ^[[:space:]]*# ]] && continue
        [[ -z "$key" ]] && continue

        # Check if value is set
        value=$(echo "$value" | xargs)
        if [[ -z "$value" ]]; then
            echo "  - $key (empty)"
        else
            echo "  ✓ $key (set)"
        fi
    done < "$secrets_file"

    return 0
}

# Copy secrets from one org to another
tetra_secrets_copy() {
    local source_org="$1"
    local target_org="$2"

    if [[ -z "$source_org" || -z "$target_org" ]]; then
        echo "Error: Source and target organization names required" >&2
        echo "Usage: tetra secrets copy <source_org> <target_org>" >&2
        return 1
    fi

    local source_file="$TETRA_DIR/orgs/$source_org/secrets.env"
    local target_file="$TETRA_DIR/orgs/$target_org/secrets.env"

    if [[ ! -f "$source_file" ]]; then
        echo "Error: Source secrets file not found: $source_file" >&2
        return 1
    fi

    if [[ -f "$target_file" ]]; then
        echo "⚠️  Target secrets file already exists: $target_file"
        echo -n "Overwrite? [y/N]: "
        read -r response
        if [[ "${response,,}" != "y" ]]; then
            echo "Cancelled"
            return 1
        fi
    fi

    # Copy secrets file
    cp "$source_file" "$target_file"
    chmod 600 "$target_file"

    # Update org name in file
    sed -i '' "s/organization: $source_org/organization: $target_org/g" "$target_file"

    echo "✅ Secrets copied from $source_org to $target_org"
    return 0
}

# Resolve environment variables in TOML content
# Expands ${VAR_NAME} references to their environment values
tetra_secrets_resolve_toml() {
    local toml_file="$1"
    local output_file="${2:-}"

    if [[ -z "$toml_file" ]]; then
        echo "Error: TOML file path required" >&2
        return 1
    fi

    if [[ ! -f "$toml_file" ]]; then
        echo "Error: TOML file not found: $toml_file" >&2
        return 1
    fi

    # Read the TOML and expand variables
    local resolved_content
    resolved_content=$(envsubst < "$toml_file")

    # Output to file or stdout
    if [[ -n "$output_file" ]]; then
        echo "$resolved_content" > "$output_file"
        echo "✅ Resolved TOML written to: $output_file"
    else
        echo "$resolved_content"
    fi

    return 0
}

# Load secrets and resolve TOML in one step
# Returns resolved TOML content with secrets expanded
tetra_secrets_resolve() {
    local org_name="$1"
    local output_file="${2:-}"

    if [[ -z "$org_name" ]]; then
        echo "Error: Organization name required" >&2
        return 1
    fi

    local org_dir="$TETRA_DIR/orgs/$org_name"
    local secrets_file="$org_dir/secrets.env"
    local toml_file="$org_dir/tetra.toml"

    if [[ ! -f "$secrets_file" ]]; then
        echo "Error: Secrets file not found: $secrets_file" >&2
        echo "Run: tetra org secrets init $org_name" >&2
        return 1
    fi

    if [[ ! -f "$toml_file" ]]; then
        echo "Error: TOML file not found: $toml_file" >&2
        return 1
    fi

    # Load secrets into environment (in subshell to avoid polluting parent)
    (
        set -a
        source "$secrets_file"
        set +a

        # Resolve TOML with loaded secrets
        tetra_secrets_resolve_toml "$toml_file" "$output_file"
    )
}

# Export functions
export -f tetra_secrets_init
export -f tetra_secrets_validate
export -f tetra_secrets_load
export -f tetra_secrets_list
export -f tetra_secrets_copy
export -f tetra_secrets_resolve_toml
export -f tetra_secrets_resolve

# CLI interface
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    case "${1:-help}" in
        init)
            shift
            tetra_secrets_init "$@"
            ;;
        validate)
            shift
            tetra_secrets_validate "$@"
            ;;
        load)
            shift
            tetra_secrets_load "$@"
            ;;
        list)
            shift
            tetra_secrets_list "$@"
            ;;
        copy)
            shift
            tetra_secrets_copy "$@"
            ;;
        resolve)
            shift
            tetra_secrets_resolve "$@"
            ;;
        help|--help|-h)
            cat << EOF
Tetra Secrets Manager

USAGE:
    secrets_manager.sh <command> [options]

COMMANDS:
    init <org_name> [--force]
        Initialize a new secrets.env file for an organization

    validate <org_name>
        Validate that secrets.env exists and check for empty values

    load <org_name> [environment]
        Load secrets into the current shell environment

    list <org_name>
        List all secret keys (without values)

    copy <source_org> <target_org>
        Copy secrets from one organization to another

    resolve <org_name> [output_file]
        Load secrets.env and resolve ${VAR} references in tetra.toml
        Output to file or stdout if no output_file specified

    help
        Show this help

EXAMPLES:
    secrets_manager.sh init my-org
    secrets_manager.sh validate my-org
    secrets_manager.sh load my-org prod
    secrets_manager.sh list my-org
    secrets_manager.sh copy my-org my-org-staging
    secrets_manager.sh resolve my-org                    # Output to stdout
    secrets_manager.sh resolve my-org /tmp/resolved.toml # Save to file

SECURITY NOTES:
    - Secrets files are created with 600 permissions (owner read/write only)
    - Always add 'orgs/*/secrets.env' to .gitignore
    - Never commit secrets to version control
    - tetra.toml uses ${VAR_NAME} references, resolved at runtime from secrets.env
EOF
            ;;
        *)
            echo "Unknown command: $1"
            echo "Use 'secrets_manager.sh help' for usage information"
            exit 1
            ;;
    esac
fi
