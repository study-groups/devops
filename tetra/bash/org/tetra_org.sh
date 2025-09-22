#!/usr/bin/env bash

# Tetra Organization Management System
# Handles multiple client infrastructures with symlink-based active org system

# Organization management functions

org_list() {
    local orgs_dir="$TETRA_DIR/orgs"
    local active_org=$(org_active)

    echo "Tetra Organizations:"
    echo ""

    if [[ ! -d "$orgs_dir" ]]; then
        echo "No organizations found. Create one with: tetra org create <name>"
        return 0
    fi

    for org_dir in "$orgs_dir"/*; do
        if [[ -d "$org_dir" ]]; then
            local org_name=$(basename "$org_dir")
            local toml_file="$org_dir/${org_name}.toml"

            if [[ "$org_name" == "$active_org" ]]; then
                echo "  $(tput bold)* $org_name$(tput sgr0) (active)"
            else
                echo "    $org_name"
            fi

            if [[ -f "$toml_file" ]]; then
                echo "      Config: $toml_file"
            else
                echo "      $(tput setaf 1)Missing config: $toml_file$(tput sgr0)"
            fi
        fi
    done
    echo ""
}

org_active() {
    local tetra_toml="$TETRA_DIR/config/tetra.toml"

    if [[ -L "$tetra_toml" ]]; then
        local target=$(readlink "$tetra_toml")
        local org_name=$(basename "$(dirname "$target")")
        echo "$org_name"
    else
        echo "none"
    fi
}

org_switch() {
    local org_name="$1"

    if [[ -z "$org_name" ]]; then
        echo "Usage: tetra org switch <organization>"
        return 1
    fi

    local org_dir="$TETRA_DIR/orgs/$org_name"
    local org_toml="$org_dir/${org_name}.toml"
    local tetra_toml="$TETRA_DIR/config/tetra.toml"

    if [[ ! -d "$org_dir" ]]; then
        echo "Organization '$org_name' not found"
        echo "Available organizations:"
        org_list
        return 1
    fi

    if [[ ! -f "$org_toml" ]]; then
        echo "Configuration file missing: $org_toml"
        return 1
    fi

    # Remove existing symlink if it exists
    [[ -L "$tetra_toml" ]] && rm "$tetra_toml"

    # Create new symlink
    ln -sf "$org_toml" "$tetra_toml"

    echo "$(tput bold)Switched to organization: $org_name$(tput sgr0)"
    echo "Active config: $org_toml"
}

org_create() {
    local org_name="$1"

    if [[ -z "$org_name" ]]; then
        echo "Usage: tetra org create <organization>"
        return 1
    fi

    # Validate org name (alphanumeric and underscore only)
    if [[ ! "$org_name" =~ ^[a-zA-Z0-9_]+$ ]]; then
        echo "Organization name must contain only letters, numbers, and underscores"
        return 1
    fi

    local org_dir="$TETRA_DIR/orgs/$org_name"
    local org_toml="$org_dir/${org_name}.toml"

    if [[ -d "$org_dir" ]]; then
        echo "Organization '$org_name' already exists"
        return 1
    fi

    # Create organization directory
    mkdir -p "$org_dir"

    # Create basic TOML template
    cat > "$org_toml" << EOF
# Tetra Organization: $org_name
# Created: $(date -Iseconds)

[org]
name = "$org_name"
description = "Organization configuration for $org_name"

[environments.local]
description = "Local development environment"

[environments.dev]
description = "Development server environment"
# dev_server = "your-dev-server"
# dev_ip = "your.dev.ip.address"

[environments.staging]
description = "Staging environment"
# staging_server = "your-staging-server"
# staging_ip = "your.staging.ip.address"

[environments.prod]
description = "Production environment"
# prod_server = "your-prod-server"
# prod_ip = "your.prod.ip.address"

[domains]
# dev = "dev.yourdomain.com"
# staging = "staging.yourdomain.com"
# prod = "yourdomain.com"

[infrastructure]
# Add your infrastructure configuration here
EOF

    echo "$(tput bold)Created organization: $org_name$(tput sgr0)"
    echo "Configuration: $org_toml"
    echo ""
    echo "Next steps:"
    echo "  1. Edit the configuration: $org_toml"
    echo "  2. Switch to this organization: tetra org switch $org_name"
    echo "  3. Deploy to environments: tetra org push $org_name <env>"
}

# Validate organization configuration
org_validate() {
    local org_name="$1"

    if [[ -z "$org_name" ]]; then
        org_name=$(org_active)
        if [[ "$org_name" == "none" ]]; then
            echo "No active organization. Specify organization name or switch to one."
            return 1
        fi
    fi

    local org_dir="$TETRA_DIR/orgs/$org_name"
    local org_toml="$org_dir/${org_name}.toml"

    echo "Validating organization: $org_name"
    echo

    local errors=0

    # Check if organization exists
    if [[ ! -d "$org_dir" ]]; then
        echo "❌ Organization directory not found: $org_dir"
        return 1
    fi

    # Check if config file exists
    if [[ ! -f "$org_toml" ]]; then
        echo "❌ Configuration file not found: $org_toml"
        return 1
    fi

    # Load and validate TOML
    if ! toml_parse "$org_toml" "ORG"; then
        echo "❌ Invalid TOML syntax in configuration file"
        return 1
    fi

    # Validate required sections
    local required_sections=("metadata")
    for section in "${required_sections[@]}"; do
        if ! declare -p "ORG_${section}" >/dev/null 2>&1; then
            echo "❌ Missing required section: [$section]"
            errors=$((errors + 1))
        else
            echo "✅ Section [$section] found"
        fi
    done

    # Check for at least one service section
    local has_services=false
    for var in $(compgen -A variable | grep "^ORG_services_"); do
        has_services=true
        break
    done

    if [[ "$has_services" == true ]]; then
        echo "✅ Services sections found"
    else
        echo "❌ No services defined in organization"
        errors=$((errors + 1))
    fi

    # Check for at least one environment section
    local has_environments=false
    for var in $(compgen -A variable | grep "^ORG_environments_"); do
        has_environments=true
        break
    done

    if [[ "$has_environments" == true ]]; then
        echo "✅ Environment sections found"
    else
        echo "❌ No environments defined in organization"
        errors=$((errors + 1))
    fi

    # Validate organization name matches
    if declare -p ORG_org >/dev/null 2>&1; then
        local -n org_section=ORG_org
        local config_name="${org_section[name]}"
        if [[ "$config_name" != "$org_name" ]]; then
            echo "⚠️  Organization name mismatch: config says '$config_name', directory is '$org_name'"
        else
            echo "✅ Organization name matches"
        fi
    fi

    # Validate environments
    if declare -p ORG_environments >/dev/null 2>&1; then
        echo "✅ Environments section found"
        # List available environments
        local env_count=0
        for var in $(compgen -A variable | grep "^ORG_environments_"); do
            local env_name="${var#ORG_environments_}"
            echo "  📍 Environment: $env_name"
            env_count=$((env_count + 1))
        done

        if [[ $env_count -eq 0 ]]; then
            echo "⚠️  No environments defined"
        fi
    fi

    echo

    if [[ $errors -eq 0 ]]; then
        echo "✅ Organization '$org_name' validation passed"
        return 0
    else
        echo "❌ Organization '$org_name' validation failed ($errors errors)"
        return 1
    fi
}

# Push organization configuration to environment
org_push() {
    local org_name="$1"
    local environment="$2"
    local force="${3:-false}"

    if [[ -z "$org_name" || -z "$environment" ]]; then
        echo "Usage: tetra org push <organization> <environment> [--force]"
        echo "Environments: dev, staging, prod"
        return 1
    fi

    # Validate organization first
    if ! org_validate "$org_name"; then
        echo "❌ Organization validation failed. Fix errors before pushing."
        return 1
    fi

    local org_dir="$TETRA_DIR/orgs/$org_name"
    local org_toml="$org_dir/${org_name}.toml"

    echo "🚀 Pushing '$org_name' configuration to '$environment' environment..."
    echo

    # Create backup of current deployment
    local backup_dir="$org_dir/backups"
    local backup_file="$backup_dir/${environment}_$(date +%Y%m%d_%H%M%S).toml"
    mkdir -p "$backup_dir"

    # Load configuration to get environment details
    toml_parse "$org_toml" "ORG"

    # Check if environment is defined
    if ! declare -p "ORG_environments_${environment}" >/dev/null 2>&1; then
        echo "❌ Environment '$environment' not defined in organization config"
        echo "Available environments:"
        for var in $(compgen -A variable | grep "^ORG_environments_"); do
            local env_name="${var#ORG_environments_}"
            echo "  - $env_name"
        done
        return 1
    fi

    # Create deployment metadata
    local deployment_toml="$org_dir/deployments/${environment}.toml"
    mkdir -p "$(dirname "$deployment_toml")"

    cat > "$deployment_toml" <<EOF
# Deployment metadata for $org_name to $environment
# Generated: $(date -Iseconds)

[deployment]
organization = "$org_name"
environment = "$environment"
timestamp = "$(date -Iseconds)"
source_config = "$org_toml"
deployed_by = "$(whoami)"
hostname = "$(hostname)"

[status]
state = "deployed"
last_push = "$(date -Iseconds)"
version = "$(date +%Y%m%d_%H%M%S)"
EOF

    # Copy current config as backup
    if [[ -f "$deployment_toml" ]]; then
        cp "$deployment_toml" "$backup_file"
        echo "📦 Created backup: $backup_file"
    fi

    # Simulate deployment (in real implementation, this would deploy to remote servers)
    echo "🔄 Deploying configuration..."
    sleep 1

    # For now, we'll create a deployed config copy
    local deployed_config="$org_dir/deployed/${environment}.toml"
    mkdir -p "$(dirname "$deployed_config")"
    cp "$org_toml" "$deployed_config"

    echo "✅ Successfully pushed '$org_name' to '$environment'"
    echo "📍 Deployment metadata: $deployment_toml"
    echo "🗂️  Deployed config: $deployed_config"

    return 0
}

# Pull organization configuration from environment
org_pull() {
    local org_name="$1"
    local environment="$2"

    if [[ -z "$org_name" || -z "$environment" ]]; then
        echo "Usage: tetra org pull <organization> <environment>"
        return 1
    fi

    local org_dir="$TETRA_DIR/orgs/$org_name"
    local deployed_config="$org_dir/deployed/${environment}.toml"

    echo "📥 Pulling '$org_name' configuration from '$environment' environment..."

    if [[ ! -f "$deployed_config" ]]; then
        echo "❌ No deployed configuration found for '$environment'"
        echo "Run 'tetra org push $org_name $environment' first"
        return 1
    fi

    # Create backup of current local config
    local org_toml="$org_dir/${org_name}.toml"
    local backup_file="${org_toml}.backup.$(date +%s)"

    if [[ -f "$org_toml" ]]; then
        cp "$org_toml" "$backup_file"
        echo "📦 Created backup: $backup_file"
    fi

    # Pull deployed config
    cp "$deployed_config" "$org_toml"

    echo "✅ Successfully pulled '$org_name' from '$environment'"
    echo "📍 Updated local config: $org_toml"

    return 0
}

# Rollback organization deployment
org_rollback() {
    local org_name="$1"
    local environment="$2"

    if [[ -z "$org_name" || -z "$environment" ]]; then
        echo "Usage: tetra org rollback <organization> <environment>"
        return 1
    fi

    local org_dir="$TETRA_DIR/orgs/$org_name"
    local backup_dir="$org_dir/backups"

    echo "🔄 Rolling back '$org_name' deployment in '$environment'..."

    # Find latest backup for this environment
    local latest_backup
    latest_backup=$(find "$backup_dir" -name "${environment}_*.toml" -type f 2>/dev/null | sort -r | head -1)

    if [[ -z "$latest_backup" ]]; then
        echo "❌ No backup found for environment '$environment'"
        echo "Cannot perform rollback"
        return 1
    fi

    echo "📦 Found backup: $(basename "$latest_backup")"
    echo -n "Proceed with rollback? (y/N): "
    read -r response

    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        echo "Rollback cancelled"
        return 0
    fi

    # Restore from backup
    local deployed_config="$org_dir/deployed/${environment}.toml"
    mkdir -p "$(dirname "$deployed_config")"

    cp "$latest_backup" "$deployed_config"

    # Update deployment metadata
    local deployment_toml="$org_dir/deployments/${environment}.toml"
    if [[ -f "$deployment_toml" ]]; then
        # Update status
        echo "" >> "$deployment_toml"
        echo "[rollback]" >> "$deployment_toml"
        echo "timestamp = \"$(date -Iseconds)\"" >> "$deployment_toml"
        echo "restored_from = \"$(basename "$latest_backup")\"" >> "$deployment_toml"
        echo "performed_by = \"$(whoami)\"" >> "$deployment_toml"
    fi

    echo "✅ Successfully rolled back '$org_name' in '$environment'"
    echo "📍 Restored from: $latest_backup"

    return 0
}

# Create organization from template
org_template() {
    local template_name="$1"
    local org_name="$2"

    if [[ -z "$template_name" ]]; then
        echo "Usage: tetra org template <template-name> [organization-name]"
        echo
        echo "Available templates:"
        org_list_templates
        return 1
    fi

    local template_dir="$TETRA_SRC/templates/organizations"
    local template_file="$template_dir/${template_name}.toml"

    if [[ ! -f "$template_file" ]]; then
        echo "❌ Template not found: $template_name"
        echo "Available templates:"
        org_list_templates
        return 1
    fi

    # Generate org name if not provided
    if [[ -z "$org_name" ]]; then
        org_name="${template_name}_$(date +%Y%m%d_%H%M%S)"
    fi

    local org_dir="$TETRA_DIR/orgs/$org_name"

    if [[ -d "$org_dir" ]]; then
        echo "❌ Organization '$org_name' already exists"
        return 1
    fi

    # Create organization from template
    mkdir -p "$org_dir"

    # Process template (simple variable substitution for now)
    sed "s/\\\${ORG_NAME}/$org_name/g" "$template_file" > "$org_dir/${org_name}.toml"

    echo "✅ Created organization '$org_name' from template '$template_name'"
    echo "📍 Configuration: $org_dir/${org_name}.toml"
    echo
    echo "Next steps:"
    echo "  1. Edit the configuration to match your setup"
    echo "  2. Switch to this organization: tetra org switch $org_name"

    return 0
}

# List available templates
org_list_templates() {
    local template_dir="$TETRA_SRC/templates/organizations"

    if [[ ! -d "$template_dir" ]]; then
        echo "No templates directory found: $template_dir"
        return 1
    fi

    echo "Available organization templates:"
    for template in "$template_dir"/*.toml; do
        if [[ -f "$template" ]]; then
            local name=$(basename "$template" .toml)
            echo "  - $name"
        fi
    done
}

# Show deployment history
org_history() {
    local org_name="$1"
    local environment="$2"

    if [[ -z "$org_name" ]]; then
        org_name=$(org_active)
        if [[ "$org_name" == "none" ]]; then
            echo "No active organization. Specify organization name."
            return 1
        fi
    fi

    local org_dir="$TETRA_DIR/orgs/$org_name"

    echo "📜 Deployment history for '$org_name':"
    echo

    if [[ -n "$environment" ]]; then
        # Show history for specific environment
        local deployment_file="$org_dir/deployments/${environment}.toml"
        if [[ -f "$deployment_file" ]]; then
            echo "Environment: $environment"
            cat "$deployment_file"
        else
            echo "No deployment history for environment: $environment"
        fi
    else
        # Show all deployments
        local deployments_dir="$org_dir/deployments"
        if [[ -d "$deployments_dir" ]]; then
            for deployment in "$deployments_dir"/*.toml; do
                if [[ -f "$deployment" ]]; then
                    local env_name=$(basename "$deployment" .toml)
                    echo "=== Environment: $env_name ==="
                    cat "$deployment"
                    echo
                fi
            done
        else
            echo "No deployment history found"
        fi
    fi
}

# Export organization functions
org_import() {
    local import_type="$1"
    local import_path="$2"
    local org_name="$3"

    if [[ -z "$import_type" ]]; then
        echo "Usage: tetra org import <type> <path> [org_name]"
        echo ""
        echo "Import Types:"
        echo "  nh <nh_dir> [org_name]     Import from NodeHolder directory"
        echo "  json <json_file> [org_name] Import from DigitalOcean JSON"
        echo "  env <env_file> [org_name]   Import from digocean.env file"
        echo ""
        echo "Examples:"
        echo "  tetra org import nh ~/nh/pixeljam-arcade pixeljam-arcade"
        echo "  tetra org import json ~/nh/pixeljam-arcade/digocean.json pixeljam-arcade"
        echo "  tetra org import env ~/nh/pixeljam-arcade/digocean.env pixeljam-arcade"
        return 1
    fi

    # Auto-detect organization name if not provided
    if [[ -z "$org_name" ]]; then
        case "$import_type" in
            "nh")
                org_name=$(basename "$import_path" | tr '-' '_')
                ;;
            "json"|"env")
                org_name=$(basename "$(dirname "$import_path")" | tr '-' '_')
                ;;
        esac
        echo "Auto-detected organization name: $org_name"
    fi

    # Validate org name
    if [[ ! "$org_name" =~ ^[a-zA-Z0-9_]+$ ]]; then
        echo "Error: Organization name must contain only letters, numbers, and underscores"
        return 1
    fi

    local org_dir="$TETRA_DIR/orgs/$org_name"

    # Check if organization already exists
    if [[ -d "$org_dir" ]]; then
        echo "Error: Organization '$org_name' already exists at $org_dir"
        echo "Use 'tetra org list' to see existing organizations"
        return 1
    fi

    echo "Creating organization: $org_name"
    echo "Source: $import_type from $import_path"
    echo ""

    # Create organization directory structure
    mkdir -p "$org_dir"
    mkdir -p "$org_dir/services"
    mkdir -p "$org_dir/nginx"
    mkdir -p "$org_dir/deployment"

    # Source the NH converter
    source "$TETRA_SRC/bash/org/nh_to_toml.sh"

    case "$import_type" in
        "nh")
            _org_import_from_nh "$import_path" "$org_name" "$org_dir"
            ;;
        "json")
            _org_import_from_json "$import_path" "$org_name" "$org_dir"
            ;;
        "env")
            _org_import_from_env "$import_path" "$org_name" "$org_dir"
            ;;
        *)
            echo "Error: Unknown import type '$import_type'"
            echo "Supported types: nh, json, env"
            rm -rf "$org_dir"
            return 1
            ;;
    esac

    if [[ $? -eq 0 ]]; then
        echo ""
        echo "✅ Successfully imported organization: $org_name"
        echo "   Location: $org_dir"
        echo "   Structure:"
        echo "     📁 $org_dir/"
        echo "     ├── 📄 ${org_name}.toml (infrastructure)"
        echo "     ├── 📁 services/ (application services)"
        echo "     ├── 📁 nginx/ (web server configs)"
        echo "     └── 📁 deployment/ (deployment strategies)"
        echo ""
        echo "Next steps:"
        echo "  tetra org switch $org_name   # Make this the active organization"
        echo "  tetra org list               # See all organizations"
        echo "  tview                        # View in dashboard"
    else
        echo ""
        echo "❌ Import failed, cleaning up..."
        rm -rf "$org_dir"
        return 1
    fi
}

# Import from NodeHolder directory
_org_import_from_nh() {
    local nh_dir="$1"
    local org_name="$2"
    local org_dir="$3"

    if [[ ! -d "$nh_dir" ]]; then
        echo "Error: NodeHolder directory not found: $nh_dir"
        return 1
    fi

    local json_file="$nh_dir/digocean.json"
    local env_file="$nh_dir/digocean.env"

    # Try to find the JSON file
    if [[ ! -f "$json_file" ]]; then
        echo "Error: digocean.json not found in $nh_dir"
        echo "Expected: $json_file"
        return 1
    fi

    echo "📊 Found DigitalOcean data: $json_file"

    # Preserve existing customizations
    local customization_file="$org_dir/${org_name}.customizations.toml"
    local customization_backup=""
    if [[ -f "$customization_file" ]]; then
        customization_backup="/tmp/${org_name}_customizations_backup_$(date +%s).toml"
        cp "$customization_file" "$customization_backup"
        echo "🔒 Preserved customizations: $customization_backup"
    fi

    # Import infrastructure using the existing converter
    local toml_file="$org_dir/${org_name}.toml"
    _org_generate_infrastructure_toml "$json_file" "$org_name" "$toml_file" "$env_file"

    if [[ $? -eq 0 ]]; then
        # Restore customizations if they existed
        if [[ -n "$customization_backup" ]]; then
            cp "$customization_backup" "$customization_file"
            echo "✅ Restored customizations from backup"
            rm -f "$customization_backup"
        elif [[ ! -f "$customization_file" ]]; then
            # Create default customization file for new organizations
            _org_create_default_customizations "$org_dir" "$org_name"
        fi

        _org_generate_service_templates "$org_dir" "$org_name"
        _org_generate_nginx_templates "$org_dir" "$org_name"
        _org_generate_deployment_templates "$org_dir" "$org_name"
        return 0
    else
        # Restore customizations even if import failed
        if [[ -n "$customization_backup" ]]; then
            cp "$customization_backup" "$customization_file"
            rm -f "$customization_backup"
        fi
        return 1
    fi
}

# Create default customization file for new organizations
_org_create_default_customizations() {
    local org_dir="$1"
    local org_name="$2"
    local customization_file="$org_dir/${org_name}.customizations.toml"

    echo "📝 Creating default customization file..."

    cat > "$customization_file" << EOF
# ${org_name} User Customizations
# This file persists your preferences and is never overwritten by imports
# Generated: $(date -u '+%Y-%m-%d')

[environment_mapping]
# Override which physical server runs which environment
# staging_server_override = "prod_server"  # staging runs on prod box
# qa_server_override = "dev_server"        # qa runs on dev box

[ssh_users]
# Multiple SSH users per environment (array format)
dev = ["root", "dev"]
staging = ["root", "staging"]
prod = ["root", "production"]
qa = ["root", "qa"]

[ssh_config]
# SSH connection preferences (update with your actual domains)
dev_domain = "dev.${org_name}.com"
staging_domain = "staging.${org_name}.com"
prod_domain = "${org_name}.com"
qa_domain = "qa.${org_name}.com"
prefer_domain_ssh = false  # use IP addresses as primary, domains for reference

[ssh_keys]
# SSH key preferences per environment
# dev_key = "~/.ssh/id_rsa_dev"
# staging_key = "~/.ssh/id_rsa_staging"
# prod_key = "~/.ssh/id_rsa_prod"

[custom_commands]
# Custom SSH commands for specific tasks
# dev_tunnel = "ssh -L 3000:localhost:3000 dev@dev.${org_name}.com"
# staging_logs = "ssh staging@staging.${org_name}.com 'tail -f /var/log/app.log'"

# User notes and preferences
[notes]
description = "${org_name} infrastructure with custom SSH configuration"
updated_by = "tetra_org_import"
last_updated = "$(date -u '+%Y-%m-%d %H:%M:%S UTC')"
# Add your own notes about server configurations, special setups, etc.
EOF

    echo "✅ Created customization file: $customization_file"
}

# Import from JSON file directly
_org_import_from_json() {
    local json_file="$1"
    local org_name="$2"
    local org_dir="$3"

    if [[ ! -f "$json_file" ]]; then
        echo "Error: JSON file not found: $json_file"
        return 1
    fi

    echo "📊 Importing from JSON: $json_file"

    local toml_file="$org_dir/${org_name}.toml"
    _org_generate_infrastructure_toml "$json_file" "$org_name" "$toml_file"

    if [[ $? -eq 0 ]]; then
        _org_generate_service_templates "$org_dir" "$org_name"
        _org_generate_nginx_templates "$org_dir" "$org_name"
        _org_generate_deployment_templates "$org_dir" "$org_name"
        return 0
    else
        return 1
    fi
}

# Import from env file
_org_import_from_env() {
    local env_file="$1"
    local org_name="$2"
    local org_dir="$3"

    if [[ ! -f "$env_file" ]]; then
        echo "Error: Environment file not found: $env_file"
        return 1
    fi

    echo "📊 Importing from ENV: $env_file"

    local toml_file="$org_dir/${org_name}.toml"
    _org_generate_infrastructure_from_env "$env_file" "$org_name" "$toml_file"

    if [[ $? -eq 0 ]]; then
        _org_generate_service_templates "$org_dir" "$org_name"
        _org_generate_nginx_templates "$org_dir" "$org_name"
        _org_generate_deployment_templates "$org_dir" "$org_name"
        return 0
    else
        return 1
    fi
}

# Generate infrastructure-only TOML from DigitalOcean JSON
_org_generate_infrastructure_toml() {
    local json_file="$1"
    local org_name="$2"
    local toml_file="$3"
    local env_file="$4"  # Optional

    echo "🏗️  Generating infrastructure TOML..."

    # Use the existing NH converter but modify for infrastructure-only
    local temp_toml="/tmp/${org_name}_full.toml"

    # Generate full TOML first
    nh_to_toml_parse_digitalocean "$json_file" "$org_name" "$temp_toml"

    if [[ $? -ne 0 ]]; then
        echo "Error: Failed to parse DigitalOcean JSON"
        return 1
    fi

    # Extract only infrastructure sections for clean separation
    cat > "$toml_file" << EOF
# ${org_name} Organization Infrastructure Configuration
# Generated from DigitalOcean data on $(date -u '+%Y-%m-%dT%H:%M:%SZ')
# Infrastructure-only TOML (services, nginx, deployment in separate files)

[metadata]
name = "${org_name}"
type = "digitalocean-managed"
description = "${org_name} infrastructure managed via DigitalOcean"
created_from_nh = true
generated_at = "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

[org]
name = "${org_name}"
description = "${org_name} infrastructure"
provider = "digitalocean"
region = "sfo3"

EOF

    # Extract infrastructure data from the temp TOML
    if [[ -f "$temp_toml" ]]; then
        # Copy infrastructure, environments, domains, and variables sections
        awk '
        /^\[infrastructure\]/ { p=1 }
        /^\[environments/ { p=1 }
        /^\[domains\]/ { p=1 }
        /^\[variables\]/ { p=1 }
        /^\[dns\]/ { p=1 }
        /^\[/ && !/^\[(infrastructure|environments|domains|variables|dns)/ { p=0 }
        p { print }
        ' "$temp_toml" >> "$toml_file"

        # Add references to separated files
        cat >> "$toml_file" << EOF

# File references for separated concerns
[references]
services_dir = "services/"
nginx_dir = "nginx/"
deployment_dir = "deployment/"
services_include = ["services/*.service.toml"]
nginx_include = ["nginx/*.nginx.conf"]
deployment_include = ["deployment/*.deploy.toml"]
EOF

        rm -f "$temp_toml"
        echo "✅ Infrastructure TOML generated: $toml_file"
        return 0
    else
        echo "Error: Failed to generate temporary TOML"
        return 1
    fi
}

# Generate infrastructure TOML from env file
_org_generate_infrastructure_from_env() {
    local env_file="$1"
    local org_name="$2"
    local toml_file="$3"

    echo "🏗️  Generating infrastructure TOML from env file..."

    # Parse the env file to extract IP information
    local dev_ip dev_private_ip staging_ip staging_private_ip staging_floating_ip
    local prod_ip prod_private_ip prod_floating_ip

    # Parse from your specific format
    dev_ip=$(grep "pxjam_arcade_dev01=" "$env_file" | cut -d'=' -f2 | sed 's/#.*//' | tr -d ' ')
    dev_private_ip=$(grep "pxjam_arcade_dev01_private=" "$env_file" | cut -d'=' -f2 | sed 's/#.*//' | tr -d ' ')
    staging_ip=$(grep "pxjam_arcade_qa01=" "$env_file" | cut -d'=' -f2 | sed 's/#.*//' | tr -d ' ')
    staging_private_ip=$(grep "pxjam_arcade_qa01_private=" "$env_file" | cut -d'=' -f2 | sed 's/#.*//' | tr -d ' ')
    staging_floating_ip=$(grep "pxjam_arcade_qa01_floating=" "$env_file" | cut -d'=' -f2 | sed 's/#.*//' | tr -d ' ')
    prod_ip=$(grep "pxjam_arcade_prod01=" "$env_file" | cut -d'=' -f2 | sed 's/#.*//' | tr -d ' ')
    prod_private_ip=$(grep "pxjam_arcade_prod01_private=" "$env_file" | cut -d'=' -f2 | sed 's/#.*//' | tr -d ' ')
    prod_floating_ip=$(grep "pxjam_arcade_prod01_floating=" "$env_file" | cut -d'=' -f2 | sed 's/#.*//' | tr -d ' ')

    cat > "$toml_file" << EOF
# ${org_name} Organization Infrastructure Configuration
# Generated from digocean.env on $(date -u '+%Y-%m-%dT%H:%M:%SZ')
# Infrastructure-only TOML (services, nginx, deployment in separate files)

[metadata]
name = "${org_name}"
type = "digitalocean-managed"
description = "${org_name} infrastructure managed via DigitalOcean"
created_from_env = true
generated_at = "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

[org]
name = "${org_name}"
description = "${org_name} infrastructure"
provider = "digitalocean"
region = "sfo3"

[infrastructure]
provider = "digitalocean"
region = "sfo3"

# Development environment - pxjam-arcade-dev01
dev_server_hostname = "pxjam-arcade-dev01"
dev_server_ip = "${dev_ip}"
dev_private_ip = "${dev_private_ip}"

# Staging/QA environment - pxjam-arcade-qa01
staging_server_hostname = "pxjam-arcade-qa01"
staging_server_ip = "${staging_ip}"
staging_private_ip = "${staging_private_ip}"
staging_floating_ip = "${staging_floating_ip}"

# Production environment - pxjam-arcade-prod01
prod_server_hostname = "pxjam-arcade-prod01"
prod_server_ip = "${prod_ip}"
prod_private_ip = "${prod_private_ip}"
prod_floating_ip = "${prod_floating_ip}"

[environments.local]
description = "Local development environment"
domain = "localhost"
url = "http://localhost:3000"
app_port = 3000
node_env = "development"

[environments.dev]
description = "Development server environment"
server_hostname = "\${infrastructure.dev_server_hostname}"
server_ip = "${dev_ip}"
private_ip = "${dev_private_ip}"
domain = "dev.pixeljamarcade.com"
url = "https://dev.pixeljamarcade.com"
ssh_user = "dev"
ssh_key_path = "~/.ssh/id_rsa"

[environments.staging]
description = "Staging/QA environment"
server_hostname = "\${infrastructure.staging_server_hostname}"
server_ip = "${staging_ip}"
private_ip = "${staging_private_ip}"
floating_ip = "${staging_floating_ip}"
domain = "qa.pixeljamarcade.com"
url = "https://qa.pixeljamarcade.com"
ssh_user = "staging"
ssh_key_path = "~/.ssh/id_rsa"

[environments.prod]
description = "Production environment"
server_hostname = "\${infrastructure.prod_server_hostname}"
server_ip = "${prod_floating_ip}"  # Using floating IP for production
private_ip = "${prod_private_ip}"
floating_ip = "${prod_floating_ip}"
domain = "pixeljamarcade.com"
url = "https://pixeljamarcade.com"
ssh_user = "prod"
ssh_key_path = "~/.ssh/id_rsa"

[domains]
base_domain = "pixeljamarcade.com"
dev = "dev.pixeljamarcade.com"
staging = "qa.pixeljamarcade.com"
prod = "pixeljamarcade.com"

[variables]
# NH variable mappings for backwards compatibility
pad = "${dev_ip}"               # NH development server variable
padp = "${dev_private_ip}"      # NH development private IP
paq = "${staging_ip}"           # NH staging server variable
paqp = "${staging_private_ip}"  # NH staging private IP
paqf = "${staging_floating_ip}" # NH staging floating IP
pap = "${prod_floating_ip}"     # NH production server variable (floating IP)
papp = "${prod_private_ip}"     # NH production private IP
papf = "${prod_floating_ip}"    # NH production floating IP

# File references for separated concerns
[references]
services_dir = "services/"
nginx_dir = "nginx/"
deployment_dir = "deployment/"
services_include = ["services/*.service.toml"]
nginx_include = ["nginx/*.nginx.conf"]
deployment_include = ["deployment/*.deploy.toml"]
EOF

    echo "✅ Infrastructure TOML generated: $toml_file"
    return 0
}

