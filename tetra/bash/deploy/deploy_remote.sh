#!/usr/bin/env bash
# deploy_remote.sh - Remote deployment operations
#
# Uses TETRA_LOCAL_DIR and TETRA_REMOTE_DIR set by deploy_load()

# =============================================================================
# INTERNAL STATE (set by deploy_load)
# =============================================================================

TETRA_LOCAL_DIR=""
TETRA_REMOTE_DIR=""

# From [target]
declare -gA TARGET=()

# From [envs.all] merged with [envs.<env>]
declare -gA ENVS=()

# From [deploy]
declare -ga DEPLOY_PRE=()
declare -ga DEPLOY_COMMANDS=()
declare -ga DEPLOY_POST=()

# =============================================================================
# TARGET LOADING
# =============================================================================

deploy_load() {
    local target_ref="$1"
    local env="$2"

    if [[ -z "$target_ref" || -z "$env" ]]; then
        echo "Usage: deploy_load <target> <env>" >&2
        return 1
    fi

    # Get active org
    local org=$(org_active 2>/dev/null)
    if [[ -z "$org" || "$org" == "none" ]]; then
        echo "No active org. Run: org switch <name>" >&2
        return 1
    fi

    # Resolve target directory
    if [[ -d "$target_ref" ]]; then
        TETRA_LOCAL_DIR="$target_ref"
    elif [[ -d "$TETRA_DIR/orgs/$org/targets/$target_ref" ]]; then
        TETRA_LOCAL_DIR="$TETRA_DIR/orgs/$org/targets/$target_ref"
    else
        echo "Target not found: $target_ref" >&2
        echo "Looked in: $TETRA_DIR/orgs/$org/targets/$target_ref" >&2
        return 1
    fi

    local toml="$TETRA_LOCAL_DIR/tetra-deploy.toml"
    if [[ ! -f "$toml" ]]; then
        echo "No tetra-deploy.toml in: $TETRA_LOCAL_DIR" >&2
        return 1
    fi

    # Parse TOML
    _deploy_parse_toml "$toml" "$env"
}

# Parse tetra-deploy.toml into variables
_deploy_parse_toml() {
    local toml="$1"
    local env="$2"

    # Reset state
    TARGET=()
    ENVS=()
    DEPLOY_PRE=()
    DEPLOY_COMMANDS=()
    DEPLOY_POST=()

    local section=""
    local in_array=""
    local array_name=""

    while IFS= read -r line || [[ -n "$line" ]]; do
        # Skip comments and empty lines
        [[ "$line" =~ ^[[:space:]]*# ]] && continue
        [[ -z "${line// }" ]] && continue

        # Section headers
        if [[ "$line" =~ ^\[([a-zA-Z0-9_.]+)\] ]]; then
            section="${BASH_REMATCH[1]}"
            in_array=""
            continue
        fi

        # Array continuation (lines starting with ")
        if [[ -n "$in_array" && "$line" =~ ^[[:space:]]*\"([^\"]+)\" ]]; then
            local val="${BASH_REMATCH[1]}"
            case "$array_name" in
                pre) DEPLOY_PRE+=("$val") ;;
                commands) DEPLOY_COMMANDS+=("$val") ;;
                post) DEPLOY_POST+=("$val") ;;
            esac
            continue
        fi

        # Array end
        if [[ -n "$in_array" && "$line" =~ \] ]]; then
            in_array=""
            continue
        fi

        # Key = value
        if [[ "$line" =~ ^[[:space:]]*([a-zA-Z_][a-zA-Z0-9_]*)[[:space:]]*=[[:space:]]*(.*) ]]; then
            local key="${BASH_REMATCH[1]}"
            local val="${BASH_REMATCH[2]}"

            # Strip quotes
            val="${val#\"}"
            val="${val%\"}"

            # Check for array start
            if [[ "$val" =~ ^\[ ]]; then
                in_array=1
                array_name="$key"
                # Handle single-line array
                if [[ "$val" =~ \]$ ]]; then
                    in_array=""
                    # Parse inline array
                    val="${val#\[}"
                    val="${val%\]}"
                    while [[ "$val" =~ \"([^\"]+)\" ]]; do
                        local item="${BASH_REMATCH[1]}"
                        case "$key" in
                            pre) DEPLOY_PRE+=("$item") ;;
                            commands) DEPLOY_COMMANDS+=("$item") ;;
                            post) DEPLOY_POST+=("$item") ;;
                        esac
                        val="${val#*\"$item\"}"
                    done
                fi
                continue
            fi

            # Store based on section
            case "$section" in
                target)
                    TARGET["$key"]="$val"
                    [[ "$key" == "cwd" ]] && TETRA_REMOTE_DIR="$val"
                    ;;
                envs.all|env.all)
                    ENVS["$key"]="$val"
                    ;;
                envs.$env|env.$env)
                    ENVS["$key"]="$val"  # Override all
                    ;;
                deploy)
                    ;; # Arrays handled above
            esac
        fi
    done < "$toml"

    return 0
}

# =============================================================================
# TEMPLATE SUBSTITUTION
# =============================================================================

