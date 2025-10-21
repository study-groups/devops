#!/usr/bin/env bash

# Org Config Management
# Manages organization-wide multi-environment configuration

# Strong globals
MOD_SRC="${TETRA_SRC:?}/bash/org"
MOD_DIR="${TETRA_DIR:?}/org"

# Initialize org structure
org_config_init() {
    local orgname="${1:-default}"

    if [[ -z "$orgname" ]]; then
        echo "Usage: tsm org init <orgname>"
        return 1
    fi

    local org_dir="$MOD_DIR/$orgname"

    if [[ -d "$org_dir" ]]; then
        echo "⚠️  Organization already exists: $orgname"
        echo "   Location: $org_dir"
        read -p "Reinitialize? [y/N] " -n 1 -r
        echo
        [[ ! $REPLY =~ ^[Yy]$ ]] && return 1
    fi

    echo "🏢 Initializing organization: $orgname"

    # Create directory structure
    mkdir -p "$org_dir"/{environments,secrets,history}

    # Copy manifest template
    local manifest_template="$TETRA_SRC/templates/org/manifest.toml"
    if [[ -f "$manifest_template" ]]; then
        sed "s/my-org/$orgname/g" "$manifest_template" > "$org_dir/manifest.toml"
        echo "✅ Created manifest: $org_dir/manifest.toml"
    else
        echo "⚠️  Manifest template not found: $manifest_template"
    fi

    # Copy ONLY local.toml template (single source of truth)
    local local_template="$TETRA_SRC/templates/org/environments/local.toml"
    if [[ -f "$local_template" ]]; then
        cp "$local_template" "$org_dir/environments/local.toml"
        echo "✅ Created local.toml (SOURCE OF TRUTH)"
        echo "   Other environments will be generated from this with: tsm org promote @<env>"
    else
        echo "⚠️  Local template not found: $local_template"
    fi

    # Create secrets directory with gitignore
    cat > "$org_dir/secrets/.gitignore" <<'EOF'
# Never commit secrets to git
*.env
*.key
*.pem
*.crt
*secret*
*password*
EOF

    # Create README
    cat > "$org_dir/README.md" <<EOF
# $orgname - Tetra Organization Configuration

This directory contains environment configurations for your Tetra deployment.

## Structure

- \`manifest.toml\` - Organization-wide settings
- \`environments/\` - Per-environment configuration (local, dev, staging, prod)
- \`secrets/\` - Secret files (gitignored)
- \`history/\` - Deployment history

## Workflow

1. **Edit local.toml**: This is your source of truth
   \`\`\`bash
   tsm org env edit local
   \`\`\`

2. **Review changes**: See what would be deployed
   \`\`\`bash
   tsm org deploy diff @dev
   \`\`\`

3. **Push to environment**: Deploy configuration
   \`\`\`bash
   tsm org deploy push @dev
   \`\`\`

4. **Verify**: Check environment status
   \`\`\`bash
   tsm org env status @dev
   \`\`\`

## Security

- Never commit files in \`secrets/\` to git
- Production deployments require approval
- All deployments are logged in \`history/\`

## Documentation

See: $TETRA_SRC/bash/org/ORG_CONFIG_README.md
EOF

    echo ""
    echo "✅ Organization initialized: $orgname"
    echo "   Location: $org_dir"
    echo ""
    echo "Next steps:"
    echo "  1. Edit manifest:    \$EDITOR $org_dir/manifest.toml"
    echo "  2. Configure local:  tsm org env edit local"
    echo "  3. Set org default:  export TETRA_ORG=$orgname"
    echo ""
    echo "Add to your shell rc file:"
    echo "  export TETRA_ORG=$orgname"
}

# List organizations
org_config_list() {
    echo "📋 Organizations in $MOD_DIR:"
    echo ""

    if [[ ! -d "$MOD_DIR" ]]; then
        echo "No organizations found"
        echo "Create one with: tsm org init <orgname>"
        return 0
    fi

    local found=false
    for org_dir in "$MOD_DIR"/*; do
        [[ -d "$org_dir" ]] || continue
        found=true

        local orgname=$(basename "$org_dir")
        local manifest="$org_dir/manifest.toml"

        # Show current org marker
        local marker=""
        if [[ "${TETRA_ORG:-}" == "$orgname" ]]; then
            marker=" ← current"
        fi

        echo "🏢 $orgname$marker"

        # Read description from manifest if available
        if [[ -f "$manifest" ]]; then
            local desc=$(grep "^description" "$manifest" | cut -d'"' -f2)
            [[ -n "$desc" ]] && echo "   $desc"
        fi

        # List environments
        local envs=()
        for env_file in "$org_dir/environments"/*.toml; do
            [[ -f "$env_file" ]] || continue
            envs+=("$(basename "$env_file" .toml)")
        done

        if [[ ${#envs[@]} -gt 0 ]]; then
            echo "   Environments: ${envs[*]}"
        fi

        echo ""
    done

    if [[ "$found" == "false" ]]; then
        echo "No organizations found"
        echo "Create one with: tsm org init <orgname>"
    fi
}

# Get current org directory
org_config_get_dir() {
    local orgname="${TETRA_ORG:-}"

    if [[ -z "$orgname" ]]; then
        echo "❌ No organization set. Set TETRA_ORG environment variable." >&2
        echo "   Or initialize one with: tsm org init <orgname>" >&2
        return 1
    fi

    local org_dir="$MOD_DIR/$orgname"

    if [[ ! -d "$org_dir" ]]; then
        echo "❌ Organization not found: $orgname" >&2
        echo "   Expected at: $org_dir" >&2
        return 1
    fi

    echo "$org_dir"
}

# Edit environment configuration
org_config_env_edit() {
    local env="${1:-local}"
    local org_dir

    org_dir=$(org_config_get_dir) || return 1

    local env_file="$org_dir/environments/${env}.toml"

    if [[ ! -f "$env_file" ]]; then
        echo "❌ Environment not found: $env"
        echo "   Expected: $env_file"
        return 1
    fi

    # Use EDITOR or default to vim
    local editor="${EDITOR:-vim}"

    echo "✏️  Editing $env environment..."
    $editor "$env_file"
}

# Show environment configuration
org_config_env_show() {
    local env="${1:-local}"
    local org_dir

    org_dir=$(org_config_get_dir) || return 1

    local env_file="$org_dir/environments/${env}.toml"

    if [[ ! -f "$env_file" ]]; then
        echo "❌ Environment not found: $env"
        return 1
    fi

    echo "📄 Environment: $env"
    echo "📁 File: $env_file"
    echo ""
    cat "$env_file"
}

# Validate TOML file (requires toml parser)
org_config_validate() {
    local env="${1:-local}"
    local org_dir

    org_dir=$(org_config_get_dir) || return 1

    local env_file="$org_dir/environments/${env}.toml"

    if [[ ! -f "$env_file" ]]; then
        echo "❌ Environment not found: $env"
        return 1
    fi

    echo "🔍 Validating $env environment..."

    # Basic TOML syntax check (simple grep-based)
    if ! grep -q "^\[environment\]" "$env_file"; then
        echo "❌ Missing [environment] section"
        return 1
    fi

    if ! grep -q "^name = " "$env_file"; then
        echo "❌ Missing environment name"
        return 1
    fi

    # Check for required sections
    local required_sections=("deployment" "ports" "services")
    for section in "${required_sections[@]}"; do
        if ! grep -q "^\[$section\]" "$env_file"; then
            echo "⚠️  Missing [$section] section (optional but recommended)"
        fi
    done

    echo "✅ Basic validation passed"
    echo ""
    echo "ℹ️  For full TOML validation, install: npm install -g @taplo/cli"
    echo "   Then run: taplo check $env_file"
}

# Export functions
export -f org_config_init
export -f org_config_list
export -f org_config_get_dir
export -f org_config_env_edit
export -f org_config_env_show
export -f org_config_validate
