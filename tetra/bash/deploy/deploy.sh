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
# CONTEXT LOADING
# =============================================================================
# Note: TOML parsing functions (_deploy_toml_get, _deploy_toml_get_array,
# _deploy_toml_has_ssh) are now in includes.sh

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

    # Build vars array from DEPLOY_* globals
    local -A _tmpl_vars=(
        [ssh]="$DEPLOY_SSH"
        [host]="$DEPLOY_HOST"
        [auth_user]="$DEPLOY_AUTH_USER"
        [work_user]="$DEPLOY_WORK_USER"
        [user]="$DEPLOY_WORK_USER"
        [name]="$DEPLOY_NAME"
        [cwd]="$DEPLOY_REMOTE"
        [domain]="$DEPLOY_DOMAIN"
        [env]="$DEPLOY_ENV"
        [local]="$DEPLOY_TOML_DIR"
    )

    _deploy_template_core "$str" _tmpl_vars
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

# Deploy with current context (confirm first)
deploy_with_context() {
    if [[ -z "$DEPLOY_CTX_TARGET" ]]; then
        echo "need target" >&2
        return 1
    fi
    if [[ -z "$DEPLOY_CTX_ENV" ]]; then
        echo "need env" >&2
        return 1
    fi

    local toml
    if [[ "$DEPLOY_CTX_TARGET" == "." ]]; then
        toml="./tetra-deploy.toml"
    else
        toml=$(_deploy_find_target "$DEPLOY_CTX_TARGET")
    fi

    if [[ -n "$toml" ]]; then
        _deploy_load "$toml" "$DEPLOY_CTX_ENV" 2>/dev/null
        echo "Deploy: $DEPLOY_CTX_TARGET -> $DEPLOY_CTX_ENV"
        echo "  ${DEPLOY_SSH}:${DEPLOY_REMOTE//\{\{user\}\}/$DEPLOY_WORK_USER}"
    fi

    read -rp "Proceed? [y/N] " confirm
    [[ "$confirm" =~ ^[Yy]$ ]] && deploy_push "$DEPLOY_CTX_TARGET" "$DEPLOY_CTX_ENV" || echo "Cancelled"
}

deploy_doctor() {
    local cmd="${1:-}"
    local arg="${2:-}"

    case "$cmd" in
        reload|r)
            echo "Reloading deploy module..."
            source "$DEPLOY_SRC/includes.sh"
            echo "done"
            return 0
            ;;
        complete|comp)
            # Show completion diagnostics
            _deploy_doctor_complete "$arg"
            return 0
            ;;
        "")
            # Default: show status
            ;;
        *)
            echo "usage: deploy doctor [reload|complete [target]]"
            return 1
            ;;
    esac

    local org=$(org_active 2>/dev/null)
    local ctx="[${DEPLOY_CTX_ORG:-?}:${DEPLOY_CTX_TARGET:-?}:${DEPLOY_CTX_ENV:-?}]"

    echo "deploy doctor"
    echo "  ctx: $ctx"
    echo "  org: ${org:-(none)}"
    echo "  tps: ${DEPLOY_TPS_REGISTERED:-0}"

    # Targets
    if [[ -n "$org" && "$org" != "none" ]]; then
        local targets_dir="$TETRA_DIR/orgs/$org/targets"
        if [[ -d "$targets_dir" ]]; then
            local count=$(find "$targets_dir" \( -name "*.toml" -o -name "tetra-deploy.toml" \) 2>/dev/null | wc -l | tr -d ' ')
            echo "  targets: $count"
        fi
    fi

    [[ -f "./tetra-deploy.toml" ]] && echo "  cwd: tetra-deploy.toml"
}

