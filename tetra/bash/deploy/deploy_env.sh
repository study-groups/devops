#!/usr/bin/env bash
# deploy_env.sh - Environment file management with validation
#
# Handles .env files for deployments:
#   - Validation against tetra-deploy.toml requirements
#   - Diff between local and remote
#   - Atomic push with backup
#   - Status overview
#
# Env files are stored in repo: <repo>/env/<environment>.env
# Example: arcade/env/dev.env, arcade/env/prod.env

# =============================================================================
# VALIDATION
# =============================================================================

# Check if env file has all required variables from tetra-deploy.toml
# Usage: deploy_env_validate <target> <env>
deploy_env_validate() {
    local target="$1"
    local env="$2"

    if [[ -z "$target" || -z "$env" ]]; then
        echo "Usage: deploy env validate <target> <env>"
        return 1
    fi

    # Load target config
    deploy_target_load "$target" || return 1

    local repo_path="$TGT_PATH_LOCAL"
    local env_file="$repo_path/env/${env}.env"

    # Check env file exists
    if [[ ! -f "$env_file" ]]; then
        echo "Missing: $env_file"
        return 1
    fi

    # Load repo config for requirements
    if ! deploy_repo_load "$repo_path"; then
        echo "No tetra-deploy.toml (skipping validation)"
        return 0
    fi

    # Validate against requirements
    deploy_repo_validate_env "$env_file"
}

# =============================================================================
# DIFF
# =============================================================================

# Show diff between local and remote env files
# Usage: deploy_env_diff <target> <env>
deploy_env_diff() {
    local target="$1"
    local env="$2"

    if [[ -z "$target" || -z "$env" ]]; then
        echo "Usage: deploy env diff <target> <env>"
        return 1
    fi

    deploy_target_load "$target" || return 1

    local repo_path="$TGT_PATH_LOCAL"
    local local_file="$repo_path/env/${env}.env"
    local ssh_target=$(_deploy_ssh_target "$env") || return 1
    local www_path=$(deploy_target_get_www "$env")
    local remote_file="$www_path/env/${env}.env"

    if [[ ! -f "$local_file" ]]; then
        echo "No local env file: $local_file"
        return 1
    fi

    # Fetch remote to temp
    local tmp=$(mktemp)
    trap "rm -f $tmp" RETURN

    if ! scp -q $DEPLOY_SSH_OPTIONS "$ssh_target:$remote_file" "$tmp" 2>/dev/null; then
        echo "Remote file does not exist (new deployment)"
        echo ""
        echo "Local file will be pushed:"
        echo "---"
        _deploy_env_mask_values "$local_file"
        return 0
    fi

    echo "Diff: local vs remote"
    echo "  Local:  $local_file"
    echo "  Remote: $ssh_target:$remote_file"
    echo "---"

    # Mask secret values in diff output
    diff -u <(_deploy_env_mask_values "$tmp") <(_deploy_env_mask_values "$local_file") \
        --label "remote" --label "local" || true
}

# Mask values for display (show var names, hide values)
_deploy_env_mask_values() {
    local file="$1"
    # Replace value with *** but keep var name
    sed -E 's/^(export )?([A-Za-z_][A-Za-z0-9_]*)=.*/\1\2=***/' "$file"
}

# =============================================================================
# PUSH
# =============================================================================

# Push env file to remote with validation and confirmation
# Usage: deploy_env_push [--dry-run] [--force] <target> <env>
deploy_env_push() {
    _deploy_parse_opts "$@"
    local target="${DEPLOY_ARGS[0]}"
    local env="${DEPLOY_ARGS[1]}"
    local dry_run=$DEPLOY_DRY_RUN
    local force=0

    # Check for --force in remaining args
    for arg in "${DEPLOY_ARGS[@]:2}"; do
        [[ "$arg" == "--force" ]] && force=1
    done

    if [[ -z "$target" || -z "$env" ]]; then
        echo "Usage: deploy env push [--dry-run] [--force] <target> <env>"
        return 1
    fi

    deploy_target_load "$target" || return 1

    local repo_path="$TGT_PATH_LOCAL"
    local local_file="$repo_path/env/${env}.env"
    local ssh_target=$(_deploy_ssh_target "$env") || return 1
    local www_path=$(deploy_target_get_www "$env")
    local remote_file="$www_path/env/${env}.env"

    echo "Env Push: $target -> $env"
    echo "=========================="
    echo ""

    # Step 1: Check file exists
    echo "[1/4] Checking local file..."
    if [[ ! -f "$local_file" ]]; then
        echo "FAILED: File not found: $local_file"
        return 1
    fi
    echo "  Found: $local_file"
    echo ""

    # Step 2: Validate
    echo "[2/4] Validating env file..."
    if ! deploy_env_validate "$target" "$env"; then
        echo "FAILED: Validation failed"
        return 1
    fi
    echo ""

    # Step 3: Show diff (unless --force)
    if [[ $force -ne 1 ]]; then
        echo "[3/4] Checking diff..."
        deploy_env_diff "$target" "$env"
        echo ""

        if [[ $dry_run -eq 1 ]]; then
            echo "[DRY RUN] Would push env file"
            return 0
        fi

        read -rp "Push these changes? [y/N] " confirm
        if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
            echo "Aborted"
            return 1
        fi
    else
        echo "[3/4] Skipping diff (--force)"
        echo ""
    fi

    if [[ $dry_run -eq 1 ]]; then
        echo "[DRY RUN] Would push env file to $ssh_target:$remote_file"
        return 0
    fi

    # Step 4: Backup and push
    echo "[4/4] Pushing env file..."

    # Backup remote (if exists)
    local backup_cmd="test -f $remote_file && cp $remote_file ${remote_file}.bak.\$(date +%Y%m%d-%H%M%S)"
    _deploy_remote_exec "$ssh_target" "$backup_cmd" 2>/dev/null || true

    # Ensure remote directory exists
    _deploy_remote_exec "$ssh_target" "mkdir -p $(dirname $remote_file)" || {
        echo "FAILED: Cannot create remote directory"
        return 1
    }

    # Atomic push: copy to temp, then mv
    local tmp_remote="/tmp/env.${target}.${env}.$$"

    scp -q $DEPLOY_SSH_OPTIONS "$local_file" "$ssh_target:$tmp_remote" || {
        echo "FAILED: scp failed"
        return 1
    }

    _deploy_remote_exec "$ssh_target" "mv $tmp_remote $remote_file && chmod 600 $remote_file" || {
        echo "FAILED: mv/chmod failed"
        return 1
    }

    echo ""
    echo "SUCCESS: Env file pushed to $env"
    echo "  Remote: $ssh_target:$remote_file"
}

