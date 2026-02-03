#!/usr/bin/env bash
# tcaddy/caddy.sh - Caddy server management (tcaddy command)
#
# Uses sticky context from caddy_ctx.sh
# Commands operate on current context host
#
# Named tcaddy to avoid conflict with system caddy binary

CADDY_SRC="${TETRA_SRC}/bash/tcaddy"

# =============================================================================
# CORE HELPERS
# =============================================================================

# Check if current context is local
_caddy_is_local() {
    [[ "$(_caddy_ssh_target)" == "localhost" ]]
}

# Run command on current context (local or remote)
# Usage: _caddy_exec "command string"
_caddy_exec() {
    if _caddy_is_local; then
        eval "$1"
    else
        _caddy_ssh "$1"
    fi
}

# Run command on current context host (legacy, for complex remote commands)
# Uses SSH ControlMaster for connection reuse (~10ms vs ~300ms per call)
_caddy_ssh() {
    local target
    target=$(_caddy_ssh_target)

    if [[ -z "$target" ]]; then
        echo "No host set. Use: tcaddy ctx <org> [env]" >&2
        return 1
    fi

    if [[ "$target" == "localhost" ]]; then
        bash -c "$*"
    else
        ssh -o ControlMaster=auto \
            -o ControlPath="/tmp/tcaddy-ssh-%r@%h:%p" \
            -o ControlPersist=300 \
            "$target" "$@"
    fi
}

# Get local caddy config dir for current org
_caddy_config_dir() {
    local org=$(_caddy_org_full)
    echo "${TETRA_DIR:-$HOME/tetra}/orgs/${org:-tetra}/targets/caddy"
}

# Get Caddyfile path for current context
_caddy_caddyfile_path() {
    local target=$(_caddy_ssh_target)

    if [[ "$target" == "localhost" ]]; then
        echo "$(_caddy_config_dir)/Caddyfile"
    else
        echo "/etc/caddy/Caddyfile"
    fi
}

# =============================================================================
# SOURCE MODULES
# =============================================================================

source "${CADDY_SRC}/caddy_api.sh"    # Native Caddy admin API (localhost:2019)
source "${CADDY_SRC}/caddy_svc.sh"
source "${CADDY_SRC}/caddy_cfg.sh"
source "${CADDY_SRC}/caddy_log.sh"
source "${CADDY_SRC}/caddy_route.sh"
source "${CADDY_SRC}/caddy_ban.sh"
source "${CADDY_SRC}/caddy_hosts.sh"

# =============================================================================
# LOCAL SERVE
# =============================================================================

# Run caddy locally using context-based Caddyfile
_caddy_serve() {
    local org=$(_caddy_org)
    local caddyfile="$(_caddy_config_dir)/Caddyfile"
    local watch="${1:-}"

    if [[ ! -f "$caddyfile" ]]; then
        echo "Caddyfile not found: $caddyfile" >&2
        return 1
    fi

    local ip=$(_caddy_local_ip)
    local domain=$(_caddy_domain)

    echo "=== Caddy Local Server ==="
    echo "Config: $caddyfile"
    echo "IP: $ip"
    echo "Domain: $domain"
    echo ""
    echo "URLs:"
    echo "  http://$ip:8080/"
    echo "  http://$domain:8080/"
    echo ""

    if [[ "$watch" == "-w" || "$watch" == "--watch" ]]; then
        echo "Starting with auto-reload..."
        caddy run --config "$caddyfile" --watch
    else
        echo "Starting... (use -w for auto-reload)"
        caddy run --config "$caddyfile"
    fi
}

# =============================================================================
# HELP
# =============================================================================

