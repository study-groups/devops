#!/usr/bin/env bash

# Org Deployment Management
# Handles pushing configuration from local (source of truth) to other environments

# Strong globals
MOD_SRC="${TETRA_SRC:?}/bash/org"
MOD_DIR="${TETRA_DIR:?}/org"

# Source org_config and env_profiles functions
source "$MOD_SRC/org_config.sh"
source "$MOD_SRC/env_profiles.sh"

# Promote local config to target environment (generate from local.toml)
org_promote() {
    local target_env="${1#@}"  # Remove @ prefix
    local org_dir

    org_dir=$(org_config_get_dir) || return 1

    local local_file="$org_dir/environments/local.toml"
    local target_file="$org_dir/environments/${target_env}.toml"

    if [[ ! -f "$local_file" ]]; then
        echo "❌ Local configuration not found: $local_file"
        echo "   Initialize org with: tsm org init <orgname>"
        return 1
    fi

    # Validate target environment
    case "$target_env" in
        dev|staging|prod) ;;
        local)
            echo "❌ Cannot promote to local (local is the source)"
            return 1
            ;;
        *)
            echo "❌ Unknown environment: $target_env"
            echo "   Valid: dev, staging, prod"
            return 1
            ;;
    esac

    echo "🚀 Promoting local → @$target_env"
    echo "═══════════════════════════════════"
    echo ""

    # Backup existing target if it exists
    if [[ -f "$target_file" ]]; then
        local backup_dir="$org_dir/history"
        local timestamp=$(date +%Y%m%d_%H%M%S)
        local backup_file="$backup_dir/${target_env}_${timestamp}.toml"

        mkdir -p "$backup_dir"
        cp "$target_file" "$backup_file"
        echo "📦 Backed up existing: $backup_file"
    fi

    # Copy local.toml to target
    cp "$local_file" "$target_file"

    # Apply environment-specific transformations
    echo "⚙️  Applying $target_env profile..."
    apply_env_profile "$target_env" "$target_file"

    # Update sync metadata
    org_deploy_update_metadata "$target_file" "$target_env"

    echo ""
    echo "✅ Configuration promoted to @$target_env"
    echo "   File: $target_file"
    echo ""
    echo "Next steps:"
    echo "  1. Review: tsm org env show $target_env"
    echo "  2. Copy to server: scp $target_file $target_env:/path/"
    echo "  3. Apply: ssh $target_env 'tsm org apply'"
}

# Show differences between local and target environment
org_deploy_diff() {
    local target_env="${1#@}"  # Remove @ prefix
    local org_dir

    org_dir=$(org_config_get_dir) || return 1

    local local_file="$org_dir/environments/local.toml"
    local target_file="$org_dir/environments/${target_env}.toml"

    if [[ ! -f "$local_file" ]]; then
        echo "❌ Local configuration not found: $local_file"
        return 1
    fi

    if [[ ! -f "$target_file" ]]; then
        echo "❌ Target environment not found: $target_env"
        return 1
    fi

    echo "📊 Configuration Diff: local → @$target_env"
    echo "═════════════════════════════════════════════"
    echo ""

    # Use diff with color if available
    if command -v colordiff >/dev/null 2>&1; then
        colordiff -u "$target_file" "$local_file" || true
    else
        diff -u "$target_file" "$local_file" || true
    fi

    echo ""
    echo "ℹ️  To apply these changes: tsm org deploy push @$target_env"
}

