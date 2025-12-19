#!/usr/bin/env bash
# tkm_claude.sh - Claude Code integration
#
# Functions for safe SSH operations in automated/AI contexts:
# - info: one-line status for context
# - preflight: quick connectivity validation
# - claude: enable/disable safe SSH mode

# =============================================================================
# INFO (Claude-friendly one-liner)
# =============================================================================

tkm_info() {
    local org=$(tkm_org_name 2>/dev/null)
    if [[ -z "$org" ]]; then
        echo "tkm: no org active"
        return 1
    fi

    local keys_dir=$(tkm_keys_dir)
    local key_count=0
    if [[ -d "$keys_dir" ]]; then
        key_count=$(find "$keys_dir" -name "*.pub" 2>/dev/null | wc -l | tr -d ' ')
    fi

    local envs=$(org_env_names 2>/dev/null | grep -v '^local$' | tr '\n' ' ')
    local vars=""
    for env in $envs; do
        local ip=$(_tkm_get_host "$env" 2>/dev/null)
        [[ -n "$ip" ]] && vars+="\$$env=$ip "
    done

    echo "tkm: $org | keys: $key_count | envs: ${envs}| ${vars}"
}

# =============================================================================
# PREFLIGHT (validate SSH before operations)
# =============================================================================

tkm_preflight() {
    local target="${1:-all}"
    local timeout="${2:-3}"
    local failed=0
    local passed=0

    echo "SSH Preflight Check (${timeout}s timeout)"
    echo "====================================="
    echo ""

    local envs
    if [[ "$target" == "all" ]]; then
        envs=$(org_env_names 2>/dev/null)
    else
        envs="$target"
    fi

    for env in $envs; do
        [[ "$env" == "local" ]] && continue
        local host=$(_tkm_get_host "$env")
        [[ -z "$host" ]] && continue

        printf "  %-10s %s " "$env" "$host"
        if ssh -o BatchMode=yes -o ConnectTimeout="$timeout" "root@$host" "echo ok" 2>/dev/null; then
            ((passed++))
        else
            echo "FAIL"
            ((failed++))
        fi
    done

    echo ""
    echo "Results: $passed passed, $failed failed"

    if [[ $failed -eq 0 ]]; then
        echo ""
        echo "Ready for Claude SSH operations"
    fi

    return $failed
}

# =============================================================================
# CLAUDE MODE (export safe SSH options)
# =============================================================================

tkm_claude() {
    local action="${1:-on}"

    case "$action" in
        on|enable)
            export TKM_SSH_OPTS="-o BatchMode=yes -o ConnectTimeout=5 -o ServerAliveInterval=30"
            export TKM_CLAUDE_MODE=1
            echo "Claude mode enabled"
            echo "  TKM_SSH_OPTS: $TKM_SSH_OPTS"
            echo ""
            echo "Usage: ssh \$TKM_SSH_OPTS root@\$dev"
            ;;
        off|disable)
            unset TKM_SSH_OPTS
            unset TKM_CLAUDE_MODE
            echo "Claude mode disabled"
            ;;
        status)
            if [[ -n "$TKM_CLAUDE_MODE" ]]; then
                echo "Claude mode: ON"
                echo "  TKM_SSH_OPTS: $TKM_SSH_OPTS"
            else
                echo "Claude mode: OFF"
            fi
            ;;
        *)
            echo "Usage: tkm claude [on|off|status]"
            return 1
            ;;
    esac
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f tkm_info tkm_preflight tkm_claude
