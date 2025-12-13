#!/usr/bin/env bash
# deploy.sh - Unified deployment system
#
# Two modes (auto-detected):
#   1. Standalone: SSH config in target TOML ([envs.<env>] has ssh key)
#   2. Org-integrated: SSH from org module (no ssh in target TOML)
#
# Usage:
#   deploy                    With context set: confirm and deploy
#   deploy <target> <env>     Named target from targets/
#   deploy <env>              CWD mode (uses ./tetra-deploy.toml)
#   deploy target <name>      Set current target context
#   deploy env <name>         Set current env context
#   deploy info               Show current context
#   deploy clear              Clear context
#   deploy list               List targets
#   deploy help               Help
#
# Template variables:
#   {{ssh}}         user@host (standalone) or auth_user@host (org)
#   {{host}}        IP/hostname
#   {{user}}        work user
#   {{auth_user}}   SSH login user (org mode)
#   {{work_user}}   app owner user (org mode)
#   {{remote}}      remote path (target.remote or target.cwd)
#   {{domain}}      domain string
#   {{env}}         environment name
#   {{name}}        target name
#   {{local}}       local directory

# =============================================================================
# CONFIGURATION
# =============================================================================

DEPLOY_SSH_OPTS="-o BatchMode=yes -o ConnectTimeout=10"

# =============================================================================
# DEPLOY CONTEXT (persistent state for prompt integration)
# =============================================================================

# Context state - persists across commands
export DEPLOY_CTX_ORG="${DEPLOY_CTX_ORG:-}"
export DEPLOY_CTX_TARGET="${DEPLOY_CTX_TARGET:-}"
export DEPLOY_CTX_SUBTARGET="${DEPLOY_CTX_SUBTARGET:-}"
export DEPLOY_CTX_ENV="${DEPLOY_CTX_ENV:-}"

# Get active org for deploy (context or global)
_deploy_active_org() {
    if [[ -n "$DEPLOY_CTX_ORG" ]]; then
        echo "$DEPLOY_CTX_ORG"
    elif type org_active &>/dev/null; then
        org_active 2>/dev/null
    fi
}

# Prompt info function - called by tetra_prompt
# Returns org:target:env format for prompt display
_tetra_deploy_info() {
    local org="$DEPLOY_CTX_ORG"
    local target="$DEPLOY_CTX_TARGET"
    local subtarget="$DEPLOY_CTX_SUBTARGET"
    local env="$DEPLOY_CTX_ENV"

    # Nothing set - no display
    [[ -z "$org" && -z "$target" && -z "$env" ]] && return

    local parts=()
    [[ -n "$org" ]] && parts+=("$org") || parts+=("?")

    # Combine target/subtarget
    local target_str="?"
    if [[ -n "$target" ]]; then
        target_str="$target"
        [[ -n "$subtarget" ]] && target_str="$target/$subtarget"
    fi
    parts+=("$target_str")

    [[ -n "$env" ]] && parts+=("$env") || parts+=("?")

    local IFS=":"
    echo "${parts[*]}"
}

# Set org context
deploy_org_set() {
    local name="$1"

    if [[ -z "$name" ]]; then
        if [[ -n "$DEPLOY_CTX_ORG" ]]; then
            echo "Current org: $DEPLOY_CTX_ORG"
        else
            echo "No org set"
            echo "Usage: deploy org <name>"
            # List available orgs
            if [[ -d "$TETRA_DIR/orgs" ]]; then
                echo "Available: $(ls "$TETRA_DIR/orgs" 2>/dev/null | tr '\n' ' ')"
            fi
        fi
        return 0
    fi

    # Validate org exists
    if [[ ! -d "$TETRA_DIR/orgs/$name" ]]; then
        echo "Org not found: $name" >&2
        if [[ -d "$TETRA_DIR/orgs" ]]; then
            echo "Available: $(ls "$TETRA_DIR/orgs" 2>/dev/null | tr '\n' ' ')" >&2
        fi
        return 1
    fi

    export DEPLOY_CTX_ORG="$name"
    # Clear target when org changes (targets are org-specific)
    export DEPLOY_CTX_TARGET=""
    echo "Org: $name"
    echo "  Need: deploy target <name>"
}

