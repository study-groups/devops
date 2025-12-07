#!/usr/bin/env bash
# deploy_repo.sh - Load tetra-deploy.toml from repository
#
# The tetra-deploy.toml file lives in the repo and defines:
#   - What the deployment is (name, type)
#   - What env vars it requires
#   - How to run it (service command, port)
#   - Pre/post deployment hooks
#
# Schema:
#   [deploy]
#   name = "arcade"
#   type = "node"              # node | static | python
#
#   [env]
#   required = ["DATABASE_URL", "SECRET_KEY"]
#   optional = ["DEBUG", "LOG_LEVEL"]
#
#   [service]
#   command = "node server.js"
#   port = 3000
#   health = "/health"
#
#   [hooks]
#   pre = ["npm install", "npm run build"]
#   post = ["pm2 restart arcade"]

# =============================================================================
# REPO CONFIG LOADING
# =============================================================================

# Clear all REPO_* variables before loading
_deploy_clear_repo_vars() {
    unset REPO_NAME REPO_TYPE
    unset REPO_ENV_REQUIRED REPO_ENV_OPTIONAL
    unset REPO_SERVICE_CMD REPO_SERVICE_PORT REPO_SERVICE_HEALTH
    unset REPO_HOOKS_PRE REPO_HOOKS_POST
    unset REPO_DEPLOY_TOML_PATH
}

# Load tetra-deploy.toml from repo path
# Usage: deploy_repo_load <repo_path>
deploy_repo_load() {
    local repo_path="$1"

    if [[ -z "$repo_path" ]]; then
        echo "Usage: deploy_repo_load <repo_path>" >&2
        return 1
    fi

    local deploy_toml="$repo_path/tetra-deploy.toml"

    if [[ ! -f "$deploy_toml" ]]; then
        # No tetra-deploy.toml is valid - repo just doesn't define deployment config
        _deploy_clear_repo_vars
        return 1
    fi

    _deploy_clear_repo_vars
    REPO_DEPLOY_TOML_PATH="$deploy_toml"

    # Parse TOML
    toml_parse "$deploy_toml" "REPO_TOML"

    # Deploy config
    REPO_NAME=$(toml_get "deploy" "name" "REPO_TOML")
    REPO_TYPE=$(toml_get "deploy" "type" "REPO_TOML")

    # Env requirements
    REPO_ENV_REQUIRED=$(toml_get "env" "required" "REPO_TOML")
    REPO_ENV_OPTIONAL=$(toml_get "env" "optional" "REPO_TOML")

    # Service config
    REPO_SERVICE_CMD=$(toml_get "service" "command" "REPO_TOML")
    REPO_SERVICE_PORT=$(toml_get "service" "port" "REPO_TOML")
    REPO_SERVICE_HEALTH=$(toml_get "service" "health" "REPO_TOML")

    # Hooks (arrays)
    REPO_HOOKS_PRE=$(toml_get "hooks" "pre" "REPO_TOML")
    REPO_HOOKS_POST=$(toml_get "hooks" "post" "REPO_TOML")

    # Set defaults
    : "${REPO_TYPE:=static}"

    return 0
}

# Check if repo has tetra-deploy.toml
deploy_repo_has_config() {
    local repo_path="$1"
    [[ -f "$repo_path/tetra-deploy.toml" ]]
}

# Show repo deployment config
deploy_repo_show() {
    local repo_path="$1"

    if [[ -z "$repo_path" ]]; then
        echo "Usage: deploy_repo_show <repo_path>"
        return 1
    fi

    local deploy_toml="$repo_path/tetra-deploy.toml"

    if [[ ! -f "$deploy_toml" ]]; then
        echo "No tetra-deploy.toml found in: $repo_path"
        return 1
    fi

    echo "Repo Deploy Config"
    echo "=================="
    echo "File: $deploy_toml"
    echo ""
    cat "$deploy_toml"
}

# =============================================================================
# HOOK EXECUTION
# =============================================================================

# Execute pre-deployment hooks
# Usage: deploy_repo_run_pre_hooks <repo_path> [--dry-run]
deploy_repo_run_pre_hooks() {
    local repo_path="$1"
    local dry_run=0
    [[ "$2" == "--dry-run" ]] && dry_run=1

    if [[ -z "$REPO_HOOKS_PRE" ]]; then
        echo "(no pre hooks)"
        return 0
    fi

    echo "Running pre-deployment hooks..."

    # REPO_HOOKS_PRE is a space-separated list from TOML array
    # Each hook is a command string
    local hook
    for hook in $REPO_HOOKS_PRE; do
        # Remove quotes if present
        hook="${hook#\"}"
        hook="${hook%\"}"

        echo "  > $hook"

        if [[ $dry_run -eq 1 ]]; then
            echo "    [DRY RUN] Would execute"
        else
            if ! (cd "$repo_path" && eval "$hook"); then
                echo "    FAILED: $hook"
                return 1
            fi
        fi
    done

    return 0
}

