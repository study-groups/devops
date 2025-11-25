#!/usr/bin/env bash
# tkm.sh - Tetra Key Manager
#
# Manages SSH keys in ~/.ssh/<org>/ and ~/.ssh/config
# SSH config matches by HostName, not Host aliases
#
# Structure:
#   ~/.ssh/<org>/dev_root      - root key for dev
#   ~/.ssh/<org>/dev_dev       - dev user key for dev
#   ~/.ssh/config              - IdentityFile entries per hostname
#
# Usage:
#   ssh root@dev.example.com   - SSH picks right key automatically
#   ssh dev@dev.example.com    - SSH picks right key automatically

TKM_SRC="${TETRA_SRC}/bash/tkm"
ORG_SRC="${TETRA_SRC}/bash/org"

# Source org module
source "$ORG_SRC/org.sh"

# Source tkm modules
source "$TKM_SRC/tkm_keys.sh"
source "$TKM_SRC/tkm_config.sh"
source "$TKM_SRC/tkm_remote.sh"
source "$TKM_SRC/tkm_complete.sh"

# =============================================================================
# PATHS
# =============================================================================

# Org name for directory
tkm_org_name() {
    local org=$(org_active 2>/dev/null)
    [[ "$org" == "none" || -z "$org" ]] && return 1
    echo "$org"
}

# Keys directory: ~/.ssh/<org>/
tkm_keys_dir() {
    local org=$(tkm_org_name) || return 1
    echo "$HOME/.ssh/$org"
}

# Key path: ~/.ssh/<org>/<env>_<user>
tkm_key_path() {
    local env="$1"
    local user="$2"
    local dir=$(tkm_keys_dir) || return 1
    echo "$dir/${env}_${user}"
}

# App user name for environment (from tetra.toml ssh_work_user, fallback to env name)
tkm_app_user() {
    local env="$1"
    local work_user=$(_tkm_get_work_user "$env")
    [[ -n "$work_user" ]] && echo "$work_user" || echo "$env"
}

# Expected keys for an environment
tkm_expected_keys() {
    local env="$1"
    local app_user=$(tkm_app_user "$env")
    echo "${env}_root"
    echo "${env}_${app_user}"
}

# =============================================================================
# DOCTOR
# =============================================================================

tkm_doctor() {
    local org=$(tkm_org_name 2>/dev/null)

    echo "TKM Doctor"
    echo "=========="
    echo ""

    # 1. Org check
    echo "Organization"
    echo "------------"
    if [[ -z "$org" ]]; then
        echo "  [X] No active org"
        echo "      Fix: org switch <name>"
        return 1
    fi
    echo "  [OK] $org"
    echo "  Keys: ~/.ssh/$org/"
    echo ""

    # 2. Environments
    echo "Environments (from tetra.toml)"
    echo "------------------------------"
    local envs=$(org_env_names 2>/dev/null)
    if [[ -z "$envs" ]]; then
        echo "  [X] No environments"
        return 1
    fi

    for env in $envs; do
        [[ "$env" == "local" ]] && continue
        local host=$(_tkm_get_host "$env")
        if [[ -n "$host" ]]; then
            echo "  $env: $host"
        else
            echo "  $env: [!] no host configured"
        fi
    done
    echo ""

    # 3. Keys
    echo "Keys (~/.ssh/$org/)"
    echo "-------------------"
    local keys_dir=$(tkm_keys_dir)
    local missing=0
    local found=0

    if [[ ! -d "$keys_dir" ]]; then
        echo "  [!] Directory doesn't exist"
        echo "      Fix: tkm init"
        missing=99
    else
        for env in $envs; do
            [[ "$env" == "local" ]] && continue
            for key in $(tkm_expected_keys "$env"); do
                if [[ -f "$keys_dir/$key" ]]; then
                    echo "  [OK] $key"
                    ((found++))
                else
                    echo "  [--] $key"
                    ((missing++))
                fi
            done
        done
    fi
    echo ""

    # 4. SSH Config
    echo "SSH Config (~/.ssh/config)"
    echo "--------------------------"
    local missing_hosts=0

    for env in $envs; do
        [[ "$env" == "local" ]] && continue
        local host=$(_tkm_get_host "$env")
        [[ -z "$host" ]] && continue

        if grep -q "^Host $host\$" ~/.ssh/config 2>/dev/null; then
            echo "  [OK] $host"
        else
            echo "  [--] $host"
            ((missing_hosts++))
        fi
    done
    echo ""

    # 5. Summary
    echo "Summary"
    echo "-------"
    echo "  Keys: $found found, $missing missing"
    echo "  Hosts: $missing_hosts missing in SSH config"
    echo ""

    if [[ $missing -gt 0 || $missing_hosts -gt 0 ]]; then
        echo "Recommendations"
        echo "---------------"
        [[ $missing -gt 0 ]] && echo "  tkm gen all"
        [[ $missing_hosts -gt 0 ]] && echo "  tkm config gen"
    else
        echo "Ready! Test with: tkm test"
    fi
}

