#!/usr/bin/env bash

# Tetra Secrets Manager for TView
# Handles secret bubbling from dev → staging → prod based on devpages/env pattern

# Secrets management configuration
SECRETS_BASE_DIR="$(dirname "$(dirname "$(dirname "$TETRA_DIR")")")/devpages/env"  # ../devpages/env
TETRA_SECRETS_DIR="$TETRA_DIR/secrets"
ORG_SECRETS_TOML="$TETRA_DIR/secrets.toml"

# Environment precedence for secret inheritance
SECRETS_ENV_CHAIN=(
    "local"      # Base: development secrets, full access
    "dev"        # Dev: inherits from local, adds dev-specific
    "staging"    # Staging: inherits from dev, adds staging-specific
    "prod"       # Prod: inherits from staging, adds prod-specific
)

# Secret categories and their inheritance rules
declare -A SECRET_CATEGORIES=(
    ["database"]="env_specific"      # Each env has different DB
    ["api_keys"]="inherit_override"  # Inherit but can override
    ["ssh"]="env_specific"          # Each env has own SSH config
    ["storage"]="inherit_override"   # Inherit storage, override buckets
    ["ssl"]="env_specific"          # Each env has own certs
)

# Parse existing env files to understand secret structure
secrets_analyze_env_files() {
    local env="$1"
    local env_file="$SECRETS_BASE_DIR/${env}.env"

    if [[ ! -f "$env_file" ]]; then
        echo "Warning: Environment file not found: $env_file" >&2
        return 1
    fi

    echo "=== Analyzing $env environment secrets ==="

    # Parse environment variables
    while IFS= read -r line; do
        # Skip comments and empty lines
        [[ "$line" =~ ^[[:space:]]*# ]] && continue
        [[ "$line" =~ ^[[:space:]]*$ ]] && continue

        # Extract export statements
        if [[ "$line" =~ ^export[[:space:]]+([^=]+)=(.*)$ ]]; then
            local var_name="${BASH_REMATCH[1]}"
            local var_value="${BASH_REMATCH[2]}"

            # Remove comments from value
            var_value="${var_value%% #*}"

            # Categorize secret based on variable name
            local category=$(secrets_categorize_var "$var_name")
            echo "$category: $var_name = $var_value"
        fi
    done < "$env_file"
}

# Categorize a variable into secret categories
secrets_categorize_var() {
    local var_name="$1"

    case "$var_name" in
        *DATABASE*|*DB_*|*POSTGRES*|*MYSQL*) echo "database" ;;
        *API*|*KEY*|*SECRET*|*TOKEN*) echo "api_keys" ;;
        *SSH*|*HOST*|*USER*) echo "ssh" ;;
        *SPACES*|*BUCKET*|*S3*|*STORAGE*) echo "storage" ;;
        *SSL*|*TLS*|*CERT*) echo "ssl" ;;
        *PORT*|*NODE_ENV*|*ENV*) echo "app_config" ;;
        *) echo "misc" ;;
    esac
}

# Generate secrets.toml from existing env files
secrets_generate_org_config() {
    echo "Generating organization secrets configuration..."

    cat > "$ORG_SECRETS_TOML" << 'EOF'
# Tetra Organization Secrets Configuration
# Generated from existing devpages/env/* files
# This file should be encrypted/secured and not committed to git

[organization]
name = "tetra_org"
id = "org_001"
created = "TIMESTAMP_PLACEHOLDER"

# Secret inheritance rules
[inheritance]
# Environments inherit from previous in chain: local → dev → staging → prod
chain = ["local", "dev", "staging", "prod"]

# Categories and their inheritance behavior
[inheritance.rules]
database = "env_specific"      # Each environment has unique database
api_keys = "inherit_override"  # Inherit from previous, allow override
ssh = "env_specific"          # Each environment has unique SSH
storage = "inherit_override"   # Inherit storage config, override specifics
ssl = "env_specific"          # Each environment has unique certificates
app_config = "inherit_merge"   # Merge app configs with overrides

EOF

    # Replace timestamp
    sed -i.bak "s/TIMESTAMP_PLACEHOLDER/$(date -u +"%Y-%m-%dT%H:%M:%SZ")/" "$ORG_SECRETS_TOML"
    rm -f "$ORG_SECRETS_TOML.bak" 2>/dev/null

    # Add environment-specific sections
    for env in "${SECRETS_ENV_CHAIN[@]}"; do
        echo "Processing $env environment..."
        secrets_add_env_section "$env" >> "$ORG_SECRETS_TOML"
    done

    echo "✓ Organization secrets config generated: $ORG_SECRETS_TOML"
}

