#!/usr/bin/env bash
# tcaddy/caddy_complete.sh - Tab completion for tcaddy command
#
# Structure: tcaddy <group> <command> [args]
# Groups: ctx, log, cfg, svc, route, f2b, hosts, serve

# =============================================================================
# COMPLETION DATA
# =============================================================================

# Top-level groups (no shortcuts in completion - cleaner interface)
_CADDY_GROUPS="ctx log cfg svc route f2b hosts serve help"

# Subcommands per group
_CADDY_LOG_CMDS="show follow errors list stats raw json size top export archive rotate help"
_CADDY_CFG_CMDS="show validate fmt reload deploy help"
_CADDY_SVC_CMDS="status start stop restart ping version help"
_CADDY_ROUTE_CMDS="list upstreams certs certs-list help"
_CADDY_HOSTS_CMDS="status list add update remove edit ip domain"
_CADDY_F2B_CMDS="status jails banned match recent help"

# Log top subcommands
_CADDY_LOG_TOP="ips paths codes ua errors"
_CADDY_LOG_EXPORT="json csv"

# Context subcommands and values
_CADDY_CTX_CMDS="set proj env clear status add-env"
_CADDY_ORGS="pja tetra"
_CADDY_PROJS="arcade api docs cabinet pbase dashboard"
_CADDY_ENVS_LIST="dev local"

# Help topics
_CADDY_HELP_TOPICS="ctx log cfg svc route f2b hosts"

# =============================================================================
# MAIN COMPLETION
# =============================================================================

_caddy_complete() {
    local cur prev cmd subcmd
    COMPREPLY=()

    cur="${COMP_WORDS[COMP_CWORD]}"
    prev="${COMP_WORDS[COMP_CWORD-1]}"
    cmd="${COMP_WORDS[1]:-}"
    subcmd="${COMP_WORDS[2]:-}"

    # First argument - groups only (no shortcuts for cleaner completion)
    if [[ $COMP_CWORD -eq 1 ]]; then
        COMPREPLY=($(compgen -W "$_CADDY_GROUPS" -- "$cur"))
        return
    fi

    # Handle group subcommands
    case "$cmd" in
        # Log group
        log)
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "$_CADDY_LOG_CMDS" -- "$cur"))
            elif [[ $COMP_CWORD -eq 3 ]]; then
                case "$subcmd" in
                    show|errors|raw|json)
                        COMPREPLY=($(compgen -W "10 20 50 100 200 500" -- "$cur"))
                        ;;
                    list)
                        COMPREPLY=($(compgen -W "-v -vv" -- "$cur"))
                        ;;
                    top)
                        COMPREPLY=($(compgen -W "$_CADDY_LOG_TOP" -- "$cur"))
                        ;;
                    export)
                        COMPREPLY=($(compgen -W "$_CADDY_LOG_EXPORT" -- "$cur"))
                        ;;
                    archive|rotate)
                        COMPREPLY=($(compgen -W "1 3 7 14 30" -- "$cur"))
                        ;;
                esac
            elif [[ $COMP_CWORD -eq 4 ]]; then
                # Fourth arg: count for top, etc.
                case "$subcmd" in
                    top)
                        COMPREPLY=($(compgen -W "5 10 20 50 100" -- "$cur"))
                        ;;
                esac
            fi
            ;;

        # Config group
        cfg)
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "$_CADDY_CFG_CMDS" -- "$cur"))
            elif [[ $COMP_CWORD -eq 3 && "$subcmd" == "deploy" ]]; then
                COMPREPLY=($(compgen -f -- "$cur"))
            fi
            ;;

        # Service group
        svc)
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "$_CADDY_SVC_CMDS" -- "$cur"))
            fi
            ;;

        # Route group
        route)
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "$_CADDY_ROUTE_CMDS" -- "$cur"))
            fi
            ;;

        # Context group
        ctx)
            if [[ $COMP_CWORD -eq 2 ]]; then
                # ctx subcommands + orgs for shorthand
                COMPREPLY=($(compgen -W "$_CADDY_CTX_CMDS $_CADDY_ORGS" -- "$cur"))
            elif [[ $COMP_CWORD -eq 3 ]]; then
                case "$subcmd" in
                    set|pja|tetra)
                        COMPREPLY=($(compgen -W "$_CADDY_PROJS" -- "$cur"))
                        ;;
                    proj)
                        COMPREPLY=($(compgen -W "$_CADDY_PROJS" -- "$cur"))
                        ;;
                    env)
                        COMPREPLY=($(compgen -W "$_CADDY_ENVS_LIST" -- "$cur"))
                        ;;
                esac
            elif [[ $COMP_CWORD -eq 4 ]]; then
                # After proj, complete envs
                COMPREPLY=($(compgen -W "$_CADDY_ENVS_LIST" -- "$cur"))
            fi
            ;;

        # Hosts group
        hosts)
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "$_CADDY_HOSTS_CMDS" -- "$cur"))
            elif [[ $COMP_CWORD -eq 3 && "$subcmd" == "add" ]]; then
                COMPREPLY=($(compgen -W "-n --dry-run" -- "$cur"))
            fi
            ;;

        # fail2ban group
        f2b|ban)
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "$_CADDY_F2B_CMDS" -- "$cur"))
            elif [[ $COMP_CWORD -eq 3 ]]; then
                case "$subcmd" in
                    banned|match)
                        # Could complete with jail names dynamically
                        COMPREPLY=($(compgen -W "caddy-auth caddy-badbots sshd" -- "$cur"))
                        ;;
                    recent)
                        COMPREPLY=($(compgen -W "10 20 50 100" -- "$cur"))
                        ;;
                esac
            fi
            ;;

        # Help
        help|h)
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "$_CADDY_HELP_TOPICS" -- "$cur"))
            fi
            ;;
    esac
}

# =============================================================================
# REGISTER
# =============================================================================

complete -F _caddy_complete tcaddy

export -f _caddy_complete
