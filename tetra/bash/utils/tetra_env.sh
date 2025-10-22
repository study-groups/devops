#!/usr/bin/env bash

# Tetra Secure Environment Management System
# Implements template-based environment management that never commits secrets

# Source centralized TOML parser
TOML_PARSER="${TETRA_SRC}/bash/utils/toml_parser.sh"
if [[ -f "$TOML_PARSER" ]]; then
    source "$TOML_PARSER"
fi

# Main tetra env command
tetra_env() {
    local command="${1:-}"

    case "$command" in
        "init")
            tetra_env_init "${2:-}"
            ;;
        "list")
            tetra_env_list
            ;;
        "validate")
            tetra_env_validate "${2:-}"
            ;;
        "templates")
            tetra_env_templates
            ;;
        "toml")
            tetra_env_toml "${@:2}"
            ;;
        *)
            tetra_env_help
            return 1
            ;;
    esac
}

# Initialize environment file from template or TOML
tetra_env_init() {
    local env="${1:-local}"
    local target_file="env/${env}.env"
    local toml_file="tetra.toml"

    # Check if tetra.toml exists and use enhanced TOML generation
    if [[ -f "$toml_file" ]]; then
        echo "🔧 Using tetra.toml for environment generation"
        echo "🎯 Target: $target_file"
        echo

        # Source the TOML parser
        if ! source "$TETRA_SRC/bash/deploy/toml.sh"; then
            echo "❌ Failed to load TOML parser"
            return 1
        fi

        # Check if target exists
        if [[ -f "$target_file" ]]; then
            echo "⚠️  Warning: $target_file already exists"
            read -p "Overwrite? (y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                echo "Cancelled"
                return 1
            fi
        fi

        # Ensure env directory exists
        mkdir -p env

        # Generate environment file from TOML with variable resolution
        echo "🔄 Generating $target_file from tetra.toml..."
        if tetra_toml_generate_env_enhanced "$toml_file" "$env" > "$target_file"; then
            echo "✅ Created $target_file from tetra.toml"
            echo
            echo "📋 Generated variables:"
            grep "^export" "$target_file" | sed 's/export /  /' | head -10
            if [[ $(grep -c "^export" "$target_file") -gt 10 ]]; then
                echo "  ... and $(($(grep -c "^export" "$target_file") - 10)) more"
            fi
            echo

            # Check for placeholders
            if grep -q "PLACEHOLDER.*_HERE" "$target_file"; then
                echo "⚠️  IMPORTANT: Found placeholder values that need real secrets:"
                grep "PLACEHOLDER.*_HERE" "$target_file" | sed 's/export /  /'
                echo
                echo "Set environment variables and regenerate:"
                grep "PLACEHOLDER.*_HERE" "$target_file" | sed 's/.*PLACEHOLDER_\(.*\)_HERE.*/  export \1="your_secret_here"/'
                echo "  tetra env init $env"
            else
                echo "✅ All secrets resolved successfully"
            fi
        else
            echo "❌ Failed to generate $target_file from TOML"
            return 1
        fi

    else
        # Fallback to template-based generation
        local template_file="env/${env}.env.tmpl"

        if [[ ! -f "$template_file" ]]; then
            echo "❌ Neither tetra.toml nor template found"
            echo "Missing: $toml_file and $template_file"
            echo
            echo "Available templates:"
            ls env/*.env.tmpl 2>/dev/null || echo "  No templates found"
            echo
            echo "💡 Create tetra.toml for enhanced configuration management"
            return 1
        fi

        if [[ -f "$target_file" ]]; then
            echo "Warning: $target_file already exists"
            read -p "Overwrite? (y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                echo "Cancelled"
                return 1
            fi
        fi

        cp "$template_file" "$target_file"
        echo "✅ Created $target_file from $template_file"
        echo
        echo "⚠️  IMPORTANT: Edit $target_file and replace placeholder values with real secrets"
    fi

    echo "⚠️  Never commit $target_file to git - it's protected by .gitignore"
    echo
    echo "Next steps:"
    echo "  1. Edit $target_file with your actual secrets (if needed)"
    echo "  2. Use: tsm start --env env/${env}.env your-script.sh"
}

# List available templates and environment files
tetra_env_list() {
    echo "📋 Environment Templates (safe to commit):"
    echo
    for template in env/*.env.tmpl; do
        if [[ -f "$template" ]]; then
            local env_name=$(basename "$template" .env.tmpl)
            echo "  📄 $template → $env_name environment"
        fi
    done

    echo
    echo "🔒 Local Environment Files (never committed):"
    echo
    local found_env=false
    for env_file in env/*.env; do
        if [[ -f "$env_file" && "$env_file" != "env/*.env" ]]; then
            local env_name=$(basename "$env_file" .env)
            echo "  🔑 $env_file (secrets for $env_name)"
            found_env=true
        fi
    done

    if [[ "$found_env" == false ]]; then
        echo "  No environment files found"
        echo "  Use: tetra env init <environment> to create from template"
    fi
}

# Show available templates
tetra_env_templates() {
    echo "📋 Available Environment Templates:"
    echo
    for template in env/*.env.tmpl; do
        if [[ -f "$template" ]]; then
            local env_name=$(basename "$template" .env.tmpl)
            echo "  📄 $env_name - $template"
            echo "     Initialize with: tetra env init $env_name"
        fi
    done
}

# Validate environment file
tetra_env_validate() {
    local env="${1:-local}"
    local env_file="env/${env}.env"

    if [[ ! -f "$env_file" ]]; then
        echo "❌ Environment file not found: $env_file"
        echo "Create it with: tetra env init $env"
        return 1
    fi

    echo "🔍 Validating environment file: $env_file"
    echo

    local errors=0
    local warnings=0

    # Check for placeholder values that weren't replaced
    if grep -q "your_.*_here\|your-.*-name" "$env_file"; then
        echo "❌ Found placeholder values that need to be replaced:"
        grep "your_.*_here\|your-.*-name" "$env_file" | head -5
        ((errors++))
    fi

    # Check for required variables
    local required_vars=("NODE_ENV" "PORT" "TETRA_ENV")
    for var in "${required_vars[@]}"; do
        if ! grep -q "^export $var=" "$env_file"; then
            echo "❌ Missing required variable: $var"
            ((errors++))
        fi
    done

    # Check for potential security issues
    if grep -q "password\|secret\|key" "$env_file" | grep -q "test\|example\|placeholder"; then
        echo "⚠️  Warning: Found test/placeholder secrets"
        ((warnings++))
    fi

    echo
    echo "📊 Validation summary:"
    echo "  Errors: $errors"
    echo "  Warnings: $warnings"

    if [[ $errors -eq 0 ]]; then
        echo "✅ Environment file is valid"
        return 0
    else
        echo "❌ Environment file has errors"
        return 1
    fi
}

# Help function
tetra_env_help() {
    cat <<'EOF'
🔒 Tetra Secure Environment Management

Usage: tetra env <command> [options]

Commands:
  init <env>        Create environment file from template
  list              Show templates and environment files
  templates         Show available templates
  validate [env]    Validate environment file (default: local)

Examples:
  tetra env init dev          # Create env/dev.env from env/dev.env.tmpl
  tetra env init staging      # Create env/staging.env from env/staging.env.tmpl
  tetra env list              # Show all templates and environment files
  tetra env validate dev      # Check env/dev.env for issues

Security Features:
  ✅ Templates are safe to commit (no secrets)
  ✅ Environment files are never committed (.gitignore protected)
  ✅ No secret promotion between environments
  ✅ Validation catches placeholder values

Workflow:
  1. Copy template: tetra env init dev
  2. Edit secrets: edit env/dev.env (add real API keys, etc.)
  3. Use environment: tsm start --env dev server.js
  4. Never commit: env/*.env files are gitignore protected

Templates define structure, local files contain secrets.
EOF
}

# TOML management functions
tetra_env_toml() {
    local action="${1:-}"

    case "$action" in
        "sync")
            tetra_env_toml_sync_nh
            ;;
        "show")
            tetra_env_toml_show "${2:-}"
            ;;
        "validate")
            tetra_env_toml_validate
            ;;
        "ufw")
            tetra_env_toml_ufw "${@:3}"
            ;;
        *)
            tetra_env_toml_help
            return 1
            ;;
    esac
}

# Sync NH infrastructure data to tetra.toml
tetra_env_toml_sync_nh() {
    local toml_file="tetra.toml"
    local nh_context="${DIGITALOCEAN_CONTEXT:-pixeljam-arcade}"
    local nh_env_file="$HOME/nh/$nh_context/digocean.env"

    if [[ ! -f "$nh_env_file" ]]; then
        echo "❌ NH environment file not found: $nh_env_file"
        echo "Run 'pj' to load NH context first"
        return 1
    fi

    if [[ ! -f "$toml_file" ]]; then
        echo "❌ tetra.toml not found"
        echo "Create it first or run from tetra root directory"
        return 1
    fi

    echo "🔄 Syncing NH infrastructure data to $toml_file..."
    echo "📍 NH Context: $nh_context"
    echo "📁 NH Data: $nh_env_file"
    echo

    # Create temporary file for updated TOML
    local temp_file="${toml_file}.tmp"
    cp "$toml_file" "$temp_file"

    # Extract infrastructure data from NH
    echo "🔍 Extracting infrastructure data from NH..."

    # Parse NH variables and update TOML infrastructure section
    while IFS='=' read -r var_name var_value; do
        # Skip empty lines and comments
        [[ -z "$var_name" || "$var_name" =~ ^[[:space:]]*# ]] && continue

        # Remove 'export ' prefix
        var_name="${var_name#export }"

        # Remove quotes and comments from value
        var_value="${var_value%% #*}"
        var_value="${var_value//\"/}"

        # Map NH variables to TOML infrastructure section
        case "$var_name" in
            pxjam_arcade_qa01)
                sed -i '' "s/qa_ip = .*/qa_ip = \"$var_value\"/" "$temp_file"
                ;;
            pxjam_arcade_qa01_private)
                sed -i '' "s/qa_private_ip = .*/qa_private_ip = \"$var_value\"/" "$temp_file"
                ;;
            pxjam_arcade_qa01_floating)
                sed -i '' "s/qa_floating_ip = .*/qa_floating_ip = \"$var_value\"/" "$temp_file"
                ;;
            pxjam_arcade_dev01)
                sed -i '' "s/dev_ip = .*/dev_ip = \"$var_value\"/" "$temp_file"
                ;;
            pxjam_arcade_dev01_private)
                sed -i '' "s/dev_private_ip = .*/dev_private_ip = \"$var_value\"/" "$temp_file"
                ;;
            pxjam_arcade_prod01)
                sed -i '' "s/prod_ip = .*/prod_ip = \"$var_value\"/" "$temp_file"
                ;;
            pxjam_arcade_prod01_private)
                sed -i '' "s/prod_private_ip = .*/prod_private_ip = \"$var_value\"/" "$temp_file"
                ;;
            pxjam_arcade_prod01_floating)
                sed -i '' "s/prod_floating_ip = .*/prod_floating_ip = \"$var_value\"/" "$temp_file"
                ;;
        esac
    done < "$nh_env_file"

    # Replace original file
    mv "$temp_file" "$toml_file"

    echo "✅ Infrastructure data synced successfully"
    echo
    echo "📋 Updated infrastructure section:"
    toml_parse "$toml_file" "INFRA" >/dev/null 2>&1
    local keys
    keys=$(toml_keys "infrastructure" "INFRA" 2>/dev/null || echo "")
    if [[ -n "$keys" ]]; then
        while IFS= read -r key; do
            local value
            value=$(toml_get "infrastructure" "$key" "INFRA" 2>/dev/null)
            echo "  $key = $value"
        done <<< "$keys"
    fi
}

