#!/usr/bin/env bash
# deploy_remote.sh - Remote deployment operations for TOML projects
#
# All commands support --dry-run to preview without executing.
# Uses centralized helpers from includes.sh.
#
# Two systems:
# 1. Legacy project-based (deploy_push using PROJ_* vars)
# 2. Target-based with named commands (deploy_target_push using targets/)

# =============================================================================
# TARGET-BASED DEPLOYMENT STATE (set by deploy_target_load)
# =============================================================================

DEPLOY_TARGET_LOCAL_DIR=""
DEPLOY_TARGET_REMOTE_DIR=""

# From [target]
declare -gA DEPLOY_TARGET=()

# From [env.all] merged with [env.<env>]
declare -gA DEPLOY_TARGET_ENVS=()

# From [commands] - named multi-line scripts
declare -gA DEPLOY_TARGET_COMMANDS=()

# From [subtargets] - subtarget definitions
declare -gA DEPLOY_SUBTARGET_FILES=()
declare -gA DEPLOY_SUBTARGET_COMMANDS=()
declare -g DEPLOY_SUBTARGET_NAMES=""

# From [defaults]
declare -g DEPLOY_DEFAULTS_COMMANDS=""

# Legacy support: from [deploy] arrays
declare -ga DEPLOY_LEGACY_PRE=()
declare -ga DEPLOY_LEGACY_COMMANDS=()
declare -ga DEPLOY_LEGACY_POST=()

# =============================================================================
# TARGET-BASED DEPLOYMENT FUNCTIONS
# =============================================================================

# Load target from targets/<name>/tetra-deploy.toml
deploy_target_load() {
    local target_ref="$1"
    local env="$2"

    if [[ -z "$target_ref" || -z "$env" ]]; then
        echo "Usage: deploy_target_load <target> <env>" >&2
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
        DEPLOY_TARGET_LOCAL_DIR="$target_ref"
    elif [[ -d "$TETRA_DIR/orgs/$org/targets/$target_ref" ]]; then
        DEPLOY_TARGET_LOCAL_DIR="$TETRA_DIR/orgs/$org/targets/$target_ref"
    else
        echo "Target not found: $target_ref" >&2
        echo "Looked in: $TETRA_DIR/orgs/$org/targets/$target_ref" >&2
        return 1
    fi

    local toml="$DEPLOY_TARGET_LOCAL_DIR/tetra-deploy.toml"
    if [[ ! -f "$toml" ]]; then
        echo "No tetra-deploy.toml in: $DEPLOY_TARGET_LOCAL_DIR" >&2
        return 1
    fi

    # Parse TOML
    _deploy_target_parse_config "$toml" "$env"
}

