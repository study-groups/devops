#!/usr/bin/env bash
# tkm_keys.sh - SSH key generation and deployment
#
# Keys: ~/.ssh/<org>/<env>_<user>
# SSH config: Host entries matching hostname with multiple IdentityFiles

# =============================================================================
# GENERATE
# =============================================================================

tkm_generate() {
    local target="${1:-}"

    [[ -z "$target" ]] && { echo "Usage: tkm gen <env|all>"; return 1; }

    local org=$(tkm_org_name) || { echo "No active org"; return 1; }
    local keys_dir=$(tkm_keys_dir)

    # Ensure directory exists
    mkdir -p "$keys_dir"
    chmod 700 "$keys_dir"

    if [[ "$target" == "all" ]]; then
        _tkm_generate_all
    else
        _tkm_generate_env "$target"
    fi
}

_tkm_generate_env() {
    local env="$1"
    local keys_dir=$(tkm_keys_dir)

    echo "Generating keys for: $env"

    local host=$(_tkm_get_host "$env")
    if [[ -z "$host" ]]; then
        echo "  [!] No host for $env in tetra.toml"
        return 1
    fi

    local app_user=$(tkm_app_user "$env")
    local generated=0

    # Generate root key
    if _tkm_generate_key "${env}_root"; then
        ((generated++))
    fi

    # Generate app user key
    if _tkm_generate_key "${env}_${app_user}"; then
        ((generated++))
    fi

    # Update SSH config for this host
    _tkm_add_ssh_host_config "$env" "$host"

    echo "  Generated $generated key(s)"
    echo "  SSH config updated for: $host"
}

_tkm_generate_key() {
    local keyname="$1"
    local keys_dir=$(tkm_keys_dir)
    local keypath="$keys_dir/$keyname"

    if [[ -f "$keypath" ]]; then
        echo "  $keyname: exists"
        return 0
    fi

    if ssh-keygen -t ed25519 -f "$keypath" -C "tkm_${keyname}" -N "" -q; then
        chmod 600 "$keypath"
        chmod 644 "${keypath}.pub"
        local fp=$(ssh-keygen -l -f "${keypath}.pub" 2>/dev/null | awk '{print $2}')
        echo "  $keyname: ${fp:0:25}"
        return 0
    else
        echo "  $keyname: FAILED"
        return 1
    fi
}

_tkm_generate_all() {
    local envs=$(org_env_names 2>/dev/null)
    [[ -z "$envs" ]] && { echo "No environments"; return 1; }

    for env in $envs; do
        [[ "$env" == "local" ]] && continue
        _tkm_generate_env "$env"
        echo ""
    done
}

# =============================================================================
# SSH CONFIG (hostname matching)
# =============================================================================

# Add SSH config Match blocks for a hostname (user-specific keys)
# Creates: Match Host <ip> User root -> dev_root key
#          Match Host <ip> User dev  -> dev_dev key
_tkm_add_ssh_host_config() {
    local env="$1"
    local host="$2"

    local org=$(tkm_org_name)
    local keys_dir="~/.ssh/$org"
    local app_user=$(tkm_app_user "$env")

    touch ~/.ssh/config
    chmod 600 ~/.ssh/config

    # Check if Match blocks already exist for this host
    if grep -q "^Match Host $host User root\$" ~/.ssh/config 2>/dev/null; then
        return 0
    fi

    cat >> ~/.ssh/config << EOF

# tkm: $org $env
Match Host $host User root
    IdentityFile $keys_dir/${env}_root

Match Host $host User $app_user
    IdentityFile $keys_dir/${env}_${app_user}
EOF
}

# Remove SSH config Match blocks for a hostname
_tkm_remove_ssh_host_config() {
    local host="$1"

    [[ ! -f ~/.ssh/config ]] && return 0

    local tmp=$(mktemp)

    awk -v host="$host" '
        /^# tkm:/ { pending = $0; next }
        /^Match Host / {
            if (index($0, host) > 0) {
                skip = 1
                pending = ""
                next
            } else {
                if (pending) print pending
                pending = ""
                skip = 0
            }
        }
        skip && /^[[:space:]]/ { next }
        skip && /^$/ { skip = 0; next }
        skip && /^Match / { skip = 0 }
        skip && /^Host / { skip = 0 }
        skip && /^#/ { skip = 0 }
        !skip { print }
    ' ~/.ssh/config > "$tmp"

    mv "$tmp" ~/.ssh/config
    chmod 600 ~/.ssh/config
}

# =============================================================================
# DEPLOY
# =============================================================================

# Find a working SSH key for bootstrap access
# Tries: 1) direct connection, 2) common bootstrap keys
_tkm_find_bootstrap_key() {
    local host="$1"
    local user="$2"

    # Try direct connection first (maybe tkm key already works)
    if ssh -o BatchMode=yes -o ConnectTimeout=5 "$user@$host" "true" 2>/dev/null; then
        echo ""  # Empty means use default
        return 0
    fi

    # Try common bootstrap keys
    for key in ~/.ssh/id_rsa ~/.ssh/id_ed25519; do
        if [[ -f "$key" ]]; then
            if ssh -i "$key" -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=5 "$user@$host" "true" 2>/dev/null; then
                echo "$key"
                return 0
            fi
        fi
    done

    return 1
}