# Convert hex to raw ANSI (not PS1)
_caddy_hex_to_ansi() {
    local hex="${1#\#}"
    [[ ${#hex} -ne 6 ]] && return
    local r=$((16#${hex:0:2})) g=$((16#${hex:2:2})) b=$((16#${hex:4:2}))
    local c256=$(( 16 + 36*(r/51) + 6*(g/51) + (b/51) ))
    printf '\033[38;5;%dm' "$c256"
}

# Help system - categorized with TDS colors
_caddy_help() {
    local topic="${1:-}"

    # TDS semantic colors
    local CTX CFG SVC LOG RTE CMD ARG DIM R

    # Use TDS semantic colors if available
    if type tds_resolve_color &>/dev/null; then
        CTX=$(_caddy_hex_to_ansi "$(tds_resolve_color 'env.a.primary')")    # green - context
        LOG=$(_caddy_hex_to_ansi "$(tds_resolve_color 'status.info')")      # blue - logs
        CFG=$(_caddy_hex_to_ansi "$(tds_resolve_color 'env.b.primary')")    # cyan - config
        SVC=$(_caddy_hex_to_ansi "$(tds_resolve_color 'action.primary')")   # blue - service
        RTE=$(_caddy_hex_to_ansi "$(tds_resolve_color 'env.b.light')")      # cyan - routes
        CMD=$(_caddy_hex_to_ansi "$(tds_resolve_color 'text.primary')")     # bright - commands
        ARG=$(_caddy_hex_to_ansi "$(tds_resolve_color 'action.secondary')") # args
        DIM=$(_caddy_hex_to_ansi "$(tds_resolve_color 'text.dim')")         # dim
    else
        CTX='\033[32m'  # green
        LOG='\033[34m'  # blue
        CFG='\033[36m'  # cyan
        SVC='\033[34m'  # blue
        RTE='\033[36m'  # cyan
        CMD='\033[97m'  # bright white
        ARG='\033[33m'  # yellow
        DIM='\033[90m'  # dim
    fi
    R='\033[0m'

    case "$topic" in
        ctx|context)
            echo -e "${CTX}tcaddy ctx${R} ${DIM}- Context management${R}"
            echo ""
            echo -e "  ${CMD}set${R} ${ARG}<org> [env]${R}          ${DIM}Set context${R}"
            echo -e "  ${CMD}env${R} ${ARG}<name>${R}               ${DIM}Change env only${R}"
            echo -e "  ${CMD}envs${R}                     ${DIM}List envs for org${R}"
            echo -e "  ${CMD}clear${R}                    ${DIM}Clear context${R}"
            echo -e "  ${CMD}status${R}                   ${DIM}Show current${R}"
            echo -e "  ${CMD}alias${R} ${ARG}<short> <org>${R}      ${DIM}Add org alias${R}"
            echo ""
            echo -e "  ${DIM}Example: tcaddy ctx pja prod${R}"
            ;;
        log|logs)
            echo -e "${LOG}tcaddy log${R} ${DIM}- Log viewing & analysis${R}"
            echo ""
            echo -e "  ${CMD}policy${R} ${ARG}[section]${R} ${DIM}Show log policy (roll/filter/alert)${R}"
            echo -e "  ${CMD}roll${R}           ${DIM}Show Caddy roll settings${R}"
            echo ""
            echo -e "  ${CMD}show${R} ${ARG}[n]${R}       ${DIM}Formatted logs (default: 50)${R}"
            echo -e "  ${CMD}follow${R}         ${DIM}Tail logs live${R}"
            echo -e "  ${CMD}errors${R} ${ARG}[n]${R}     ${DIM}Errors only (5xx + level:error)${R}"
            echo -e "  ${CMD}stats${R}          ${DIM}Error counts per file${R}"
            echo ""
            echo -e "  ${CMD}size${R}           ${DIM}Log file sizes and disk usage${R}"
            echo -e "  ${CMD}top${R} ${ARG}<what> [n]${R} ${DIM}Top IPs/paths/codes/ua/errors/all${R}"
            echo -e "  ${CMD}export${R} ${ARG}<fmt> [n]${R} ${DIM}Export to json/csv${R}"
            echo -e "  ${CMD}archive${R} ${ARG}[days]${R} ${DIM}Compress logs older than N days${R}"
            ;;
        cfg|config)
            echo -e "${CFG}tcaddy cfg${R} ${DIM}- Configuration management${R}"
            echo ""
            echo -e "  ${CMD}show${R}        ${DIM}Show Caddyfile${R}"
            echo -e "  ${CMD}validate${R}    ${DIM}Validate configuration${R}"
            echo -e "  ${CMD}fmt${R}         ${DIM}Format Caddyfile${R}"
            echo -e "  ${CMD}reload${R}      ${DIM}Reload config (triggers service)${R}"
            echo -e "  ${CMD}deploy${R} ${ARG}[-n]${R}  ${DIM}Deploy config tree to host${R}"
            echo -e "  ${CMD}audit${R}        ${DIM}Diff local vs remote config${R}"
            echo ""
            echo -e "  ${DIM}Shortcut: tcaddy c${R}"
            ;;
        svc|service)
            echo -e "${SVC}tcaddy svc${R} ${DIM}- Service control${R}"
            echo ""
            echo -e "  ${CMD}status${R}      ${DIM}Service status${R}"
            echo -e "  ${CMD}start${R}       ${DIM}Start service${R}"
            echo -e "  ${CMD}stop${R}        ${DIM}Stop service${R}"
            echo -e "  ${CMD}restart${R}     ${DIM}Restart service${R}"
            echo -e "  ${CMD}ping${R}        ${DIM}Check if running${R}"
            echo -e "  ${CMD}version${R}     ${DIM}Caddy version${R}"
            echo -e "  ${CMD}resources${R}   ${DIM}CPU, memory, disk usage${R}"
            echo ""
            echo -e "  ${DIM}Shortcut: tcaddy s${R}"
            ;;
        route|routes)
            echo -e "${RTE}tcaddy route${R} ${DIM}- Sites & certificates${R}"
            echo ""
            echo -e "  ${CMD}list${R}        ${DIM}List configured sites${R}"
            echo -e "  ${CMD}upstreams${R}   ${DIM}Show reverse proxy backends${R}"
            echo -e "  ${CMD}certs${R}       ${DIM}Certificate info for site${R}"
            echo -e "  ${CMD}certs-list${R}  ${DIM}List managed certificates${R}"
            echo ""
            echo -e "  ${DIM}Shortcut: tcaddy r${R}"
            ;;
        ban|f2b|fail2ban)
            echo -e "${LOG}tcaddy ban${R} ${DIM}- fail2ban monitoring${R}"
            echo ""
            echo -e "  ${CMD}status${R}         ${DIM}fail2ban service status${R}"
            echo -e "  ${CMD}jails${R}          ${DIM}List configured jails${R}"
            echo -e "  ${CMD}banned${R} ${ARG}[jail]${R} ${DIM}Show banned IPs${R}"
            echo -e "  ${CMD}match${R} ${ARG}[jail]${R}  ${DIM}Match bans to caddy errors${R}"
            echo -e "  ${CMD}recent${R} ${ARG}[n]${R}    ${DIM}Recent ban/unban activity${R}"
            echo ""
            echo -e "  ${DIM}Examples: tcaddy ban banned${R}"
            echo -e "  ${DIM}          tcaddy ban match caddy-auth${R}"
            ;;
        hosts)
            echo -e "${CTX}tcaddy hosts${R} ${DIM}- Local /etc/hosts management${R}"
            echo ""
            echo -e "  ${CMD}status${R}      ${DIM}Check configuration${R}"
            echo -e "  ${CMD}list${R}        ${DIM}Show current entries${R}"
            echo -e "  ${CMD}add${R} ${ARG}[-n]${R}    ${DIM}Add entries (-n: dry-run)${R}"
            echo -e "  ${CMD}update${R}      ${DIM}Refresh IP (remove + add)${R}"
            echo -e "  ${CMD}remove${R}      ${DIM}Remove managed entries${R}"
            echo -e "  ${CMD}edit${R}        ${DIM}Edit /etc/hosts${R}"
            ;;
        *)
            echo -e "${CMD}tcaddy${R} ${DIM}- Caddy server management${R}"
            echo ""
            echo -e "  ${CTX}ctx${R}      ${DIM}Context (org:env)${R}"
            echo -e "  ${LOG}log${R}      ${DIM}Log viewing & analysis${R}"
            echo -e "  ${CFG}cfg${R}      ${DIM}Configuration management${R}"
            echo -e "  ${SVC}svc${R}      ${DIM}Service control${R}"
            echo -e "  ${RTE}route${R}    ${DIM}Sites & certificates${R}"
            echo -e "  ${LOG}ban${R}      ${DIM}fail2ban monitoring${R}"
            echo ""
            echo -e "  ${CMD}map${R}      ${DIM}Proxy/backend visualization${R}"
            echo -e "  ${CMD}info${R}     ${DIM}Show paths & modules${R}"
            echo -e "  ${CMD}test${R}     ${DIM}Test API connectivity${R}"
            echo -e "  ${CMD}hosts${R}    ${DIM}Local /etc/hosts${R}"
            echo -e "  ${CMD}serve${R}    ${DIM}Run local caddy${R}"
            echo ""
            echo -e "tcaddy ${ARG}<group>${R} help  ${DIM}for details${R}"
            ;;
    esac
}