# Push configuration from local to target environment
org_deploy_push() {
    local target_env="${1#@}"  # Remove @ prefix
    local approve="${2:-}"
    local org_dir

    org_dir=$(org_config_get_dir) || return 1

    local local_file="$org_dir/environments/local.toml"
    local target_file="$org_dir/environments/${target_env}.toml"

    if [[ ! -f "$local_file" ]]; then
        echo "❌ Local configuration not found: $local_file"
        return 1
    fi

    if [[ ! -f "$target_file" ]]; then
        echo "❌ Target environment not found: $target_env"
        return 1
    fi

    # Check if target requires approval
    local requires_approval
    requires_approval=$(grep "^requires_approval = true" "$target_file" 2>/dev/null)

    echo "🚀 Deploying configuration: local → @$target_env"
    echo "═════════════════════════════════════════════"
    echo ""

    # Show diff
    echo "Changes to be deployed:"
    echo ""
    org_deploy_diff "@$target_env"
    echo ""

    # Require confirmation for production
    if [[ -n "$requires_approval" ]]; then
        if [[ "$approve" != "--approve" ]]; then
            echo "⚠️  This environment requires approval"
            echo "   Use: tsm org deploy push @$target_env --approve"
            return 1
        fi
    fi

    # Confirm deployment
    read -p "Deploy these changes? [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Deployment cancelled"
        return 1
    fi

    # Backup current target
    local backup_dir="$org_dir/history"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$backup_dir/${target_env}_${timestamp}.toml"

    mkdir -p "$backup_dir"
    cp "$target_file" "$backup_file"
    echo "📦 Backup saved: $backup_file"

    # Update target file from local template
    # We need to preserve environment-specific values
    org_deploy_merge_config "$local_file" "$target_file" "$target_env"

    # Update sync metadata
    org_deploy_update_metadata "$target_file" "$target_env"

    echo "✅ Configuration deployed to @$target_env"
    echo ""
    echo "Next steps:"
    echo "  1. Copy to target server:  scp $target_file $target_env:/path/to/config"
    echo "  2. Apply on target:        ssh $target_env 'tsm org apply'"
    echo "  3. Verify deployment:      tsm org env status @$target_env"
}

# Merge local config into target, preserving environment-specific values
org_deploy_merge_config() {
    local source_file="$1"
    local target_file="$2"
    local target_env="$3"

    # For now, we'll do a simple approach: copy local and update environment-specific fields
    # In production, you'd want a proper TOML parser

    # Read source
    local temp_file="${target_file}.tmp"
    cp "$source_file" "$temp_file"

    # Update environment name
    sed -i.bak "s/^name = \"local\"/name = \"$target_env\"/" "$temp_file"
    sed -i.bak "s/^is_source_of_truth = true/is_source_of_truth = false/" "$temp_file"
    sed -i.bak "/^synced_from =/d" "$temp_file"
    sed -i.bak "/^\[environment\]/a synced_from = \"local\"" "$temp_file"

    # Update deployment paths based on environment
    case "$target_env" in
        dev)
            sed -i.bak 's|tetra_src = ".*"|tetra_src = "/root/src/devops/tetra"|' "$temp_file"
            sed -i.bak 's|tetra_dir = ".*"|tetra_dir = "/root/tetra"|' "$temp_file"
            sed -i.bak 's|^user = ".*"|user = "root"|' "$temp_file"
            sed -i.bak 's|^group = ".*"|group = "root"|' "$temp_file"
            sed -i.bak 's|^init_system = ".*"|init_system = "systemd"|' "$temp_file"
            ;;
        staging|prod)
            sed -i.bak 's|tetra_src = ".*"|tetra_src = "/opt/tetra"|' "$temp_file"
            sed -i.bak 's|tetra_dir = ".*"|tetra_dir = "/var/lib/tetra"|' "$temp_file"
            sed -i.bak 's|^user = ".*"|user = "tetra"|' "$temp_file"
            sed -i.bak 's|^group = ".*"|group = "tetra"|' "$temp_file"
            sed -i.bak 's|^init_system = ".*"|init_system = "systemd"|' "$temp_file"
            ;;
    esac

    # Move temp file to target
    mv "$temp_file" "$target_file"
    rm -f "${temp_file}.bak"
}

# Update sync metadata in target file
org_deploy_update_metadata() {
    local target_file="$1"
    local target_env="$2"

    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local user="${USER:-unknown}"
    local commit=""

    # Get git commit if in a git repo
    if git rev-parse --git-dir >/dev/null 2>&1; then
        commit=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    fi

    # Update metadata in [sync] section
    if grep -q "^\[sync\]" "$target_file"; then
        sed -i.bak "s|^last_synced_at = .*|last_synced_at = \"$timestamp\"|" "$target_file"
        sed -i.bak "s|^last_synced_by = .*|last_synced_by = \"$user\"|" "$target_file"
        sed -i.bak "s|^local_commit = .*|local_commit = \"$commit\"|" "$target_file"
        rm -f "${target_file}.bak"
    fi
}

