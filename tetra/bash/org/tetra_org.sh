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
    echo "Edit the configuration file to add your infrastructure details."
    echo "Switch to this organization with: tetra org switch $org_name"
}

org_push() {
    local org_name="$1"
    local env="$2"

    if [[ -z "$org_name" || -z "$env" ]]; then
        echo "Usage: tetra org push <organization> <environment>"
        echo "Example: tetra org push pixeljam_arcade dev"
        return 1
    fi

    echo "$(tput setaf 3)Org push functionality coming soon$(tput sgr0)"
    echo "Will deploy $org_name configuration to $env environment"
}

org_pull() {
    local org_name="$1"
    local env="$2"

    if [[ -z "$org_name" || -z "$env" ]]; then
        echo "Usage: tetra org pull <organization> <environment>"
        echo "Example: tetra org pull pixeljam_arcade dev"
        return 1
    fi

    echo "$(tput setaf 3)Org pull functionality coming soon$(tput sgr0)"
    echo "Will sync $org_name configuration from $env environment"
}

org_sync() {
    local org_name="$1"

    if [[ -z "$org_name" ]]; then
        echo "Usage: tetra org sync <organization>"
        echo "Example: tetra org sync pixeljam_arcade"
        return 1
    fi

    echo "$(tput setaf 3)Org sync functionality coming soon$(tput sgr0)"
    echo "Will bi-directionally sync $org_name across all environments"
}

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