# Execute post-deployment hooks
# Usage: deploy_repo_run_post_hooks <repo_path> [--dry-run]
deploy_repo_run_post_hooks() {
    local repo_path="$1"
    local dry_run=0
    [[ "$2" == "--dry-run" ]] && dry_run=1

    if [[ -z "$REPO_HOOKS_POST" ]]; then
        echo "(no post hooks)"
        return 0
    fi

    echo "Running post-deployment hooks..."

    local hook
    for hook in $REPO_HOOKS_POST; do
        # Remove quotes if present
        hook="${hook#\"}"
        hook="${hook%\"}"

        echo "  > $hook"

        if [[ $dry_run -eq 1 ]]; then
            echo "    [DRY RUN] Would execute"
        else
            if ! (cd "$repo_path" && eval "$hook"); then
                echo "    WARNING: Hook failed: $hook"
                # Post hooks don't stop deployment
            fi
        fi
    done

    return 0
}

# =============================================================================
# SERVICE MANAGEMENT
# =============================================================================

# Check if deployment is a service (has service config)
deploy_repo_is_service() {
    [[ -n "$REPO_SERVICE_CMD" ]]
}

# Get service info as formatted string
deploy_repo_service_info() {
    if ! deploy_repo_is_service; then
        echo "type=static"
        return
    fi

    echo "type=service"
    echo "command=$REPO_SERVICE_CMD"
    [[ -n "$REPO_SERVICE_PORT" ]] && echo "port=$REPO_SERVICE_PORT"
    [[ -n "$REPO_SERVICE_HEALTH" ]] && echo "health=$REPO_SERVICE_HEALTH"
}

# =============================================================================
# ENV VALIDATION
# =============================================================================

# Validate env file has required variables
# Usage: deploy_repo_validate_env <env_file>
deploy_repo_validate_env() {
    local env_file="$1"

    if [[ -z "$REPO_ENV_REQUIRED" ]]; then
        echo "No required env vars defined"
        return 0
    fi

    if [[ ! -f "$env_file" ]]; then
        echo "Env file not found: $env_file"
        return 1
    fi

    local missing=()
    local var

    # REPO_ENV_REQUIRED is space-separated from TOML array
    for var in $REPO_ENV_REQUIRED; do
        # Remove quotes if present
        var="${var#\"}"
        var="${var%\"}"

        # Check if var exists in env file (with or without export)
        if ! grep -qE "^(export )?${var}=" "$env_file"; then
            missing+=("$var")
        fi
    done

    if [[ ${#missing[@]} -gt 0 ]]; then
        echo "Missing required env vars:"
        printf "  - %s\n" "${missing[@]}"
        return 1
    fi

    echo "All required env vars present"
    return 0
}

# =============================================================================
# SUMMARY
# =============================================================================

# Print summary of repo deploy config
deploy_repo_summary() {
    if [[ -z "$REPO_DEPLOY_TOML_PATH" ]]; then
        echo "No tetra-deploy.toml loaded"
        return 1
    fi

    echo "Deploy Config Summary"
    echo "---------------------"
    echo "Name: ${REPO_NAME:-(not set)}"
    echo "Type: ${REPO_TYPE:-static}"
    echo ""

    if [[ -n "$REPO_ENV_REQUIRED" ]]; then
        echo "Required env vars:"
        local var
        for var in $REPO_ENV_REQUIRED; do
            var="${var#\"}"
            var="${var%\"}"
            echo "  - $var"
        done
        echo ""
    fi

    if deploy_repo_is_service; then
        echo "Service:"
        echo "  Command: $REPO_SERVICE_CMD"
        [[ -n "$REPO_SERVICE_PORT" ]] && echo "  Port: $REPO_SERVICE_PORT"
        [[ -n "$REPO_SERVICE_HEALTH" ]] && echo "  Health: $REPO_SERVICE_HEALTH"
        echo ""
    fi

    if [[ -n "$REPO_HOOKS_PRE" ]]; then
        echo "Pre hooks:"
        local hook
        for hook in $REPO_HOOKS_PRE; do
            hook="${hook#\"}"
            hook="${hook%\"}"
            echo "  - $hook"
        done
        echo ""
    fi

    if [[ -n "$REPO_HOOKS_POST" ]]; then
        echo "Post hooks:"
        local hook
        for hook in $REPO_HOOKS_POST; do
            hook="${hook#\"}"
            hook="${hook%\"}"
            echo "  - $hook"
        done
    fi
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f deploy_repo_load deploy_repo_has_config deploy_repo_show
export -f deploy_repo_run_pre_hooks deploy_repo_run_post_hooks
export -f deploy_repo_is_service deploy_repo_service_info
export -f deploy_repo_validate_env deploy_repo_summary
export -f _deploy_clear_repo_vars