# Set target context
deploy_target_set() {
    local name="$1"
    local subtarget="$2"

    if [[ -z "$name" ]]; then
        if [[ -n "$DEPLOY_CTX_TARGET" ]]; then
            echo "Current target: $DEPLOY_CTX_TARGET"
            [[ -n "$DEPLOY_CTX_SUBTARGET" ]] && echo "  Subtarget: $DEPLOY_CTX_SUBTARGET"
        else
            echo "No target set"
            echo "Usage: deploy target <name> [subtarget]"
        fi
        return 0
    fi

    # Validate target exists
    local toml=$(_deploy_find_target "$name")
    if [[ -z "$toml" ]]; then
        # Check CWD
        if [[ "$name" == "." && -f "./tetra-deploy.toml" ]]; then
            export DEPLOY_CTX_TARGET="."
            export DEPLOY_CTX_SUBTARGET=""
            echo "Target: . (cwd)"
            return 0
        fi
        echo "Target not found: $name" >&2
        return 1
    fi

    export DEPLOY_CTX_TARGET="$name"

    # Handle subtarget
    if [[ -n "$subtarget" ]]; then
        # Validate subtarget exists in TOML
        if grep -q "^\[subtargets\]" "$toml" && \
           awk '/^\[subtargets\]/{found=1; next} /^\[/{found=0} found && /^'"$subtarget"'[ ]*=/{exit 0} END{exit 1}' "$toml"; then
            export DEPLOY_CTX_SUBTARGET="$subtarget"
            echo "Target: $name/$subtarget"
        else
            echo "Subtarget not found: $subtarget" >&2
            echo "Target: $name (no subtarget)"
            export DEPLOY_CTX_SUBTARGET=""
        fi
    else
        export DEPLOY_CTX_SUBTARGET=""
        echo "Target: $name"
    fi

    # Show what's needed
    if [[ -z "$DEPLOY_CTX_ENV" ]]; then
        echo "  Need: deploy env <name>"
    else
        echo "  Env: $DEPLOY_CTX_ENV"
        echo "  Ready: deploy"
    fi
}

# Set env context
deploy_env_set() {
    local name="$1"

    if [[ -z "$name" ]]; then
        if [[ -n "$DEPLOY_CTX_ENV" ]]; then
            echo "Current env: $DEPLOY_CTX_ENV"
        else
            echo "No env set"
            echo "Usage: deploy env <name>"
            if type org_env_names &>/dev/null; then
                echo "Available: $(org_env_names 2>/dev/null | tr '\n' ' ')"
            fi
        fi
        return 0
    fi

    export DEPLOY_CTX_ENV="$name"
    echo "Env: $name"

    # Show what's needed
    if [[ -z "$DEPLOY_CTX_TARGET" ]]; then
        echo "  Need: deploy target <name>"
    else
        echo "  Target: $DEPLOY_CTX_TARGET"
        echo "  Ready: deploy"
    fi
}

# Clear context
deploy_clear_context() {
    export DEPLOY_CTX_ORG=""
    export DEPLOY_CTX_TARGET=""
    export DEPLOY_CTX_SUBTARGET=""
    export DEPLOY_CTX_ENV=""
    echo "Deploy context cleared"
}

# Show context info
deploy_info() {
    echo "Deploy Context"
    echo "=============="

    echo "Org:       ${DEPLOY_CTX_ORG:-(not set)}"
    local target_display="${DEPLOY_CTX_TARGET:-(not set)}"
    [[ -n "$DEPLOY_CTX_SUBTARGET" ]] && target_display="$target_display/$DEPLOY_CTX_SUBTARGET"
    echo "Target:    $target_display"
    echo "Env:       ${DEPLOY_CTX_ENV:-(not set)}"

    if [[ -n "$DEPLOY_CTX_ORG" && -n "$DEPLOY_CTX_TARGET" && -n "$DEPLOY_CTX_ENV" ]]; then
        echo ""
        echo "Ready to deploy. Run: deploy"
        echo ""
        # Show preview
        deploy_show "$DEPLOY_CTX_TARGET" "$DEPLOY_CTX_ENV" 2>/dev/null
    elif [[ -z "$DEPLOY_CTX_ORG" ]]; then
        echo ""
        echo "Set org: deploy org <name>"
        if [[ -d "$TETRA_DIR/orgs" ]]; then
            echo "Available: $(ls "$TETRA_DIR/orgs" 2>/dev/null | tr '\n' ' ')"
        fi
    elif [[ -z "$DEPLOY_CTX_TARGET" ]]; then
        echo ""
        echo "Set target: deploy target <name>"
    elif [[ -z "$DEPLOY_CTX_ENV" ]]; then
        echo ""
        echo "Set env: deploy env <name>"
    fi
}

# Deploy with context (confirm first)
deploy_with_context() {
    if [[ -z "$DEPLOY_CTX_TARGET" ]]; then
        echo "No target set. Use: deploy target <name>" >&2
        return 1
    fi
    if [[ -z "$DEPLOY_CTX_ENV" ]]; then
        echo "No env set. Use: deploy env <name>" >&2
        if type org_env_names &>/dev/null; then
            echo "Available: $(org_env_names 2>/dev/null | tr '\n' ' ')" >&2
        fi
        return 1
    fi

    # Show what will happen
    echo "Deploy: $DEPLOY_CTX_TARGET -> $DEPLOY_CTX_ENV"
    echo ""

    # Quick preview
    local toml
    if [[ "$DEPLOY_CTX_TARGET" == "." ]]; then
        toml="./tetra-deploy.toml"
    else
        toml=$(_deploy_find_target "$DEPLOY_CTX_TARGET")
    fi

    if [[ -n "$toml" ]]; then
        _deploy_load "$toml" "$DEPLOY_CTX_ENV" 2>/dev/null
        echo "  Remote: ${DEPLOY_SSH}:${DEPLOY_REMOTE//\{\{user\}\}/$DEPLOY_WORK_USER}"
        [[ -n "$DEPLOY_DOMAIN" ]] && echo "  Domain: $DEPLOY_DOMAIN"
        echo ""
    fi

    read -rp "Proceed? [y/N] " confirm
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
        deploy_push "$DEPLOY_CTX_TARGET" "$DEPLOY_CTX_ENV"
    else
        echo "Cancelled"
    fi
}