# Generate service templates in services/ directory
_org_generate_service_templates() {
    local org_dir="$1"
    local org_name="$2"

    echo "🔧 Generating service templates..."

    # Create a basic app service template
    cat > "$org_dir/services/app.service.toml" << EOF
# Application Service Configuration
# Generated on $(date -u '+%Y-%m-%dT%H:%M:%SZ')

[metadata]
name = "app"
description = "Main application service"
type = "nodejs"
owner = "application-team"

[service]
name = "app"
type = "nodejs"
start_command = "npm run start"
health_check = "http://localhost:\${port}/health"
auto_restart = true
environments = ["dev", "staging", "prod"]

[service.dev]
port = 3000
env_file = "env/dev.env"
node_env = "development"
instances = 1

[service.staging]
port = 4000
env_file = "env/staging.env"
node_env = "staging"
instances = 1

[service.prod]
port = 5000
env_file = "env/prod.env"
node_env = "production"
instances = 2

[monitoring]
health_check_path = "/health"
health_check_interval = 30
restart_on_failure = true
max_restarts = 3
EOF

    # Create arcade service if this is pixeljam
    if [[ "$org_name" == *"arcade"* ]]; then
        cat > "$org_dir/services/arcade.service.toml" << EOF
# Arcade Game Service Configuration
# Generated on $(date -u '+%Y-%m-%dT%H:%M:%SZ')

[metadata]
name = "arcade"
description = "Pixeljam Arcade game server"
type = "nodejs"
owner = "game-team"

[service]
name = "arcade"
type = "nodejs"
start_command = "npm run start:arcade"
health_check = "http://localhost:\${port}/api/health"
auto_restart = true
environments = ["dev", "staging", "prod"]

[service.dev]
port = 3400
env_file = "env/arcade-dev.env"
node_env = "development"
game_mode = "debug"

[service.staging]
port = 4400
env_file = "env/arcade-staging.env"
node_env = "staging"
game_mode = "testing"

[service.prod]
port = 5400
env_file = "env/arcade-prod.env"
node_env = "production"
game_mode = "live"

[game_config]
max_players = 100
session_timeout = 3600
leaderboard_enabled = true
EOF
    fi

    echo "✅ Service templates generated in $org_dir/services/"
}

