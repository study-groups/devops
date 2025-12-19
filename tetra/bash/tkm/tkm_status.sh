#!/usr/bin/env bash
# tkm_status.sh - Status and diagnostic functions
#
# Functions for viewing and validating tkm state:
# - status: overview of keys for current org
# - doctor: comprehensive audit
# - list: key names only
# - test: SSH connectivity test
# - fingerprint: show key fingerprints

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

        if grep -q "^Match Host $host" ~/.ssh/config 2>/dev/null; then
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
# LIST
# =============================================================================

tkm_list() {
    local keys_dir=$(tkm_keys_dir) || { echo "No active org"; return 1; }
    [[ ! -d "$keys_dir" ]] && return 0

    for key in "$keys_dir"/*; do
        [[ -f "$key" && ! "$key" == *.pub && ! "$key" == *.revoked.* ]] || continue
        basename "$key"
    done
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
# EXPORTS
# =============================================================================

export -f tkm_status tkm_doctor tkm_list tkm_test tkm_fingerprint