# =============================================================================
# STATUS
# =============================================================================

tkm_status() {
    local org=$(tkm_org_name 2>/dev/null)

    echo "TKM Status"
    echo "=========="
    echo ""

    if [[ -z "$org" ]]; then
        echo "Org: (none)"
        echo "Run: org switch <name>"
        return 1
    fi

    echo "Org: $org"
    echo "Keys: ~/.ssh/$org/"
    echo ""

    local keys_dir=$(tkm_keys_dir)
    if [[ ! -d "$keys_dir" ]]; then
        echo "No keys directory. Run: tkm init"
        return 0
    fi

    echo "Keys:"
    for key in "$keys_dir"/*; do
        [[ -f "$key" && ! "$key" == *.pub && ! "$key" == *.revoked.* ]] || continue
        local name=$(basename "$key")
        local fp=$(ssh-keygen -l -f "${key}.pub" 2>/dev/null | awk '{print $2}')
        printf "  %-20s %s\n" "$name" "${fp:0:25}"
    done
}

tkm_list() {
    local keys_dir=$(tkm_keys_dir) || { echo "No active org"; return 1; }
    [[ ! -d "$keys_dir" ]] && return 0

    for key in "$keys_dir"/*; do
        [[ -f "$key" && ! "$key" == *.pub && ! "$key" == *.revoked.* ]] || continue
        basename "$key"
    done
}

# =============================================================================
# INIT
# =============================================================================

tkm_init() {
    local org=$(tkm_org_name) || { echo "No active org"; return 1; }
    local keys_dir="$HOME/.ssh/$org"

    mkdir -p "$keys_dir"
    chmod 700 "$keys_dir"

    echo "Initialized: $keys_dir"
    echo ""
    echo "Next: tkm gen all"
}

# =============================================================================
# TEST
# =============================================================================

tkm_test() {
    local target="${1:-all}"

    echo "Testing SSH connectivity..."
    echo ""

    local envs
    if [[ "$target" == "all" ]]; then
        envs=$(org_env_names 2>/dev/null)
    else
        envs="$target"
    fi

    local pass=0
    local fail=0

    for env in $envs; do
        [[ "$env" == "local" ]] && continue

        local host=$(_tkm_get_host "$env")
        [[ -z "$host" ]] && continue

        local user=$(_tkm_get_auth_user "$env")
        [[ -z "$user" ]] && user="root"

        echo -n "  $user@$host: "
        if ssh -o BatchMode=yes -o ConnectTimeout=5 "$user@$host" echo ok 2>/dev/null; then
            ((pass++))
        else
            echo "FAILED"
            ((fail++))
        fi
    done

    echo ""
    echo "Results: $pass passed, $fail failed"
}

# =============================================================================
# HELPERS (use org's unified functions)
# =============================================================================

# Aliases to org helpers for consistency
_tkm_get_host() { _org_get_host "$1"; }
_tkm_get_auth_user() { _org_get_user "$1"; }
_tkm_get_work_user() { _org_get_work_user "$1"; }

# =============================================================================
# FINGERPRINT
# =============================================================================

tkm_fingerprint() {
    local target="${1:-}"

    if [[ -z "$target" ]]; then
        echo "Usage: tkm fingerprint <keyname|all>"
        echo ""
        echo "Show fingerprints for local keys"
        return 1
    fi

    local keys_dir=$(tkm_keys_dir) || { echo "No active org"; return 1; }
    [[ ! -d "$keys_dir" ]] && { echo "No keys directory"; return 1; }

    if [[ "$target" == "all" ]]; then
        echo "Fingerprints (~/.ssh/$(tkm_org_name)/)"
        echo "================================"
        echo ""
        for key in "$keys_dir"/*; do
            [[ -f "$key" && ! "$key" == *.pub && ! "$key" == *.revoked.* ]] || continue
            local name=$(basename "$key")
            local pub="${key}.pub"
            if [[ -f "$pub" ]]; then
                local fp=$(ssh-keygen -l -f "$pub" 2>/dev/null | awk '{print $2}')
                printf "%-20s %s\n" "$name" "$fp"
            fi
        done
    else
        local keypath="$keys_dir/$target"
        local pub="${keypath}.pub"

        # Try with .pub if not found
        [[ ! -f "$pub" && -f "$keypath" && "$keypath" == *.pub ]] && pub="$keypath"

        if [[ ! -f "$pub" ]]; then
            echo "Key not found: $target"
            return 1
        fi

        ssh-keygen -l -f "$pub"
    fi
}

# =============================================================================
# HELP
# =============================================================================

tkm_help() {
    cat << 'EOF'
tkm - Tetra Key Manager

USAGE
    tkm [command] [args]

COMMANDS
    status, s           Show keys for current org
    doctor              Audit setup
    list, ls            List key names
    init                Create ~/.ssh/<org>/ directory
    test [env|all]      Test SSH connectivity

KEY OPERATIONS
    gen <env|all>       Generate keys + update SSH config
    deploy <env|all>    Push public keys to servers
    revoke <env>        Archive keys, remove SSH config
    rotate <env>        Revoke + gen + deploy
    fingerprint <key>   Show fingerprint for a key (or 'all')

CONFIG
    config              Show SSH config for current org
    config gen          Generate SSH config entries
    config edit         Edit ~/.ssh/config

REMOTE KEYS
    remote list <env> [user]        List keys on remote server
    remote audit <env> [user]       Audit remote vs local keys
    remote add <env> <user> <key>   Add key to remote
    remote rm <env> <user> <sel>    Remove key (by index/fp/pattern)
    remote clean <env> <user> <pat> Remove all keys matching pattern

STRUCTURE
    ~/.ssh/<org>/           Keys directory per org
    ~/.ssh/<org>/dev_root   Root key for dev env
    ~/.ssh/<org>/dev_dev    App user key for dev env
    ~/.ssh/config           IdentityFile per hostname

USAGE AFTER SETUP
    ssh root@dev.example.com    # SSH auto-selects key
    ssh dev@dev.example.com     # SSH auto-selects key
    org ssh dev                 # Same as above

WORKFLOW
    org switch myorg
    tkm init
    tkm gen all
    tkm deploy all      # Push keys to servers (needs initial access)
    tkm test
EOF
}

# =============================================================================
# MAIN
# =============================================================================

tkm() {
    local cmd="${1:-status}"
    shift 2>/dev/null || true

    case "$cmd" in
        status|s)       tkm_status "$@" ;;
        doctor|doc)     tkm_doctor "$@" ;;
        list|ls)        tkm_list "$@" ;;
        init)           tkm_init "$@" ;;
        test)           tkm_test "$@" ;;
        generate|gen)   tkm_generate "$@" ;;
        deploy|dep)     tkm_deploy "$@" ;;
        revoke|rev)     tkm_revoke "$@" ;;
        rotate|rot)     tkm_rotate "$@" ;;
        config|cfg)     tkm_config "$@" ;;
        remote|rem)     tkm_remote "$@" ;;
        fingerprint|fp) tkm_fingerprint "$@" ;;
        help|h|--help|-h) tkm_help ;;
        *)
            echo "Unknown: $cmd"
            echo "Try: tkm help"
            return 1
            ;;
    esac
}

complete -F _tkm_complete tkm

export -f tkm tkm_status tkm_doctor tkm_list tkm_init tkm_test tkm_help tkm_fingerprint
export -f tkm_org_name tkm_keys_dir tkm_key_path tkm_app_user tkm_expected_keys
export -f _tkm_get_host _tkm_get_auth_user _tkm_get_work_user
