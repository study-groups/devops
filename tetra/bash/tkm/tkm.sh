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

# Source org module (dependency)
source "$ORG_SRC/org.sh"

# Source tkm modules (order matters: core first)
source "$TKM_SRC/tkm_core.sh"
source "$TKM_SRC/tkm_status.sh"
source "$TKM_SRC/tkm_claude.sh"
source "$TKM_SRC/tkm_keys.sh"
source "$TKM_SRC/tkm_config.sh"
source "$TKM_SRC/tkm_remote.sh"
source "$TKM_SRC/tkm_complete.sh"

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

CLAUDE INTEGRATION
    info                One-line status (org, keys, env vars)
    preflight [env]     Quick SSH connectivity check (3s timeout)
    claude [on|off]     Enable/disable Claude-safe SSH mode

KEY OPERATIONS
    gen <env|all>       Generate keys + update SSH config
    deploy <env|all>    Push public keys to servers
    revoke <env>        Archive keys, remove SSH config
    rotate <env>        Revoke + gen + deploy
    fingerprint <key>   Show fingerprint for a key (or 'all')

CONFIG
    config              Show SSH config for current org
    config gen          Generate SSH config entries
    config regen        Regenerate Match blocks (add BatchMode/Timeout)
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
    ~/.ssh/config           Match blocks with BatchMode + ConnectTimeout

CLAUDE-SAFE SSH
    Match blocks include BatchMode=yes and ConnectTimeout=5 to prevent
    hanging on password prompts or unreachable servers.

    tkm preflight           # Verify before Claude SSH operations
    tkm claude on           # Export $TKM_SSH_OPTS for manual use

WORKFLOW
    org switch myorg
    tkm init
    tkm gen all
    tkm deploy all          # Push keys to servers (needs initial access)
    tkm test
    tkm preflight           # Verify Claude can SSH safely

MODULE FILES
    tkm.sh          Main dispatcher and help
    tkm_core.sh     Paths, helpers, init
    tkm_status.sh   status, doctor, list, test, fingerprint
    tkm_claude.sh   info, preflight, claude (AI-safe operations)
    tkm_keys.sh     gen, deploy, revoke, rotate, config_regen
    tkm_config.sh   SSH config viewing/editing
    tkm_remote.sh   Remote authorized_keys management
    tkm_complete.sh Tab completion
EOF
}

# =============================================================================
# MAIN DISPATCHER
# =============================================================================

tkm() {
    local cmd="${1:-status}"
    shift 2>/dev/null || true

    case "$cmd" in
        # Status/diagnostics (tkm_status.sh)
        status|s)       tkm_status "$@" ;;
        doctor|doc)     tkm_doctor "$@" ;;
        list|ls)        tkm_list "$@" ;;
        test)           tkm_test "$@" ;;
        fingerprint|fp) tkm_fingerprint "$@" ;;

        # Core (tkm_core.sh)
        init)           tkm_init "$@" ;;

        # Claude integration (tkm_claude.sh)
        info|i)         tkm_info "$@" ;;
        preflight|pre)  tkm_preflight "$@" ;;
        claude|cl)      tkm_claude "$@" ;;

        # Key operations (tkm_keys.sh)
        generate|gen)   tkm_generate "$@" ;;
        deploy|dep)     tkm_deploy "$@" ;;
        revoke|rev)     tkm_revoke "$@" ;;
        rotate|rot)     tkm_rotate "$@" ;;

        # Config (tkm_config.sh + tkm_keys.sh for regen)
        config|cfg)
            local subcmd="${1:-}"
            if [[ "$subcmd" == "regen" ]]; then
                shift
                tkm_config_regen "$@"
            else
                tkm_config "$@"
            fi
            ;;

        # Remote (tkm_remote.sh)
        remote|rem)     tkm_remote "$@" ;;

        help|h|--help|-h) tkm_help ;;
        *)
            echo "Unknown: $cmd"
            echo "Try: tkm help"
            return 1
            ;;
    esac
}

# Register completion
complete -F _tkm_complete tkm

# Export main entry point and help
export -f tkm tkm_help