# Completion diagnostics
_deploy_doctor_complete() {
    local target="${1:-}"

    echo "Completion Diagnostics"
    echo "======================"
    echo ""

    # Org resolution
    echo "Org Resolution:"
    echo "  DEPLOY_CTX_ORG:    ${DEPLOY_CTX_ORG:-(empty)}"
    echo "  org_active:        $(type org_active &>/dev/null && org_active 2>/dev/null || echo "(unavailable)")"
    echo "  _deploy_active_org: $(type _deploy_active_org &>/dev/null && _deploy_active_org 2>/dev/null || echo "(unavailable)")"

    local org=$(_deploy_active_org 2>/dev/null)
    [[ -z "$org" ]] && org=$(org_active 2>/dev/null)
    echo "  resolved:          ${org:-(none)}"
    echo ""

    # Targets directory
    if [[ -n "$org" && "$org" != "none" ]]; then
        local targets_dir="$TETRA_DIR/orgs/$org/targets"
        echo "Targets Directory:"
        echo "  path: $targets_dir"
        echo "  exists: $([[ -d "$targets_dir" ]] && echo "yes" || echo "no")"
        echo ""

        if [[ -d "$targets_dir" ]]; then
            echo "Available Targets:"
            # .toml files
            for f in "$targets_dir"/*.toml; do
                [[ -f "$f" ]] && echo "  $(basename "$f" .toml) (file)"
            done
            # Directories
            for d in "$targets_dir"/*/; do
                [[ -d "$d" && -f "$d/tetra-deploy.toml" ]] && echo "  $(basename "$d") (dir)"
            done
            echo ""

            # If target specified, show its pipelines
            if [[ -n "$target" ]]; then
                local toml=""
                if [[ -f "$targets_dir/$target/tetra-deploy.toml" ]]; then
                    toml="$targets_dir/$target/tetra-deploy.toml"
                elif [[ -f "$targets_dir/${target}.toml" ]]; then
                    toml="$targets_dir/${target}.toml"
                fi

                if [[ -n "$toml" ]]; then
                    echo "Target: $target"
                    echo "  toml: $toml"
                    echo ""
                    echo "  Pipelines (tab-completable):"
                    awk '/^\[pipeline\]/{found=1; next} /^\[/{found=0} found && /^[a-zA-Z_][a-zA-Z0-9_-]*[ ]*=/{print "    " $1}' "$toml"
                    echo ""
                    echo "  Aliases (hidden from tab, power-user shortcuts):"
                    awk '/^\[alias\]/{found=1; next} /^\[/{found=0} found && /^[a-zA-Z_][a-zA-Z0-9_-]*[ ]*=/{print "    " $1}' "$toml" || echo "    (none)"
                else
                    echo "Target '$target' not found"
                fi
            fi
        fi
    else
        echo "No org resolved - cannot list targets"
    fi
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
        doctor)
            _deploy_help_section "DOCTOR"
            echo ""
            _deploy_help_cmd "doctor" "Show deploy module status"
            _deploy_help_cmd "doctor reload" "Reload deploy module"
            _deploy_help_cmd "doctor complete" "Show completion diagnostics"
            _deploy_help_cmd "doctor complete <target>" "Show target's pipelines/aliases"
            ;;
        taxonomy)
            _deploy_help_section "DEPLOY TAXONOMY"
            echo ""
            _deploy_help_sub "Hierarchy:"
            echo -e "  ${CLR_H1}ORG${CLR_NC} ${CLR_DIM}─────────────${CLR_NC} Organization container (nodeholder, acme)"
            echo -e "   ${CLR_DIM}└─${CLR_NC} ${CLR_H2}TARGET${CLR_NC} ${CLR_DIM}──────${CLR_NC} Deployable unit (docs, api, web)"
            echo -e "       ${CLR_DIM}└─${CLR_NC} ${CLR_CMD}PIPELINE${CLR_NC} ${CLR_DIM}──${CLR_NC} Workflow sequence (default, quick, gdocs)"
            echo -e "           ${CLR_DIM}└─${CLR_NC} ${CLR_ARG}ITEMS${CLR_NC} ${CLR_DIM}────${CLR_NC} File selection filter ({gdocs}, {!index})"
            echo ""
            _deploy_help_sub "Concepts:"
            echo -e "  ${CLR_H2}TARGET${CLR_NC}     ${CLR_DIM}A deployable project with its own tetra-deploy.toml${CLR_NC}"
            echo -e "             ${CLR_DIM}Contains: source files, build rules, push config${CLR_NC}"
            echo ""
            echo -e "  ${CLR_CMD}PIPELINE${CLR_NC}   ${CLR_DIM}Named sequence of steps: [\"build:all\", \"push\"]${CLR_NC}"
            echo -e "             ${CLR_DIM}Defines WHAT operations run and in what order${CLR_NC}"
            echo ""
            echo -e "  ${CLR_ARG}ITEMS${CLR_NC}      ${CLR_DIM}Filter for WHICH files the pipeline operates on${CLR_NC}"
            echo -e "             ${CLR_DIM}Affects both build steps AND push file selection${CLR_NC}"
            echo ""
            echo -e "  ${CLR_OK}ENV${CLR_NC}        ${CLR_DIM}Target environment: prod, dev, staging${CLR_NC}"
            echo -e "             ${CLR_DIM}Provides: SSH connection, domain, settings${CLR_NC}"
            echo ""
            _deploy_help_sub "Steps (pipeline components):"
            echo -e "  ${CLR_CMD}build:X${CLR_NC}    ${CLR_DIM}Run build command for file set X${CLR_NC}"
            echo -e "  ${CLR_CMD}push${CLR_NC}       ${CLR_DIM}Transfer files to remote server${CLR_NC}"
            echo -e "  ${CLR_CMD}pre${CLR_NC}        ${CLR_DIM}Pre-build hook (runs once before any build)${CLR_NC}"
            echo ""
            _deploy_help_sub "Item Modifiers:"
            echo -e "  ${CLR_ARG}{gdocs}${CLR_NC}    ${CLR_DIM}Include: only these items${CLR_NC}"
            echo -e "  ${CLR_ARG}{!index}${CLR_NC}   ${CLR_DIM}Exclude: all EXCEPT these${CLR_NC}"
            echo -e "  ${CLR_ARG}{@guides}${CLR_NC}  ${CLR_DIM}Group: expand to [files.guides].include list${CLR_NC}"
            echo -e "  ${CLR_ARG}~gdocs${CLR_NC}     ${CLR_DIM}Shorthand: same as {gdocs}${CLR_NC}"
            echo ""
            _deploy_help_sub "Address Format:"
            echo -e "  ${CLR_H1}[org:]${CLR_NC}${CLR_H2}target${CLR_NC}${CLR_DIM}:${CLR_NC}${CLR_CMD}[pipeline]${CLR_NC}${CLR_DIM}:${CLR_NC}${CLR_ARG}[{items}]${CLR_NC} ${CLR_OK}env${CLR_NC}"
            echo ""
            _deploy_help_sub "Examples:"
            echo -e "  ${CLR_H2}docs${CLR_NC}${CLR_DIM}:${CLR_NC}${CLR_CMD}quick${CLR_NC} ${CLR_OK}prod${CLR_NC}              ${CLR_DIM}# target:pipeline${CLR_NC}"
            echo -e "  ${CLR_H2}docs${CLR_NC}${CLR_DIM}:${CLR_NC}${CLR_ARG}{gdocs}${CLR_NC} ${CLR_OK}prod${CLR_NC}            ${CLR_DIM}# target:{items}${CLR_NC}"
            echo -e "  ${CLR_H2}docs${CLR_NC}${CLR_DIM}:${CLR_NC}${CLR_CMD}quick${CLR_NC}${CLR_DIM}:${CLR_NC}${CLR_ARG}{gdocs}${CLR_NC} ${CLR_OK}prod${CLR_NC}      ${CLR_DIM}# target:pipeline:{items}${CLR_NC}"
            echo -e "  ${CLR_H1}nodeholder${CLR_NC}${CLR_DIM}:${CLR_NC}${CLR_H2}docs${CLR_NC}${CLR_DIM}:${CLR_NC}${CLR_CMD}quick${CLR_NC} ${CLR_OK}prod${CLR_NC}    ${CLR_DIM}# org:target:pipeline${CLR_NC}"
            echo -e "  ${CLR_H1}nodeholder${CLR_NC}${CLR_DIM}:${CLR_NC}${CLR_H2}docs${CLR_NC}${CLR_DIM}:${CLR_NC}${CLR_ARG}{gdocs}${CLR_NC} ${CLR_OK}prod${CLR_NC}  ${CLR_DIM}# org:target:{items}${CLR_NC}"
            echo -e "  ${CLR_H1}nodeholder${CLR_NC}${CLR_DIM}:${CLR_NC}${CLR_H2}docs${CLR_NC}${CLR_DIM}:${CLR_NC}${CLR_CMD}quick${CLR_NC}${CLR_DIM}:${CLR_NC}${CLR_ARG}{gdocs}${CLR_NC} ${CLR_OK}prod${CLR_NC}  ${CLR_DIM}# full address${CLR_NC}"
            ;;
        dry-run|template)
            _deploy_help_section "DRY-RUN OUTPUT TEMPLATE"
            echo ""
            echo -e "${CLR_DIM}────────────────────────────────────────${CLR_NC}"
            echo -e "${CLR_H1}Deploy${CLR_NC} ${CLR_H2}\${TARGET[name]}${CLR_NC}:${CLR_CMD}\${PIPELINE}${CLR_NC} ${CLR_DIM}→${CLR_NC} ${CLR_OK}\${ENV}${CLR_NC}"
            echo -e "${CLR_DIM}Files${CLR_NC}  ${CLR_ARG}\${ITEMS_OVERRIDE}${CLR_NC}"
            echo -e "${CLR_WARN}[DRY RUN]${CLR_NC}"
            echo -e "${CLR_DIM}────────────────────────────────────────${CLR_NC}"
            echo ""
            echo -e "  ${CLR_DIM}[skip]${CLR_NC} build:all ${CLR_DIM}(items specified → build each item)${CLR_NC}"
            echo ""
            echo -e "  ${CLR_CMD}[pre]${CLR_NC} \${BUILD[pre]}"
            echo -e "        ${CLR_DIM}↳ Runs once before first build${CLR_NC}"
            echo ""
            echo -e "  ${CLR_CMD}[build:\${ITEM}]${CLR_NC} \${BUILD[\${ITEM}.command]}"
            echo -e "        ${CLR_DIM}↳ Runs for each item in ITEMS_OVERRIDE${CLR_NC}"
            echo ""
            echo -e "  ${CLR_CMD}[build:index]${CLR_NC} \${BUILD[index.command]}"
            echo -e "        ${CLR_DIM}↳ Always runs (navigation)${CLR_NC}"
            echo ""
            echo -e "  ${CLR_CMD}[push]${CLR_NC} \${ENV[ssh]}:\${TARGET[cwd]}/"
            echo -e "    ${CLR_ARG}\${FILES[\${ITEM}]}${CLR_NC}              ${CLR_DIM}\${SIZE}${CLR_NC}"
            echo -e "    ${CLR_DIM}─────────────────────────────────────${CLR_NC}"
            echo -e "    ${CLR_DIM}\${FILE_COUNT} files              \${TOTAL_SIZE}${CLR_NC}"
            echo ""
            echo -e "${CLR_DIM}────────────────────────────────────────${CLR_NC}"
            echo -e "${CLR_OK}Done${CLR_NC} ${CLR_DIM}(\${DURATION}s)${CLR_NC}"
            echo ""
            _deploy_help_sub "Variable Sources (from TOML):"
            echo -e "  ${CLR_H2}TARGET[name]${CLR_NC}     ${CLR_DIM}[target] name = \"docs\"${CLR_NC}"
            echo -e "  ${CLR_H2}TARGET[cwd]${CLR_NC}      ${CLR_DIM}[target] cwd = \"/home/{{user}}/docs\"${CLR_NC}"
            echo -e "  ${CLR_CMD}PIPELINE${CLR_NC}         ${CLR_DIM}[pipeline] default = [\"build:all\", \"push\"]${CLR_NC}"
            echo -e "  ${CLR_ARG}FILES[gdocs]${CLR_NC}     ${CLR_DIM}[files] gdocs = \"gdocs-guide.html\"${CLR_NC}"
            echo -e "  ${CLR_CMD}BUILD[gdocs]${CLR_NC}     ${CLR_DIM}[build.gdocs] command = \"tut build...\"${CLR_NC}"
            echo -e "  ${CLR_OK}ENV[ssh]${CLR_NC}         ${CLR_DIM}[env.prod] ssh = \"root@1.2.3.4\"${CLR_NC}"
            ;;
        items)
            _deploy_help_section "ITEMS"
            echo ""
            _deploy_help_sub "File Selection Syntax:"
            _deploy_help_cmd "docs:gdocs" "Pipeline: run gdocs pipeline"
            _deploy_help_cmd "docs:{gdocs,deploy}" "Items: build+push specific items"
            _deploy_help_cmd "docs:~gdocs" "Shorthand: same as {gdocs}"
            _deploy_help_cmd "docs:{!index}" "Exclude: all except index"
            _deploy_help_cmd "docs:{@guides}" "Group: use [files.guides] list"
            _deploy_help_cmd "docs:>" "Push-only: skip all builds"
            _deploy_help_cmd "docs:>{gdocs}" "Push-only: specific files"
            echo ""
            _deploy_help_sub "Combined Syntax:"
            _deploy_help_cmd "docs:quick:{gdocs}" "Pipeline + items filter"
            _deploy_help_cmd "docs:quick:~gdocs" "Pipeline + shorthand"
            _deploy_help_cmd "docs:default -index" "Pipeline, exclude via flag"
            echo ""
            _deploy_help_sub "Behavior:"
            echo -e "  ${CLR_DIM}• {items} affects both build AND push steps${CLR_NC}"
            echo -e "  ${CLR_DIM}• build:all is replaced with build:<item> for each item${CLR_NC}"
            echo -e "  ${CLR_DIM}• build:index always runs (for navigation)${CLR_NC}"
            echo ""
            _deploy_help_sub "TOML Structure:"
            echo -e "  ${CLR_DIM}[files]${CLR_NC}"
            echo -e "  ${CLR_DIM}gdocs = \"gdocs-guide.html\"${CLR_NC}"
            echo -e "  ${CLR_DIM}deploy = \"deploy-ref.html\"${CLR_NC}"
            echo -e "  ${CLR_DIM}[files.guides]${CLR_NC}"
            echo -e "  ${CLR_DIM}include = [\"gdocs\", \"deploy\", \"org\"]${CLR_NC}"
            echo ""
            _deploy_help_sub "Examples:"
            _deploy_help_ex "deploy docs:{gdocs} prod         # build gdocs, push gdocs"
            _deploy_help_ex "deploy docs:~gdocs prod          # same, shorter"
            _deploy_help_ex "deploy docs:{!index,!tut} prod   # all except index,tut"
            _deploy_help_ex "deploy docs:{@guides} prod       # items from guides group"
            _deploy_help_ex "deploy docs:> prod               # just push, no build"
            _deploy_help_ex "deploy docs:>{gdocs} prod        # just push gdocs"
            ;;
        aliases)
            _deploy_help_section "ALIASES"
            echo ""
            _deploy_help_sub "Commands:"
            _deploy_help_cmd "o" "org"
            _deploy_help_cmd "t" "target"
            _deploy_help_cmd "e" "env"
            _deploy_help_cmd "i" "info"
            _deploy_help_cmd "c" "clear"
            _deploy_help_cmd "p" "push"
            _deploy_help_cmd "s" "show"
            _deploy_help_cmd "ls" "list"
            _deploy_help_cmd "hist" "history"
            _deploy_help_cmd "doc" "doctor"
            _deploy_help_cmd "h" "help"
            echo ""
            _deploy_help_sub "Subcommands:"
            _deploy_help_cmd "doctor r" "doctor reload"
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
            _deploy_help_cmd "set <org> <tgt> <env>" "Set all three at once"
            _deploy_help_cmd "target <name>" "Set target"
            _deploy_help_cmd "env <name>" "Set env"
            _deploy_help_cmd "deploy" "Deploy (confirms)"
            _deploy_help_cmd "info | clear" "Show/clear context"
            echo ""
            _deploy_help_sub "All Commands:"
            echo -e "  ${CLR_CMD}Context${CLR_NC}   ${CLR_DIM}set org target env info clear${CLR_NC}"
            echo -e "  ${CLR_CMD}Items${CLR_NC}     ${CLR_DIM}items run${CLR_NC}"
            echo -e "  ${CLR_CMD}Deploy${CLR_NC}    ${CLR_DIM}push show list${CLR_NC}"
            echo -e "  ${CLR_CMD}Monitor${CLR_NC}   ${CLR_DIM}history doctor${CLR_NC}"
            echo ""
            _deploy_help_sub "Help Topics:"
            echo -e "  ${CLR_ARG}taxonomy${CLR_NC} ${CLR_ARG}dry-run${CLR_NC} ${CLR_ARG}items${CLR_NC} ${CLR_ARG}context${CLR_NC} ${CLR_ARG}direct${CLR_NC} ${CLR_ARG}history${CLR_NC} ${CLR_ARG}targets${CLR_NC} ${CLR_ARG}vars${CLR_NC} ${CLR_ARG}modes${CLR_NC} ${CLR_ARG}aliases${CLR_NC}"
            ;;
    esac
}