# Simple template expansion - only expands known vars
# Avoids complex bash escaping issues
_deploy_expand() {
    local str="$1"
    local ssh="${ENVS[ssh]}"
    local user="${ENVS[user]}"
    local domain="${ENVS[domain]}"
    local cwd="$TETRA_REMOTE_DIR"
    local localdir="$TETRA_LOCAL_DIR"

    # Expand {{user}} in cwd first
    cwd="${cwd//\{\{user\}\}/$user}"

    # Now expand all vars
    str="${str//\{\{ssh\}\}/$ssh}"
    str="${str//\{\{user\}\}/$user}"
    str="${str//\{\{domain\}\}/$domain}"
    str="${str//\{\{cwd\}\}/$cwd}"
    str="${str//\{\{local\}\}/$localdir}"

    echo "$str"
}

# =============================================================================
# COMMAND EXECUTION
# =============================================================================

_deploy_exec() {
    local cmd="$1"
    local dry_run="${2:-0}"

    # Inline expansion (no subshell)
    local ssh="${ENVS[ssh]}"
    local user="${ENVS[user]}"
    local domain="${ENVS[domain]}"
    local cwd="$TETRA_REMOTE_DIR"

    # Expand {{user}} in cwd first
    cwd="${cwd//\{\{user\}\}/$user}"

    # Expand vars in command
    cmd="${cmd//\{\{ssh\}\}/$ssh}"
    cmd="${cmd//\{\{user\}\}/$user}"
    cmd="${cmd//\{\{domain\}\}/$domain}"
    cmd="${cmd//\{\{cwd\}\}/$cwd}"
    cmd="${cmd//\{\{local\}\}/$TETRA_LOCAL_DIR}"

    echo "> $cmd"

    if [[ "$dry_run" -eq 1 ]]; then
        echo "  [dry-run]"
        return 0
    fi

    eval "$cmd"
}

# =============================================================================
# MAIN DEPLOY
# =============================================================================

deploy_push() {
    local dry_run=0
    local args=()

    # Parse flags
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --dry-run|-n) dry_run=1; shift ;;
            *) args+=("$1"); shift ;;
        esac
    done

    local target="${args[0]}"
    local env="${args[1]}"

    if [[ -z "$target" || -z "$env" ]]; then
        echo "Usage: deploy push [--dry-run] <target> <env>"
        return 1
    fi

    # Load target
    deploy_load "$target" "$env" || return 1

    # Expand {{user}} in TETRA_REMOTE_DIR
    TETRA_REMOTE_DIR="${TETRA_REMOTE_DIR//\{\{user\}\}/${ENVS[user]}}"

    echo "========================================"
    echo "Deploy: ${TARGET[name]:-$target} -> $env"
    echo "========================================"
    echo ""
    echo "Local:  $TETRA_LOCAL_DIR"
    echo "Remote: ${ENVS[ssh]}:$TETRA_REMOTE_DIR"
    echo "Domain: ${ENVS[domain]:-not set}"
    [[ "$dry_run" -eq 1 ]] && echo "[DRY RUN]"
    echo ""

    # Save current dir, cd to local, run commands, restore
    local _saved_pwd="$PWD"
    cd "$TETRA_LOCAL_DIR" || return 1

    # Pre hooks (local)
    if [[ ${#DEPLOY_PRE[@]} -gt 0 ]]; then
        echo "[pre]"
        for cmd in "${DEPLOY_PRE[@]}"; do
            _deploy_exec "$cmd" "$dry_run" || { cd "$_saved_pwd"; return 1; }
        done
        echo ""
    fi

    # Commands (run from local dir)
    if [[ ${#DEPLOY_COMMANDS[@]} -gt 0 ]]; then
        echo "[commands]"
        for cmd in "${DEPLOY_COMMANDS[@]}"; do
            _deploy_exec "$cmd" "$dry_run" || { cd "$_saved_pwd"; return 1; }
        done
        echo ""
    fi

    # Post hooks
    if [[ ${#DEPLOY_POST[@]} -gt 0 ]]; then
        echo "[post]"
        for cmd in "${DEPLOY_POST[@]}"; do
            _deploy_exec "$cmd" "$dry_run" || { cd "$_saved_pwd"; return 1; }
        done
        echo ""
    fi

    cd "$_saved_pwd"

    echo "========================================"
    if [[ "$dry_run" -eq 1 ]]; then
        echo "[DRY RUN] Would deploy: ${TARGET[name]:-$target} -> $env"
    else
        echo "Done: ${TARGET[name]:-$target} -> $env"
    fi
    [[ -n "${ENVS[domain]}" ]] && echo "URL: https://${ENVS[domain]}"
    echo "========================================"
}

# =============================================================================
# STATUS / INFO
# =============================================================================

deploy_show() {
    local target="$1"
    local env="${2:-prod}"

    deploy_load "$target" "$env" || return 1

    echo "Target: ${TARGET[name]:-$target}"
    echo "Local:  $TETRA_LOCAL_DIR"
    echo "Remote: $TETRA_REMOTE_DIR"
    echo ""
    echo "Environment: $env"
    for key in "${!ENVS[@]}"; do
        echo "  $key = ${ENVS[$key]}"
    done
    echo ""
    echo "Pre:      ${DEPLOY_PRE[*]:-none}"
    echo "Commands: ${DEPLOY_COMMANDS[*]:-none}"
    echo "Post:     ${DEPLOY_POST[*]:-none}"
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f deploy_load deploy_push deploy_show
export -f _deploy_parse_toml _deploy_expand _deploy_exec