tkm_deploy() {
    local target="${1:-}"
    local bootstrap_key=""

    # Parse --key option
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --key|-k)
                bootstrap_key="$2"
                shift 2
                ;;
            *)
                target="$1"
                shift
                ;;
        esac
    done

    [[ -z "$target" ]] && { echo "Usage: tkm deploy <env|all> [--key <path>]"; return 1; }

    if [[ "$target" == "all" ]]; then
        _tkm_deploy_all "$bootstrap_key"
    else
        _tkm_deploy_env "$target" "$bootstrap_key"
    fi
}

_tkm_deploy_env() {
    local env="$1"
    local bootstrap_key="$2"
    local keys_dir=$(tkm_keys_dir)

    local host=$(_tkm_get_host "$env")
    local auth_user=$(_tkm_get_auth_user "$env")
    local work_user=$(_tkm_get_work_user "$env")

    [[ -z "$host" ]] && { echo "No host for $env"; return 1; }

    echo "Deploying keys for: $env ($host)"

    # Find bootstrap key if not specified
    local ssh_opts=""
    if [[ -n "$bootstrap_key" ]]; then
        ssh_opts="-i $bootstrap_key -o IdentitiesOnly=yes"
        echo "  Using key: $bootstrap_key"
    else
        bootstrap_key=$(_tkm_find_bootstrap_key "$host" "$auth_user")
        if [[ $? -ne 0 ]]; then
            echo "  [!] Cannot connect to $auth_user@$host"
            echo "      Try: tkm deploy $env --key ~/.ssh/your_key"
            return 1
        fi
        if [[ -n "$bootstrap_key" ]]; then
            ssh_opts="-i $bootstrap_key -o IdentitiesOnly=yes"
            echo "  Using bootstrap: $bootstrap_key"
        fi
    fi

    local app_user=$(tkm_app_user "$env")
    local deployed=0

    # Deploy root key
    local root_pub="$keys_dir/${env}_root.pub"
    if [[ -f "$root_pub" ]]; then
        echo -n "  ${env}_root -> root: "
        if cat "$root_pub" | ssh $ssh_opts "$auth_user@$host" \
            "mkdir -p /root/.ssh && cat >> /root/.ssh/authorized_keys && chmod 600 /root/.ssh/authorized_keys && chmod 700 /root/.ssh" 2>/dev/null; then
            echo "OK"
            ((deployed++))
        else
            echo "FAILED"
        fi
    fi

    # Deploy app user key
    local app_pub="$keys_dir/${env}_${app_user}.pub"
    if [[ -f "$app_pub" ]]; then
        echo -n "  ${env}_${app_user} -> $work_user: "
        local home="/home/$work_user"
        if cat "$app_pub" | ssh $ssh_opts "$auth_user@$host" \
            "mkdir -p $home/.ssh && cat >> $home/.ssh/authorized_keys && chmod 600 $home/.ssh/authorized_keys && chmod 700 $home/.ssh && chown -R $work_user:$work_user $home/.ssh" 2>/dev/null; then
            echo "OK"
            ((deployed++))
        else
            echo "FAILED"
        fi
    fi

    echo "  Deployed $deployed key(s)"
}

_tkm_deploy_all() {
    local bootstrap_key="$1"
    local envs=$(org_env_names 2>/dev/null)
    [[ -z "$envs" ]] && { echo "No environments"; return 1; }

    for env in $envs; do
        [[ "$env" == "local" ]] && continue
        _tkm_deploy_env "$env" "$bootstrap_key"
        echo ""
    done
}

# =============================================================================
# REVOKE
# =============================================================================

tkm_revoke() {
    local target="${1:-}"

    [[ -z "$target" ]] && { echo "Usage: tkm revoke <env>"; return 1; }

    _tkm_revoke_env "$target"
}

_tkm_revoke_env() {
    local env="$1"
    local keys_dir=$(tkm_keys_dir)
    local host=$(_tkm_get_host "$env")

    echo "Revoking keys for: $env"

    local app_user=$(tkm_app_user "$env")
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local revoked=0

    for keyname in "${env}_root" "${env}_${app_user}"; do
        local keypath="$keys_dir/$keyname"
        if [[ -f "$keypath" ]]; then
            mv "$keypath" "${keypath}.revoked.${timestamp}"
            mv "${keypath}.pub" "${keypath}.pub.revoked.${timestamp}" 2>/dev/null
            echo "  Revoked: $keyname"
            ((revoked++))
        fi
    done

    # Remove SSH config
    if [[ -n "$host" ]]; then
        _tkm_remove_ssh_host_config "$host"
        echo "  Removed SSH config: $host"
    fi

    echo "  Revoked $revoked key(s)"
}

# =============================================================================
# ROTATE
# =============================================================================

tkm_rotate() {
    local env="${1:-}"

    [[ -z "$env" ]] && { echo "Usage: tkm rotate <env>"; return 1; }

    echo "Rotating keys for: $env"
    echo ""

    echo "1. Revoking old keys..."
    _tkm_revoke_env "$env"
    echo ""

    echo "2. Generating new keys..."
    _tkm_generate_env "$env"
    echo ""

    echo "3. Deploying new keys..."
    _tkm_deploy_env "$env"
    echo ""

    echo "Rotation complete"
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f tkm_generate tkm_deploy tkm_revoke tkm_rotate
export -f _tkm_generate_env _tkm_generate_key _tkm_generate_all
export -f _tkm_add_ssh_host_config _tkm_remove_ssh_host_config
export -f _tkm_deploy_env _tkm_deploy_all _tkm_find_bootstrap_key
export -f _tkm_revoke_env