# Parse tetra-deploy.toml using toml_parser.sh
_deploy_target_parse_config() {
    local toml="$1"
    local env="$2"

    # Reset state
    DEPLOY_TARGET=()
    DEPLOY_TARGET_ENVS=()
    DEPLOY_TARGET_COMMANDS=()
    DEPLOY_SUBTARGET_FILES=()
    DEPLOY_SUBTARGET_COMMANDS=()
    DEPLOY_SUBTARGET_NAMES=""
    DEPLOY_DEFAULTS_COMMANDS=""
    DEPLOY_LEGACY_PRE=()
    DEPLOY_LEGACY_COMMANDS=()
    DEPLOY_LEGACY_POST=()

    # Parse with full TOML parser (prefix: DTOML)
    toml_parse "$toml" "DTOML"

    # Extract [target] section
    if declare -p DTOML_target &>/dev/null 2>&1; then
        local -n target_ref=DTOML_target
        for key in "${!target_ref[@]}"; do
            DEPLOY_TARGET["$key"]="${target_ref[$key]}"
        done
        [[ -n "${DEPLOY_TARGET[cwd]}" ]] && DEPLOY_TARGET_REMOTE_DIR="${DEPLOY_TARGET[cwd]}"
    fi

    # Extract [env.all] first (defaults)
    if declare -p DTOML_env_all &>/dev/null 2>&1; then
        local -n env_all_ref=DTOML_env_all
        for key in "${!env_all_ref[@]}"; do
            DEPLOY_TARGET_ENVS["$key"]="${env_all_ref[$key]}"
        done
    fi

    # Extract [env.<env>] to override
    local env_var="DTOML_env_${env}"
    if declare -p "$env_var" &>/dev/null 2>&1; then
        local -n env_ref="$env_var"
        for key in "${!env_ref[@]}"; do
            DEPLOY_TARGET_ENVS["$key"]="${env_ref[$key]}"
        done
    fi

    # Extract [commands] section - named commands
    if declare -p DTOML_commands &>/dev/null 2>&1; then
        local -n cmd_ref=DTOML_commands
        for key in "${!cmd_ref[@]}"; do
            DEPLOY_TARGET_COMMANDS["$key"]="${cmd_ref[$key]}"
        done
    fi

    # Extract [subtargets] section
    if declare -p DTOML_subtargets &>/dev/null 2>&1; then
        local -n sub_ref=DTOML_subtargets
        for key in "${!sub_ref[@]}"; do
            local value="${sub_ref[$key]}"
            # Parse inline table: { files = "...", commands = [...] }
            if [[ "$value" =~ files[[:space:]]*=[[:space:]]*\"([^\"]+)\" ]]; then
                DEPLOY_SUBTARGET_FILES["$key"]="${BASH_REMATCH[1]}"
            fi
            if [[ "$value" =~ commands[[:space:]]*=[[:space:]]*\[([^\]]+)\] ]]; then
                local cmds="${BASH_REMATCH[1]}"
                cmds="${cmds//\"/}"
                cmds="${cmds//,/ }"
                DEPLOY_SUBTARGET_COMMANDS["$key"]="$cmds"
            fi
            DEPLOY_SUBTARGET_NAMES+="$key "
        done
    fi

    # Extract [defaults] section
    if declare -p DTOML_defaults &>/dev/null 2>&1; then
        local -n def_ref=DTOML_defaults
        if [[ -n "${def_ref[commands]}" ]]; then
            DEPLOY_DEFAULTS_COMMANDS="${def_ref[commands]//$'\n'/ }"
        fi
    fi

    # Legacy: Extract [deploy] arrays
    if declare -p DTOML_deploy &>/dev/null 2>&1; then
        local -n deploy_ref=DTOML_deploy
        if [[ -n "${deploy_ref[pre]}" ]]; then
            while IFS= read -r line; do
                [[ -n "$line" ]] && DEPLOY_LEGACY_PRE+=("$line")
            done <<< "${deploy_ref[pre]}"
        fi
        if [[ -n "${deploy_ref[commands]}" ]]; then
            while IFS= read -r line; do
                [[ -n "$line" ]] && DEPLOY_LEGACY_COMMANDS+=("$line")
            done <<< "${deploy_ref[commands]}"
        fi
        if [[ -n "${deploy_ref[post]}" ]]; then
            while IFS= read -r line; do
                [[ -n "$line" ]] && DEPLOY_LEGACY_POST+=("$line")
            done <<< "${deploy_ref[post]}"
        fi
    fi

    # Cleanup DTOML_* variables
    for var in $(compgen -v | grep '^DTOML_'); do
        unset "$var"
    done

    return 0
}

# Template expansion with validation
_deploy_target_expand() {
    local str="$1"
    local original="$str"
    local ssh="${DEPLOY_TARGET_ENVS[ssh]}"
    local user="${DEPLOY_TARGET_ENVS[user]}"
    local domain="${DEPLOY_TARGET_ENVS[domain]}"
    local cwd="$DEPLOY_TARGET_REMOTE_DIR"
    local localdir="$DEPLOY_TARGET_LOCAL_DIR"

    # Expand {{user}} in cwd first
    cwd="${cwd//\{\{user\}\}/$user}"

    # Expand all vars
    str="${str//\{\{ssh\}\}/$ssh}"
    str="${str//\{\{user\}\}/$user}"
    str="${str//\{\{domain\}\}/$domain}"
    str="${str//\{\{cwd\}\}/$cwd}"
    str="${str//\{\{local\}\}/$localdir}"

    # Fail if unexpanded vars remain
    if [[ "$str" =~ \{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\} ]]; then
        echo "ERROR: Unexpanded template variable: {{${BASH_REMATCH[1]}}}" >&2
        return 1
    fi

    echo "$str"
}

# Execute a named command
_deploy_target_run_command() {
    local cmd_name="$1"
    local dry_run="${2:-0}"

    local script="${DEPLOY_TARGET_COMMANDS[$cmd_name]}"
    if [[ -z "$script" ]]; then
        echo "ERROR: Unknown command: $cmd_name" >&2
        echo "  Available: ${!DEPLOY_TARGET_COMMANDS[*]}" >&2
        return 1
    fi

    script=$(_deploy_target_expand "$script") || return 1

    echo "[command: $cmd_name]"
    if [[ "$dry_run" -eq 1 ]]; then
        echo "$script" | sed 's/^/  /'
        return 0
    fi

    bash -c "$script"
}

# Execute legacy command string
_deploy_target_exec_legacy() {
    local cmd="$1"
    local dry_run="${2:-0}"

    cmd=$(_deploy_target_expand "$cmd") || return 1

    echo "  \$ $cmd"
    [[ "$dry_run" -eq 1 ]] && return 0
    eval "$cmd"
}

# Parse target spec: "docs:{api,!tests}" -> target predicates
_deploy_parse_target_spec() {
    local spec="$1"
    if [[ "$spec" =~ ^([^:]+):\{([^}]+)\}$ ]]; then
        echo "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}"
    else
        echo "$spec" ""
    fi
}