# Rollback to previous configuration
org_deploy_rollback() {
    local target_env="${1#@}"
    local org_dir

    org_dir=$(org_config_get_dir) || return 1

    local backup_dir="$org_dir/history"
    local target_file="$org_dir/environments/${target_env}.toml"

    if [[ ! -d "$backup_dir" ]]; then
        echo "❌ No backup history found"
        return 1
    fi

    # Find latest backup for this environment
    local latest_backup
    latest_backup=$(ls -t "$backup_dir/${target_env}"_*.toml 2>/dev/null | head -1)

    if [[ -z "$latest_backup" ]]; then
        echo "❌ No backups found for $target_env"
        return 1
    fi

    echo "🔙 Rollback: @$target_env"
    echo "   From: $(basename "$latest_backup")"
    echo ""

    # Show diff
    if command -v colordiff >/dev/null 2>&1; then
        colordiff -u "$target_file" "$latest_backup" || true
    else
        diff -u "$target_file" "$latest_backup" || true
    fi

    echo ""
    read -p "Rollback to this version? [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Rollback cancelled"
        return 1
    fi

    # Backup current before rollback
    local timestamp=$(date +%Y%m%d_%H%M%S)
    cp "$target_file" "$backup_dir/${target_env}_pre_rollback_${timestamp}.toml"

    # Restore from backup
    cp "$latest_backup" "$target_file"

    echo "✅ Rolled back to: $(basename "$latest_backup")"
}

# Show deployment history
org_deploy_history() {
    local target_env="${1#@}"
    local org_dir

    org_dir=$(org_config_get_dir) || return 1

    local backup_dir="$org_dir/history"

    if [[ ! -d "$backup_dir" ]]; then
        echo "No deployment history found"
        return 0
    fi

    echo "📚 Deployment History: @$target_env"
    echo "════════════════════════════════════"
    echo ""

    local backups=()
    while IFS= read -r -d '' backup; do
        backups+=("$backup")
    done < <(find "$backup_dir" -name "${target_env}_*.toml" -print0 | sort -rz)

    if [[ ${#backups[@]} -eq 0 ]]; then
        echo "No backups found for $target_env"
        return 0
    fi

    for backup in "${backups[@]}"; do
        local filename=$(basename "$backup")
        local timestamp="${filename#${target_env}_}"
        timestamp="${timestamp%.toml}"

        # Try to extract sync metadata
        local synced_by=""
        if grep -q "^last_synced_by" "$backup"; then
            synced_by=$(grep "^last_synced_by" "$backup" | cut -d'"' -f2)
        fi

        echo "📄 $timestamp"
        [[ -n "$synced_by" ]] && echo "   By: $synced_by"
        echo "   File: $backup"
        echo ""
    done
}

# Apply configuration on target server (runs on the target)
org_apply() {
    local env="${TETRA_ENV:-local}"
    local org_dir

    org_dir=$(org_config_get_dir) || return 1

    local env_file="$org_dir/environments/${env}.toml"

    if [[ ! -f "$env_file" ]]; then
        echo "❌ Environment configuration not found: $env"
        return 1
    fi

    echo "🔧 Applying configuration for @$env"
    echo "══════════════════════════════════════"
    echo ""

    # This would parse the TOML and apply settings
    # For now, we'll show what would be done

    echo "TODO: Implementation needed"
    echo "This would:"
    echo "  - Parse $env_file"
    echo "  - Update systemd service files"
    echo "  - Update TSM service definitions"
    echo "  - Reload/restart services as needed"
    echo ""
    echo "For now, manually review: $env_file"
}

# Export functions
export -f org_promote
export -f org_deploy_diff
export -f org_deploy_push
export -f org_deploy_merge_config
export -f org_deploy_update_metadata
export -f org_deploy_rollback
export -f org_deploy_history
export -f org_apply
