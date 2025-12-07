#!/usr/bin/env bash
# deploy_target.sh - Target TOML file operations
#
# Targets are stored as TOML files:
#   $TETRA_DIR/orgs/<org>/targets/<name>.toml
#
# Schema:
#   [target]
#   repo = "git@github.com:org/repo.git"
#   www = "/var/www/myapp"
#
#   [envs.dev]
#   branch = "develop"
#   domain = "myapp.dev.example.com"
#
#   [envs.staging]
#   branch = "main"
#   domain = "myapp.staging.example.com"
#
#   [envs.prod]
#   branch = "release"
#   domain = "myapp.example.com"

# =============================================================================
# TARGET PATHS
# =============================================================================

_deploy_targets_dir() {
    local org=$(org_active 2>/dev/null)
    if [[ -z "$org" || "$org" == "none" ]]; then
        echo "No active org" >&2
        return 1
    fi
    echo "$TETRA_DIR/orgs/$org/targets"
}

_deploy_target_toml_path() {
    local name="$1"
    local dir=$(_deploy_targets_dir) || return 1
    echo "$dir/${name}.toml"
}

# =============================================================================
# TOML LOADING
# =============================================================================

# Clear all TGT_* variables before loading new target
_deploy_clear_tgt_vars() {
    unset TGT_NAME TGT_REPO TGT_WWW TGT_PATH_LOCAL
    unset TGT_ENVS TGT_BRANCH TGT_DOMAIN
    unset TGT_RSYNC_ENABLED TGT_RSYNC_EXCLUDE TGT_RSYNC_SOURCE
}

# Load target TOML into TGT_* variables
deploy_target_load() {
    local name="$1"

    if [[ -z "$name" ]]; then
        echo "Usage: deploy_target_load <target_name>" >&2
        return 1
    fi

    local toml=$(_deploy_target_toml_path "$name")
    if [[ ! -f "$toml" ]]; then
        echo "Target not found: $name" >&2
        echo "Expected: $toml" >&2
        return 1
    fi

    _deploy_clear_tgt_vars

    # Parse TOML
    toml_parse "$toml" "TGT_TOML"

    # Core target config
    TGT_NAME="$name"
    TGT_REPO=$(toml_get "target" "repo" "TGT_TOML")
    TGT_WWW=$(toml_get "target" "www" "TGT_TOML")
    TGT_PATH_LOCAL=$(toml_get "target" "local" "TGT_TOML")

    # Rsync config
    TGT_RSYNC_ENABLED=$(toml_get "rsync" "enabled" "TGT_TOML")
    TGT_RSYNC_EXCLUDE=$(toml_get "rsync" "exclude" "TGT_TOML")
    TGT_RSYNC_SOURCE=$(toml_get "rsync" "source" "TGT_TOML")

    # Expand ~ in paths
    TGT_PATH_LOCAL="${TGT_PATH_LOCAL/#\~/$HOME}"

    # Build list of available envs from [envs.*] sections
    TGT_ENVS=""
    local env_keys=$(toml_get_keys "envs" "TGT_TOML" 2>/dev/null)
    for key in $env_keys; do
        TGT_ENVS+="$key "
    done
    TGT_ENVS="${TGT_ENVS% }"  # trim trailing space

    return 0
}

# Get branch for specific environment
deploy_target_get_branch() {
    local env="$1"
    local branch=$(toml_get "envs" "${env}.branch" "TGT_TOML" 2>/dev/null)
    # Fall back to main if not specified
    echo "${branch:-main}"
}

# Get domain for specific environment
deploy_target_get_domain() {
    local env="$1"
    local domain=$(toml_get "envs" "${env}.domain" "TGT_TOML" 2>/dev/null)
    echo "$domain"
}

# Get www path for specific environment (with optional override)
deploy_target_get_www() {
    local env="$1"
    local www=$(toml_get "envs" "${env}.www" "TGT_TOML" 2>/dev/null)
    echo "${www:-$TGT_WWW}"
}

# Check if target can deploy to environment
deploy_target_can_deploy() {
    local env="$1"

    # No envs = nothing configured
    [[ -z "$TGT_ENVS" ]] && return 1

    # Check if env is in the list
    [[ " $TGT_ENVS " == *" $env "* ]]
}

# =============================================================================
# TARGET LISTING
# =============================================================================

deploy_target_list() {
    local dir=$(_deploy_targets_dir)

    echo "Targets for: $(org_active)"
    echo "===================="
    echo ""

    if [[ ! -d "$dir" ]] || [[ -z "$(ls -A "$dir"/*.toml 2>/dev/null)" ]]; then
        echo "(none)"
        echo ""
        echo "Create with: deploy target add <name>"
        return 0
    fi

    printf "%-20s %-40s %s\n" "NAME" "REPO" "ENVS"
    printf "%-20s %-40s %s\n" "----" "----" "----"

    for toml in "$dir"/*.toml; do
        [[ -f "$toml" ]] || continue
        local name=$(basename "$toml" .toml)

        if deploy_target_load "$name" 2>/dev/null; then
            local repo_short="${TGT_REPO##*/}"
            repo_short="${repo_short%.git}"
            printf "%-20s %-40s %s\n" "$name" "${repo_short:-(no repo)}" "${TGT_ENVS:-(none)}"
        else
            printf "%-20s %-40s %s\n" "$name" "?" "(error loading)"
        fi
    done
}

