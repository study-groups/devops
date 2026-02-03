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
# PROMOTE
# =============================================================================

# Promote local.env to target environment by extracting annotated values
# Annotation format: # {{env:value}} on line before variable
# Example:
#   # {{dev:8580}} {{staging:9080}} {{prod:8080}}
#   export PORT=8580
#
# Usage: deploy env promote <env> [source_dir]
#   env        - target environment (dev, staging, prod)
#   source_dir - optional, defaults to current directory
deploy_env_promote() {
    local env="$1"
    local source_dir="${2:-.}"

    if [[ -z "$env" ]]; then
        echo "Usage: deploy env promote <env> [source_dir]"
        echo "  env: dev, staging, prod"
        echo "  source_dir: directory containing env/local.env (default: .)"
        return 1
    fi

    local source_file="$source_dir/env/local.env"
    local output="$source_dir/env/${env}.env"

    # Check source exists
    if [[ ! -f "$source_file" ]]; then
        echo "No source: $source_file"
        return 1
    fi

    # Load org secrets for envsubst
    local org_secrets=""
    local org="${DEPLOY_ORG:-}"
    [[ -z "$org" ]] && type org_active &>/dev/null && org=$(org_active 2>/dev/null)

    if [[ -n "$org" && "$org" != "none" && -f "$TETRA_DIR/orgs/$org/secrets.env" ]]; then
        org_secrets="$TETRA_DIR/orgs/$org/secrets.env"
    fi

    if [[ -n "$org_secrets" ]]; then
        set -a; source "$org_secrets"; set +a
        echo "Loaded secrets: $org_secrets"
    fi

    # Process: extract {{env:value}} annotations and substitute
    local content=""
    local pending_value=""

    while IFS= read -r line || [[ -n "$line" ]]; do
        # Check for annotation comment: # {{dev:val}} {{staging:val}} {{prod:val}}
        if [[ "$line" =~ ^#.*\{\{${env}:([^}]+)\}\} ]]; then
            pending_value="${BASH_REMATCH[1]}"
            continue  # Skip annotation line in output
        fi

        # If we have a pending value, substitute it in export line
        if [[ -n "$pending_value" && "$line" =~ ^export[[:space:]]+([A-Za-z_][A-Za-z0-9_]*)= ]]; then
            local var_name="${BASH_REMATCH[1]}"
            line="export ${var_name}=${pending_value}"
            pending_value=""
        fi

        content+="$line"$'\n'
    done < "$source_file"

    # Apply envsubst for secrets ($VAR patterns)
    content=$(echo "$content" | envsubst)

    # Warn if output exists
    if [[ -f "$output" ]]; then
        echo "Warning: Overwriting $output"
    fi

    # Write output
    mkdir -p "$(dirname "$output")"
    echo "$content" > "$output"
    chmod 600 "$output"

    echo "Promoted: $source_file → $output"
}

# =============================================================================
# GENERATE ORG-LEVEL ENV FILES
# =============================================================================

# Generate org-level env file for an environment
# Uses local.env as template and injects secrets from secrets.env
#
# Usage: deploy env generate <env> [--org=<org>]
#   env  - target environment (local, dev, staging, prod)
#   --org - organization name (default: TETRA_ORG or 'tetra')
#
# Files:
#   Template: $TETRA_DIR/orgs/<org>/env/local.env
#   Secrets:  $TETRA_DIR/orgs/<org>/secrets.env
#   Output:   $TETRA_DIR/orgs/<org>/env/<env>.env
deploy_env_generate() {
    local env=""
    local org="${TETRA_ORG:-tetra}"

    # Parse args
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --org=*) org="${1#--org=}"; shift ;;
            --org)   org="$2"; shift 2 ;;
            -*)      echo "Unknown option: $1"; return 1 ;;
            *)       [[ -z "$env" ]] && env="$1"; shift ;;
        esac
    done

    if [[ -z "$env" ]]; then
        echo "Usage: deploy env generate <env> [--org=<org>]"
        echo "  env: local, dev, staging, prod"
        echo "  --org: organization (default: $org)"
        return 1
    fi

    local org_dir="$TETRA_DIR/orgs/$org"
    local env_dir="$org_dir/env"
    local template="$env_dir/local.env"
    local secrets="$org_dir/secrets.env"
    local output="$env_dir/${env}.env"

    # Check org exists
    if [[ ! -d "$org_dir" ]]; then
        echo "Org not found: $org_dir"
        return 1
    fi

    # Create env dir if needed
    mkdir -p "$env_dir"

    # Check template exists
    if [[ ! -f "$template" ]]; then
        echo "Template not found: $template"
        echo "Create $template with base environment variables first."
        return 1
    fi

    # Load secrets for envsubst
    if [[ -f "$secrets" ]]; then
        set -a; source "$secrets"; set +a
        echo "Loaded secrets: $secrets"
    else
        echo "No secrets file: $secrets (continuing without secrets)"
    fi

    # Export TETRA_ENV for substitution
    export TETRA_ENV="$env"

    # Process template: apply envsubst for $VAR and ${VAR} patterns
    local content
    content=$(envsubst < "$template")

    # Warn if output exists
    if [[ -f "$output" ]]; then
        echo "Overwriting: $output"
    fi

    # Write output with restricted permissions
    echo "$content" > "$output"
    chmod 600 "$output"

    echo "Generated: $output"
    echo "  Template: $template"
    echo "  Secrets:  ${secrets:-none}"
}