# =============================================================================
# GROUP DISPATCHERS
# =============================================================================

# Log group: tcaddy log [show|follow|errors|list|stats|size|top|export|archive|rotate]
_caddy_log() {
    local cmd="${1:-show}"
    shift 2>/dev/null || true

    case "$cmd" in
        show|s)      _caddy_logs "$@" ;;
        follow|f)    _caddy_logs_follow "$@" ;;
        errors|e)    _caddy_errors "$@" ;;
        list|ls)     _caddy_logs_list "$@" ;;
        stats)       _caddy_logs_stats "$@" ;;
        raw)         _caddy_logs_raw "$@" ;;
        json)        _caddy_logs_json "$@" ;;
        size|sz)     _caddy_logs_size "$@" ;;
        top|t)       _caddy_logs_top "$@" ;;
        export|x)    _caddy_logs_export "$@" ;;
        policy|p)    _caddy_logs_policy "$@" ;;
        roll)        _caddy_logs_roll "$@" ;;
        archive|ar)  _caddy_logs_archive "$@" ;;
        help|h)      _caddy_help log ;;
        # Numeric arg → show N lines
        [0-9]*)      _caddy_logs "$cmd" "$@" ;;
        *)
            echo "tcaddy log: unknown '$cmd'" >&2
            _caddy_help log
            return 1
            ;;
    esac
}