# Add environment section to secrets.toml
secrets_add_env_section() {
    local env="$1"
    local env_file="$SECRETS_BASE_DIR/${env}.env"

    echo ""
    echo "# $env Environment Secrets"
    echo "[secrets.$env]"
    echo "name = \"$(tr '[:lower:]' '[:upper:]' <<< ${env:0:1})${env:1} Environment\""

    [[ ! -f "$env_file" ]] && { echo "# No env file found"; return; }

    # Parse and categorize secrets
    local -A categories
    while IFS= read -r line; do
        [[ "$line" =~ ^[[:space:]]*# ]] && continue
        [[ "$line" =~ ^[[:space:]]*$ ]] && continue

        if [[ "$line" =~ ^export[[:space:]]+([^=]+)=(.*)$ ]]; then
            local var_name="${BASH_REMATCH[1]}"
            local var_value="${BASH_REMATCH[2]}"
            var_value="${var_value%% #*}"  # Remove comments

            local category=$(secrets_categorize_var "$var_name")
            categories["$category"]+="$var_name=$var_value"$'\n'
        fi
    done < "$env_file"

    # Output categorized secrets
    for category in "${!categories[@]}"; do
        echo ""
        echo "[$env.$category]"
        while IFS='=' read -r key value; do
            [[ -n "$key" ]] && echo "$key = \"$value\""
        done <<< "${categories[$category]}"
    done
}

# Bubble secrets from one environment to another
secrets_bubble_to_env() {
    local source_env="$1"
    local target_env="$2"
    local category="${3:-all}"

    echo "Bubbling secrets from $source_env → $target_env (category: $category)"

    local source_file="$SECRETS_BASE_DIR/${source_env}.env"
    local target_file="$SECRETS_BASE_DIR/${target_env}.env"

    if [[ ! -f "$source_file" ]]; then
        echo "Error: Source env file not found: $source_file" >&2
        return 1
    fi

    # Create backup of target
    [[ -f "$target_file" ]] && cp "$target_file" "${target_file}.backup.$(date +%Y%m%d_%H%M%S)"

    # Create target directory if needed
    mkdir -p "$(dirname "$target_file")"

    echo "# Environment: $target_env" > "$target_file"
    echo "# Inherited from: $source_env on $(date)" >> "$target_file"
    echo "" >> "$target_file"

    # Copy secrets based on inheritance rules
    while IFS= read -r line; do
        [[ "$line" =~ ^[[:space:]]*# ]] && continue
        [[ "$line" =~ ^[[:space:]]*$ ]] && continue

        if [[ "$line" =~ ^export[[:space:]]+([^=]+)=(.*)$ ]]; then
            local var_name="${BASH_REMATCH[1]}"
            local var_value="${BASH_REMATCH[2]}"

            local var_category=$(secrets_categorize_var "$var_name")

            # Apply inheritance rules
            case "${SECRET_CATEGORIES[$var_category]:-inherit_override}" in
                "env_specific")
                    # Skip - each environment should define its own
                    continue
                    ;;
                "inherit_override"|"inherit_merge")
                    # Include if category matches or all categories requested
                    if [[ "$category" == "all" || "$category" == "$var_category" ]]; then
                        echo "$line" >> "$target_file"
                    fi
                    ;;
            esac
        fi
    done < "$source_file"

    echo "✓ Secrets bubbled to $target_file"
}

# Validate secret consistency across environments
secrets_validate_chain() {
    echo "Validating secret inheritance chain..."

    for i in "${!SECRETS_ENV_CHAIN[@]}"; do
        local env="${SECRETS_ENV_CHAIN[$i]}"
        local env_file="$SECRETS_BASE_DIR/${env}.env"

        echo "Checking $env environment..."

        if [[ ! -f "$env_file" ]]; then
            echo "  ⚠️  Missing env file: $env_file"
            continue
        fi

        # Check for required secrets in each environment
        case "$env" in
            "local")
                secrets_check_required_vars "$env_file" "NODE_ENV" "PORT"
                ;;
            "dev")
                secrets_check_required_vars "$env_file" "NODE_ENV" "PORT" "DO_SPACES_KEY"
                ;;
            "staging")
                secrets_check_required_vars "$env_file" "NODE_ENV" "PORT"
                ;;
            "prod")
                secrets_check_required_vars "$env_file" "NODE_ENV" "PORT"
                ;;
        esac
    done
}