# =============================================================================
# INTERNAL STATE
# =============================================================================

# Cleared by _deploy_clear, set by _deploy_load
DEPLOY_TOML=""
DEPLOY_TOML_DIR=""
DEPLOY_ENV=""
DEPLOY_MODE=""          # "standalone" or "org"

# From target TOML
DEPLOY_NAME=""
DEPLOY_REMOTE=""
DEPLOY_DOMAIN=""

# SSH info (from TOML in standalone, from org in org-mode)
DEPLOY_SSH=""           # user@host shortcut
DEPLOY_HOST=""
DEPLOY_AUTH_USER=""
DEPLOY_WORK_USER=""

# Command arrays
declare -ga DEPLOY_PRE=()
declare -ga DEPLOY_COMMANDS=()
declare -ga DEPLOY_POST=()

# =============================================================================
# TOML PARSING
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
_deploy_toml_get_array() {
    local file="$1" section="$2" key="$3"

    local raw=$(_deploy_toml_get "$file" "$section" "$key")
    [[ -z "$raw" ]] && return

    # Strip brackets and parse quoted strings
    raw="${raw#\[}"
    raw="${raw%\]}"

    while [[ "$raw" =~ \"([^\"]+)\" ]]; do
        echo "${BASH_REMATCH[1]}"
        raw="${raw#*\"${BASH_REMATCH[1]}\"}"
    done
}

# Check if TOML has ssh key in envs section (standalone mode indicator)
_deploy_toml_has_ssh() {
    local file="$1" env="$2"
    local ssh=$(_deploy_toml_get "$file" "envs.$env" "ssh")
    [[ -z "$ssh" ]] && ssh=$(_deploy_toml_get "$file" "envs.all" "ssh")
    [[ -z "$ssh" ]] && ssh=$(_deploy_toml_get "$file" "env.$env" "ssh")
    [[ -z "$ssh" ]] && ssh=$(_deploy_toml_get "$file" "env.all" "ssh")
    [[ -n "$ssh" ]]
}

# =============================================================================
# CONTEXT LOADING
# =============================================================================

_deploy_clear() {
    DEPLOY_TOML=""
    DEPLOY_TOML_DIR=""
    DEPLOY_ENV=""
    DEPLOY_MODE=""
    DEPLOY_NAME=""
    DEPLOY_REMOTE=""
    DEPLOY_DOMAIN=""
    DEPLOY_SSH=""
    DEPLOY_HOST=""
    DEPLOY_AUTH_USER=""
    DEPLOY_WORK_USER=""
    DEPLOY_PRE=()
    DEPLOY_COMMANDS=()
    DEPLOY_POST=()
}

# Load deploy context from TOML
# Auto-detects standalone vs org mode
# Usage: _deploy_load <toml_file> <env>
_deploy_load() {
    local toml="$1"
    local env="$2"

    _deploy_clear

    [[ ! -f "$toml" ]] && { echo "Not found: $toml" >&2; return 1; }

    DEPLOY_TOML="$toml"
    DEPLOY_TOML_DIR=$(dirname "$toml")
    DEPLOY_ENV="$env"

    # From target TOML [target] section
    DEPLOY_NAME=$(_deploy_toml_get "$toml" "target" "name")
    DEPLOY_REMOTE=$(_deploy_toml_get "$toml" "target" "remote")
    [[ -z "$DEPLOY_REMOTE" ]] && DEPLOY_REMOTE=$(_deploy_toml_get "$toml" "target" "cwd")
    DEPLOY_DOMAIN=$(_deploy_toml_get "$toml" "target" "domain")

    # Detect mode: does TOML have ssh in envs section?
    if _deploy_toml_has_ssh "$toml" "$env"; then
        DEPLOY_MODE="standalone"
        _deploy_load_standalone "$toml" "$env"
    else
        DEPLOY_MODE="org"
        _deploy_load_org "$toml" "$env"
    fi

    local rc=$?
    [[ $rc -ne 0 ]] && return $rc

    # Load command arrays
    mapfile -t DEPLOY_PRE < <(_deploy_toml_get_array "$toml" "deploy" "pre")
    mapfile -t DEPLOY_COMMANDS < <(_deploy_toml_get_array "$toml" "deploy" "commands")
    mapfile -t DEPLOY_POST < <(_deploy_toml_get_array "$toml" "deploy" "post")

    return 0
}

# Load SSH info from target TOML (standalone mode)
_deploy_load_standalone() {
    local toml="$1"
    local env="$2"

    # Try envs.<env> first, fall back to envs.all, then env.<env>, env.all
    local ssh=$(_deploy_toml_get "$toml" "envs.$env" "ssh")
    [[ -z "$ssh" ]] && ssh=$(_deploy_toml_get "$toml" "envs.all" "ssh")
    [[ -z "$ssh" ]] && ssh=$(_deploy_toml_get "$toml" "env.$env" "ssh")
    [[ -z "$ssh" ]] && ssh=$(_deploy_toml_get "$toml" "env.all" "ssh")

    if [[ -z "$ssh" ]]; then
        echo "No ssh config for env: $env" >&2
        return 1
    fi

    DEPLOY_SSH="$ssh"
    DEPLOY_AUTH_USER="${ssh%@*}"
    DEPLOY_HOST="${ssh#*@}"

    # Work user (optional, defaults to auth user)
    local user=$(_deploy_toml_get "$toml" "envs.$env" "user")
    [[ -z "$user" ]] && user=$(_deploy_toml_get "$toml" "envs.all" "user")
    [[ -z "$user" ]] && user=$(_deploy_toml_get "$toml" "env.$env" "user")
    [[ -z "$user" ]] && user=$(_deploy_toml_get "$toml" "env.all" "user")
    DEPLOY_WORK_USER="${user:-$DEPLOY_AUTH_USER}"

    # Domain override from env
    local domain=$(_deploy_toml_get "$toml" "envs.$env" "domain")
    [[ -z "$domain" ]] && domain=$(_deploy_toml_get "$toml" "env.$env" "domain")
    [[ -n "$domain" ]] && DEPLOY_DOMAIN="$domain"

    return 0
}

# Load SSH info from org module
_deploy_load_org() {
    local toml="$1"
    local env="$2"

    # Check org module
    if ! type org_active &>/dev/null; then
        echo "org module not loaded (and no ssh in target TOML)" >&2
        return 1
    fi

    if [[ "$(org_active)" == "none" ]]; then
        echo "No active org. Run: org switch <name>" >&2
        return 1
    fi

    DEPLOY_HOST=$(_org_get_host "$env")
    DEPLOY_AUTH_USER=$(_org_get_user "$env")
    DEPLOY_WORK_USER=$(_org_get_work_user "$env")

    if [[ -z "$DEPLOY_HOST" ]]; then
        echo "No host for env '$env' in org $(org_active)" >&2
        return 1
    fi

    DEPLOY_SSH="${DEPLOY_AUTH_USER}@${DEPLOY_HOST}"

    return 0
}

# =============================================================================
# TEMPLATE SUBSTITUTION
# =============================================================================

_deploy_template() {
    local str="$1"

    # Expand {{user}} in remote path first
    local remote="${DEPLOY_REMOTE//\{\{user\}\}/$DEPLOY_WORK_USER}"

    # SSH/host
    str="${str//\{\{ssh\}\}/$DEPLOY_SSH}"
    str="${str//\{\{host\}\}/$DEPLOY_HOST}"

    # Users
    str="${str//\{\{auth_user\}\}/$DEPLOY_AUTH_USER}"
    str="${str//\{\{work_user\}\}/$DEPLOY_WORK_USER}"
    str="${str//\{\{user\}\}/$DEPLOY_WORK_USER}"

    # Target info
    str="${str//\{\{name\}\}/$DEPLOY_NAME}"
    str="${str//\{\{remote\}\}/$remote}"
    str="${str//\{\{cwd\}\}/$remote}"
    str="${str//\{\{domain\}\}/$DEPLOY_DOMAIN}"
    str="${str//\{\{env\}\}/$DEPLOY_ENV}"
    str="${str//\{\{local\}\}/$DEPLOY_TOML_DIR}"

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
# TARGET RESOLUTION
# =============================================================================

# Check if arg is a known environment name
_deploy_is_env() {
    local arg="$1"

    # Check org envs if available
    if type org_env_names &>/dev/null; then
        org_env_names 2>/dev/null | grep -qx "$arg" && return 0
    fi

    # Common env names as fallback
    [[ "$arg" =~ ^(dev|staging|prod|production|local)$ ]]
}

# Find TOML file for named target
_deploy_find_target() {
    local name="$1"

    # Use deploy context org, or fall back to global org
    local org=$(_deploy_active_org)
    if [[ -n "$org" && "$org" != "none" ]]; then
        local target_file="$TETRA_DIR/orgs/$org/targets/${name}.toml"
        [[ -f "$target_file" ]] && { echo "$target_file"; return 0; }

        local target_dir="$TETRA_DIR/orgs/$org/targets/$name"
        [[ -f "$target_dir/tetra-deploy.toml" ]] && { echo "$target_dir/tetra-deploy.toml"; return 0; }
    fi

    return 1
}

# Resolve arguments to (toml_file, env)
# Sets DEPLOY_RESOLVED_TOML, DEPLOY_RESOLVED_ENV
#
# Patterns:
#   deploy dev                  -> cwd, dev
#   deploy docs dev             -> targets/docs, dev
#   deploy push dev             -> cwd, dev
#   deploy push docs dev        -> targets/docs, dev
_deploy_resolve() {
    local arg1="${1:-}"
    local arg2="${2:-}"

    DEPLOY_RESOLVED_TOML=""
    DEPLOY_RESOLVED_ENV=""

    if [[ -z "$arg1" ]]; then
        echo "Usage: deploy <env> | deploy <target> <env>" >&2
        return 1
    fi

    # Single arg: must be env with cwd TOML
    if [[ -z "$arg2" ]]; then
        if [[ -f "./tetra-deploy.toml" ]]; then
            DEPLOY_RESOLVED_TOML="./tetra-deploy.toml"
            DEPLOY_RESOLVED_ENV="$arg1"
            return 0
        else
            echo "No tetra-deploy.toml in current directory" >&2
            echo "Usage: deploy <target> <env>" >&2
            return 1
        fi
    fi

    # Two args: target + env
    local target="$arg1"
    local env="$arg2"

    local toml=$(_deploy_find_target "$target")
    if [[ -z "$toml" ]]; then
        echo "Target not found: $target" >&2
        if type org_active &>/dev/null; then
            echo "Looked in: \$TETRA_DIR/orgs/$(org_active)/targets/" >&2
        fi
        return 1
    fi

    DEPLOY_RESOLVED_TOML="$toml"
    DEPLOY_RESOLVED_ENV="$env"
    return 0
}

# =============================================================================
# COMMANDS
# =============================================================================

deploy_push() {
    local dry_run=0
    local args=()
    local start_time=$SECONDS

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --dry-run|-n) dry_run=1; shift ;;
            *) args+=("$1"); shift ;;
        esac
    done

    _deploy_resolve "${args[@]}" || return 1
    _deploy_load "$DEPLOY_RESOLVED_TOML" "$DEPLOY_RESOLVED_ENV" || return 1

    local target_name="${DEPLOY_NAME:-$(basename "$DEPLOY_TOML_DIR")}"

    echo "========================================"
    echo "Deploy: $target_name -> $DEPLOY_ENV"
    echo "========================================"
    echo ""
    echo "Mode:   $DEPLOY_MODE"
    echo "Target: $DEPLOY_TOML"
    echo "Remote: ${DEPLOY_SSH}:${DEPLOY_REMOTE//\{\{user\}\}/$DEPLOY_WORK_USER}"
    [[ -n "$DEPLOY_DOMAIN" ]] && echo "Domain: $DEPLOY_DOMAIN"
    [[ "$dry_run" -eq 1 ]] && echo "[DRY RUN]"
    echo ""

    # Pre hooks
    if [[ ${#DEPLOY_PRE[@]} -gt 0 ]]; then
        echo "[pre]"
        for cmd in "${DEPLOY_PRE[@]}"; do
            (cd "$DEPLOY_TOML_DIR" && _deploy_exec "$cmd" "$dry_run") || return 1
        done
        echo ""
    fi

    # Commands
    if [[ ${#DEPLOY_COMMANDS[@]} -gt 0 ]]; then
        echo "[commands]"
        for cmd in "${DEPLOY_COMMANDS[@]}"; do
            (cd "$DEPLOY_TOML_DIR" && _deploy_exec "$cmd" "$dry_run") || return 1
        done
        echo ""
    fi

    # Post hooks
    if [[ ${#DEPLOY_POST[@]} -gt 0 ]]; then
        echo "[post]"
        for cmd in "${DEPLOY_POST[@]}"; do
            (cd "$DEPLOY_TOML_DIR" && _deploy_exec "$cmd" "$dry_run") || {
                local duration=$((SECONDS - start_time))
                _deploy_log "$target_name" "$DEPLOY_ENV" "push" "failed" "$duration"
                return 1
            }
        done
        echo ""
    fi

    local duration=$((SECONDS - start_time))

    echo "========================================"
    echo "Done (${duration}s)"
    echo "========================================"

    # Log successful deployment (skip for dry runs)
    if [[ "$dry_run" -eq 0 ]]; then
        _deploy_log "$target_name" "$DEPLOY_ENV" "push" "success" "$duration"
    fi
}

deploy_show() {
    _deploy_resolve "$@" || return 1
    _deploy_load "$DEPLOY_RESOLVED_TOML" "$DEPLOY_RESOLVED_ENV" || return 1

    echo "Target:     ${DEPLOY_NAME:-?}"
    echo "TOML:       $DEPLOY_TOML"
    echo "Mode:       $DEPLOY_MODE"
    echo "Env:        $DEPLOY_ENV"
    echo ""
    echo "Host:       $DEPLOY_HOST"
    echo "Auth user:  $DEPLOY_AUTH_USER"
    echo "Work user:  $DEPLOY_WORK_USER"
    echo "SSH:        $DEPLOY_SSH"
    echo "Remote:     ${DEPLOY_REMOTE//\{\{user\}\}/$DEPLOY_WORK_USER}"
    echo "Domain:     ${DEPLOY_DOMAIN:--}"
    echo ""
    echo "Pre:        ${DEPLOY_PRE[*]:-(none)}"
    echo "Commands:   ${DEPLOY_COMMANDS[*]:-(none)}"
    echo "Post:       ${DEPLOY_POST[*]:-(none)}"
}

deploy_list() {
    echo "Deploy Targets"
    echo "=============="
    echo ""

    # Check org
    if type org_active &>/dev/null; then
        local org=$(org_active 2>/dev/null)
        if [[ -n "$org" && "$org" != "none" ]]; then
            echo "Org: $org"
            local targets_dir="$TETRA_DIR/orgs/$org/targets"

            if [[ -d "$targets_dir" ]]; then
                local found=0

                for f in "$targets_dir"/*.toml; do
                    [[ -f "$f" ]] || continue
                    printf "  %s\n" "$(basename "$f" .toml)"
                    ((found++))
                done

                for d in "$targets_dir"/*/; do
                    [[ -d "$d" && -f "$d/tetra-deploy.toml" ]] || continue
                    printf "  %s/\n" "$(basename "$d")"
                    ((found++))
                done

                [[ $found -eq 0 ]] && echo "  (none)"
            else
                echo "  (no targets dir)"
            fi
            echo ""
        else
            echo "Org: (none active)"
            echo ""
        fi
    fi

    # CWD check
    if [[ -f "./tetra-deploy.toml" ]]; then
        echo "CWD: ./tetra-deploy.toml found"
        local name=$(_deploy_toml_get "./tetra-deploy.toml" "target" "name")
        [[ -n "$name" ]] && echo "  name: $name"
    else
        echo "CWD: (no tetra-deploy.toml)"
    fi
}

deploy_doctor() {
    echo "Deploy Doctor"
    echo "============="
    echo ""

    local issues=0

    # Check org
    if type org_active &>/dev/null; then
        local org=$(org_active 2>/dev/null)
        if [[ -n "$org" && "$org" != "none" ]]; then
            echo "[OK] Org: $org"
        else
            echo "[--] No active org (standalone mode only)"
        fi
    else
        echo "[--] org module not loaded (standalone mode only)"
    fi

    # Check targets
    if type org_active &>/dev/null; then
        local org=$(org_active 2>/dev/null)
        if [[ -n "$org" && "$org" != "none" ]]; then
            local targets_dir="$TETRA_DIR/orgs/$org/targets"
            if [[ -d "$targets_dir" ]]; then
                local count=$(find "$targets_dir" \( -name "*.toml" -o -name "tetra-deploy.toml" \) 2>/dev/null | wc -l | tr -d ' ')
                echo "[OK] Targets: $count found"
            else
                echo "[--] No targets directory"
            fi
        fi
    fi

    # Check CWD
    if [[ -f "./tetra-deploy.toml" ]]; then
        echo "[OK] CWD has tetra-deploy.toml"
    else
        echo "[--] No tetra-deploy.toml in CWD"
    fi

    return $issues
}

deploy_history() {
    local log_file="$MOD_DIR/logs/deploy.log"
    local verbose=0
    local limit=20

    while [[ $# -gt 0 ]]; do
        case "$1" in
            -v|--verbose) verbose=1; shift ;;
            [0-9]*) limit="$1"; shift ;;
            *) shift ;;
        esac
    done

    if [[ ! -f "$log_file" ]]; then
        echo "No deployment history"
        return 0
    fi

    echo "Recent Deployments"
    echo "=================="

    if [[ $verbose -eq 1 ]]; then
        # Verbose format
        printf "%-20s %-12s %-6s %-10s %-7s %5s %-8s %-12s %s\n" \
            "TIMESTAMP" "TARGET" "ENV" "ACTION" "STATUS" "SECS" "USER" "BRANCH" "COMMIT"
        printf "%-20s %-12s %-6s %-10s %-7s %5s %-8s %-12s %s\n" \
            "---------" "------" "---" "------" "------" "----" "----" "------" "------"

        tail -n "$limit" "$log_file" | tac | while IFS='|' read -r ts target env action status duration user branch commit extra; do
            # Trim whitespace
            ts="${ts## }"; ts="${ts%% }"
            target="${target## }"; target="${target%% }"
            env="${env## }"; env="${env%% }"
            action="${action## }"; action="${action%% }"
            status="${status## }"; status="${status%% }"
            duration="${duration## }"; duration="${duration%% }"
            user="${user## }"; user="${user%% }"
            branch="${branch## }"; branch="${branch%% }"
            commit="${commit## }"; commit="${commit%% }"

            # Shorten timestamp
            ts="${ts%+*}"  # Remove timezone
            ts="${ts/T/ }" # Replace T with space

            # Truncate long fields
            [[ ${#target} -gt 12 ]] && target="${target:0:11}…"
            [[ ${#branch} -gt 12 ]] && branch="${branch:0:11}…"

            printf "%-20s %-12s %-6s %-10s %-7s %5s %-8s %-12s %s\n" \
                "$ts" "$target" "$env" "$action" "$status" "${duration:-0}" "$user" "$branch" "$commit"
        done
    else
        # Compact format
        printf "%-20s %-15s %-8s %-12s %-8s %s\n" "TIMESTAMP" "TARGET" "ENV" "ACTION" "STATUS" "TIME"
        printf "%-20s %-15s %-8s %-12s %-8s %s\n" "---------" "------" "---" "------" "------" "----"

        tail -n "$limit" "$log_file" | tac | while IFS='|' read -r ts target env action status duration rest; do
            # Trim whitespace
            ts="${ts## }"; ts="${ts%% }"
            target="${target## }"; target="${target%% }"
            env="${env## }"; env="${env%% }"
            action="${action## }"; action="${action%% }"
            status="${status## }"; status="${status%% }"
            duration="${duration## }"; duration="${duration%% }"

            # Shorten timestamp
            ts="${ts%+*}"  # Remove timezone
            ts="${ts/T/ }" # Replace T with space

            # Format duration
            local time_str="${duration:-0}s"

            printf "%-20s %-15s %-8s %-12s %-8s %s\n" "$ts" "$target" "$env" "$action" "$status" "$time_str"
        done
    fi
}

# Help color definitions (TDS semantic colors)
_deploy_help_colors() {
    # Use TDS if available, fallback to ANSI
    if type tds_text_color &>/dev/null; then
        CLR_H1=$(tds_text_color "content.heading.h1")
        CLR_H2=$(tds_text_color "content.heading.h2")
        CLR_CMD=$(tds_text_color "action.primary")
        CLR_ARG=$(tds_text_color "action.secondary")
        CLR_DIM=$(tds_text_color "text.muted")
        CLR_OK=$(tds_text_color "status.success")
        CLR_NC=$(reset_color)
    else
        CLR_H1='\033[1;34m'      # Blue bold - section headers
        CLR_H2='\033[0;36m'      # Cyan - subsections
        CLR_CMD='\033[0;33m'     # Yellow - commands
        CLR_ARG='\033[0;32m'     # Green - arguments
        CLR_DIM='\033[0;90m'     # Gray - descriptions
        CLR_OK='\033[0;32m'      # Green - success
        CLR_NC='\033[0m'         # Reset
    fi
}

_deploy_help_section() { echo -e "${CLR_H1}$1${CLR_NC}"; }
_deploy_help_sub() { echo -e "  ${CLR_H2}$1${CLR_NC}"; }
_deploy_help_cmd() { printf "  ${CLR_CMD}%-24s${CLR_NC} ${CLR_DIM}%s${CLR_NC}\n" "$1" "$2"; }
_deploy_help_ex() { echo -e "  ${CLR_DIM}#${CLR_NC} ${CLR_ARG}$1${CLR_NC}"; }

deploy_help() {
    local topic="${1:-}"
    _deploy_help_colors

    case "$topic" in
        context)
            _deploy_help_section "CONTEXT MODE (stateful)"
            echo ""
            _deploy_help_cmd "target <name>" "Set current target (shows in prompt)"
            _deploy_help_cmd "target ." "Use CWD as target"
            _deploy_help_cmd "env <name>" "Set current env"
            _deploy_help_cmd "deploy" "Deploy with context (confirms)"
            _deploy_help_cmd "info" "Show current context"
            _deploy_help_cmd "clear" "Clear context"
            echo ""
            _deploy_help_sub "Workflow:"
            _deploy_help_ex "deploy target docs   # prompt: [org:docs:?]"
            _deploy_help_ex "deploy env dev       # prompt: [org:docs:dev]"
            _deploy_help_ex "deploy               # confirm and deploy"
            ;;
        direct)
            _deploy_help_section "DIRECT MODE"
            echo ""
            _deploy_help_cmd "<env>" "Deploy CWD to environment"
            _deploy_help_cmd "<target> <env>" "Deploy named target"
            _deploy_help_cmd "push [-n] <args>" "Explicit push (same as above)"
            _deploy_help_cmd "show <target> <env>" "Show resolved config"
            echo ""
            _deploy_help_sub "Examples:"
            _deploy_help_ex "deploy docs prod        # target to prod"
            _deploy_help_ex "deploy dev              # CWD to dev"
            _deploy_help_ex "deploy -n docs staging  # dry run"
            ;;
        history)
            _deploy_help_section "HISTORY"
            echo ""
            _deploy_help_cmd "history" "Show last 20 deployments"
            _deploy_help_cmd "history <n>" "Show last n deployments"
            _deploy_help_cmd "history -v" "Verbose (user, branch, commit)"
            _deploy_help_cmd "history -v <n>" "Verbose, last n"
            echo ""
            _deploy_help_sub "Logged metrics:"
            echo -e "  ${CLR_DIM}timestamp, target, env, action, status, duration${CLR_NC}"
            echo -e "  ${CLR_DIM}user, git branch, git commit${CLR_NC}"
            ;;
        targets)
            _deploy_help_section "TARGETS"
            echo ""
            _deploy_help_sub "Named targets:"
            echo -e "  ${CLR_DIM}\$TETRA_DIR/orgs/<org>/targets/<name>.toml${CLR_NC}"
            echo -e "  ${CLR_DIM}\$TETRA_DIR/orgs/<org>/targets/<name>/tetra-deploy.toml${CLR_NC}"
            echo ""
            _deploy_help_sub "CWD mode:"
            echo -e "  ${CLR_DIM}./tetra-deploy.toml or deploy target .${CLR_NC}"
            echo ""
            _deploy_help_cmd "list" "List available targets"
            ;;
        vars|variables)
            _deploy_help_section "TEMPLATE VARIABLES"
            echo ""
            _deploy_help_cmd "{{ssh}}" "user@host"
            _deploy_help_cmd "{{host}}" "IP/hostname"
            _deploy_help_cmd "{{user}}" "work user"
            _deploy_help_cmd "{{auth_user}}" "SSH login user"
            _deploy_help_cmd "{{work_user}}" "app owner"
            _deploy_help_cmd "{{remote}}" "remote path"
            _deploy_help_cmd "{{cwd}}" "alias for remote"
            _deploy_help_cmd "{{domain}}" "domain string"
            _deploy_help_cmd "{{env}}" "environment name"
            _deploy_help_cmd "{{name}}" "target name"
            _deploy_help_cmd "{{local}}" "local directory"
            ;;
        modes)
            _deploy_help_section "MODES"
            echo ""
            _deploy_help_sub "Standalone:"
            echo -e "  ${CLR_DIM}SSH config in target TOML ([env.<env>] has ssh key)${CLR_NC}"
            echo ""
            _deploy_help_sub "Org-integrated:"
            echo -e "  ${CLR_DIM}SSH from org module (no ssh in target TOML)${CLR_NC}"
            echo ""
            echo -e "  ${CLR_DIM}Mode is auto-detected per target.${CLR_NC}"
            ;;
        *)
            # Main categorical help
            _deploy_help_section "deploy - deployment system"
            echo ""
            _deploy_help_sub "Quick Start:"
            _deploy_help_cmd "list" "List available targets"
            _deploy_help_cmd "<target> <env>" "Deploy target to env"
            _deploy_help_cmd "history" "Show recent deployments"
            echo ""
            _deploy_help_sub "Context Mode:"
            _deploy_help_cmd "target <name>" "Set target"
            _deploy_help_cmd "env <name>" "Set env"
            _deploy_help_cmd "deploy" "Deploy (confirms)"
            _deploy_help_cmd "info | clear" "Show/clear context"
            echo ""
            _deploy_help_sub "All Commands:"
            echo -e "  ${CLR_CMD}Context${CLR_NC}   ${CLR_DIM}org target env info clear${CLR_NC}"
            echo -e "  ${CLR_CMD}Deploy${CLR_NC}    ${CLR_DIM}push show list${CLR_NC}"
            echo -e "  ${CLR_CMD}Monitor${CLR_NC}   ${CLR_DIM}history doctor${CLR_NC}"
            echo ""
            _deploy_help_sub "Help Topics:"
            echo -e "  ${CLR_ARG}context${CLR_NC} ${CLR_ARG}direct${CLR_NC} ${CLR_ARG}history${CLR_NC} ${CLR_ARG}targets${CLR_NC} ${CLR_ARG}vars${CLR_NC} ${CLR_ARG}modes${CLR_NC}"
            ;;
    esac
}

# =============================================================================
# DISPATCHER
# =============================================================================

deploy() {
    local cmd="${1:-}"

    # No args -> use context if set, else show info
    if [[ -z "$cmd" ]]; then
        if [[ -n "$DEPLOY_CTX_TARGET" && -n "$DEPLOY_CTX_ENV" ]]; then
            deploy_with_context
        elif [[ -n "$DEPLOY_CTX_TARGET" || -n "$DEPLOY_CTX_ENV" ]]; then
            deploy_info
        else
            deploy_list
        fi
        return 0
    fi

    case "$cmd" in
        # Context commands
        org|o)
            shift
            deploy_org_set "$@"
            ;;
        target|t)
            shift
            deploy_target_set "$@"
            ;;
        env|e)
            shift
            deploy_env_set "$@"
            ;;
        info|i)
            deploy_info
            ;;
        clear|c)
            deploy_clear_context
            ;;

        # Action commands
        push|p)
            shift
            deploy_push "$@"
            ;;
        show|s)
            shift
            deploy_show "$@"
            ;;
        list|ls)
            deploy_list
            ;;
        doctor|doc)
            deploy_doctor
            ;;
        history|hist)
            shift
            deploy_history "$@"
            ;;
        help|h|--help|-h)
            shift
            deploy_help "$@"
            ;;
        -n|--dry-run)
            # Allow: deploy -n target env
            deploy_push "$@"
            ;;
        *)
            # Default: deploy <target> <env> or deploy <env>
            deploy_push "$@"
            ;;
    esac
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f deploy deploy_push deploy_show deploy_list deploy_history deploy_doctor deploy_help
export -f _deploy_help_colors _deploy_help_section _deploy_help_sub _deploy_help_cmd _deploy_help_ex
export -f deploy_org_set deploy_target_set deploy_env_set deploy_clear_context deploy_info deploy_with_context
export -f _tetra_deploy_info _deploy_active_org
export -f _deploy_load _deploy_load_standalone _deploy_load_org
export -f _deploy_template _deploy_exec _deploy_resolve _deploy_clear
export -f _deploy_is_env _deploy_find_target
export -f _deploy_toml_get _deploy_toml_get_array _deploy_toml_has_ssh
