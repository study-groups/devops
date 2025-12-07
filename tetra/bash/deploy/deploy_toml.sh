#!/usr/bin/env bash
# deploy_toml.sh - Project TOML file operations
#
# Projects are stored as TOML files:
#   $TETRA_DIR/orgs/<org>/projects/<name>.toml
#
# Schema:
#   [project]
#   name = "myproject"
#   type = "static"
#   envs = ["dev", "staging", "prod"]
#
#   [git]
#   repo = "git@github.com:org/repo.git"
#   branch = "main"
#
#   [domain]
#   pattern = "subdomain"   # subdomain | path
#
#   [paths]
#   local = "~/src/project"
#   www = "/var/www/project"

# =============================================================================
# PROJECT PATHS
# =============================================================================

_deploy_projects_dir() {
    local org=$(org_active 2>/dev/null)
    if [[ -z "$org" || "$org" == "none" ]]; then
        echo "No active org" >&2
        return 1
    fi
    echo "$TETRA_DIR/orgs/$org/projects"
}

_deploy_project_toml_path() {
    local name="$1"
    local dir=$(_deploy_projects_dir) || return 1
    echo "$dir/${name}.toml"
}

# =============================================================================
# TOML LOADING
# =============================================================================

# Clear all PROJ_* variables before loading new project
_deploy_clear_proj_vars() {
    unset PROJ_NAME PROJ_TYPE PROJ_DESCRIPTION PROJ_ENVS
    unset PROJ_PATH PROJ_PATH_LOCAL PROJ_PATH_WWW
    unset PROJ_GIT_REPO PROJ_GIT_BRANCH PROJ_GIT_BRANCHES
    unset PROJ_DOMAIN_PATTERN PROJ_DOMAIN_OVERRIDES
    unset PROJ_HOOK_POST_PULL PROJ_DEPLOY_POST_PULL
    unset PROJ_RSYNC_ENABLED PROJ_RSYNC_EXCLUDE PROJ_RSYNC_SOURCE
}

# Load project TOML into PROJ_* variables
deploy_toml_load() {
    local name="$1"

    if [[ -z "$name" ]]; then
        echo "Usage: deploy_toml_load <project_name>" >&2
        return 1
    fi

    local toml=$(_deploy_project_toml_path "$name")
    if [[ ! -f "$toml" ]]; then
        echo "Project not found: $name" >&2
        echo "Expected: $toml" >&2
        return 1
    fi

    _deploy_clear_proj_vars

    # Parse TOML
    toml_parse "$toml" "PROJ_TOML"

    # Map to simpler variable names
    PROJ_NAME=$(toml_get "project" "name" "PROJ_TOML")
    PROJ_TYPE=$(toml_get "project" "type" "PROJ_TOML")
    PROJ_DESCRIPTION=$(toml_get "project" "description" "PROJ_TOML")
    PROJ_ENVS=$(toml_get "project" "envs" "PROJ_TOML")

    # New: project.path is the canonical source path
    PROJ_PATH=$(toml_get "project" "path" "PROJ_TOML")

    PROJ_GIT_REPO=$(toml_get "git" "repo" "PROJ_TOML")
    PROJ_GIT_BRANCH=$(toml_get "git" "branch" "PROJ_TOML")

    PROJ_DOMAIN_PATTERN=$(toml_get "domain" "pattern" "PROJ_TOML")

    # Legacy: paths.local (now prefer project.path)
    PROJ_PATH_LOCAL=$(toml_get "paths" "local" "PROJ_TOML")
    PROJ_PATH_WWW=$(toml_get "paths" "www" "PROJ_TOML")

    # New: deploy.post_pull (preferred over hooks.post_pull)
    PROJ_DEPLOY_POST_PULL=$(toml_get "deploy" "post_pull" "PROJ_TOML")
    PROJ_HOOK_POST_PULL=$(toml_get "hooks" "post_pull" "PROJ_TOML")

    PROJ_RSYNC_ENABLED=$(toml_get "rsync" "enabled" "PROJ_TOML")
    PROJ_RSYNC_EXCLUDE=$(toml_get "rsync" "exclude" "PROJ_TOML")
    PROJ_RSYNC_SOURCE=$(toml_get "rsync" "source" "PROJ_TOML")

    # Expand ~ in paths
    PROJ_PATH="${PROJ_PATH/#\~/$HOME}"
    PROJ_PATH_LOCAL="${PROJ_PATH_LOCAL/#\~/$HOME}"

    # Prefer project.path over paths.local if set
    [[ -z "$PROJ_PATH_LOCAL" && -n "$PROJ_PATH" ]] && PROJ_PATH_LOCAL="$PROJ_PATH"
    [[ -z "$PROJ_PATH" && -n "$PROJ_PATH_LOCAL" ]] && PROJ_PATH="$PROJ_PATH_LOCAL"

    # Prefer deploy.post_pull over hooks.post_pull
    [[ -z "$PROJ_HOOK_POST_PULL" && -n "$PROJ_DEPLOY_POST_PULL" ]] && PROJ_HOOK_POST_PULL="$PROJ_DEPLOY_POST_PULL"

    # Set defaults
    : "${PROJ_TYPE:=static}"
    : "${PROJ_DOMAIN_PATTERN:=subdomain}"
    : "${PROJ_GIT_BRANCH:=main}"

    return 0
}