# =============================================================================
# PULL
# =============================================================================

# Pull env file from remote
# Usage: deploy_env_pull [--force] <target> <env>
deploy_env_pull() {
    _deploy_parse_opts "$@"
    local target="${DEPLOY_ARGS[0]}"
    local env="${DEPLOY_ARGS[1]}"
    local force=0

    for arg in "${DEPLOY_ARGS[@]:2}"; do
        [[ "$arg" == "--force" ]] && force=1
    done

    if [[ -z "$target" || -z "$env" ]]; then
        echo "Usage: deploy env pull [--force] <target> <env>"
        return 1
    fi

    deploy_target_load "$target" || return 1

    local repo_path="$TGT_PATH_LOCAL"
    local local_file="$repo_path/env/${env}.env"
    local ssh_target=$(_deploy_ssh_target "$env") || return 1
    local www_path=$(deploy_target_get_www "$env")
    local remote_file="$www_path/env/${env}.env"

    echo "Env Pull: $target <- $env"
    echo ""

    # Check if local exists
    if [[ -f "$local_file" && $force -ne 1 ]]; then
        echo "Local file exists: $local_file"
        read -rp "Overwrite? [y/N] " confirm
        if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
            echo "Aborted"
            return 1
        fi
    fi

    # Ensure local directory exists
    mkdir -p "$(dirname "$local_file")"

    # Pull
    if scp -q $DEPLOY_SSH_OPTIONS "$ssh_target:$remote_file" "$local_file"; then
        echo "SUCCESS: Pulled to $local_file"
    else
        echo "FAILED: Could not pull from $ssh_target:$remote_file"
        return 1
    fi
}

# =============================================================================
# EDIT
# =============================================================================

# Edit remote env file via SSH
# Usage: deploy_env_edit <target> <env>
deploy_env_edit() {
    local target="$1"
    local env="$2"

    if [[ -z "$target" || -z "$env" ]]; then
        echo "Usage: deploy env edit <target> <env>"
        return 1
    fi

    deploy_target_load "$target" || return 1

    local ssh_target=$(_deploy_ssh_target "$env") || return 1
    local www_path=$(deploy_target_get_www "$env")
    local remote_file="$www_path/env/${env}.env"

    echo "Editing: $ssh_target:$remote_file"
    ssh -t $DEPLOY_SSH_OPTIONS "$ssh_target" "${EDITOR:-vim} '$remote_file'"
}

# =============================================================================
# STATUS
# =============================================================================

# Show status of env files for a target
# Usage: deploy_env_status <target> [env]
deploy_env_status() {
    local target="$1"
    local filter_env="$2"

    if [[ -z "$target" ]]; then
        echo "Usage: deploy env status <target> [env]"
        return 1
    fi

    deploy_target_load "$target" || return 1

    local repo_path="$TGT_PATH_LOCAL"
    local env_dir="$repo_path/env"

    echo "Env Status: $target"
    echo "====================="
    echo ""
    echo "Local path: $env_dir"

    # Show required vars if available
    if deploy_repo_load "$repo_path" 2>/dev/null && [[ -n "$REPO_ENV_REQUIRED" ]]; then
        echo "Required vars: $REPO_ENV_REQUIRED"
    fi
    echo ""

    if [[ ! -d "$env_dir" ]]; then
        echo "No env/ directory found"
        echo ""
        echo "Create with: mkdir -p $env_dir"
        return 0
    fi

    printf "%-15s %-8s %-10s %s\n" "FILE" "VARS" "SIZE" "VALID"
    printf "%-15s %-8s %-10s %s\n" "----" "----" "----" "-----"

    for f in "$env_dir"/*.env; do
        [[ -f "$f" ]] || continue

        local name=$(basename "$f")
        local env_name="${name%.env}"

        # Filter if specified
        [[ -n "$filter_env" && "$env_name" != "$filter_env" ]] && continue

        local vars=$(grep -cE '^(export )?[A-Za-z_]' "$f" 2>/dev/null || echo 0)
        local size=$(wc -c < "$f" | tr -d ' ')

        # Validate
        local valid="-"
        if [[ -n "$REPO_ENV_REQUIRED" ]]; then
            if deploy_repo_validate_env "$f" >/dev/null 2>&1; then
                valid="ok"
            else
                valid="MISSING"
            fi
        fi

        printf "%-15s %-8s %-10s %s\n" "$name" "$vars" "${size}B" "$valid"
    done
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f deploy_env_validate deploy_env_diff deploy_env_push deploy_env_pull
export -f deploy_env_edit deploy_env_status
export -f _deploy_env_mask_values
