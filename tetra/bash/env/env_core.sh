#!/usr/bin/env bash

# Tetra Environment Module - Core Functions
# Manages the Four Amigos: local, dev, staging, prod

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
        "status")
            tetra_env_status "${@:2}"
            ;;
        "show")
            tetra_env_show "${2:-}"
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
    if grep -q "your_.*_here\|your-.*-name\|PLACEHOLDER.*_HERE" "$env_file"; then
        echo "❌ Found placeholder values that need to be replaced:"
        grep "your_.*_here\|your-.*-name\|PLACEHOLDER.*_HERE" "$env_file" | head -5
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

# Show specific environment details
tetra_env_show() {
    local env="${1:-}"

    if [[ -z "$env" ]]; then
        echo "Usage: tetra env show <environment>"
        echo "Available environments: local, dev, staging, prod"
        return 1
    fi

    local env_file="env/${env}.env"
    local toml_file="tetra.toml"

    echo "🔍 Environment: $env"
    echo

    # Show TOML configuration if available
    if [[ -f "$toml_file" ]]; then
        echo "📋 TOML Configuration:"
        tetra_env_toml_show "environments.$env"
        echo
    fi

    # Show generated environment file
    if [[ -f "$env_file" ]]; then
        echo "📄 Generated Environment File: $env_file"
        echo "Variables:"
        grep "^export" "$env_file" | sed 's/export /  /' | head -15
        if [[ $(grep -c "^export" "$env_file") -gt 15 ]]; then
            echo "  ... and $(($(grep -c "^export" "$env_file") - 15)) more"
        fi
    else
        echo "❌ Environment file not found: $env_file"
        echo "Generate with: tetra env init $env"
    fi
}

# Help function
tetra_env_help() {
    cat <<'EOF'
🌍 Tetra Environment Module - The Four Amigos Manager

Usage: tetra env <command> [options]

Environment Management:
  init <env>        Create environment file from template/TOML
  list              Show templates and environment files
  validate [env]    Validate environment file (default: local)
  templates         Show available templates
  status            Show status of all four environments (l,d,s,p)
  show <env>        Show detailed environment configuration

TOML Management:
  toml <cmd>        Manage tetra.toml configuration

The Four Amigos:
  local             Local development (laptops, home computers)
  dev               Development server environment
  staging           Staging/QA server environment
  prod              Production server environment

Examples:
  tetra env status                    # Show all environment status
  tetra env init dev                  # Create env/dev.env from tetra.toml
  tetra env show staging              # Show staging environment details
  tetra env validate prod             # Check prod environment file
  tetra env toml sync                 # Sync NH → tetra.toml

Features:
  ✅ Single source of truth (tetra.toml)    ✅ NH infrastructure integration
  ✅ Terraform-style variables             ✅ Secret injection via ENV vars
  ✅ Multi-environment support             ✅ Template fallback support

Next Steps:
  1. tetra env status                     # See current state
  2. tetra env init <env>                 # Configure environment
  3. tetra deploy <env>                   # Deploy to environment (if available)
EOF
}

# Register the tetra env command
alias env='tetra_env'