#!/usr/bin/env bash
# deploy.sh - Main dispatcher for deploy module
#
# Purpose: Deploy TOML-configured targets to remote environments
# Assumes: org and tkm are configured, SSH connectivity is established
#
# Usage:
#   deploy push <target> <env>        # Full deployment pipeline
#   deploy push <env>                 # Deploy cwd (uses ./tetra-deploy.toml)
#   deploy status                     # Show deployment status

# =============================================================================
# CONFIGURATION
# =============================================================================

DEPLOY_SSH_OPTS="-o BatchMode=yes -o ConnectTimeout=10"

# =============================================================================
# TOML PARSING (minimal, no external deps)
# =============================================================================

# Get value from TOML file
# Usage: _deploy_toml_get <file> <section> <key>
_deploy_toml_get() {
    local file="$1" section="$2" key="$3"

    awk -v sect="$section" -v k="$key" '
        /^\[/ { in_sect = ($0 == "[" sect "]") }
        in_sect && $1 == k && $2 == "=" {
            val = $0
            sub(/^[^=]*=[ \t]*/, "", val)
            gsub(/^["'\''"]|["'\''"]$/, "", val)
            print val
            exit
        }
    ' "$file"
}

# Get array from TOML (single line [...] format)
# Usage: _deploy_toml_get_array <file> <section> <key>
_deploy_toml_get_array() {
    local file="$1" section="$2" key="$3"

    local raw=$(_deploy_toml_get "$file" "$section" "$key")
    [[ -z "$raw" ]] && return

    # Strip brackets and parse quoted strings
    raw="${raw#\[}"
    raw="${raw%\]}"

    # Extract quoted items
    while [[ "$raw" =~ \"([^\"]+)\" ]]; do
        echo "${BASH_REMATCH[1]}"
        raw="${raw#*\"${BASH_REMATCH[1]}\"}"
    done
}

# =============================================================================
# CONTEXT LOADING
# =============================================================================

# Clear deploy context
_deploy_clear() {
    unset DEPLOY_TOML DEPLOY_NAME DEPLOY_REMOTE DEPLOY_DOMAIN DEPLOY_ENV
    unset DEPLOY_HOST DEPLOY_AUTH_USER DEPLOY_WORK_USER
    DEPLOY_PRE=()
    DEPLOY_COMMANDS=()
    DEPLOY_POST=()
}

# Load deploy context from TOML + org
# Usage: _deploy_load <toml_file> <env>
_deploy_load() {
    local toml="$1"
    local env="$2"

    _deploy_clear

    [[ ! -f "$toml" ]] && { echo "Not found: $toml" >&2; return 1; }

    DEPLOY_TOML="$toml"
    DEPLOY_ENV="$env"

    # From target TOML
    DEPLOY_NAME=$(_deploy_toml_get "$toml" "target" "name")
    DEPLOY_REMOTE=$(_deploy_toml_get "$toml" "target" "remote")
    DEPLOY_DOMAIN=$(_deploy_toml_get "$toml" "target" "domain")

    # From org (requires org module)
    if ! type org_active &>/dev/null; then
        echo "org module not loaded" >&2
        return 1
    fi

    if [[ "$(org_active)" == "none" ]]; then
        echo "No active org. Run: org switch <name>" >&2
        return 1
    fi

    DEPLOY_HOST=$(_org_get_host "$env")
    DEPLOY_AUTH_USER=$(_org_get_user "$env")
    DEPLOY_WORK_USER=$(_org_get_work_user "$env")

    [[ -z "$DEPLOY_HOST" ]] && { echo "No host for env: $env" >&2; return 1; }

    # Load command arrays
    mapfile -t DEPLOY_PRE < <(_deploy_toml_get_array "$toml" "deploy" "pre")
    mapfile -t DEPLOY_COMMANDS < <(_deploy_toml_get_array "$toml" "deploy" "commands")
    mapfile -t DEPLOY_POST < <(_deploy_toml_get_array "$toml" "deploy" "post")

    return 0
}

# =============================================================================
# TEMPLATE SUBSTITUTION
# =============================================================================

_deploy_template() {
    local str="$1"

    # From org
    str="${str//\{\{host\}\}/$DEPLOY_HOST}"
    str="${str//\{\{auth_user\}\}/$DEPLOY_AUTH_USER}"
    str="${str//\{\{work_user\}\}/$DEPLOY_WORK_USER}"

    # From target
    str="${str//\{\{name\}\}/$DEPLOY_NAME}"
    str="${str//\{\{remote\}\}/$DEPLOY_REMOTE}"
    str="${str//\{\{domain\}\}/$DEPLOY_DOMAIN}"
    str="${str//\{\{env\}\}/$DEPLOY_ENV}"

    # Shortcuts
    str="${str//\{\{ssh\}\}/${DEPLOY_AUTH_USER}@${DEPLOY_HOST}}"

    echo "$str"
}

# =============================================================================
# COMMAND EXECUTION
# =============================================================================

_deploy_exec() {
    local cmd="$1"
    local dry_run="${2:-0}"

    cmd=$(_deploy_template "$cmd")

    echo "  \$ $cmd"

    if [[ "$dry_run" -eq 1 ]]; then
        return 0
    fi

    eval "$cmd"
}

# =============================================================================
# RESOLVE TARGET
# =============================================================================

# Check if arg looks like an env name
_deploy_is_env() {
    local arg="$1"
    # Check if this env exists in org
    org_env_names 2>/dev/null | grep -qx "$arg"
}

# Find TOML file for named target
_deploy_find_target() {
    local name="$1"
    local org=$(org_active)
    local target_file="$TETRA_DIR/orgs/$org/targets/${name}.toml"

    if [[ -f "$target_file" ]]; then
        echo "$target_file"
        return 0
    fi

    # Also check without .toml extension (directory with tetra-deploy.toml)
    local target_dir="$TETRA_DIR/orgs/$org/targets/$name"
    if [[ -f "$target_dir/tetra-deploy.toml" ]]; then
        echo "$target_dir/tetra-deploy.toml"
        return 0
    fi

    return 1
}

# Resolve args to (toml_file, env)
# Usage: _deploy_resolve "$@" -> sets DEPLOY_RESOLVED_TOML, DEPLOY_RESOLVED_ENV
#
# Patterns:
#   deploy push dev                 -> cwd (if ./tetra-deploy.toml exists), dev
#   deploy push to dev              -> cwd (explicit), dev
#   deploy push docs dev            -> targets/docs, dev
#   deploy push docs to dev         -> targets/docs, dev
#
_deploy_resolve() {
    local arg1="${1:-}"
    local arg2="${2:-}"
    local arg3="${3:-}"

    DEPLOY_RESOLVED_TOML=""
    DEPLOY_RESOLVED_ENV=""

    # No args
    if [[ -z "$arg1" ]]; then
        echo "Usage: deploy push <env> | deploy push <target> <env>" >&2
        return 1
    fi

    # "deploy push to <env>" - explicit cwd mode
    if [[ "$arg1" == "to" ]]; then
        local env="$arg2"
        if [[ -z "$env" ]]; then
            echo "Usage: deploy push to <env>" >&2
            return 1
        fi
        if ! _deploy_is_env "$env"; then
            echo "Unknown env: $env" >&2
            echo "Available: $(org_env_names 2>/dev/null | tr '\n' ' ')" >&2
            return 1
        fi
        if [[ ! -f "./tetra-deploy.toml" ]]; then
            echo "No tetra-deploy.toml in current directory" >&2
            return 1
        fi
        DEPLOY_RESOLVED_TOML="./tetra-deploy.toml"
        DEPLOY_RESOLVED_ENV="$env"
        return 0
    fi

    # Single arg: if it's an env AND cwd has tetra-deploy.toml, use cwd
    if [[ -z "$arg2" ]]; then
        if _deploy_is_env "$arg1" && [[ -f "./tetra-deploy.toml" ]]; then
            DEPLOY_RESOLVED_TOML="./tetra-deploy.toml"
            DEPLOY_RESOLVED_ENV="$arg1"
            return 0
        else
            echo "Unknown env '$arg1' or no tetra-deploy.toml in current directory" >&2
            echo "Available envs: $(org_env_names 2>/dev/null | tr '\n' ' ')" >&2
            return 1
        fi
    fi

    # "deploy push <target> to <env>" or "deploy push <target> <env>"
    local target="$arg1"
    local env=""

    if [[ "$arg2" == "to" ]]; then
        env="$arg3"
    else
        env="$arg2"
    fi

    if [[ -z "$env" ]]; then
        echo "Usage: deploy push <target> <env>" >&2
        return 1
    fi

    if ! _deploy_is_env "$env"; then
        echo "Unknown env: $env" >&2
        echo "Available: $(org_env_names 2>/dev/null | tr '\n' ' ')" >&2
        return 1
    fi

    local toml=$(_deploy_find_target "$target")
    if [[ -z "$toml" ]]; then
        echo "Target not found: $target" >&2
        echo "Looked in: \$TETRA_DIR/orgs/$(org_active)/targets/" >&2
        return 1
    fi

    DEPLOY_RESOLVED_TOML="$toml"
    DEPLOY_RESOLVED_ENV="$env"
    return 0
}

# =============================================================================
# STATUS
# =============================================================================

deploy_status() {
    echo "Deploy Status"
    echo "============="
    echo ""

    # Show active org
    local org=$(org_active 2>/dev/null)
    if [[ -z "$org" || "$org" == "none" ]]; then
        echo "Org: (none)"
        echo "Run: org switch <name>"
        return 1
    fi
    echo "Org: $org"
    echo ""

    # Show targets
    echo "Targets:"
    local targets_dir="$TETRA_DIR/orgs/$org/targets"

    if [[ ! -d "$targets_dir" ]]; then
        echo "  (none)"
        echo "  Create: mkdir -p $targets_dir/<name>"
        return 0
    fi

    local found=0

    # .toml files
    for f in "$targets_dir"/*.toml; do
        [[ -f "$f" ]] || continue
        local name=$(basename "$f" .toml)
        printf "  %s\n" "$name"
        ((found++))
    done

    # Directories with tetra-deploy.toml
    for d in "$targets_dir"/*/; do
        [[ -d "$d" ]] || continue
        [[ -f "$d/tetra-deploy.toml" ]] || continue
        local name=$(basename "$d")
        printf "  %s/\n" "$name"
        ((found++))
    done

    [[ $found -eq 0 ]] && echo "  (none)"

    echo ""
    echo "Also: tetra-deploy.toml in current directory"
}

# =============================================================================
# SHOW
# =============================================================================

deploy_show() {
    _deploy_resolve "$@" || return 1
    _deploy_load "$DEPLOY_RESOLVED_TOML" "$DEPLOY_RESOLVED_ENV" || return 1

    echo "Target:     ${DEPLOY_NAME:-?}"
    echo "TOML:       $DEPLOY_RESOLVED_TOML"
    echo "Env:        $DEPLOY_ENV"
    echo ""
    echo "Host:       $DEPLOY_HOST"
    echo "Auth user:  $DEPLOY_AUTH_USER"
    echo "Work user:  $DEPLOY_WORK_USER"
    echo "Remote:     $DEPLOY_REMOTE"
    echo "Domain:     ${DEPLOY_DOMAIN:--}"
    echo ""
    echo "Pre:        ${DEPLOY_PRE[*]:-(none)}"
    echo "Commands:   ${DEPLOY_COMMANDS[*]:-(none)}"
    echo "Post:       ${DEPLOY_POST[*]:-(none)}"
}

# =============================================================================
# DOCTOR
# =============================================================================

deploy_doctor() {
    echo "Deploy Doctor"
    echo "============="
    echo ""

    # Check org
    local org=$(org_active 2>/dev/null)
    if [[ -z "$org" || "$org" == "none" ]]; then
        echo "[X] No active org"
        echo "    Fix: org switch <name>"
        return 1
    fi
    echo "[OK] Org: $org"

    # Check targets dir
    local targets_dir="$TETRA_DIR/orgs/$org/targets"
    if [[ -d "$targets_dir" ]]; then
        local count=$(find "$targets_dir" -name "*.toml" 2>/dev/null | wc -l | tr -d ' ')
        echo "[OK] Targets: $count found in $targets_dir"
    else
        echo "[--] No targets dir: $targets_dir"
    fi
}

# =============================================================================
# PUSH (main deploy action)
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

    _deploy_resolve "${args[@]}" || return 1
    _deploy_load "$DEPLOY_RESOLVED_TOML" "$DEPLOY_RESOLVED_ENV" || return 1

    local toml_dir=$(dirname "$DEPLOY_RESOLVED_TOML")

    echo "========================================"
    echo "Deploy: ${DEPLOY_NAME:-$(basename "$toml_dir")} -> $DEPLOY_ENV"
    echo "========================================"
    echo ""
    echo "Target: $DEPLOY_RESOLVED_TOML"
    echo "Remote: ${DEPLOY_AUTH_USER}@${DEPLOY_HOST}:${DEPLOY_REMOTE}"
    [[ -n "$DEPLOY_DOMAIN" ]] && echo "Domain: $DEPLOY_DOMAIN"
    [[ "$dry_run" -eq 1 ]] && echo "[DRY RUN]"
    echo ""

    # Pre hooks (run from toml directory)
    if [[ ${#DEPLOY_PRE[@]} -gt 0 ]]; then
        echo "[pre]"
        for cmd in "${DEPLOY_PRE[@]}"; do
            (cd "$toml_dir" && _deploy_exec "$cmd" "$dry_run") || return 1
        done
        echo ""
    fi

    # Commands
    if [[ ${#DEPLOY_COMMANDS[@]} -gt 0 ]]; then
        echo "[commands]"
        for cmd in "${DEPLOY_COMMANDS[@]}"; do
            (cd "$toml_dir" && _deploy_exec "$cmd" "$dry_run") || return 1
        done
        echo ""
    fi

    # Post hooks
    if [[ ${#DEPLOY_POST[@]} -gt 0 ]]; then
        echo "[post]"
        for cmd in "${DEPLOY_POST[@]}"; do
            (cd "$toml_dir" && _deploy_exec "$cmd" "$dry_run") || return 1
        done
        echo ""
    fi

    echo "========================================"
    echo "Done"
    echo "========================================"
}

# =============================================================================
# HELP
# =============================================================================

deploy_help() {
    cat << 'EOF'
deploy - Target deployment for tetra

USAGE
    deploy push <env>                 Deploy cwd to env (uses ./tetra-deploy.toml)
    deploy push <target> <env>        Deploy named target to env
    deploy push --dry-run <target> <env>   Show what would run

COMMANDS
    push [target] <env>      Full deployment pipeline
    status                   Show targets and current org
    show [target] <env>      Show resolved config
    doctor                   Audit deployment setup
    help                     This help

EXAMPLES
    cd ~/src/myapp
    deploy push dev                   # deploy cwd to dev
    deploy push --dry-run prod        # dry run to prod

    deploy push api dev               # deploy named target "api" to dev
    deploy push docs prod             # deploy "docs" to prod

TARGETS
    Named targets live in: $TETRA_DIR/orgs/<org>/targets/
    As either: <name>.toml or <name>/tetra-deploy.toml

    Or use tetra-deploy.toml in current directory.

TEMPLATE VARIABLES
    From org:
      {{host}}        env IP
      {{auth_user}}   SSH login user
      {{work_user}}   app owner user

    From target:
      {{name}}        target name
      {{remote}}      remote path
      {{domain}}      domain string
      {{env}}         environment name

    Shortcut:
      {{ssh}}         auth_user@host

TETRA-DEPLOY.TOML FORMAT
    [target]
    name = "myapp"
    remote = "/var/www/myapp"
    domain = "myapp.example.com"

    [deploy]
    pre = ["npm install", "npm run build"]
    commands = ["rsync -av ./dist/ {{ssh}}:{{remote}}/"]
    post = ["ssh {{ssh}} 'systemctl restart myapp'"]
EOF
}

# =============================================================================
# MAIN DISPATCHER
# =============================================================================

deploy() {
    local cmd="${1:-status}"
    shift 2>/dev/null || true

    case "$cmd" in
        # Status/info
        status|s)
            deploy_status "$@"
            ;;

        show)
            deploy_show "$@"
            ;;

        doctor|doc)
            deploy_doctor "$@"
            ;;

        # Core operations
        push)
            deploy_push "$@"
            ;;

        # Help
        help|h|--help|-h)
            deploy_help
            ;;

        *)
            echo "Unknown: $cmd"
            echo "Try: deploy help"
            return 1
            ;;
    esac
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f deploy deploy_status deploy_show deploy_doctor deploy_push deploy_help
export -f _deploy_load _deploy_template _deploy_exec _deploy_resolve
export -f _deploy_is_env _deploy_find_target _deploy_clear
export -f _deploy_toml_get _deploy_toml_get_array