# Show TOML section or variable
tetra_env_toml_show() {
    local section="${1:-}"
    local toml_file="tetra.toml"

    if [[ ! -f "$toml_file" ]]; then
        echo "❌ tetra.toml not found"
        return 1
    fi

    if [[ -z "$section" ]]; then
        echo "📋 tetra.toml sections:"
        toml_parse "$toml_file" "SHOW" >/dev/null 2>&1
        local sections
        sections=$(toml_sections "SHOW" 2>/dev/null)
        if [[ -n "$sections" ]]; then
            while IFS= read -r sec; do
                echo "  $sec"
            done <<< "$sections"
        fi
        return 0
    fi

    echo "📋 [$section] section:"
    toml_parse "$toml_file" "SHOW" >/dev/null 2>&1
    local keys
    keys=$(toml_keys "${section//./_}" "SHOW" 2>/dev/null)
    if [[ -n "$keys" ]]; then
        while IFS= read -r key; do
            local value
            value=$(toml_get "${section//./_}" "$key" "SHOW" 2>/dev/null)
            echo "  $key = $value"
        done <<< "$keys"
    fi
}

# Validate tetra.toml structure
tetra_env_toml_validate() {
    local toml_file="tetra.toml"

    if [[ ! -f "$toml_file" ]]; then
        echo "❌ tetra.toml not found"
        return 1
    fi

    echo "🔍 Validating tetra.toml structure..."

    local errors=0

    # Check required sections
    local required_sections=("infrastructure" "variables" "environments.local" "environments.dev" "environments.staging" "environments.prod")

    for section in "${required_sections[@]}"; do
        if ! grep -q "^\[$section\]" "$toml_file"; then
            echo "❌ Missing required section: [$section]"
            ((errors++))
        fi
    done

    # Check for variable references without definition
    if grep -q '\${variables\.' "$toml_file"; then
        echo "✓ Found variable references"

        # Extract variable references and check if they're defined
        grep -o '\${variables\.[^}]*}' "$toml_file" | sort -u | while read -r var_ref; do
            var_name="${var_ref#\${variables.}"
            var_name="${var_name%}}"

            toml_parse "$toml_file" "VAL" >/dev/null 2>&1
            if ! toml_get "variables" "$var_name" "VAL" >/dev/null 2>&1; then
                echo "❌ Undefined variable reference: $var_ref"
                ((errors++))
            fi
        done
    fi

    if [[ $errors -eq 0 ]]; then
        echo "✅ tetra.toml validation passed"
        return 0
    else
        echo "❌ tetra.toml validation failed ($errors errors)"
        return 1
    fi
}