# =============================================================================
# ITEMS / RUN OPERATIONS
# =============================================================================

# Edit items in $EDITOR, return remaining items
# Usage: _deploy_edit_items
_deploy_edit_items() {
    local editor="${VISUAL:-${EDITOR:-vi}}"
    local tmpfile

    tmpfile=$(mktemp "${TMPDIR:-/tmp}/deploy-items.XXXXXX")

    # Write items to temp file
    printf '%s\n' "${DEPLOY_CTX_ITEMS[@]}" > "$tmpfile"

    # Open editor
    "$editor" "$tmpfile"
    local rc=$?

    if [[ $rc -ne 0 ]]; then
        echo "Editor exited with error" >&2
        rm -f "$tmpfile"
        return 1
    fi

    # Read back, filter empty/comment lines
    DEPLOY_CTX_ITEMS=()
    while IFS= read -r line; do
        # Skip empty lines and comments
        [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
        # Trim whitespace
        line="${line#"${line%%[![:space:]]*}"}"
        line="${line%"${line##*[![:space:]]}"}"
        [[ -n "$line" ]] && DEPLOY_CTX_ITEMS+=("$line")
    done < "$tmpfile"

    rm -f "$tmpfile"
    DEPLOY_CTX_ITEMS_MODIFIED=1

    if [[ ${#DEPLOY_CTX_ITEMS[@]} -eq 0 ]]; then
        echo "No items remaining after edit" >&2
        return 1
    fi

    echo "Items after edit: ${DEPLOY_CTX_ITEMS[*]} (${#DEPLOY_CTX_ITEMS[@]})"
    return 0
}

# Parse -item and =item arguments, return remaining args
# Sets DEPLOY_ONESHOT_EXCLUDE and DEPLOY_ONESHOT_INCLUDE arrays
_deploy_parse_item_args() {
    DEPLOY_ONESHOT_EXCLUDE=()
    DEPLOY_ONESHOT_INCLUDE=()
    DEPLOY_REMAINING_ARGS=()

    for arg in "$@"; do
        case "$arg" in
            --edit)
                DEPLOY_EDIT_MODE=1
                ;;
            --only)
                # Next arg is glob, handled by caller
                DEPLOY_REMAINING_ARGS+=("$arg")
                ;;
            -[a-zA-Z_]*)
                # Exclude: -itemname (but not flags like -n)
                local item="${arg#-}"
                # Skip known flags
                [[ "$item" == "n" || "$item" == "v" ]] && { DEPLOY_REMAINING_ARGS+=("$arg"); continue; }
                DEPLOY_ONESHOT_EXCLUDE+=("$item")
                ;;
            =[a-zA-Z_]*)
                # Include-only: =itemname
                DEPLOY_ONESHOT_INCLUDE+=("${arg#=}")
                ;;
            *)
                DEPLOY_REMAINING_ARGS+=("$arg")
                ;;
        esac
    done
}