# =============================================================================
# CREATE TSM FROM ENV.TOML
# =============================================================================

# Parse env.toml and generate self-contained .tsm file
# Usage: deploy_env_create <env> [source_dir] [--dry-run]
#
# Reads: env.toml in source_dir (or current dir)
# Writes: <name>-<env>.tsm to services-available
#
# env.toml format:
#   [service]
#   name = "arcade"
#   command = "node build/index.js"
#   description = "..."
#   org = "pixeljam"
#
#   [shared]
#   NODE_ENV = "production"
#   ...
#
#   [secrets]
#   DO_SPACES_KEY = "$DO_SPACES_KEY"
#
#   [local]
#   PORT = "8580"
#   cwd = "$HOME/src/..."
#
#   [dev]
#   PORT = "8580"
#   cwd = "/home/dev/src/..."
#
deploy_env_create() {
    # DEPRECATION NOTICE
    echo "WARNING: 'deploy env create' is deprecated." >&2
    echo "Use 'tsm build <env>' instead:" >&2
    echo "  tsm build dev           # Build dev env" >&2
    echo "  tsm build dev prod      # Build multiple envs" >&2
    echo "" >&2
    echo "tsm build provides:" >&2
    echo "  - Implicit inheritance: local → dev → staging → prod" >&2
    echo "  - Smart staleness detection via deploy push" >&2
    echo "" >&2

    local env=""
    local source_dir="."
    local dry_run=false
    local output_dir=""

    # Parse args
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --dry-run|-n) dry_run=true; shift ;;
            --output=*) output_dir="${1#--output=}"; shift ;;
            --output|-o) output_dir="$2"; shift 2 ;;
            -*) echo "Unknown option: $1"; return 1 ;;
            *)
                if [[ -z "$env" ]]; then
                    env="$1"
                else
                    source_dir="$1"
                fi
                shift
                ;;
        esac
    done

    if [[ -z "$env" ]]; then
        echo "Usage: deploy env create <env> [source_dir] [--dry-run] [--output=dir]"
        echo "  env: local, dev, staging, prod"
        echo "  source_dir: directory containing env.toml (default: .)"
        echo "  --output: output directory (default: services-available)"
        return 1
    fi

    local toml_file="$source_dir/env.toml"
    if [[ ! -f "$toml_file" ]]; then
        echo "Not found: $toml_file"
        return 1
    fi

    # Parse env.toml
    local name="" command="" description="" org="" cwd=""
    local -A shared_vars env_vars secrets_vars

    _deploy_parse_toml "$toml_file" "$env" \
        name command description org cwd \
        shared_vars env_vars secrets_vars || return 1

    # Validate required fields
    if [[ -z "$name" ]]; then
        echo "Missing [service] name in env.toml"
        return 1
    fi
    if [[ -z "$command" ]]; then
        echo "Missing [service] command in env.toml"
        return 1
    fi

    # Determine org for secrets
    [[ -z "$org" ]] && org="${TETRA_ORG:-tetra}"

    # Load org secrets
    local secrets_file="$TETRA_DIR/orgs/$org/secrets.env"
    if [[ -f "$secrets_file" ]]; then
        set -a; source "$secrets_file"; set +a
    fi

    # Merge: shared + env-specific (env overrides shared)
    local -A merged_vars
    for key in "${!shared_vars[@]}"; do
        merged_vars["$key"]="${shared_vars[$key]}"
    done
    for key in "${!env_vars[@]}"; do
        merged_vars["$key"]="${env_vars[$key]}"
    done

    # Resolve secrets ($VAR → actual value)
    for key in "${!secrets_vars[@]}"; do
        local val="${secrets_vars[$key]}"
        if [[ "$val" == \$* ]]; then
            local var_name="${val#\$}"
            var_name="${var_name#\{}"
            var_name="${var_name%\}}"
            merged_vars["$key"]="${!var_name:-}"
        else
            merged_vars["$key"]="$val"
        fi
    done

    # Get PORT and CWD from merged vars or env-specific
    local port="${merged_vars[PORT]:-${env_vars[PORT]:-8080}}"
    [[ -z "$cwd" ]] && cwd="${env_vars[cwd]:-${merged_vars[cwd]:-\$PWD}}"

    # Expand $HOME in cwd for display
    local cwd_expanded=$(echo "$cwd" | envsubst)

    # Determine output
    [[ -z "$output_dir" ]] && output_dir="$TSM_SERVICES_AVAILABLE"
    [[ -z "$output_dir" ]] && output_dir="$TETRA_DIR/orgs/$org/tsm/services-available"

    local output_file="$output_dir/${name}-${env}.tsm"

    # Generate .tsm content
    local content=""
    content+="#!/usr/bin/env bash"$'\n'
    content+="# Generated from env.toml [$env] - do not edit"$'\n'
    content+="# Regenerate: deploy env create $env $source_dir"$'\n'
    content+="# Source: $toml_file"$'\n'
    content+=""$'\n'
    content+="TSM_NAME=\"${name}-${env}\""$'\n'
    content+="TSM_COMMAND=\"$command\""$'\n'
    content+="TSM_PORT=$port"$'\n'
    content+="TSM_CWD=\"$cwd\""$'\n'
    [[ -n "$description" ]] && content+="TSM_DESCRIPTION=\"$description\""$'\n'
    content+=""$'\n'
    content+="# Environment variables"$'\n'

    # Sort keys for consistent output
    local sorted_keys=($(echo "${!merged_vars[@]}" | tr ' ' '\n' | sort))
    for key in "${sorted_keys[@]}"; do
        local val="${merged_vars[$key]}"
        # Skip cwd - it's TSM_CWD
        [[ "$key" == "cwd" ]] && continue
        content+="export ${key}=\"${val}\""$'\n'
    done

    if [[ "$dry_run" == "true" ]]; then
        echo "=== DRY RUN: deploy env create $env ==="
        echo ""
        echo "Would write to: $output_file"
        echo ""
        echo "--- Content ---"
        echo "$content"
        return 0
    fi

    # Ensure output directory exists
    mkdir -p "$output_dir"

    # Write file
    echo "$content" > "$output_file"
    chmod 755 "$output_file"

    echo "Created: $output_file"
    echo "  From: $toml_file [$env]"
    echo "  Port: $port"
    echo "  CWD:  $cwd"
}