# Check if required variables exist in env file
secrets_check_required_vars() {
    local env_file="$1"
    shift
    local required_vars=("$@")

    for var in "${required_vars[@]}"; do
        if grep -q "^export $var=" "$env_file"; then
            echo "  ✓ $var present"
        else
            echo "  ✗ $var missing"
        fi
    done
}

# TView integration - get secret status for environment
secrets_get_env_status() {
    local env="$1"
    local env_file="$SECRETS_BASE_DIR/${env}.env"

    if [[ ! -f "$env_file" ]]; then
        echo "missing"
        return 1
    fi

    # Count secrets by category
    local total_secrets=0
    local categories=()

    while IFS= read -r line; do
        if [[ "$line" =~ ^export[[:space:]]+([^=]+)= ]]; then
            ((total_secrets++))
            local category=$(secrets_categorize_var "${BASH_REMATCH[1]}")
            [[ ! " ${categories[*]} " =~ " $category " ]] && categories+=("$category")
        fi
    done < "$env_file"

    if [[ $total_secrets -eq 0 ]]; then
        echo "empty"
    elif [[ $total_secrets -lt 3 ]]; then
        echo "minimal"
    else
        echo "configured"
    fi

    # Return additional info
    echo "total:$total_secrets categories:${#categories[@]}" >&2
}

# Generate TKM-compatible SSH config from secrets
secrets_generate_ssh_config() {
    local env="$1"
    local output_file="$HOME/.ssh/config.tetra_${env}"

    echo "Generating SSH config for $env environment..."

    # Extract SSH info from secrets.toml
    if [[ -f "$ORG_SECRETS_TOML" ]]; then
        echo "# Tetra SSH Config for $env" > "$output_file"
        echo "# Generated on $(date)" >> "$output_file"
        echo "" >> "$output_file"

        # Parse TOML for SSH section (simple parsing)
        local in_ssh_section=false
        while IFS= read -r line; do
            if [[ "$line" =~ ^\[ssh\.$env\]$ ]]; then
                in_ssh_section=true
                continue
            elif [[ "$line" =~ ^\[.*\]$ ]]; then
                in_ssh_section=false
                continue
            fi

            if [[ "$in_ssh_section" == true && "$line" =~ ^([^=]+)=(.*)$ ]]; then
                local key="${BASH_REMATCH[1]// /}"
                local value="${BASH_REMATCH[2]}"
                value="${value#\"}"
                value="${value%\"}"

                case "$key" in
                    "host") echo "Host tetra-$env" >> "$output_file"
                           echo "  HostName $value" >> "$output_file" ;;
                    "user_env") echo "  User $value" >> "$output_file" ;;
                    "port") echo "  Port $value" >> "$output_file" ;;
                    "private_key_path") echo "  IdentityFile $value" >> "$output_file" ;;
                esac
            fi
        done < "$ORG_SECRETS_TOML"

        echo "✓ SSH config generated: $output_file"
    fi
}

# Initialize secrets management
secrets_init() {
    echo "Initializing Tetra secrets management..."

    # Create secrets directory
    mkdir -p "$TETRA_SECRETS_DIR"

    # Generate organization config if it doesn't exist
    [[ ! -f "$ORG_SECRETS_TOML" ]] && secrets_generate_org_config

    echo "✓ Secrets management initialized"
}

# Main CLI interface
case "${1:-help}" in
    "analyze")
        secrets_analyze_env_files "${2:-local}"
        ;;
    "generate")
        secrets_generate_org_config
        ;;
    "bubble")
        secrets_bubble_to_env "$2" "$3" "${4:-all}"
        ;;
    "validate")
        secrets_validate_chain
        ;;
    "status")
        secrets_get_env_status "${2:-local}"
        ;;
    "ssh-config")
        secrets_generate_ssh_config "${2:-dev}"
        ;;
    "init")
        secrets_init
        ;;
    *)
        echo "Tetra Secrets Manager"
        echo ""
        echo "USAGE:"
        echo "  secrets_manager.sh analyze [env]     - Analyze environment secrets"
        echo "  secrets_manager.sh generate          - Generate secrets.toml from env files"
        echo "  secrets_manager.sh bubble src dest   - Bubble secrets between environments"
        echo "  secrets_manager.sh validate          - Validate secret chain consistency"
        echo "  secrets_manager.sh status [env]      - Get secret status for environment"
        echo "  secrets_manager.sh ssh-config [env]  - Generate SSH config from secrets"
        echo "  secrets_manager.sh init              - Initialize secrets management"
        ;;
esac