deploy_target_names() {
    local dir=$(_deploy_targets_dir 2>/dev/null) || return
    [[ -d "$dir" ]] || return

    for toml in "$dir"/*.toml; do
        [[ -f "$toml" ]] && basename "$toml" .toml
    done
}

# =============================================================================
# TARGET SHOW/EDIT
# =============================================================================

deploy_target_show() {
    local name="$1"

    if [[ -z "$name" ]]; then
        echo "Usage: deploy target show <name>"
        return 1
    fi

    local toml=$(_deploy_target_toml_path "$name")
    if [[ ! -f "$toml" ]]; then
        echo "Target not found: $name"
        return 1
    fi

    echo "Target: $name"
    echo "File: $toml"
    echo "---"
    cat "$toml"
}

deploy_target_edit() {
    local name="$1"

    if [[ -z "$name" ]]; then
        echo "Usage: deploy target edit <name>"
        return 1
    fi

    local toml=$(_deploy_target_toml_path "$name")
    if [[ ! -f "$toml" ]]; then
        echo "Target not found: $name"
        return 1
    fi

    ${EDITOR:-vim} "$toml"
}

# =============================================================================
# TARGET ADD (Interactive)
# =============================================================================

deploy_target_add() {
    local name="$1"

    if [[ -z "$name" ]]; then
        echo "Usage: deploy target add <name>"
        echo ""
        echo "Creates a new target TOML configuration interactively."
        return 1
    fi

    if [[ ! "$name" =~ ^[a-zA-Z0-9_-]+$ ]]; then
        echo "Invalid name: use a-z, 0-9, _, -"
        return 1
    fi

    local dir=$(_deploy_targets_dir) || return 1
    mkdir -p "$dir"

    local toml="$dir/${name}.toml"
    if [[ -f "$toml" ]]; then
        echo "Target already exists: $name"
        echo "Edit with: deploy target edit $name"
        return 1
    fi

    echo "Creating target: $name"
    echo ""

    # Get local path
    local local_path
    read -rp "Local path [~/src/$name]: " local_path
    local_path="${local_path:-~/src/$name}"
    local_path="${local_path/#\~/$HOME}"

    # Get git repo URL
    local git_repo=""
    if [[ -d "$local_path/.git" ]]; then
        git_repo=$(cd "$local_path" && git remote get-url origin 2>/dev/null)
    fi
    read -rp "Git repo URL [$git_repo]: " input_repo
    git_repo="${input_repo:-$git_repo}"

    # Get www path
    local www_path="/var/www/$name"
    read -rp "Remote www path [$www_path]: " input_www
    www_path="${input_www:-$www_path}"

    # Get environments and branches
    echo ""
    echo "Configure environments (leave blank to skip):"

    local dev_branch="" staging_branch="" prod_branch=""
    local dev_domain="" staging_domain="" prod_domain=""

    read -rp "Dev branch [develop]: " dev_branch
    if [[ -n "$dev_branch" || -z "$dev_branch" ]]; then
        dev_branch="${dev_branch:-develop}"
        read -rp "Dev domain [$name.dev.example.com]: " dev_domain
        dev_domain="${dev_domain:-$name.dev.example.com}"
    fi

    read -rp "Staging branch [main]: " staging_branch
    if [[ -n "$staging_branch" || -z "$staging_branch" ]]; then
        staging_branch="${staging_branch:-main}"
        read -rp "Staging domain [$name.staging.example.com]: " staging_domain
        staging_domain="${staging_domain:-$name.staging.example.com}"
    fi

    read -rp "Prod branch [release]: " prod_branch
    if [[ -n "$prod_branch" || -z "$prod_branch" ]]; then
        prod_branch="${prod_branch:-release}"
        read -rp "Prod domain [$name.example.com]: " prod_domain
        prod_domain="${prod_domain:-$name.example.com}"
    fi

    # Write TOML file
    cat > "$toml" << EOF
# Target: $name
# Created: $(date -Iseconds)
#
# This file defines WHERE to deploy.
# The repo should contain a tetra-deploy.toml defining WHAT to deploy.

[target]
repo = "$git_repo"
www = "$www_path"
local = "${local_path/$HOME/\~}"

[envs.dev]
branch = "$dev_branch"
domain = "$dev_domain"

[envs.staging]
branch = "$staging_branch"
domain = "$staging_domain"

[envs.prod]
branch = "$prod_branch"
domain = "$prod_domain"

[rsync]
enabled = false
exclude = [".git", "node_modules", ".env*"]
source = "."
EOF

    echo ""
    echo "Created: $toml"
    echo ""
    echo "Next steps:"
    echo "  deploy target show $name     # Review config"
    echo "  deploy target edit $name     # Edit config"
    echo "  deploy preflight $name dev   # Check readiness"
    echo "  deploy push $name dev        # Deploy to dev"
}

deploy_target_remove() {
    local name="$1"

    if [[ -z "$name" ]]; then
        echo "Usage: deploy target remove <name>"
        return 1
    fi

    local toml=$(_deploy_target_toml_path "$name")
    if [[ ! -f "$toml" ]]; then
        echo "Target not found: $name"
        return 1
    fi

    read -rp "Remove target '$name'? [y/N] " confirm
    if [[ "$confirm" == "y" || "$confirm" == "Y" ]]; then
        rm "$toml"
        echo "Removed: $name"
    else
        echo "Cancelled"
    fi
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f deploy_target_load deploy_target_get_branch deploy_target_get_domain
export -f deploy_target_get_www deploy_target_can_deploy
export -f deploy_target_list deploy_target_names deploy_target_show deploy_target_edit
export -f deploy_target_add deploy_target_remove
export -f _deploy_targets_dir _deploy_target_toml_path _deploy_clear_tgt_vars