# Resolve predicates to subtarget list
_deploy_resolve_predicates() {
    local predicates="$1"
    local all_subtargets="$2"

    local -a includes=()
    local -a excludes=()

    IFS=',' read -ra parts <<< "$predicates"
    for part in "${parts[@]}"; do
        part="${part// /}"
        if [[ "$part" == "*" ]]; then
            read -ra includes <<< "$all_subtargets"
        elif [[ "$part" == !* ]]; then
            excludes+=("${part:1}")
        else
            includes+=("$part")
        fi
    done

    for sub in "${includes[@]}"; do
        local excluded=0
        for ex in "${excludes[@]}"; do
            [[ "$sub" == "$ex" ]] && excluded=1 && break
        done
        [[ $excluded -eq 0 ]] && echo "$sub"
    done
}

# Check if files changed since marker
_deploy_files_changed() {
    local pattern="$1"
    local marker_file="$2"
    [[ ! -f "$marker_file" ]] && return 0
    find $pattern -newer "$marker_file" 2>/dev/null | head -1
}

# Check if subtarget should run
_deploy_should_run() {
    local subtarget="$1"
    local force="${2:-0}"
    [[ "$force" -eq 1 ]] && return 0
    local pattern="${DEPLOY_SUBTARGET_FILES[$subtarget]}"
    [[ -z "$pattern" ]] && return 0
    local marker="$DEPLOY_TARGET_LOCAL_DIR/deploy-state/${subtarget}.marker"
    [[ ! -f "$marker" ]] && return 0
    [[ -n "$(_deploy_files_changed "$DEPLOY_TARGET_LOCAL_DIR/$pattern" "$marker")" ]] && return 0
    return 1
}

# Update deploy marker
_deploy_update_marker() {
    local subtarget="${1:-default}"
    local state_dir="$DEPLOY_TARGET_LOCAL_DIR/deploy-state"
    mkdir -p "$state_dir"
    touch "$state_dir/${subtarget}.marker"
}