# UFW firewall management from tetra.toml
tetra_env_toml_ufw() {
    local action="${1:-show}"
    local environment="${2:-}"
    local toml_file="tetra.toml"

    if [[ ! -f "$toml_file" ]]; then
        echo "❌ tetra.toml not found"
        return 1
    fi

    case "$action" in
        "show")
            tetra_env_toml_ufw_show "$environment"
            ;;
        "apply")
            tetra_env_toml_ufw_apply "$environment"
            ;;
        "status")
            tetra_env_toml_ufw_status
            ;;
        *)
            tetra_env_toml_ufw_help
            return 1
            ;;
    esac
}

# Show UFW rules for environment
tetra_env_toml_ufw_show() {
    local environment="${1:-}"
    local toml_file="tetra.toml"

    if [[ -z "$environment" ]]; then
        echo "🔥 UFW rules defined in tetra.toml:"
        echo
        for env in dev staging prod; do
            echo "[$env]:"
            tetra_env_toml_ufw_extract_rules "$env"
            echo
        done
        return 0
    fi

    echo "🔥 UFW rules for [$environment]:"
    tetra_env_toml_ufw_extract_rules "$environment"
}

# Extract and resolve UFW rules from TOML
tetra_env_toml_ufw_extract_rules() {
    local environment="$1"
    local toml_file="tetra.toml"

    # Extract ufw_rules array from environment section
    local rules_line
    rules_line=$(awk -v env="[environments.$environment]" '
        $0 == env {flag=1; next}
        /^\[/{flag=0}
        flag && /^ufw_rules *= *\[/ {
            # Handle single line array
            if (/\]/) {
                print $0
                exit
            } else {
                # Handle multi-line array
                line = $0
                while (getline > 0 && !/\]/) {
                    line = line " " $0
                }
                line = line " " $0
                print line
                exit
            }
        }
    ' "$toml_file")

    if [[ -z "$rules_line" ]]; then
        echo "  No UFW rules defined"
        return 0
    fi

    # Extract rules from array format: ufw_rules = ["rule1", "rule2"]
    local rules
    rules=$(echo "$rules_line" | sed 's/.*\[\(.*\)\].*/\1/' | sed 's/"//g' | tr ',' '\n')

    # Resolve variables in rules
    while IFS= read -r rule; do
        rule=$(echo "$rule" | xargs)  # Trim whitespace
        [[ -z "$rule" ]] && continue

        # Resolve ${variables.*} references
        while [[ "$rule" =~ \$\{variables\.([^}]+)\} ]]; do
            local var_name="${BASH_REMATCH[1]}"
            local var_value

            var_value=$(awk -v var="$var_name" '
                /^\[variables\]/{flag=1; next}
                /^\[/{flag=0}
                flag && $1 == var {
                    sub(/^[^=]*= */, "")
                    gsub(/"/, "")
                    print $0
                    exit
                }
            ' "$toml_file")

            if [[ -n "$var_value" ]]; then
                rule="${rule/\${variables.${var_name}}/$var_value}"
            else
                echo "  ❌ Undefined variable: \${variables.${var_name}}"
                continue 2
            fi
        done

        echo "  ufw allow $rule"
    done <<< "$rules"
}

# Apply UFW rules for environment
tetra_env_toml_ufw_apply() {
    local environment="$1"

    if [[ -z "$environment" ]]; then
        echo "Usage: tetra env toml ufw apply <environment>"
        echo "Example: tetra env toml ufw apply dev"
        return 1
    fi

    echo "🔥 Applying UFW rules for [$environment]..."
    echo

    # Check if UFW is installed
    if ! command -v ufw >/dev/null 2>&1; then
        echo "❌ UFW not installed"
        echo "Install with: sudo apt install ufw"
        return 1
    fi

    # Get current UFW status
    if ! sudo ufw status >/dev/null 2>&1; then
        echo "❌ UFW not accessible (need sudo?)"
        return 1
    fi

    # Show rules that will be applied
    echo "📋 Rules to apply:"
    tetra_env_toml_ufw_extract_rules "$environment"
    echo

    # Confirm application
    read -p "Apply these UFW rules? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cancelled"
        return 0
    fi

    # Apply rules
    echo "🔄 Applying rules..."
    local rules_applied=0
    local rules_failed=0

    while IFS= read -r rule_line; do
        [[ -z "$rule_line" ]] && continue

        # Extract rule from "  ufw allow rule" format
        local rule
        rule=$(echo "$rule_line" | sed 's/^[[:space:]]*ufw allow //')

        if sudo ufw allow "$rule" >/dev/null 2>&1; then
            echo "✅ Applied: ufw allow $rule"
            ((rules_applied++))
        else
            echo "❌ Failed: ufw allow $rule"
            ((rules_failed++))
        fi
    done < <(tetra_env_toml_ufw_extract_rules "$environment")

    echo
    echo "📊 Summary:"
    echo "  Applied: $rules_applied rules"
    echo "  Failed: $rules_failed rules"

    if [[ $rules_applied -gt 0 ]]; then
        echo
        echo "🔍 Current UFW status:"
        sudo ufw status numbered
    fi
}

# Show current UFW status
tetra_env_toml_ufw_status() {
    echo "🔥 Current UFW Status:"
    echo

    if ! command -v ufw >/dev/null 2>&1; then
        echo "❌ UFW not installed"
        return 1
    fi

    sudo ufw status verbose
}

# UFW help
tetra_env_toml_ufw_help() {
    cat <<'EOF'
🔥 Tetra UFW Firewall Management

Usage: tetra env toml ufw <command> [environment]

Commands:
  show [env]     Show UFW rules for environment (or all)
  apply <env>    Apply UFW rules for environment
  status         Show current UFW status

Examples:
  tetra env toml ufw show dev        # Show dev environment rules
  tetra env toml ufw apply prod      # Apply production rules
  tetra env toml ufw status          # Show current UFW state

UFW Rules in tetra.toml:
  [environments.dev]
  ufw_rules = [
    "22/tcp",           # SSH
    "8000/tcp",         # Application port
    "80/tcp",           # HTTP
    "443/tcp"           # HTTPS
  ]

Variable Resolution:
  ufw_rules = ["${variables.ufw_ssh_port}/tcp", "${variables.default_port}/tcp"]
EOF
}

# TOML help
tetra_env_toml_help() {
    cat <<'EOF'
🔧 Tetra TOML Management

Usage: tetra env toml <command> [options]

Commands:
  sync              Sync NH infrastructure data to tetra.toml
  show [section]    Show TOML section or list all sections
  validate          Validate tetra.toml structure
  ufw <cmd> [env]   Manage UFW firewall rules from TOML

Examples:
  tetra env toml sync                    # Update infrastructure from NH
  tetra env toml show infrastructure     # Show infrastructure section
  tetra env toml show variables          # Show variables section
  tetra env toml validate                # Check TOML structure
  tetra env toml ufw show dev            # Show UFW rules for dev
  tetra env toml ufw apply prod          # Apply production firewall rules

Full Workflow:
  1. pj                                  # Load NH context
  2. tetra env toml sync                 # Sync infrastructure to TOML
  3. tetra env toml validate             # Verify structure
  4. tetra env init dev                  # Generate env/dev.env from TOML
  5. tetra env toml ufw apply dev        # Apply firewall rules

Features:
  ✅ Infrastructure sync from NH          ✅ Terraform-style variable resolution
  ✅ Secret injection via ENV vars       ✅ UFW firewall management
  ✅ Template validation                 ✅ Multi-environment support
EOF
}

# Register the tetra env command
alias env='tetra_env'