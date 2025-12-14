#!/usr/bin/env bash
# deploy_ctx.sh - Deploy context management
# Ephemeral state with cross-session persistence
# Priority: explicit command > env var > saved file
# TPS prompt only active when context is set

DEPLOY_CTX_FILE="${TETRA_DIR}/deploy/context"
DEPLOY_TPS_REGISTERED=0

# =============================================================================
# TPS INTEGRATION (lazy - only when context active)
# =============================================================================

_deploy_prompt_org() { echo "${DEPLOY_CTX_ORG:-}"; }
_deploy_prompt_target() {
    local t="${DEPLOY_CTX_TARGET:-}" p="${DEPLOY_CTX_PIPELINE:-}"
    [[ -z "$t" ]] && return
    [[ -n "$p" ]] && echo "$t:$p" || echo "$t"
}
_deploy_prompt_env() { echo "${DEPLOY_CTX_ENV:-}"; }

_deploy_register_prompt() {
    [[ $DEPLOY_TPS_REGISTERED -eq 1 ]] && return
    if type tps_register_context &>/dev/null; then
        tps_register_context org _deploy_prompt_org
        tps_register_context target _deploy_prompt_target
        tps_register_context env _deploy_prompt_env
        DEPLOY_TPS_REGISTERED=1
    fi
}

_deploy_unregister_prompt() {
    [[ $DEPLOY_TPS_REGISTERED -eq 0 ]] && return
    if type tps_unregister_context &>/dev/null; then
        tps_unregister_context org
        tps_unregister_context target
        tps_unregister_context env
        DEPLOY_TPS_REGISTERED=0
    fi
}

# =============================================================================
# PERSISTENCE
# =============================================================================

_deploy_ctx_save() {
    mkdir -p "$(dirname "$DEPLOY_CTX_FILE")"
    cat > "$DEPLOY_CTX_FILE" <<EOF
DEPLOY_CTX_ORG=${DEPLOY_CTX_ORG}
DEPLOY_CTX_TARGET=${DEPLOY_CTX_TARGET}
DEPLOY_CTX_PIPELINE=${DEPLOY_CTX_PIPELINE}
DEPLOY_CTX_ENV=${DEPLOY_CTX_ENV}
EOF
    # Register TPS when we have context
    if [[ -n "$DEPLOY_CTX_ORG" || -n "$DEPLOY_CTX_TARGET" || -n "$DEPLOY_CTX_ENV" ]]; then
        _deploy_register_prompt
    else
        _deploy_unregister_prompt
    fi
}

_deploy_ctx_load() {
    [[ ! -f "$DEPLOY_CTX_FILE" ]] && return

    local saved_org saved_target saved_pipeline saved_env
    while IFS='=' read -r key val; do
        case "$key" in
            DEPLOY_CTX_ORG) saved_org="$val" ;;
            DEPLOY_CTX_TARGET) saved_target="$val" ;;
            DEPLOY_CTX_PIPELINE) saved_pipeline="$val" ;;
            DEPLOY_CTX_ENV) saved_env="$val" ;;
        esac
    done < "$DEPLOY_CTX_FILE"

    [[ -z "$DEPLOY_CTX_ORG" ]] && export DEPLOY_CTX_ORG="$saved_org"
    [[ -z "$DEPLOY_CTX_TARGET" ]] && export DEPLOY_CTX_TARGET="$saved_target"
    [[ -z "$DEPLOY_CTX_PIPELINE" ]] && export DEPLOY_CTX_PIPELINE="$saved_pipeline"
    [[ -z "$DEPLOY_CTX_ENV" ]] && export DEPLOY_CTX_ENV="$saved_env"

    # Register TPS if we loaded context
    if [[ -n "$DEPLOY_CTX_ORG" || -n "$DEPLOY_CTX_TARGET" || -n "$DEPLOY_CTX_ENV" ]]; then
        _deploy_register_prompt
    fi
}

# =============================================================================
# STATE
# =============================================================================

export DEPLOY_CTX_ORG="${DEPLOY_CTX_ORG:-}"
export DEPLOY_CTX_TARGET="${DEPLOY_CTX_TARGET:-}"
export DEPLOY_CTX_PIPELINE="${DEPLOY_CTX_PIPELINE:-}"
export DEPLOY_CTX_ENV="${DEPLOY_CTX_ENV:-}"
declare -ga DEPLOY_CTX_ITEMS=()
DEPLOY_CTX_ITEMS_MODIFIED=0  # Track if items were filtered

# Load saved context
_deploy_ctx_load