# Config group: caddy cfg [show|validate|fmt|reload|deploy]
_caddy_cfg() {
    local cmd="${1:-show}"
    shift 2>/dev/null || true

    case "$cmd" in
        show|s)      _caddy_config "$@" ;;
        validate|v)  _caddy_validate "$@" ;;
        fmt|format)  _caddy_fmt "$@" ;;
        reload|r)    _caddy_reload "$@" ;;
        deploy|d)    _caddy_deploy "$@" ;;
        audit|a)     _caddy_audit "$@" ;;
        help|h)      _caddy_help cfg ;;
        *)
            echo "caddy cfg: unknown '$cmd'" >&2
            _caddy_help cfg
            return 1
            ;;
    esac
}

# Service group: caddy svc [status|start|stop|restart|ping|version|resources]
_caddy_svc() {
    local cmd="${1:-status}"
    shift 2>/dev/null || true

    case "$cmd" in
        status|s)    _caddy_status "$@" ;;
        start)       _caddy_start "$@" ;;
        stop)        _caddy_stop "$@" ;;
        restart|r)   _caddy_restart "$@" ;;
        ping|p)      _caddy_ping "$@" ;;
        version|v)   _caddy_version "$@" ;;
        resources|res) _caddy_resources "$@" ;;
        help|h)      _caddy_help svc ;;
        *)
            echo "caddy svc: unknown '$cmd'" >&2
            _caddy_help svc
            return 1
            ;;
    esac
}

# Route group: caddy route [list|upstreams|certs]
_caddy_route() {
    local cmd="${1:-list}"
    shift 2>/dev/null || true

    case "$cmd" in
        list|ls|l)   _caddy_routes "$@" ;;
        upstreams|u) _caddy_upstreams "$@" ;;
        certs|c)     _caddy_certs "$@" ;;
        certs-list)  _caddy_certs_list "$@" ;;
        help|h)      _caddy_help route ;;
        *)
            echo "tcaddy route: unknown '$cmd'" >&2
            _caddy_help route
            return 1
            ;;
    esac
}

# fail2ban group dispatcher
_caddy_ban() {
    local cmd="${1:-status}"
    shift 2>/dev/null || true

    case "$cmd" in
        status|s)    _caddy_ban_status "$@" ;;
        jails|j)     _caddy_ban_jails "$@" ;;
        banned|b)    _caddy_ban_banned "$@" ;;
        match|m)     _caddy_ban_match "$@" ;;
        recent|r)    _caddy_ban_recent "$@" ;;
        help|h)      _caddy_help ban ;;
        *)
            echo "tcaddy ban: unknown '$cmd'" >&2
            _caddy_help ban
            return 1
            ;;
    esac
}

# =============================================================================
# MAIN DISPATCHER
# =============================================================================

tcaddy() {
    local cmd="${1:-help}"
    shift 2>/dev/null || true

    case "$cmd" in
        # Groups
        ctx)         caddy_ctx "$@" ;;
        log)         _caddy_log "$@" ;;
        cfg)         _caddy_cfg "$@" ;;
        svc)         _caddy_svc "$@" ;;
        route)       _caddy_route "$@" ;;
        ban|f2b)     _caddy_ban "$@" ;;

        # Top-level commands
        map)         _caddy_map "$@" ;;
        info)        _caddy_info "$@" ;;
        reload)      _caddy_reload "$@" ;;
        test)        _caddy_api_test "$@" ;;

        # Single-letter shortcuts
        i)           _caddy_info "$@" ;;
        s)           _caddy_svc status "$@" ;;
        l)           _caddy_log show "$@" ;;
        c)           _caddy_cfg show "$@" ;;
        r)           _caddy_route list "$@" ;;
        p)           _caddy_ping "$@" ;;
        t)           _caddy_api_test "$@" ;;

        # Local development
        hosts)       _caddy_hosts "$@" ;;
        serve)       _caddy_serve "$@" ;;

        # Help
        help|h|--help|-h)
            _caddy_help "$@"
            ;;

        *)
            echo "Unknown command: $cmd" >&2
            echo "Use 'tcaddy help' for usage" >&2
            return 1
            ;;
    esac
}

# =============================================================================
# EXPORTS
# =============================================================================

# Core helpers
export -f _caddy_is_local _caddy_exec _caddy_ssh _caddy_config_dir _caddy_caddyfile_path
export -f _caddy_hex_to_ansi _caddy_help

# Group dispatchers
export -f _caddy_log _caddy_cfg _caddy_svc _caddy_route _caddy_ban

# Local
export -f _caddy_serve

# Main
export -f tcaddy
