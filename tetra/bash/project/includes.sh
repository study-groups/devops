#!/usr/bin/env bash
# project/includes.sh - Module loader for project management
#
# Internal module used by deploy for project registry, service discovery,
# and environment file management. Not exposed as a top-level command.
#
# Usage: source from deploy/includes.sh

# =============================================================================
# MODULE INITIALIZATION
# =============================================================================

source "$TETRA_SRC/bash/utils/module_init.sh"
source "$TETRA_SRC/bash/utils/function_helpers.sh"

tetra_module_init_with_alias "project" "PROJECT" ""

# Source org dependency for environment info
tetra_source_if_exists "${TETRA_SRC}/bash/org/org.sh"

# =============================================================================
# SHARED HELPERS
# =============================================================================

# Get projects directory for active org
_project_dir() {
    local org=$(org_active 2>/dev/null)
    if [[ -z "$org" || "$org" == "none" ]]; then
        echo "No active org" >&2
        return 1
    fi
    echo "$TETRA_DIR/orgs/$org/projects"
}

# Get project TOML path
_project_toml_path() {
    local name="$1"
    local dir=$(_project_dir) || return 1
    echo "$dir/${name}.toml"
}

# Get project source path from TOML
# Usage: _project_get_path <project_name>
_project_get_path() {
    local name="$1"
    local toml=$(_project_toml_path "$name") || return 1
    [[ ! -f "$toml" ]] && return 1

    local path=$(grep -E '^\s*path\s*=' "$toml" | head -1 | sed 's/.*=\s*"\([^"]*\)".*/\1/')
    path="${path/#\~/$HOME}"
    echo "$path"
}

# Get project type from TOML (static | service)
_project_get_type() {
    local name="$1"
    local toml=$(_project_toml_path "$name") || return 1
    [[ ! -f "$toml" ]] && return 1

    local type=$(grep -E '^\s*type\s*=' "$toml" | head -1 | sed 's/.*=\s*"\([^"]*\)".*/\1/')
    echo "${type:-static}"
}

# SSH options for remote operations
PROJECT_SSH_TIMEOUT="${PROJECT_SSH_TIMEOUT:-10}"
PROJECT_SSH_OPTIONS="${PROJECT_SSH_OPTIONS:--o BatchMode=yes -o ConnectTimeout=$PROJECT_SSH_TIMEOUT}"

# Get SSH target for environment
_project_ssh_target() {
    local env="$1"

    local host=$(_org_get_host "$env")
    if [[ -z "$host" ]]; then
        echo "No host configured for: $env" >&2
        return 1
    fi

    local user=$(_org_get_work_user "$env")
    [[ -z "$user" ]] && user="$env"

    echo "${user}@${host}"
}

# Run command on remote
_project_remote_exec() {
    local target="$1"
    shift
    ssh $PROJECT_SSH_OPTIONS "$target" "$@"
}

# =============================================================================
# EXPORTS
# =============================================================================

export PROJECT_SSH_TIMEOUT PROJECT_SSH_OPTIONS
export -f _project_dir _project_toml_path _project_get_path _project_get_type
export -f _project_ssh_target _project_remote_exec

# =============================================================================
# SOURCE PROJECT MODULES
# =============================================================================

source "$MOD_SRC/project_registry.sh"
source "$MOD_SRC/project_services.sh"
source "$MOD_SRC/project_env.sh"