deploy_toml_get_branch() {
    local env="$1"
    local branch=$(toml_get "git" "branches_${env}" "PROJ_TOML" 2>/dev/null)
    echo "${branch:-$PROJ_GIT_BRANCH}"
}

deploy_toml_get_www() {
    local env="$1"
    local www=$(toml_get "paths" "www_${env}" "PROJ_TOML" 2>/dev/null)
    echo "${www:-$PROJ_PATH_WWW}"
}

deploy_toml_can_deploy() {
    local env="$1"

    # No envs restriction = allow all
    [[ -z "$PROJ_ENVS" ]] && return 0

    # Check if env is in the list
    [[ " $PROJ_ENVS " == *" $env "* ]]
}

# =============================================================================
# PROJECT LISTING
# =============================================================================

deploy_toml_list() {
    local dir=$(_deploy_projects_dir)

    echo "Projects for: $(org_active)"
    echo "===================="
    echo ""

    if [[ ! -d "$dir" ]] || [[ -z "$(ls -A "$dir"/*.toml 2>/dev/null)" ]]; then
        echo "(none)"
        echo ""
        echo "Create with: deploy project:add <name>"
        return 0
    fi

    printf "%-15s %-10s %-30s\n" "NAME" "TYPE" "ENVS"
    printf "%-15s %-10s %-30s\n" "----" "----" "----"

    for toml in "$dir"/*.toml; do
        [[ -f "$toml" ]] || continue
        local name=$(basename "$toml" .toml)

        if deploy_toml_load "$name" 2>/dev/null; then
            printf "%-15s %-10s %-30s\n" "$name" "${PROJ_TYPE:-static}" "${PROJ_ENVS:-(all)}"
        else
            printf "%-15s %-10s %-30s\n" "$name" "?" "(error loading)"
        fi
    done
}

deploy_toml_names() {
    local dir=$(_deploy_projects_dir 2>/dev/null) || return
    [[ -d "$dir" ]] || return

    for toml in "$dir"/*.toml; do
        [[ -f "$toml" ]] && basename "$toml" .toml
    done
}

# =============================================================================
# PROJECT SHOW/EDIT
# =============================================================================

deploy_toml_show() {
    local name="$1"

    if [[ -z "$name" ]]; then
        echo "Usage: deploy project:show <name>"
        return 1
    fi

    local toml=$(_deploy_project_toml_path "$name")
    if [[ ! -f "$toml" ]]; then
        echo "Project not found: $name"
        return 1
    fi

    echo "Project: $name"
    echo "File: $toml"
    echo "---"
    cat "$toml"
}

deploy_toml_edit() {
    local name="$1"

    if [[ -z "$name" ]]; then
        echo "Usage: deploy project:edit <name>"
        return 1
    fi

    local toml=$(_deploy_project_toml_path "$name")
    if [[ ! -f "$toml" ]]; then
        echo "Project not found: $name"
        return 1
    fi

    ${EDITOR:-vim} "$toml"
}

# =============================================================================
# PROJECT ADD (Interactive)
# =============================================================================

deploy_toml_add() {
    local name="$1"

    if [[ -z "$name" ]]; then
        echo "Usage: deploy project:add <name>"
        echo ""
        echo "Creates a new project TOML configuration interactively."
        return 1
    fi

    if [[ ! "$name" =~ ^[a-zA-Z0-9_-]+$ ]]; then
        echo "Invalid name: use a-z, 0-9, _, -"
        return 1
    fi

    local dir=$(_deploy_projects_dir) || return 1
    mkdir -p "$dir"

    local toml="$dir/${name}.toml"
    if [[ -f "$toml" ]]; then
        echo "Project already exists: $name"
        echo "Edit with: deploy project:edit $name"
        return 1
    fi

    echo "Creating project: $name"
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

    # Get git branch
    local git_branch="main"
    if [[ -d "$local_path/.git" ]]; then
        git_branch=$(cd "$local_path" && git rev-parse --abbrev-ref HEAD 2>/dev/null)
    fi
    read -rp "Default branch [$git_branch]: " input_branch
    git_branch="${input_branch:-$git_branch}"

    # Get www path
    local www_path="/var/www/$name"
    read -rp "Remote www path [$www_path]: " input_www
    www_path="${input_www:-$www_path}"

    # Get environments
    echo ""
    echo "Which environments? (space-separated)"
    local envs
    read -rp "Envs [dev staging prod]: " envs
    envs="${envs:-dev staging prod}"
    local envs_toml=$(echo "$envs" | sed 's/[[:space:]]\+/", "/g')
    envs_toml="[\"$envs_toml\"]"

    # Domain pattern
    echo ""
    echo "Domain pattern:"
    echo "  1) subdomain - $name.dev.example.com"
    echo "  2) path      - dev.example.com/$name"
    local pattern_choice
    read -rp "Pattern [1]: " pattern_choice
    local domain_pattern="subdomain"
    [[ "$pattern_choice" == "2" ]] && domain_pattern="path"

    # Post-pull hook
    echo ""
    local post_hook=""
    read -rp "Post-pull hook (e.g., 'npm run build'): " post_hook

    # Write TOML file
    cat > "$toml" << EOF
# Project: $name
# Created: $(date -Iseconds)

[project]
name = "$name"
type = "static"
description = ""
envs = $envs_toml

[git]
repo = "$git_repo"
branch = "$git_branch"
# Per-env branches (optional):
# branches = { dev = "develop", staging = "main", prod = "release" }

[domain]
pattern = "$domain_pattern"
# overrides = { prod = "custom.domain.com" }

[paths]
local = "${local_path/$HOME/\~}"
www = "$www_path"
# Per-env paths (optional):
# www_dev = "/var/www/$name-dev"

[hooks]
EOF

    if [[ -n "$post_hook" ]]; then
        echo "post_pull = \"$post_hook\"" >> "$toml"
    else
        echo "# post_pull = \"npm run build\"" >> "$toml"
    fi

    cat >> "$toml" << EOF

[rsync]
enabled = false
exclude = [".git", "node_modules", ".env*"]
source = "dist"
EOF

    echo ""
    echo "Created: $toml"
    echo ""
    echo "Next steps:"
    echo "  deploy project:show $name    # Review config"
    echo "  deploy project:edit $name    # Edit config"
    echo "  deploy push $name dev        # Deploy to dev"
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f deploy_toml_load deploy_toml_get_branch deploy_toml_get_www deploy_toml_can_deploy
export -f deploy_toml_list deploy_toml_names deploy_toml_show deploy_toml_edit deploy_toml_add
export -f _deploy_projects_dir _deploy_project_toml_path _deploy_clear_proj_vars