# Seed org from TETRA_ORG or org_active if still empty
if [[ -z "$DEPLOY_CTX_ORG" ]]; then
    if [[ -n "${TETRA_ORG:-}" ]]; then
        export DEPLOY_CTX_ORG="$TETRA_ORG"
    elif type org_active &>/dev/null; then
        _deploy_seed_org=$(org_active 2>/dev/null)
        [[ -n "$_deploy_seed_org" && "$_deploy_seed_org" != "none" ]] && export DEPLOY_CTX_ORG="$_deploy_seed_org"
        unset _deploy_seed_org
    fi
    [[ -n "$DEPLOY_CTX_ORG" ]] && _deploy_register_prompt
fi

_deploy_active_org() {
    if [[ -n "$DEPLOY_CTX_ORG" ]]; then
        echo "$DEPLOY_CTX_ORG"
    elif type org_active &>/dev/null; then
        org_active 2>/dev/null
    fi
}

# =============================================================================
# SETTERS
# =============================================================================

# Quick set all three: deploy set <org> <target> <env>
deploy_set() {
    local org="$1" target="$2" env="$3"

    if [[ -z "$org" || -z "$target" || -z "$env" ]]; then
        echo "usage: deploy set <org> <target> <env>" >&2
        return 1
    fi

    # Validate org
    if [[ ! -d "$TETRA_DIR/orgs/$org" ]]; then
        echo "org not found: $org" >&2
        return 1
    fi

    export DEPLOY_CTX_ORG="$org"
    export DEPLOY_CTX_TARGET="$target"
    export DEPLOY_CTX_PIPELINE=""
    export DEPLOY_CTX_ENV="$env"
    _deploy_ctx_save
    deploy_info
}

deploy_org_set() {
    local name="$1"
    if [[ -z "$name" ]]; then
        deploy_info
        [[ -d "$TETRA_DIR/orgs" ]] && echo "orgs: $(ls "$TETRA_DIR/orgs" 2>/dev/null | tr '\n' ' ')"
        return 0
    fi
    if [[ ! -d "$TETRA_DIR/orgs/$name" ]]; then
        echo "org not found: $name" >&2
        [[ -d "$TETRA_DIR/orgs" ]] && echo "orgs: $(ls "$TETRA_DIR/orgs" 2>/dev/null | tr '\n' ' ')" >&2
        return 1
    fi
    export DEPLOY_CTX_ORG="$name"
    export DEPLOY_CTX_TARGET=""
    _deploy_ctx_save
    deploy_info
}

