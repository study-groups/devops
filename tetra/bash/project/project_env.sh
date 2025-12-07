#!/usr/bin/env bash
# project/project_env.sh - Environment file management
#
# Manages env/{env}.env files for projects.
# Environment files are gitignored and must be explicitly synced to servers.

# =============================================================================
# STATUS
# =============================================================================

# Show env file status for a project/environment
project_env_status() {
    local name="$1"
    local env="$2"

    if [[ -z "$name" ]]; then
        echo "Usage: deploy env status <project> [env]"
        return 1
    fi

    local path=$(_project_get_path "$name")
    if [[ -z "$path" ]]; then
        echo "Project not found: $name"
        return 1
    fi

    local env_dir="$path/env"

    echo "Project: $name"
    echo "Env dir: $env_dir"
    echo ""

    if [[ ! -d "$env_dir" ]]; then
        echo "No env/ directory"
        echo ""
        echo "Create with:"
        echo "  mkdir -p $env_dir"
        echo "  touch $env_dir/local.env"
        return 0
    fi

    if [[ -n "$env" ]]; then
        # Show specific env
        local env_file="$env_dir/${env}.env"
        if [[ -f "$env_file" ]]; then
            echo "File: $env_file"
            echo "Size: $(wc -c < "$env_file") bytes"
            echo "Vars: $(grep -c -E '^[A-Z_]+=' "$env_file" 2>/dev/null || echo 0)"
        else
            echo "Not found: $env_file"
        fi
    else
        # Show all envs
        echo "Environment files:"
        printf "  %-15s %-10s %s\n" "ENV" "VARS" "SIZE"
        printf "  %-15s %-10s %s\n" "---" "----" "----"

        for env_file in "$env_dir"/*.env; do
            [[ -f "$env_file" ]] || continue
            local e=$(basename "$env_file" .env)
            local vars=$(grep -c -E '^[A-Z_]+=' "$env_file" 2>/dev/null || echo 0)
            local size=$(wc -c < "$env_file" | tr -d ' ')
            printf "  %-15s %-10s %s\n" "$e" "$vars" "${size}B"
        done
    fi
}

# =============================================================================
# PUSH
# =============================================================================

# Push local env file to remote server
# Usage: project_env_push <project> <env> [--force]
project_env_push() {
    local name="$1"
    local env="$2"
    local force=0

    # Parse --force flag
    for arg in "$@"; do
        [[ "$arg" == "--force" ]] && force=1
    done

    if [[ -z "$name" || -z "$env" ]]; then
        echo "Usage: deploy env push <project> <env> [--force]"
        return 1
    fi

    local path=$(_project_get_path "$name")
    if [[ -z "$path" ]]; then
        echo "Project not found: $name"
        return 1
    fi

    local local_file="$path/env/${env}.env"
    if [[ ! -f "$local_file" ]]; then
        echo "Local env file not found: $local_file"
        return 1
    fi

    # Get remote target
    local target=$(_project_ssh_target "$env")
    if [[ -z "$target" ]]; then
        echo "No SSH target for: $env"
        return 1
    fi

    # Get remote project path (from TOML www path or derive from project path)
    local remote_path
    remote_path=$(grep -E '^\s*www\s*=' "$(_project_toml_path "$name")" | head -1 | sed 's/.*=\s*"\([^"]*\)".*/\1/')
    if [[ -z "$remote_path" ]]; then
        remote_path="/var/www/$name"
    fi

    local remote_file="$remote_path/env/${env}.env"
    local remote_dir="$remote_path/env"

    echo "Push env file"
    echo "  Local:  $local_file"
    echo "  Remote: $target:$remote_file"
    echo ""

    # Check if remote file exists
    local remote_exists=0
    if _project_remote_exec "$target" "test -f '$remote_file'" 2>/dev/null; then
        remote_exists=1
        if [[ $force -eq 0 ]]; then
            echo "Remote file exists. Will backup before overwrite."
        else
            echo "Remote file exists. --force: skipping backup."
        fi
        echo ""
    fi

    read -rp "Continue? [y/N] " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo "Cancelled"
        return 1
    fi

    # Ensure remote directory exists
    _project_remote_exec "$target" "mkdir -p '$remote_dir'" || {
        echo "Failed to create remote directory"
        return 1
    }

    # Backup existing file (unless --force)
    if [[ $remote_exists -eq 1 && $force -eq 0 ]]; then
        local backup="${remote_file}.bak.$(date +%s)"
        echo "Backing up: $backup"
        _project_remote_exec "$target" "cp '$remote_file' '$backup'" || {
            echo "Failed to backup remote file"
            return 1
        }
    fi

    # Atomic write: scp to tmp, then mv
    local tmp_file="/tmp/env.${name}.${env}.$$"
    echo "Uploading..."
    scp $PROJECT_SSH_OPTIONS "$local_file" "${target}:${tmp_file}" || {
        echo "Failed to upload"
        return 1
    }

    echo "Installing..."
    _project_remote_exec "$target" "mv '$tmp_file' '$remote_file' && chmod 600 '$remote_file'" || {
        echo "Failed to install"
        return 1
    }

    echo ""
    echo "Done: $remote_file"
}

