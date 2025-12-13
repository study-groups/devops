#!/usr/bin/env bash
# deploy_projects.sh - Project management for deploy module
#
# Projects are stored as config files in $MOD_DIR/projects/<name>.conf
# Config format:
#   DEPLOY_LOCAL="/path/to/local/repo"
#   DEPLOY_REMOTE="/path/on/remote/server"
#   DEPLOY_SERVICE="service-name"          # optional: TSM service name
#   DEPLOY_BRANCH="main"                   # optional: git branch
#   DEPLOY_PRE_HOOK="npm install"          # optional: run before restart
#   DEPLOY_POST_HOOK="npm run build"       # optional: run after pull

# =============================================================================
# PROJECT CRUD
# =============================================================================

# List all projects
deploy_list() {
    local projects_dir="$MOD_DIR/projects"

    echo "Registered Projects"
    echo "==================="
    echo ""

    if [[ ! -d "$projects_dir" ]] || [[ -z "$(ls -A "$projects_dir" 2>/dev/null)" ]]; then
        echo "(none)"
        echo ""
        echo "Register with: deploy add <name> <local_path> <remote_path>"
        return 0
    fi

    printf "%-15s %-30s %s\n" "NAME" "LOCAL" "REMOTE"
    printf "%-15s %-30s %s\n" "----" "-----" "------"

    for conf in "$projects_dir"/*.conf; do
        [[ -f "$conf" ]] || continue
        local name=$(basename "$conf" .conf)

        local DEPLOY_LOCAL="" DEPLOY_REMOTE="" DEPLOY_SERVICE=""
        source "$conf"

        # Truncate paths if too long
        local local_short="${DEPLOY_LOCAL:0:28}"
        [[ ${#DEPLOY_LOCAL} -gt 28 ]] && local_short="${local_short}.."

        printf "%-15s %-30s %s\n" "$name" "$local_short" "$DEPLOY_REMOTE"
    done
}

# Add a new project
deploy_add() {
    local name="$1"
    local local_path="$2"
    local remote_path="$3"

    if [[ -z "$name" || -z "$local_path" || -z "$remote_path" ]]; then
        echo "Usage: deploy add <name> <local_path> <remote_path>"
        echo ""
        echo "Example:"
        echo "  deploy add arcade ~/src/arcade /home/dev/arcade"
        return 1
    fi

    # Validate name
    if [[ ! "$name" =~ ^[a-zA-Z0-9_-]+$ ]]; then
        echo "Invalid name (use a-z, 0-9, _, -)"
        return 1
    fi

    # Expand local path
    local_path=$(eval echo "$local_path")

    # Validate local path exists
    if [[ ! -d "$local_path" ]]; then
        echo "Local path does not exist: $local_path"
        return 1
    fi

    local projects_dir="$MOD_DIR/projects"
    mkdir -p "$projects_dir"

    local conf="$projects_dir/${name}.conf"

    if [[ -f "$conf" ]]; then
        echo "Project already exists: $name"
        echo "Edit with: deploy edit $name"
        echo "Remove with: deploy remove $name"
        return 1
    fi

    # Detect if it's a git repo
    local branch=""
    if [[ -d "$local_path/.git" ]]; then
        branch=$(cd "$local_path" && git rev-parse --abbrev-ref HEAD 2>/dev/null)
    fi

    cat > "$conf" << EOF
# Deploy configuration for: $name
# Created: $(date -Iseconds)

# Required: Local repository path
DEPLOY_LOCAL="$local_path"

# Required: Remote path on server
DEPLOY_REMOTE="$remote_path"

# Optional: TSM service name (for restart)
DEPLOY_SERVICE="$name"

# Optional: Git branch (default: current branch)
DEPLOY_BRANCH="${branch:-main}"

# Optional: Commands to run on remote after git pull
# DEPLOY_POST_HOOK="npm install && npm run build"

# Optional: Commands to run on remote before restart
# DEPLOY_PRE_HOOK=""
EOF

    echo "Added project: $name"
    echo "  Local:  $local_path"
    echo "  Remote: $remote_path"
    echo "  Branch: ${branch:-main}"
    echo ""
    echo "Edit config: deploy edit $name"
    echo "Deploy with: deploy pull $name <env>"
}

# Remove a project
deploy_remove() {
    local name="$1"

    if [[ -z "$name" ]]; then
        echo "Usage: deploy remove <name>"
        return 1
    fi

    local conf="$MOD_DIR/projects/${name}.conf"

    if [[ ! -f "$conf" ]]; then
        echo "Project not found: $name"
        deploy_list
        return 1
    fi

    rm "$conf"
    echo "Removed project: $name"
}

# Edit project config
deploy_edit() {
    local name="$1"

    if [[ -z "$name" ]]; then
        echo "Usage: deploy edit <name>"
        return 1
    fi

    local conf="$MOD_DIR/projects/${name}.conf"

    if [[ ! -f "$conf" ]]; then
        echo "Project not found: $name"
        deploy_list
        return 1
    fi

    ${EDITOR:-vim} "$conf"
}

# Get project config value
_deploy_get_project() {
    local name="$1"
    local conf="$MOD_DIR/projects/${name}.conf"

    if [[ ! -f "$conf" ]]; then
        return 1
    fi

    # Source into current shell
    source "$conf"
    return 0
}

# List project names (for completion)
deploy_project_names() {
    local projects_dir="$MOD_DIR/projects"
    [[ -d "$projects_dir" ]] || return

    for conf in "$projects_dir"/*.conf; do
        [[ -f "$conf" ]] && basename "$conf" .conf
    done
}

export -f deploy_list deploy_add deploy_remove deploy_edit
export -f _deploy_get_project deploy_project_names