# Generate nginx templates in nginx/ directory
_org_generate_nginx_templates() {
    local org_dir="$1"
    local org_name="$2"

    echo "🌐 Generating nginx templates..."

    # Create nginx config for each environment
    cat > "$org_dir/nginx/dev.nginx.conf" << EOF
# Nginx configuration for dev.pixeljamarcade.com
# Generated on $(date -u '+%Y-%m-%dT%H:%M:%SZ')

server {
    server_name dev.pixeljamarcade.com;
    listen 80;
    listen [::]:80;

    # SSL configuration will be managed by Certbot
    # listen 443 ssl;
    # ssl_certificate /etc/letsencrypt/live/dev.pixeljamarcade.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/dev.pixeljamarcade.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:3000/health;
        access_log off;
    }
}
EOF

    cat > "$org_dir/nginx/staging.nginx.conf" << EOF
# Nginx configuration for qa.pixeljamarcade.com
# Generated on $(date -u '+%Y-%m-%dT%H:%M:%SZ')

server {
    server_name qa.pixeljamarcade.com;
    listen 80;
    listen [::]:80;

    # SSL configuration will be managed by Certbot
    # listen 443 ssl;
    # ssl_certificate /etc/letsencrypt/live/qa.pixeljamarcade.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/qa.pixeljamarcade.com/privkey.pem;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:4000/health;
        access_log off;
    }
}
EOF

    cat > "$org_dir/nginx/prod.nginx.conf" << EOF
