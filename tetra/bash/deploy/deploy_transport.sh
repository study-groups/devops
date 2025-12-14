#!/usr/bin/env bash
# deploy_transport.sh - Transport variables/arrays/functions across SSH
#
# Problem: Bash state doesn't survive SSH boundaries
# Solution: Explicit registration + declare-based serialization
#
# Usage:
#   deploy_transport_var MY_VAR           # Register scalar
#   deploy_transport_array MY_ARRAY       # Register array
#   deploy_transport_func my_func         # Register function
#   deploy_remote user@host "command"     # Execute with transported context
#   deploy_remote_script user@host <<'EOF' # Multi-line script
#     echo $MY_VAR
#     my_func
#   EOF

# =============================================================================
# REGISTRY
# =============================================================================

declare -ga _DEPLOY_TRANSPORT_VARS=()
declare -ga _DEPLOY_TRANSPORT_ARRAYS=()
declare -ga _DEPLOY_TRANSPORT_FUNCS=()

deploy_transport_var() {
    local var
    for var in "$@"; do
        _DEPLOY_TRANSPORT_VARS+=("$var")
    done
}

deploy_transport_array() {
    local arr
    for arr in "$@"; do
        _DEPLOY_TRANSPORT_ARRAYS+=("$arr")
    done
}

deploy_transport_func() {
    local func
    for func in "$@"; do
        _DEPLOY_TRANSPORT_FUNCS+=("$func")
    done
}

# Clear registrations (for testing/reset)
deploy_transport_clear() {
    _DEPLOY_TRANSPORT_VARS=()
    _DEPLOY_TRANSPORT_ARRAYS=()
    _DEPLOY_TRANSPORT_FUNCS=()
}

# =============================================================================
# SERIALIZATION
# =============================================================================

# Build payload string that reconstructs state on remote
_deploy_transport_payload() {
    local payload=""
    local item

    # Scalars: export VAR="value"
    for item in "${_DEPLOY_TRANSPORT_VARS[@]}"; do
        [[ -v $item ]] || continue
        # Use printf %q for safe quoting
        payload+="export $item=$(printf '%q' "${!item}");"
    done

    # Arrays: declare -a ARR=(...)
    for item in "${_DEPLOY_TRANSPORT_ARRAYS[@]}"; do
        [[ -v $item ]] || continue
        payload+="$(declare -p "$item" 2>/dev/null);"
    done

    # Functions: func_name () { ... }
    for item in "${_DEPLOY_TRANSPORT_FUNCS[@]}"; do
        type "$item" &>/dev/null || continue
        payload+="$(declare -f "$item");"
    done

    echo "$payload"
}

# Show what would be transported (debug)
deploy_transport_show() {
    echo "Transport Registry"
    echo "=================="
    echo ""
    echo "Vars: ${_DEPLOY_TRANSPORT_VARS[*]:-(none)}"
    echo "Arrays: ${_DEPLOY_TRANSPORT_ARRAYS[*]:-(none)}"
    echo "Funcs: ${_DEPLOY_TRANSPORT_FUNCS[*]:-(none)}"
    echo ""
    echo "Payload:"
    echo "--------"
    _deploy_transport_payload | tr ';' '\n' | grep -v '^$'
}

# =============================================================================
# REMOTE EXECUTION
# =============================================================================

# Execute single command with transported context
# Usage: deploy_remote user@host "command args"
deploy_remote() {
    local target=$1
    shift
    local cmd="$*"

    local payload=$(_deploy_transport_payload)

    ssh $DEPLOY_SSH_OPTS "$target" "${payload}${cmd}"
}

# Execute script with transported context (heredoc friendly)
# Usage: deploy_remote_script user@host <<'EOF'
#   multi-line script here
# EOF
deploy_remote_script() {
    local target=$1
    local script

    # Read script from stdin or arg
    if [[ -n "$2" ]]; then
        script="$2"
    else
        script=$(cat)
    fi

    local payload=$(_deploy_transport_payload)

    ssh $DEPLOY_SSH_OPTS "$target" bash <<EOF
$payload
$script
EOF
}

# Execute with sudo on remote
deploy_remote_sudo() {
    local target=$1
    shift
    local cmd="$*"

    local payload=$(_deploy_transport_payload)

    ssh $DEPLOY_SSH_OPTS "$target" "sudo bash -c '${payload}${cmd}'"
}

# =============================================================================
# AUTO-REGISTER CORE DEPLOY VARS
# =============================================================================

# Context vars (always useful on remote)
deploy_transport_var DEPLOY_CTX_ORG
deploy_transport_var DEPLOY_CTX_TARGET
deploy_transport_var DEPLOY_CTX_ENV

# Resolved values (from TOML loading)
deploy_transport_var DEPLOY_NAME
deploy_transport_var DEPLOY_REMOTE
deploy_transport_var DEPLOY_DOMAIN
deploy_transport_var DEPLOY_HOST
deploy_transport_var DEPLOY_WORK_USER

# Command arrays
deploy_transport_array DEPLOY_PRE
deploy_transport_array DEPLOY_COMMANDS
deploy_transport_array DEPLOY_POST

# =============================================================================
# EXPORTS
# =============================================================================

export -f deploy_transport_var deploy_transport_array deploy_transport_func
export -f deploy_transport_clear deploy_transport_show
export -f _deploy_transport_payload
export -f deploy_remote deploy_remote_script deploy_remote_sudo