deploy_target_set() {
    local input="$1"
    local name pipeline

    if [[ -z "$input" ]]; then
        deploy_info
        return 0
    fi

    # Parse target:pipeline format
    if [[ "$input" == *:* ]]; then
        name="${input%%:*}"
        pipeline="${input#*:}"
    else
        name="$input"
        pipeline=""
    fi

    # Auto-populate org
    if [[ -z "$DEPLOY_CTX_ORG" ]] && type org_active &>/dev/null; then
        local active_org=$(org_active 2>/dev/null)
        [[ -n "$active_org" && "$active_org" != "none" ]] && export DEPLOY_CTX_ORG="$active_org"
    fi

    # CWD target
    if [[ "$name" == "." && -f "./tetra-deploy.toml" ]]; then
        export DEPLOY_CTX_TARGET="."
        export DEPLOY_CTX_PIPELINE=""
        _deploy_ctx_save
        deploy_info
        return 0
    fi

    # Validate target exists
    local toml=$(_deploy_find_target "$name")
    if [[ -z "$toml" ]]; then
        echo "target not found: $name" >&2
        return 1
    fi

    export DEPLOY_CTX_TARGET="$name"

    # Validate pipeline if specified
    if [[ -n "$pipeline" ]]; then
        # Match: pipeline_name = ... or pipeline_name= ...
        if awk -v p="$pipeline" '
            /^\[pipeline\]/{found=1; next}
            /^\[/{found=0}
            found {
                # Extract key (before = sign)
                key = $0
                sub(/[ \t]*=.*/, "", key)
                if (key == p) exit 0
            }
            END{exit 1}
        ' "$toml"; then
            export DEPLOY_CTX_PIPELINE="$pipeline"
        else
            echo "pipeline not found: $pipeline" >&2
            export DEPLOY_CTX_PIPELINE=""
        fi
    else
        export DEPLOY_CTX_PIPELINE=""
    fi

    _deploy_ctx_save

    # Load items from new target
    deploy_items_reset

    deploy_info
}

deploy_env_set() {
    local name="$1"
    if [[ -z "$name" ]]; then
        deploy_info
        type org_env_names &>/dev/null && echo "envs: $(org_env_names 2>/dev/null | tr '\n' ' ')"
        return 0
    fi

    # Auto-populate org
    if [[ -z "$DEPLOY_CTX_ORG" ]] && type org_active &>/dev/null; then
        local active_org=$(org_active 2>/dev/null)
        [[ -n "$active_org" && "$active_org" != "none" ]] && export DEPLOY_CTX_ORG="$active_org"
    fi

    export DEPLOY_CTX_ENV="$name"
    _deploy_ctx_save
    deploy_info
}

deploy_clear_context() {
    export DEPLOY_CTX_ORG=""
    export DEPLOY_CTX_TARGET=""
    export DEPLOY_CTX_PIPELINE=""
    export DEPLOY_CTX_ENV=""
    DEPLOY_CTX_ITEMS=()
    DEPLOY_CTX_ITEMS_MODIFIED=0
    _deploy_ctx_save
    echo "[?:?:?] cleared"
}

# =============================================================================
# INFO
# =============================================================================

deploy_info() {
    local org=$(_deploy_prompt_org)
    local target=$(_deploy_prompt_target)
    local env=$(_deploy_prompt_env)

    # Build context line with optional items count
    local ctx="[${org:-?}:${target:-?}:${env:-?}]"
    if [[ ${#DEPLOY_CTX_ITEMS[@]} -gt 0 ]]; then
        ctx="$ctx (${#DEPLOY_CTX_ITEMS[@]} items)"
        [[ $DEPLOY_CTX_ITEMS_MODIFIED -eq 1 ]] && ctx="$ctx *"
    fi
    echo "$ctx"

    if [[ -n "$org" && -n "$target" && -n "$env" ]]; then
        echo "ready - run: deploy"
    else
        local need=()
        [[ -z "$org" ]] && need+=("org")
        [[ -z "$target" ]] && need+=("target")
        [[ -z "$env" ]] && need+=("env")
        echo "need: ${need[*]}"
    fi
}

deploy_list() {
    local org target env
    org=$(_deploy_prompt_org)
    target=$(_deploy_prompt_target)
    env=$(_deploy_prompt_env)

    # Always show context line
    echo "[${org:-?}:${target:-?}:${env:-?}]"

    local active_org=$(_deploy_active_org)
    if [[ -n "$active_org" && "$active_org" != "none" ]]; then
        local targets_dir="$TETRA_DIR/orgs/$active_org/targets"
        local targets=()
        if [[ -d "$targets_dir" ]]; then
            for f in "$targets_dir"/*.toml; do
                [[ -f "$f" ]] && targets+=("$(basename "$f" .toml)")
            done
            for d in "$targets_dir"/*/; do
                [[ -d "$d" && -f "$d/tetra-deploy.toml" ]] && targets+=("$(basename "$d")/")
            done
        fi
        if [[ ${#targets[@]} -gt 0 ]]; then
            echo "targets: ${targets[*]}"
        else
            echo "targets: (none in $active_org)"
        fi
    else
        echo "org: (none) - run: deploy org <name>"
    fi

    [[ -f "./tetra-deploy.toml" ]] && echo "cwd: ./tetra-deploy.toml"
}

# Legacy compat
_tetra_deploy_info() {
    local org="$DEPLOY_CTX_ORG" target="$DEPLOY_CTX_TARGET"
    local pipeline="$DEPLOY_CTX_PIPELINE" env="$DEPLOY_CTX_ENV"
    [[ -z "$org" && -z "$target" && -z "$env" ]] && return
    local parts=()
    [[ -n "$org" ]] && parts+=("$org") || parts+=("?")
    local target_str="?"
    if [[ -n "$target" ]]; then
        target_str="$target"
        [[ -n "$pipeline" ]] && target_str="$target:$pipeline"
    fi
    parts+=("$target_str")
    [[ -n "$env" ]] && parts+=("$env") || parts+=("?")
    local IFS=":"
    echo "${parts[*]}"
}

# =============================================================================
# ITEMS MANAGEMENT
# =============================================================================

# Get all item names from [files] section of current target TOML
_deploy_items_from_toml() {
    local toml="$1"
    [[ ! -f "$toml" ]] && return

    # Extract keys from [files] section
    awk '/^\[files\]/{found=1; next} /^\[/{found=0} found && /^[a-zA-Z_][a-zA-Z0-9_-]*[ ]*=/{print $1}' "$toml"
}

# Reset items to all from current target's [files] section
deploy_items_reset() {
    DEPLOY_CTX_ITEMS=()
    DEPLOY_CTX_ITEMS_MODIFIED=0

    local toml
    if [[ "$DEPLOY_CTX_TARGET" == "." ]]; then
        toml="./tetra-deploy.toml"
    elif [[ -n "$DEPLOY_CTX_TARGET" ]]; then
        toml=$(_deploy_find_target "$DEPLOY_CTX_TARGET")
    fi

    [[ -z "$toml" || ! -f "$toml" ]] && return 0

    mapfile -t DEPLOY_CTX_ITEMS < <(_deploy_items_from_toml "$toml")
    return 0
}

# Show current items
deploy_items_show() {
    if [[ ${#DEPLOY_CTX_ITEMS[@]} -eq 0 ]]; then
        echo "(no items - set target first or target has no [files] section)"
        return 0
    fi

    echo "${DEPLOY_CTX_ITEMS[*]} (${#DEPLOY_CTX_ITEMS[@]} items)"
    [[ $DEPLOY_CTX_ITEMS_MODIFIED -eq 1 ]] && echo "(filtered)"
}

# Exclude items by name (prefix: -)
_deploy_items_exclude() {
    local to_exclude=("$@")
    local new_items=()

    for item in "${DEPLOY_CTX_ITEMS[@]}"; do
        local exclude=0
        for ex in "${to_exclude[@]}"; do
            [[ "$item" == "$ex" ]] && { exclude=1; break; }
        done
        [[ $exclude -eq 0 ]] && new_items+=("$item")
    done

    DEPLOY_CTX_ITEMS=("${new_items[@]}")
    DEPLOY_CTX_ITEMS_MODIFIED=1
}

# Include only specified items (prefix: =)
_deploy_items_include() {
    local to_include=("$@")
    local new_items=()

    for item in "${DEPLOY_CTX_ITEMS[@]}"; do
        for inc in "${to_include[@]}"; do
            [[ "$item" == "$inc" ]] && { new_items+=("$item"); break; }
        done
    done

    DEPLOY_CTX_ITEMS=("${new_items[@]}")
    DEPLOY_CTX_ITEMS_MODIFIED=1
}

# Filter items by glob pattern
_deploy_items_glob() {
    local pattern="$1"
    local new_items=()

    for item in "${DEPLOY_CTX_ITEMS[@]}"; do
        # shellcheck disable=SC2053
        [[ "$item" == $pattern ]] && new_items+=("$item")
    done

    DEPLOY_CTX_ITEMS=("${new_items[@]}")
    DEPLOY_CTX_ITEMS_MODIFIED=1
}

# Main items command handler
# Usage: deploy items                    # show items
#        deploy items -gdocs -index      # exclude
#        deploy items =deploy =org       # include-only
#        deploy items reset              # reset to all
#        deploy items <glob>             # filter by glob
deploy_items() {
    local arg="$1"

    # No args: show items
    if [[ -z "$arg" ]]; then
        deploy_items_show
        return 0
    fi

    # Reset command
    if [[ "$arg" == "reset" ]]; then
        deploy_items_reset
        echo "reset to all items"
        deploy_items_show
        return 0
    fi

    # Parse arguments
    local excludes=() includes=() glob=""

    for arg in "$@"; do
        case "$arg" in
            -*)
                # Exclude: -itemname
                excludes+=("${arg#-}")
                ;;
            =*)
                # Include-only: =itemname
                includes+=("${arg#=}")
                ;;
            *)
                # Glob pattern
                glob="$arg"
                ;;
        esac
    done

    # Apply operations (include-only takes precedence)
    if [[ ${#includes[@]} -gt 0 ]]; then
        _deploy_items_include "${includes[@]}"
    elif [[ ${#excludes[@]} -gt 0 ]]; then
        _deploy_items_exclude "${excludes[@]}"
    elif [[ -n "$glob" ]]; then
        _deploy_items_glob "$glob"
    fi

    deploy_items_show
}

# Get item value from [files] section
_deploy_items_get_value() {
    local toml="$1"
    local item="$2"

    [[ ! -f "$toml" ]] && return 1

    awk -v k="$item" '
        /^\[files\]/{found=1; next}
        /^\[/{found=0}
        found && $1 == k && $2 == "=" {
            val = $0
            sub(/^[^=]*=[ \t]*/, "", val)
            gsub(/^["'\''"]|["'\''"]$/, "", val)
            print val
            exit
        }
    ' "$toml"
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f _deploy_ctx_save _deploy_ctx_load _deploy_active_org
export -f _deploy_items_from_toml deploy_items_reset deploy_items_show
export -f _deploy_items_exclude _deploy_items_include _deploy_items_glob
export -f deploy_items _deploy_items_get_value
export -f _deploy_prompt_org _deploy_prompt_target _deploy_prompt_env
export -f _deploy_register_prompt _deploy_unregister_prompt
export -f deploy_set deploy_org_set deploy_target_set deploy_env_set deploy_clear_context
export -f deploy_info deploy_list _tetra_deploy_info