# Nginx configuration for pixeljamarcade.com
# Generated on $(date -u '+%Y-%m-%dT%H:%M:%SZ')

server {
    server_name pixeljamarcade.com www.pixeljamarcade.com;
    listen 80;
    listen [::]:80;

    # SSL configuration will be managed by Certbot
    # listen 443 ssl;
    # ssl_certificate /etc/letsencrypt/live/pixeljamarcade.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/pixeljamarcade.com/privkey.pem;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:5000/health;
        access_log off;
    }

    # Security headers for production
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
}
EOF

    echo "✅ Nginx templates generated in $org_dir/nginx/"
}

# Generate deployment templates in deployment/ directory
_org_generate_deployment_templates() {
    local org_dir="$1"
    local org_name="$2"

    echo "🚀 Generating deployment templates..."

    cat > "$org_dir/deployment/strategy.deploy.toml" << EOF
# Deployment Strategy Configuration
# Generated on $(date -u '+%Y-%m-%dT%H:%M:%SZ')

[metadata]
name = "default"
description = "Default deployment strategy for ${org_name}"
owner = "devops-team"

[strategy]
type = "rolling"
environments = ["dev", "staging", "prod"]
auto_promote = false
rollback_on_failure = true

[strategy.dev]
deployment_method = "direct"
health_check_required = false
auto_restart_services = true

[strategy.staging]
deployment_method = "blue_green"
health_check_required = true
approval_required = false
auto_promote_to_prod = false

[strategy.prod]
deployment_method = "rolling"
health_check_required = true
approval_required = true
max_unavailable = "25%"
pre_deployment_backup = true

[hooks]
pre_deploy = ["npm ci", "npm run build", "npm run test"]
post_deploy = ["npm run migrate", "systemctl restart nginx"]
rollback = ["git checkout HEAD~1", "npm ci", "systemctl restart app"]

[notifications]
slack_webhook = ""
email_on_failure = true
email_on_success = false
EOF

    echo "✅ Deployment templates generated in $org_dir/deployment/"
}

export -f org_validate org_push org_pull org_rollback org_template org_list_templates org_history org_import

# Helper function to get organization context for other modules
tetra_get_active_org() {
    org_active
}

# Helper function to get active organization TOML path
tetra_get_active_org_toml() {
    local tetra_toml="$TETRA_DIR/config/tetra.toml"

    if [[ -L "$tetra_toml" ]]; then
        readlink "$tetra_toml"
    else
        echo ""
    fi
}