# Parse TOML file - simple parser for our env.toml format
# Sets variables via nameref
_deploy_parse_toml() {
    local file="$1"
    local target_env="$2"
    local -n _name="$3"
    local -n _command="$4"
    local -n _description="$5"
    local -n _org="$6"
    local -n _cwd="$7"
    local -n _shared="$8"
    local -n _env="$9"
    local -n _secrets="${10}"

    local current_section=""
    local in_target_env=false

    while IFS= read -r line || [[ -n "$line" ]]; do
        # Skip empty lines and comments
        [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue

        # Trim whitespace
        line="${line#"${line%%[![:space:]]*}"}"
        line="${line%"${line##*[![:space:]]}"}"

        # Section header: [name]
        if [[ "$line" =~ ^\[([a-zA-Z_][a-zA-Z0-9_]*)\]$ ]]; then
            current_section="${BASH_REMATCH[1]}"
            in_target_env=false
            [[ "$current_section" == "$target_env" ]] && in_target_env=true
            continue
        fi

        # Key = "value" or key = 'value' or key = value
        if [[ "$line" =~ ^([a-zA-Z_][a-zA-Z0-9_]*)[[:space:]]*=[[:space:]]*(.+)$ ]]; then
            local key="${BASH_REMATCH[1]}"
            local val="${BASH_REMATCH[2]}"

            # Strip quotes
            val="${val#\"}" ; val="${val%\"}"
            val="${val#\'}" ; val="${val%\'}"

            case "$current_section" in
                service)
                    case "$key" in
                        name) _name="$val" ;;
                        command) _command="$val" ;;
                        description) _description="$val" ;;
                        org) _org="$val" ;;
                    esac
                    ;;
                shared)
                    _shared["$key"]="$val"
                    ;;
                secrets)
                    _secrets["$key"]="$val"
                    ;;
                *)
                    if [[ "$in_target_env" == "true" ]]; then
                        if [[ "$key" == "cwd" ]]; then
                            _cwd="$val"
                        else
                            _env["$key"]="$val"
                        fi
                    fi
                    ;;
            esac
        fi
    done < "$file"

    return 0
}

# =============================================================================
# EXPORTS
# =============================================================================