# =============================================================================
# PULL
# =============================================================================

# Pull remote env file to local (for backup)
project_env_pull() {
    local name="$1"
    local env="$2"

    if [[ -z "$name" || -z "$env" ]]; then
        echo "Usage: deploy env pull <project> <env>"
        return 1
    fi

    local path=$(_project_get_path "$name")
    if [[ -z "$path" ]]; then
        echo "Project not found: $name"
        return 1
    fi

    local target=$(_project_ssh_target "$env")
    if [[ -z "$target" ]]; then
        echo "No SSH target for: $env"
        return 1
    fi

    # Get remote path
    local remote_path
    remote_path=$(grep -E '^\s*www\s*=' "$(_project_toml_path "$name")" | head -1 | sed 's/.*=\s*"\([^"]*\)".*/\1/')
    [[ -z "$remote_path" ]] && remote_path="/var/www/$name"

    local remote_file="$remote_path/env/${env}.env"
    local local_dir="$path/env"
    local local_file="$local_dir/${env}.env"

    echo "Pull env file"
    echo "  Remote: $target:$remote_file"
    echo "  Local:  $local_file"
    echo ""

    # Check remote exists
    if ! _project_remote_exec "$target" "test -f '$remote_file'" 2>/dev/null; then
        echo "Remote file not found"
        return 1
    fi

    # Warn if local exists
    if [[ -f "$local_file" ]]; then
        echo "Local file exists. Will overwrite."
        read -rp "Continue? [y/N] " confirm
        if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
            echo "Cancelled"
            return 1
        fi
    fi

    # Ensure local directory
    mkdir -p "$local_dir"

    # Download
    echo "Downloading..."
    scp $PROJECT_SSH_OPTIONS "${target}:${remote_file}" "$local_file" || {
        echo "Failed to download"
        return 1
    }

    echo ""
    echo "Done: $local_file"
}

# =============================================================================
# EDIT
# =============================================================================

# Edit remote env file via SSH
project_env_edit() {
    local name="$1"
    local env="$2"

    if [[ -z "$name" || -z "$env" ]]; then
        echo "Usage: deploy env edit <project> <env>"
        return 1
    fi

    local target=$(_project_ssh_target "$env")
    if [[ -z "$target" ]]; then
        echo "No SSH target for: $env"
        return 1
    fi

    local remote_path
    remote_path=$(grep -E '^\s*www\s*=' "$(_project_toml_path "$name")" | head -1 | sed 's/.*=\s*"\([^"]*\)".*/\1/')
    [[ -z "$remote_path" ]] && remote_path="/var/www/$name"

    local remote_file="$remote_path/env/${env}.env"

    echo "Editing: $target:$remote_file"
    ssh -t $PROJECT_SSH_OPTIONS "$target" "${EDITOR:-vim} '$remote_file'"
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f project_env_status project_env_push project_env_pull project_env_edit
