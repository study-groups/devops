#!/usr/bin/env bash
# project/project_registry.sh - Project registration operations
#
# Manages project TOML files that register source code locations.
# Projects are stored in $TETRA_DIR/orgs/{org}/projects/{name}.toml

# =============================================================================
# LIST
# =============================================================================

# List all projects for active org
project_list() {
    local dir=$(_project_dir) || return 1

    local org=$(org_active 2>/dev/null)
    echo "Projects: $org"
    echo "=========="
    echo ""

    if [[ ! -d "$dir" ]] || [[ -z "$(ls -A "$dir"/*.toml 2>/dev/null)" ]]; then
        echo "(none)"
        echo ""
        echo "Register with: deploy project add <name> <path>"
        return 0
    fi

    printf "%-15s %-10s %-40s\n" "NAME" "TYPE" "PATH"
    printf "%-15s %-10s %-40s\n" "----" "----" "----"

    for toml in "$dir"/*.toml; do
        [[ -f "$toml" ]] || continue
        local name=$(basename "$toml" .toml)
        local type=$(_project_get_type "$name")
        local path=$(_project_get_path "$name")

        # Truncate path for display
        local display_path="$path"
        [[ ${#path} -gt 40 ]] && display_path="...${path: -37}"

        printf "%-15s %-10s %-40s\n" "$name" "$type" "$display_path"
    done
}

# Get list of project names (for completion)
project_names() {
    local dir=$(_project_dir 2>/dev/null) || return
    [[ -d "$dir" ]] || return

    for toml in "$dir"/*.toml; do
        [[ -f "$toml" ]] && basename "$toml" .toml
    done
}

# =============================================================================
# SHOW
# =============================================================================

# Show project details including discovered services
project_show() {
    local name="$1"

    if [[ -z "$name" ]]; then
        echo "Usage: deploy project show <name>"
        return 1
    fi

    local toml=$(_project_toml_path "$name")
    if [[ ! -f "$toml" ]]; then
        echo "Project not found: $name"
        return 1
    fi

    local path=$(_project_get_path "$name")
    local type=$(_project_get_type "$name")

    echo "Project: $name"
    echo "Type: $type"
    echo "Path: $path"
    echo "File: $toml"
    echo ""

    # Show services if type=service
    if [[ "$type" == "service" ]]; then
        echo "Services:"
        local services_dir="$path/services"
        if [[ -d "$services_dir" ]]; then
            for tsm in "$services_dir"/*.tsm; do
                [[ -f "$tsm" ]] || continue
                local svc_name=$(basename "$tsm" .tsm)
                local port=$(grep -E '^TSM_PORT=' "$tsm" 2>/dev/null | cut -d= -f2 | tr -d '"')
                local kind=$(grep -E '^TSM_KIND=' "$tsm" 2>/dev/null | cut -d= -f2 | tr -d '"')
                printf "  %-15s port=%-6s kind=%s\n" "$svc_name" "${port:-none}" "${kind:-http}"
            done
        else
            echo "  (no services/ directory)"
        fi
        echo ""
    fi

    echo "Config:"
    echo "-------"
    cat "$toml"
}

# =============================================================================
# ADD
# =============================================================================

# Register a project (create TOML pointing to source path)
project_add() {
    local name="$1"
    local path="$2"

    if [[ -z "$name" ]]; then
        echo "Usage: deploy project add <name> <path>"
        echo ""
        echo "Registers a project by creating a TOML config."
        echo ""
        echo "Arguments:"
        echo "  name   Project identifier (a-z, 0-9, _, -)"
        echo "  path   Path to source code directory"
        return 1
    fi

    if [[ -z "$path" ]]; then
        echo "Usage: deploy project add <name> <path>"
        echo ""
        echo "Missing: path to source code"
        return 1
    fi

    # Validate name
    if [[ ! "$name" =~ ^[a-zA-Z0-9_-]+$ ]]; then
        echo "Invalid name: use a-z, 0-9, _, -"
        return 1
    fi

    # Expand and validate path
    path="${path/#\~/$HOME}"
    if [[ ! -d "$path" ]]; then
        echo "Path not found: $path"
        return 1
    fi

    local dir=$(_project_dir) || return 1
    mkdir -p "$dir"

    local toml="$dir/${name}.toml"
    if [[ -f "$toml" ]]; then
        echo "Project already exists: $name"
        echo "Edit with: deploy project edit $name"
        return 1
    fi

    # Detect project type
    local type="static"
    if [[ -d "$path/services" ]] && ls "$path/services"/*.tsm &>/dev/null; then
        type="service"
    fi

    # Try to get git info
    local git_repo=""
    local git_branch="main"
    if [[ -d "$path/.git" ]]; then
        git_repo=$(cd "$path" && git remote get-url origin 2>/dev/null)
        git_branch=$(cd "$path" && git rev-parse --abbrev-ref HEAD 2>/dev/null)
    fi

    # Default www path
    local www_path="/var/www/$name"

    # Write TOML
    cat > "$toml" << EOF
# Project: $name
# Created: $(date -Iseconds)

[project]
name = "$name"
type = "$type"
path = "${path/$HOME/\~}"
envs = ["dev", "staging", "prod"]

[git]
repo = "$git_repo"
branch = "$git_branch"

[paths]
www = "$www_path"

[deploy]
# post_pull = "npm install && npm run build"
EOF

    echo "Created: $toml"
    echo ""
    echo "Type: $type"
    [[ "$type" == "service" ]] && echo "Services detected in: $path/services/"
    echo ""
    echo "Next:"
    echo "  deploy project show $name"
    echo "  deploy push $name dev --dry-run"
}

# =============================================================================
# REMOVE
# =============================================================================

# Remove project registration (does not delete source code)
project_remove() {
    local name="$1"

    if [[ -z "$name" ]]; then
        echo "Usage: deploy project remove <name>"
        return 1
    fi

    local toml=$(_project_toml_path "$name")
    if [[ ! -f "$toml" ]]; then
        echo "Project not found: $name"
        return 1
    fi

    local path=$(_project_get_path "$name")

    echo "Remove project registration: $name"
    echo "File: $toml"
    echo ""
    echo "Note: Source code at $path will NOT be deleted."
    echo ""
    read -rp "Continue? [y/N] " confirm

    if [[ "$confirm" =~ ^[Yy]$ ]]; then
        rm "$toml"
        echo "Removed: $name"
    else
        echo "Cancelled"
    fi
}

# =============================================================================
# EDIT
# =============================================================================

project_edit() {
    local name="$1"

    if [[ -z "$name" ]]; then
        echo "Usage: deploy project edit <name>"
        return 1
    fi

    local toml=$(_project_toml_path "$name")
    if [[ ! -f "$toml" ]]; then
        echo "Project not found: $name"
        return 1
    fi

    ${EDITOR:-vim} "$toml"
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f project_list project_names project_show project_add project_remove project_edit