# Main target-based push
deploy_target_push() {
    local dry_run=0
    local force=0
    local specific_cmd=""
    local args=()

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --dry-run|-n) dry_run=1; shift ;;
            --force|-f) force=1; shift ;;
            --cmd|-c) specific_cmd="$2"; shift 2 ;;
            *) args+=("$1"); shift ;;
        esac
    done

    local target_spec="${args[0]}"
    local env="${args[1]}"

    if [[ -z "$target_spec" || -z "$env" ]]; then
        echo "Usage: deploy push [--dry-run] [--force] [--cmd <name>] <target>[:{subtargets}] <env>"
        echo ""
        echo "Examples:"
        echo "  deploy push docs prod              # Full deploy"
        echo "  deploy push docs:{api} prod        # Only api subtarget"
        echo "  deploy push docs:{*,!tests} prod   # All except tests"
        echo "  deploy push docs prod --cmd sync   # Run only sync command"
        return 1
    fi

    local target predicates
    read target predicates <<< "$(_deploy_parse_target_spec "$target_spec")"

    deploy_target_load "$target" "$env" || return 1

    DEPLOY_TARGET_REMOTE_DIR="${DEPLOY_TARGET_REMOTE_DIR//\{\{user\}\}/${DEPLOY_TARGET_ENVS[user]}}"

    echo "========================================"
    echo "Deploy: ${DEPLOY_TARGET[name]:-$target} -> $env"
    echo "========================================"
    echo ""
    echo "Local:  $DEPLOY_TARGET_LOCAL_DIR"
    echo "Remote: ${DEPLOY_TARGET_ENVS[ssh]}:$DEPLOY_TARGET_REMOTE_DIR"
    echo "Domain: ${DEPLOY_TARGET_ENVS[domain]:-not set}"
    [[ "$dry_run" -eq 1 ]] && echo "[DRY RUN]"
    [[ "$force" -eq 1 ]] && echo "[FORCE]"
    [[ -n "$predicates" ]] && echo "Subtargets: {$predicates}"
    [[ -n "$specific_cmd" ]] && echo "Command: $specific_cmd"
    echo ""

    local _saved_pwd="$PWD"
    cd "$DEPLOY_TARGET_LOCAL_DIR" || return 1

    if [[ -n "$specific_cmd" ]]; then
        _deploy_target_run_command "$specific_cmd" "$dry_run" || { cd "$_saved_pwd"; return 1; }
        [[ "$dry_run" -eq 0 ]] && _deploy_update_marker "cmd-$specific_cmd"

    elif [[ -n "$predicates" ]]; then
        local subtargets
        mapfile -t subtargets < <(_deploy_resolve_predicates "$predicates" "$DEPLOY_SUBTARGET_NAMES")

        if [[ ${#subtargets[@]} -eq 0 ]]; then
            echo "No subtargets matched: {$predicates}"
            echo "Available: $DEPLOY_SUBTARGET_NAMES"
            cd "$_saved_pwd"
            return 1
        fi

        for sub in "${subtargets[@]}"; do
            [[ -z "$sub" ]] && continue
            if ! _deploy_should_run "$sub" "$force"; then
                echo "[subtarget: $sub] (skipped - no changes)"
                continue
            fi
            echo "[subtarget: $sub]"
            local cmds="${DEPLOY_SUBTARGET_COMMANDS[$sub]}"
            for cmd in $cmds; do
                _deploy_target_run_command "$cmd" "$dry_run" || { cd "$_saved_pwd"; return 1; }
            done
            [[ "$dry_run" -eq 0 ]] && _deploy_update_marker "$sub"
            echo ""
        done

    elif [[ -n "$DEPLOY_DEFAULTS_COMMANDS" || ${#DEPLOY_TARGET_COMMANDS[@]} -gt 0 ]]; then
        local cmds_to_run="$DEPLOY_DEFAULTS_COMMANDS"
        [[ -z "$cmds_to_run" ]] && cmds_to_run="${!DEPLOY_TARGET_COMMANDS[*]}"

        for cmd in $cmds_to_run; do
            _deploy_target_run_command "$cmd" "$dry_run" || { cd "$_saved_pwd"; return 1; }
        done
        [[ "$dry_run" -eq 0 ]] && _deploy_update_marker "default"

    else
        # Legacy arrays
        if [[ ${#DEPLOY_LEGACY_PRE[@]} -gt 0 ]]; then
            echo "[pre]"
            for cmd in "${DEPLOY_LEGACY_PRE[@]}"; do
                _deploy_target_exec_legacy "$cmd" "$dry_run" || { cd "$_saved_pwd"; return 1; }
            done
            echo ""
        fi
        if [[ ${#DEPLOY_LEGACY_COMMANDS[@]} -gt 0 ]]; then
            echo "[commands]"
            for cmd in "${DEPLOY_LEGACY_COMMANDS[@]}"; do
                _deploy_target_exec_legacy "$cmd" "$dry_run" || { cd "$_saved_pwd"; return 1; }
            done
            echo ""
        fi
        if [[ ${#DEPLOY_LEGACY_POST[@]} -gt 0 ]]; then
            echo "[post]"
            for cmd in "${DEPLOY_LEGACY_POST[@]}"; do
                _deploy_target_exec_legacy "$cmd" "$dry_run" || { cd "$_saved_pwd"; return 1; }
            done
            echo ""
        fi
    fi

    cd "$_saved_pwd"

    echo "========================================"
    if [[ "$dry_run" -eq 1 ]]; then
        echo "[DRY RUN] Would deploy: ${DEPLOY_TARGET[name]:-$target} -> $env"
    else
        echo "Done: ${DEPLOY_TARGET[name]:-$target} -> $env"
    fi
    [[ -n "${DEPLOY_TARGET_ENVS[domain]}" ]] && echo "URL: https://${DEPLOY_TARGET_ENVS[domain]}"
    echo "========================================"
}

# Show target config
deploy_target_show() {
    local target_spec="$1"
    local env="${2:-prod}"

    local target predicates
    read target predicates <<< "$(_deploy_parse_target_spec "$target_spec")"

    deploy_target_load "$target" "$env" || return 1

    echo "Target: ${DEPLOY_TARGET[name]:-$target}"
    echo "Local:  $DEPLOY_TARGET_LOCAL_DIR"
    echo "Remote: $DEPLOY_TARGET_REMOTE_DIR"
    echo ""
    echo "Environment: $env"
    for key in "${!DEPLOY_TARGET_ENVS[@]}"; do
        echo "  $key = ${DEPLOY_TARGET_ENVS[$key]}"
    done
    echo ""

    if [[ ${#DEPLOY_TARGET_COMMANDS[@]} -gt 0 ]]; then
        echo "Commands:"
        for cmd in "${!DEPLOY_TARGET_COMMANDS[@]}"; do
            local lines=$(echo "${DEPLOY_TARGET_COMMANDS[$cmd]}" | wc -l | tr -d ' ')
            echo "  $cmd ($lines lines)"
        done
        echo ""
    fi

    if [[ -n "$DEPLOY_SUBTARGET_NAMES" ]]; then
        echo "Subtargets:"
        for sub in $DEPLOY_SUBTARGET_NAMES; do
            echo "  $sub: ${DEPLOY_SUBTARGET_COMMANDS[$sub]}"
        done
        echo ""
    fi

    if [[ -n "$predicates" ]]; then
        echo "Predicate resolution: {$predicates}"
        mapfile -t resolved < <(_deploy_resolve_predicates "$predicates" "$DEPLOY_SUBTARGET_NAMES")
        echo "  -> ${resolved[*]}"
    fi
}

# =============================================================================
# REMOTE TSM MANAGEMENT
# =============================================================================

deploy_tsm() {
    _deploy_parse_opts "$@"
    local env="${DEPLOY_ARGS[0]}"
    local tsm_cmd="${DEPLOY_ARGS[*]:1}"

    if [[ -z "$env" ]]; then
        echo "Usage: deploy tsm <env> <tsm-command...>"
        echo ""
        echo "Examples:"
        echo "  deploy tsm dev list"
        echo "  deploy tsm dev logs myapp"
        echo "  deploy tsm dev restart myapp"
        return 1
    fi

    local target
    target=$(_deploy_ssh_target "$env") || return 1

    [[ -z "$tsm_cmd" ]] && tsm_cmd="list"

    echo "TSM on $env ($target)"
    echo "Command: tsm $tsm_cmd"
    echo "---"

    _deploy_remote_exec "$target" "tsm $tsm_cmd"
}

# =============================================================================
# REMOTE NGINX MANAGEMENT
# =============================================================================

deploy_nginx() {
    _deploy_parse_opts "$@"
    local env="${DEPLOY_ARGS[0]}"
    local action="${DEPLOY_ARGS[1]:-list}"

    if [[ -z "$env" ]]; then
        echo "Usage: deploy nginx <env> [action]"
        echo ""
        echo "Actions:"
        echo "  list      List enabled sites (default)"
        echo "  available List available sites"
        echo "  reload    Reload nginx configuration"
        echo "  test      Test nginx configuration"
        echo "  status    Show nginx status"
        echo "  edit <site>  Edit site config"
        return 1
    fi

    local target
    target=$(_deploy_ssh_target "$env") || return 1

    local remote_cmd
    case "$action" in
        list)
            remote_cmd="ls -la $DEPLOY_NGINX_SITES_ENABLED/"
            ;;
        available)
            remote_cmd="ls -la $DEPLOY_NGINX_SITES_AVAILABLE/"
            ;;
        reload)
            remote_cmd="sudo nginx -t && sudo systemctl reload nginx"
            ;;
        test)
            remote_cmd="sudo nginx -t"
            ;;
        status)
            remote_cmd="sudo systemctl status nginx --no-pager"
            ;;
        edit)
            local site="${DEPLOY_ARGS[2]}"
            if [[ -z "$site" ]]; then
                echo "Usage: deploy nginx $env edit <site>"
                return 1
            fi
            remote_cmd="cat $DEPLOY_NGINX_SITES_AVAILABLE/$site"
            ;;
        *)
            echo "Unknown action: $action"
            return 1
            ;;
    esac

    echo "Nginx on $env ($target)"
    echo "---"

    _deploy_remote_exec "$target" "$remote_cmd"
}

# =============================================================================
# GENERIC REMOTE EXEC
# =============================================================================

deploy_exec() {
    _deploy_parse_opts "$@"
    local env="${DEPLOY_ARGS[0]}"
    local cmd="${DEPLOY_ARGS[*]:1}"
    local dry_run=$DEPLOY_DRY_RUN

    if [[ -z "$env" || -z "$cmd" ]]; then
        echo "Usage: deploy exec [--dry-run] <env> <command...>"
        echo ""
        echo "Examples:"
        echo "  deploy exec dev 'ls -la'"
        echo "  deploy exec dev 'pm2 list'"
        echo "  deploy exec --dry-run prod 'systemctl status nginx'"
        return 1
    fi

    local target
    target=$(_deploy_ssh_target "$env") || return 1

    [[ $dry_run -eq 1 ]] && echo "[DRY RUN]"
    echo "Remote exec on $env"
    echo "  Target: $target"
    echo "  Command: $cmd"
    echo ""

    if [[ $dry_run -eq 1 ]]; then
        echo "[DRY RUN] Would execute: ssh $target \"$cmd\""
        return 0
    fi

    echo "---"
    _deploy_remote_exec "$target" "$cmd"
}

# =============================================================================
# DEPLOY PUSH - Full Pipeline for TOML Projects
# =============================================================================

deploy_push() {
    local project env dry_run with_env force
    _deploy_setup "push" "$@" || return 1

    if ! deploy_toml_can_deploy "$env"; then
        echo "Project '$project' cannot deploy to '$env'"
        echo "Allowed: ${PROJ_ENVS:-all}"
        return 1
    fi

    local dry_flag=""
    [[ $dry_run -eq 1 ]] && dry_flag="--dry-run"

    # Determine step count based on project type
    local total_steps=7
    [[ "${PROJ_TYPE:-static}" == "service" ]] && total_steps=8

    [[ $dry_run -eq 1 ]] && echo "[DRY RUN]"
    echo "============================================"
    echo "Deploy Push: $project -> $env"
    echo "============================================"
    echo ""

    # Step 1: Show config
    echo "[1/$total_steps] Project config"
    echo "----------------------------"
    echo "Project:  $PROJ_NAME"
    echo "Type:     ${PROJ_TYPE:-static}"
    echo "Local:    $PROJ_PATH_LOCAL"
    echo "WWW:      $(deploy_toml_get_www "$env")"
    [[ $with_env -eq 1 ]] && echo "Env sync: enabled"
    echo ""

    # Step 2: Resolve SSH target and domain
    echo "[2/$total_steps] Resolving targets"
    echo "----------------------"
    local target
    target=$(_deploy_ssh_target "$env") || return 1

    local domain
    domain=$(deploy_domain_resolve "$env") || return 1
    local www_path=$(deploy_toml_get_www "$env")
    local branch=$(deploy_toml_get_branch "$env")

    echo "SSH:    $target"
    echo "Domain: $domain"
    echo "Branch: $branch"
    echo ""

    # Step 2.5: Env file sync (if --with-env)
    if [[ $with_env -eq 1 ]]; then
        echo "[2.5/$total_steps] Environment file sync"
        echo "------------------------"
        local env_file="$PROJ_PATH_LOCAL/env/${env}.env"
        if [[ -f "$env_file" ]]; then
            echo "Local: $env_file"
            if [[ $dry_run -eq 1 ]]; then
                echo "[DRY RUN] Would sync env file"
            else
                local force_flag=""
                [[ $force -eq 1 ]] && force_flag="--force"
                if ! project_env_push "$project" "$env" $force_flag </dev/null; then
                    echo "WARNING: Env sync failed (continuing)"
                fi
            fi
        else
            echo "No local env file: $env_file"
        fi
        echo ""
    fi

    # Step 3: Git clone or pull
    echo "[3/$total_steps] Git operations"
    echo "--------------------"
    local git_cmd
    local remote_exists="unknown"

    if [[ $dry_run -eq 0 ]]; then
        if _deploy_remote_exec "$target" "test -d $www_path/.git" 2>/dev/null; then
            remote_exists="yes"
        else
            remote_exists="no"
        fi
    fi

    if [[ "$remote_exists" == "no" ]]; then
        echo "Remote path does not exist - will clone"
        if [[ -z "$PROJ_GIT_REPO" ]]; then
            echo "FAILED: No git repo URL configured"
            return 1
        fi
        git_cmd="git clone $PROJ_GIT_REPO $www_path && cd $www_path && git checkout $branch"
    else
        echo "Remote path exists - will pull"
        git_cmd="cd $www_path && git fetch origin && git checkout $branch && git pull origin $branch"
    fi

    echo "Command: ssh $target \"$git_cmd\""

    if [[ $dry_run -eq 1 ]]; then
        echo "[DRY RUN] Would execute git command"
    else
        if ! _deploy_remote_exec "$target" "$git_cmd"; then
            echo "FAILED: Git operation failed"
            _deploy_log "$project" "$env" "push:git" "failed"
            return 1
        fi
    fi
    echo ""

    # Step 4: Post-pull hook
    echo "[4/$total_steps] Post-pull hook"
    echo "--------------------"
    if [[ -n "$PROJ_HOOK_POST_PULL" ]]; then
        local hook_cmd="cd $www_path && $PROJ_HOOK_POST_PULL"
        echo "Hook: $PROJ_HOOK_POST_PULL"
        echo "Command: ssh $target \"$hook_cmd\""

        if [[ $dry_run -eq 1 ]]; then
            echo "[DRY RUN] Would execute hook"
        else
            if ! _deploy_remote_exec "$target" "$hook_cmd"; then
                echo "WARNING: Hook failed (continuing)"
            fi
        fi
    else
        echo "(no hook configured)"
    fi
    echo ""

    # Step 5: Rsync assets (if enabled)
    echo "[5/$total_steps] Rsync assets"
    echo "------------------"
    if [[ "${PROJ_RSYNC_ENABLED:-false}" == "true" ]]; then
        local rsync_source="${PROJ_PATH_LOCAL}/${PROJ_RSYNC_SOURCE:-.}"

        # Build exclude list
        local -a excludes=()
        for excl in $PROJ_RSYNC_EXCLUDE; do
            excludes+=("$excl")
        done

        echo "Source: $rsync_source"
        echo "Dest:   $target:$www_path/"
        echo "Excludes: ${PROJ_RSYNC_EXCLUDE:-none}"

        _deploy_build_rsync_args "$rsync_source/" "$target:$www_path/" "${excludes[@]}"
        echo "Command: ${DEPLOY_RSYNC_CMD[*]}"

        if [[ $dry_run -eq 1 ]]; then
            echo "[DRY RUN] Would execute rsync"
        else
            if ! "${DEPLOY_RSYNC_CMD[@]}"; then
                echo "WARNING: Rsync failed (continuing)"
            fi
        fi
    else
        echo "(rsync disabled)"
    fi
    echo ""

    # Step 6: File permissions
    echo "[6/$total_steps] File permissions"
    echo "----------------------"
    echo "Owner: ${DEPLOY_WWW_USER}:${DEPLOY_WWW_GROUP}"
    echo "Perms: $DEPLOY_WWW_PERMS"
    echo "Path:  $www_path"

    if [[ $dry_run -eq 1 ]]; then
        echo "[DRY RUN] Would set permissions"
    else
        if ! _deploy_set_permissions "$target" "$www_path"; then
            echo "WARNING: Permission setting failed (continuing)"
        fi
    fi
    echo ""

    # Step 7: Service deployment (for type=service)
    if [[ "${PROJ_TYPE:-static}" == "service" ]]; then
        echo "[7/$total_steps] Service deployment"
        echo "-----------------------"
        local services_dir="$PROJ_PATH_LOCAL/services"

        if [[ -d "$services_dir" ]]; then
            local service_count=0
            for tsm_file in "$services_dir"/*.tsm; do
                [[ -f "$tsm_file" ]] || continue
                ((service_count++))
            done

            if [[ $service_count -eq 0 ]]; then
                echo "(no services/*.tsm files found)"
            else
                echo "Services: $service_count"
                echo ""

                for tsm_file in "$services_dir"/*.tsm; do
                    [[ -f "$tsm_file" ]] || continue
                    local svc_name=$(basename "$tsm_file" .tsm)

                    # Load service manifest
                    project_service_load "$project" "$svc_name" 2>/dev/null || {
                        echo "  $svc_name: failed to load manifest"
                        continue
                    }

                    echo "  Service: $svc_name"
                    echo "    Command: ${TSM_COMMAND:-?}"
                    echo "    Port: ${TSM_PORT:-none}"
                    echo "    Proxy: ${TSM_PROXY:-none}"

                    if [[ $dry_run -eq 1 ]]; then
                        echo "    [DRY RUN] Would: tsm stop $svc_name; tsm start $svc_name --env $env"
                    else
                        # Stop existing service (ignore errors)
                        echo "    Stopping..."
                        _deploy_remote_exec "$target" "cd $www_path && tsm stop $svc_name 2>/dev/null || true"

                        # Start service
                        echo "    Starting..."
                        if ! _deploy_remote_exec "$target" "cd $www_path && tsm start $svc_name --env $env"; then
                            echo "    WARNING: Failed to start $svc_name"
                        fi
                    fi

                    # Generate proxy nginx config if needed
                    if [[ "${TSM_PROXY:-none}" != "none" && -n "${TSM_PORT:-}" ]]; then
                        echo "    Generating nginx proxy config..."
                        if [[ $dry_run -eq 1 ]]; then
                            echo "    [DRY RUN] Would generate proxy config"
                        else
                            _deploy_generate_proxy_config "$project" "$svc_name" "$env" "$domain" "$TSM_PORT" "${TSM_PROXY:-subdomain}"
                        fi
                    fi
                    echo ""
                done
            fi
        else
            echo "(no services/ directory)"
        fi
        echo ""
    fi

    # Step 7/8: Nginx config (static) or Step 8 (service)
    local nginx_step=7
    [[ "${PROJ_TYPE:-static}" == "service" ]] && nginx_step=8

    echo "[$nginx_step/$total_steps] Nginx configuration"
    echo "-------------------------"

    if [[ $dry_run -eq 1 ]]; then
        echo "[DRY RUN] Would generate nginx config"
        deploy_nginx_generate --dry-run "$project" "$env" 2>&1 | sed 's/^/  /'
    else
        echo "Generating nginx config..."
        if ! deploy_nginx_generate "$project" "$env"; then
            echo "WARNING: Nginx generation failed"
        else
            echo "Installing nginx config..."
            if ! deploy_nginx_install "$project" "$env"; then
                echo "WARNING: Nginx installation failed"
            fi
        fi
    fi
    echo ""

    # Summary
    echo "============================================"
    if [[ $dry_run -eq 1 ]]; then
        echo "[DRY RUN] Would deploy: $project -> $env"
        echo "URL: https://$domain"
    else
        echo "Deploy COMPLETE: $project -> $env"
        echo "URL: https://$domain"
        _deploy_log "$project" "$env" "push" "success"
    fi
    echo "============================================"
}

# =============================================================================
# GIT-ONLY OPERATION
# =============================================================================

deploy_git() {
    local project env dry_run
    _deploy_setup "git" "$@" || return 1

    [[ $dry_run -eq 1 ]] && echo "[DRY RUN]"
    echo "Git operation: $project -> $env"
    echo ""

    local target=$(_deploy_ssh_target "$env") || return 1
    local www_path=$(deploy_toml_get_www "$env")
    local branch=$(deploy_toml_get_branch "$env")

    local git_cmd
    if [[ $dry_run -eq 0 ]] && _deploy_remote_exec "$target" "test -d $www_path/.git" 2>/dev/null; then
        git_cmd="cd $www_path && git fetch origin && git checkout $branch && git pull origin $branch"
    else
        if [[ -z "$PROJ_GIT_REPO" ]]; then
            echo "No git repo URL configured"
            return 1
        fi
        git_cmd="git clone $PROJ_GIT_REPO $www_path && cd $www_path && git checkout $branch"
    fi

    echo "Target: $target"
    echo "Path:   $www_path"
    echo "Branch: $branch"
    echo "Command: ssh $target \"$git_cmd\""
    echo ""

    if [[ $dry_run -eq 1 ]]; then
        echo "[DRY RUN] Would execute git command"
        return 0
    fi

    if _deploy_remote_exec "$target" "$git_cmd"; then
        _deploy_log "$project" "$env" "git" "success"
    else
        _deploy_log "$project" "$env" "git" "failed"
        return 1
    fi
}

# =============================================================================
# RSYNC-ONLY OPERATION
# =============================================================================

deploy_sync() {
    local project env dry_run
    _deploy_setup "sync" "$@" || return 1

    [[ $dry_run -eq 1 ]] && echo "[DRY RUN]"
    echo "Rsync: $project -> $env"
    echo ""

    local target=$(_deploy_ssh_target "$env") || return 1
    local www_path=$(deploy_toml_get_www "$env")
    local rsync_source="${PROJ_PATH_LOCAL}/${PROJ_RSYNC_SOURCE:-.}"

    # Build exclude list
    local -a excludes=()
    for excl in $PROJ_RSYNC_EXCLUDE; do
        excludes+=("$excl")
    done

    echo "Source: $rsync_source"
    echo "Dest:   $target:$www_path/"
    echo "Excludes: ${PROJ_RSYNC_EXCLUDE:-none}"
    echo ""

    _deploy_build_rsync_args "$rsync_source/" "$target:$www_path/" "${excludes[@]}"
    echo "Command: ${DEPLOY_RSYNC_CMD[*]}"
    echo ""

    if [[ $dry_run -eq 1 ]]; then
        echo "[DRY RUN] Would execute rsync"
        return 0
    fi

    if "${DEPLOY_RSYNC_CMD[@]}"; then
        _deploy_log "$project" "$env" "sync" "success"
    else
        _deploy_log "$project" "$env" "sync" "failed"
        return 1
    fi
}

# =============================================================================
# PERMISSIONS-ONLY OPERATION
# =============================================================================

deploy_perms() {
    local project env dry_run
    _deploy_setup "perms" "$@" || return 1

    [[ $dry_run -eq 1 ]] && echo "[DRY RUN]"
    echo "Setting permissions: $project -> $env"
    echo ""

    local target=$(_deploy_ssh_target "$env") || return 1
    local www_path=$(deploy_toml_get_www "$env")

    echo "Target: $target"
    echo "Path:   $www_path"
    echo "Owner:  ${DEPLOY_WWW_USER}:${DEPLOY_WWW_GROUP}"
    echo "Perms:  $DEPLOY_WWW_PERMS"
    echo ""

    if [[ $dry_run -eq 1 ]]; then
        echo "[DRY RUN] Would set permissions"
        return 0
    fi

    if _deploy_set_permissions "$target" "$www_path"; then
        _deploy_log "$project" "$env" "perms" "success"
    else
        _deploy_log "$project" "$env" "perms" "failed"
        return 1
    fi
}

# =============================================================================
# EXPORTS
# =============================================================================

# Target-based deployment
export -f deploy_target_load deploy_target_push deploy_target_show
export -f _deploy_target_parse_config _deploy_target_expand
export -f _deploy_target_run_command _deploy_target_exec_legacy
export -f _deploy_parse_target_spec _deploy_resolve_predicates
export -f _deploy_files_changed _deploy_should_run _deploy_update_marker

# Legacy project-based deployment
export -f deploy_tsm deploy_nginx deploy_exec
export -f deploy_push deploy_git deploy_sync deploy_perms