# Apply one-shot item filters (without modifying context)
# Returns filtered items in DEPLOY_WORKING_ITEMS
_deploy_apply_oneshot_filters() {
    DEPLOY_WORKING_ITEMS=("${DEPLOY_CTX_ITEMS[@]}")

    # Apply include-only filter
    if [[ ${#DEPLOY_ONESHOT_INCLUDE[@]} -gt 0 ]]; then
        local new_items=()
        for item in "${DEPLOY_WORKING_ITEMS[@]}"; do
            for inc in "${DEPLOY_ONESHOT_INCLUDE[@]}"; do
                [[ "$item" == "$inc" ]] && { new_items+=("$item"); break; }
            done
        done
        DEPLOY_WORKING_ITEMS=("${new_items[@]}")
    fi

    # Apply exclude filter
    if [[ ${#DEPLOY_ONESHOT_EXCLUDE[@]} -gt 0 ]]; then
        local new_items=()
        for item in "${DEPLOY_WORKING_ITEMS[@]}"; do
            local exclude=0
            for ex in "${DEPLOY_ONESHOT_EXCLUDE[@]}"; do
                [[ "$item" == "$ex" ]] && { exclude=1; break; }
            done
            [[ $exclude -eq 0 ]] && new_items+=("$item")
        done
        DEPLOY_WORKING_ITEMS=("${new_items[@]}")
    fi
}

# Run operation on items
# Usage: deploy run <operation> [operation...]
#        deploy run build sync
deploy_run() {
    local operations=()
    local dry_run=0

    # Parse args
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -n|--dry-run) dry_run=1; shift ;;
            *) operations+=("$1"); shift ;;
        esac
    done

    # Need target and items
    if [[ -z "$DEPLOY_CTX_TARGET" ]]; then
        echo "Need target - run: deploy target <name>" >&2
        return 1
    fi

    if [[ ${#DEPLOY_CTX_ITEMS[@]} -eq 0 ]]; then
        echo "No items to operate on" >&2
        return 1
    fi

    # Default operation from pipeline
    if [[ ${#operations[@]} -eq 0 ]]; then
        if [[ -n "$DEPLOY_CTX_PIPELINE" ]]; then
            operations=("$DEPLOY_CTX_PIPELINE")
        else
            echo "No operation specified and no default pipeline" >&2
            return 1
        fi
    fi

    local toml
    if [[ "$DEPLOY_CTX_TARGET" == "." ]]; then
        toml="./tetra-deploy.toml"
    else
        toml=$(_deploy_find_target "$DEPLOY_CTX_TARGET")
    fi

    if [[ -z "$toml" || ! -f "$toml" ]]; then
        echo "Target TOML not found: $DEPLOY_CTX_TARGET" >&2
        return 1
    fi

    echo "Running: ${operations[*]}"
    echo "Items: ${DEPLOY_CTX_ITEMS[*]} (${#DEPLOY_CTX_ITEMS[@]})"
    [[ $dry_run -eq 1 ]] && echo "[DRY RUN]"
    echo ""

    # Run each operation
    for op in "${operations[@]}"; do
        echo "[${op}]"

        for item in "${DEPLOY_CTX_ITEMS[@]}"; do
            local value=$(_deploy_items_get_value "$toml" "$item")
            [[ -z "$value" ]] && { echo "  $item: (no value, skipping)"; continue; }

            echo "  $item: $value"

            # Here you would run the actual operation
            # For now, just show what would be done
            if [[ $dry_run -eq 0 ]]; then
                # TODO: Integrate with de_run or pipeline system
                :
            fi
        done

        echo ""
    done

    echo "Done"
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
            case "$1" in
                promote) shift; deploy_env_promote "$@" ;;
                validate) shift; deploy_env_validate "$@" ;;
                diff) shift; deploy_env_diff "$@" ;;
                push) shift; deploy_env_push "$@" ;;
                pull) shift; deploy_env_pull "$@" ;;
                edit) shift; deploy_env_edit "$@" ;;
                status) shift; deploy_env_status "$@" ;;
                *) deploy_env_set "$@" ;;  # default: set context env
            esac
            ;;
        info|i)
            deploy_info
            ;;
        clear|c)
            deploy_clear_context
            ;;
        set)
            shift
            deploy_set "$@"
            ;;

        # Items commands
        items)
            shift
            deploy_items "$@"
            ;;
        run)
            shift
            deploy_run "$@"
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
            shift
            deploy_doctor "$@"
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
            # Check for address syntax: [org:]target[:pipeline][:{items}]
            if [[ "$cmd" == *:* ]]; then
                shift  # Remove cmd

                # Parse address using deploy_addr module
                deploy_addr_parse "$cmd"

                # Apply org override if specified
                local org_override="${DEPLOY_ADDR[org]}"
                local save_org=""
                if [[ -n "$org_override" ]]; then
                    save_org="$DEPLOY_CTX_ORG"
                    export DEPLOY_CTX_ORG="$org_override"
                fi

                # Helper to restore org on exit
                _restore_org() { [[ -n "$org_override" ]] && export DEPLOY_CTX_ORG="$save_org"; }

                # Validate address (org, target, pipeline)
                if ! deploy_addr_validate; then
                    echo -e "${DEPLOY_ADDR[error]}" >&2
                    _restore_org
                    return 1
                fi

                # Resolve exclude/group items after validation (needs toml_path)
                local items_override="${DEPLOY_ADDR[items]}"
                if [[ "${DEPLOY_ADDR[items_mode]}" == "exclude" ]]; then
                    deploy_addr_resolve_exclude
                    items_override="${DEPLOY_ADDR[items]}"
                elif [[ "${DEPLOY_ADDR[items_mode]}" == "group" ]]; then
                    deploy_addr_resolve_group
                    items_override="${DEPLOY_ADDR[items]}"
                fi

                # Extract parsed values
                local target="${DEPLOY_ADDR[target]}"
                local pipeline="${DEPLOY_ADDR[pipeline]}"
                local toml="${DEPLOY_ADDR[toml_path]}"

                # Parse remaining args for --edit and -item/=item
                DEPLOY_EDIT_MODE=0
                _deploy_parse_item_args "$@"
                set -- "${DEPLOY_REMAINING_ARGS[@]}"

                local env="${1:-${DEPLOY_ADDR[env]}}"
                local dry_run=0
                [[ "$2" == "-n" || "$2" == "--dry-run" ]] && dry_run=1

                # Handle --edit mode
                if [[ $DEPLOY_EDIT_MODE -eq 1 ]]; then
                    # Temporarily set target to load items
                    local save_target="$DEPLOY_CTX_TARGET"
                    export DEPLOY_CTX_TARGET="$target"
                    deploy_items_reset

                    # Apply one-shot filters before editing
                    _deploy_apply_oneshot_filters
                    DEPLOY_CTX_ITEMS=("${DEPLOY_WORKING_ITEMS[@]}")

                    _deploy_edit_items || {
                        export DEPLOY_CTX_TARGET="$save_target"
                        _restore_org
                        return 1
                    }

                    # Run pipeline on edited items
                    de_load "$toml" || { export DEPLOY_CTX_TARGET="$save_target"; _restore_org; return 1; }
                    de_run "$pipeline" "$env" "$dry_run" "${DEPLOY_CTX_ITEMS[*]}"
                    local rc=$?

                    # Restore target and org
                    export DEPLOY_CTX_TARGET="$save_target"
                    _restore_org
                    return $rc
                fi

                # Handle one-shot filters (without --edit)
                if [[ ${#DEPLOY_ONESHOT_EXCLUDE[@]} -gt 0 || ${#DEPLOY_ONESHOT_INCLUDE[@]} -gt 0 ]]; then
                    local save_target="$DEPLOY_CTX_TARGET"
                    local save_items=("${DEPLOY_CTX_ITEMS[@]}")
                    local save_modified=$DEPLOY_CTX_ITEMS_MODIFIED

                    export DEPLOY_CTX_TARGET="$target"
                    deploy_items_reset
                    _deploy_apply_oneshot_filters
                    DEPLOY_CTX_ITEMS=("${DEPLOY_WORKING_ITEMS[@]}")

                    if [[ ${#DEPLOY_CTX_ITEMS[@]} -eq 0 ]]; then
                        echo "No items remaining after filter" >&2
                        export DEPLOY_CTX_TARGET="$save_target"
                        DEPLOY_CTX_ITEMS=("${save_items[@]}")
                        DEPLOY_CTX_ITEMS_MODIFIED=$save_modified
                        _restore_org
                        return 1
                    fi

                    echo "Items: ${DEPLOY_CTX_ITEMS[*]} (${#DEPLOY_CTX_ITEMS[@]})"
                    de_load "$toml" || { export DEPLOY_CTX_TARGET="$save_target"; _restore_org; return 1; }
                    de_run "$pipeline" "$env" "$dry_run" "${DEPLOY_CTX_ITEMS[*]}"
                    local rc=$?

                    # Restore context
                    export DEPLOY_CTX_TARGET="$save_target"
                    DEPLOY_CTX_ITEMS=("${save_items[@]}")
                    DEPLOY_CTX_ITEMS_MODIFIED=$save_modified
                    _restore_org
                    return $rc
                fi

                # Standard target:pipeline run (with optional items_override from brace syntax)
                de_load "$toml" || { _restore_org; return 1; }
                de_run "$pipeline" "$env" "$dry_run" "$items_override"
                local rc=$?
                _restore_org
                return $rc
            fi

            # Default: deploy <target> <env> or deploy <env> (legacy)
            deploy_push "$@"
            ;;
    esac
}

# =============================================================================
# EXPORTS (context exports in deploy_ctx.sh)
# =============================================================================

export -f deploy deploy_push deploy_show deploy_with_context
export -f deploy_history deploy_doctor _deploy_doctor_complete deploy_help
export -f _deploy_help_colors _deploy_help_section _deploy_help_sub _deploy_help_cmd _deploy_help_ex
export -f _deploy_load _deploy_load_standalone _deploy_load_org
export -f _deploy_template _deploy_exec _deploy_resolve _deploy_clear
export -f _deploy_is_env _deploy_find_target
export -f _deploy_edit_items _deploy_parse_item_args _deploy_apply_oneshot_filters
export -f deploy_run
