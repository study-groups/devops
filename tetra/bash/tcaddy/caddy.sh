#!/usr/bin/env bash
# tcaddy/caddy.sh - Caddy server management (tcaddy command)
#
# Uses sticky context from caddy_ctx.sh
# Commands operate on current context host
#
# Named tcaddy to avoid conflict with system caddy binary

CADDY_SRC="${TETRA_SRC}/bash/tcaddy"

# =============================================================================
# SSH HELPER
# =============================================================================

# Run command on current context host
_caddy_ssh() {
    local target
    target=$(_caddy_ssh_target)

    if [[ -z "$target" ]]; then
        echo "No host set. Use: tcaddy ctx <org> <proj> <env>" >&2
        return 1
    fi

    if [[ "$target" == "localhost" ]]; then
        # Run locally via bash -c (commands are passed as strings)
        bash -c "$*"
    else
        ssh "$target" "$@"
    fi
}

# =============================================================================
# STATUS COMMANDS
# =============================================================================

# Show caddy service status
_caddy_status() {
    local target
    target=$(_caddy_ssh_target)
    echo "=== Caddy Status on $target ==="
    _caddy_ssh "systemctl status caddy --no-pager -l" 2>/dev/null | head -20
}

# Show caddy version
_caddy_version() {
    _caddy_ssh "caddy version"
}

# Test if caddy is running
_caddy_ping() {
    local target
    target=$(_caddy_ssh_target)
    if _caddy_ssh "systemctl is-active caddy" &>/dev/null; then
        echo "Caddy is running on $target"
        return 0
    else
        echo "Caddy is NOT running on $target"
        return 1
    fi
}

# =============================================================================
# CONFIG COMMANDS
# =============================================================================

# Show Caddyfile
_caddy_config() {
    local site=$(_caddy_site)

    if [[ -n "$site" ]]; then
        # Show just the site block
        echo "=== $site config ==="
        _caddy_ssh "cat /etc/caddy/Caddyfile" | awk -v site="$site" '
            $0 ~ site"\\." { found=1 }
            found { print }
            found && /^}$/ { found=0 }
        '
    else
        # Show full config
        echo "=== Caddyfile ==="
        _caddy_ssh "cat /etc/caddy/Caddyfile"
    fi
}

# Validate config
_caddy_validate() {
    echo "=== Validating Caddyfile ==="
    _caddy_ssh "caddy validate --config /etc/caddy/Caddyfile" 2>&1
}

# Reload caddy
_caddy_reload() {
    echo "=== Reloading Caddy ==="
    _caddy_ssh "systemctl reload caddy && systemctl status caddy --no-pager" | head -15
}

# Format Caddyfile
_caddy_fmt() {
    echo "=== Formatting Caddyfile ==="
    _caddy_ssh "caddy fmt --overwrite /etc/caddy/Caddyfile && echo 'Formatted.'"
}

# =============================================================================
# LOGS COMMANDS
# =============================================================================

# Get log file path for current context
_caddy_logfile() {
    local env=$(_caddy_env)
    local domain=$(_caddy_domain)
    local target=$(_caddy_ssh_target)

    # Local: use /tmp/caddy-access.log by default
    if [[ "$target" == "localhost" ]]; then
        echo "${CADDY_LOCAL_LOG:-/tmp/caddy-access.log}"
        return 0
    fi

    # Remote: use domain-based log path
    if [[ -n "$domain" && "$domain" != "localhost" ]]; then
        echo "/var/log/caddy/${domain}.log"
    else
        echo "/var/log/caddy/*.log"
    fi
}

# Show recent logs with JSON parsing (done on remote server)
_caddy_logs() {
    local lines="${1:-50}"
    local logfile
    logfile=$(_caddy_logfile)

    echo "=== Caddy logs (last $lines) - $logfile ==="

    # Parse JSON on the server (has jq)
    _caddy_ssh "tail -n $lines $logfile 2>/dev/null | jq -r '
        def color: if .level == \"error\" or (.status // 0) >= 500 then \"\\u001b[31m\"
                   elif (.status // 0) >= 400 then \"\\u001b[33m\"
                   elif (.status // 0) >= 200 then \"\\u001b[32m\"
                   else \"\" end;
        def reset: \"\\u001b[0m\";
        \"\\(color)\\(.ts | todate | split(\"T\")[1] | split(\".\")[0]) \\(.status // \"?\") \\(.request.method // \"?\") \\(.request.host // \"?\") \\(.request.uri // \"?\")\\(reset)\"
    ' 2>/dev/null || tail -n $lines $logfile 2>/dev/null"
}

# Show raw JSON logs
_caddy_logs_raw() {
    local lines="${1:-20}"
    local logfile
    logfile=$(_caddy_logfile)

    echo "=== Raw JSON logs (last $lines) ==="
    _caddy_ssh "tail -n $lines $logfile 2>/dev/null"
}

# Show logs with jq formatting (if available)
_caddy_logs_json() {
    local lines="${1:-20}"
    local logfile
    logfile=$(_caddy_logfile)

    echo "=== JSON logs (last $lines) ==="
    _caddy_ssh "tail -n $lines $logfile 2>/dev/null | jq -c '{ts:.ts, status:.status, method:.request.method, host:.request.host, uri:.request.uri, duration:.duration}' 2>/dev/null || cat"
}

# Follow logs (parsed on remote)
_caddy_logs_follow() {
    local logfile
    logfile=$(_caddy_logfile)

    echo "=== Following $logfile (Ctrl+C to stop) ==="
    _caddy_ssh "tail -f $logfile 2>/dev/null | jq -r --unbuffered '
        def color: if .level == \"error\" or (.status // 0) >= 500 then \"\\u001b[31m\"
                   elif (.status // 0) >= 400 then \"\\u001b[33m\"
                   elif (.status // 0) >= 200 then \"\\u001b[32m\"
                   else \"\" end;
        def reset: \"\\u001b[0m\";
        \"\\(color)\\(.ts | todate | split(\"T\")[1] | split(\".\")[0]) \\(.status // \"?\") \\(.request.method // \"?\") \\(.request.host // \"?\") \\(.request.uri // \"?\")\\(reset)\"
    ' 2>/dev/null || tail -f $logfile"
}

# Show errors only (5xx and level:error)
_caddy_errors() {
    local lines="${1:-50}"

    echo "=== Caddy errors (last $lines) ==="
    _caddy_ssh "cat /var/log/caddy/*.log 2>/dev/null | jq -r 'select(.level == \"error\" or (.status // 0) >= 500) |
        \"\\u001b[31m\\(.ts | todate | split(\"T\")[1] | split(\".\")[0]) \\(.status // \"?\") \\(.request.method // \"?\") \\(.request.host // \"?\") \\(.request.uri // \"?\")\\u001b[0m\\n  -> \\(.msg // \"-\")\"
    ' 2>/dev/null | tail -n $((lines * 2))"
}

# List available log files
_caddy_logs_list() {
    echo "=== Available log files ==="
    _caddy_ssh "ls -lh /var/log/caddy/*.log 2>/dev/null"
}

# Show log stats
_caddy_logs_stats() {
    echo "=== Log statistics ==="
    _caddy_ssh 'for f in /var/log/caddy/*.log; do
        name=$(basename "$f")
        lines=$(wc -l < "$f" 2>/dev/null || echo 0)
        errors=$(grep -c "\"level\":\"error\"" "$f" 2>/dev/null || echo 0)
        s5xx=$(grep -c "\"status\":5" "$f" 2>/dev/null || echo 0)
        printf "%-40s %6d lines, %4d errors, %4d 5xx\n" "$name" "$lines" "$errors" "$s5xx"
    done'
}

# Show log sizes
_caddy_logs_size() {
    echo "=== Log Sizes ==="
    _caddy_ssh 'ls -lhS /var/log/caddy/*.log 2>/dev/null | awk "{print \$5, \$9}"
        echo "---"
        du -sh /var/log/caddy/ 2>/dev/null
        echo ""
        echo "Compressed archives:"
        ls -lhS /var/log/caddy/*.gz 2>/dev/null | awk "{print \$5, \$9}" || echo "(none)"'
}

# Top analysis - IPs, paths, status codes, user agents
_caddy_logs_top() {
    local what="${1:-ips}"
    local n="${2:-10}"
    local logfile
    logfile=$(_caddy_logfile)

    case "$what" in
        ips|ip)
            echo "=== Top $n IPs ==="
            _caddy_ssh "cat $logfile 2>/dev/null | jq -r '.request.remote_ip // .request.client_ip // empty' | sort | uniq -c | sort -rn | head -n $n"
            ;;
        paths|path|uri)
            echo "=== Top $n Paths ==="
            _caddy_ssh "cat $logfile 2>/dev/null | jq -r '.request.uri // empty' | sort | uniq -c | sort -rn | head -n $n"
            ;;
        codes|status)
            echo "=== Status Code Distribution ==="
            _caddy_ssh "cat $logfile 2>/dev/null | jq -r '.status // empty' | sort | uniq -c | sort -rn | head -n $n"
            ;;
        ua|useragent|agents)
            echo "=== Top $n User Agents ==="
            _caddy_ssh "cat $logfile 2>/dev/null | jq -r '.request.headers[\"User-Agent\"][0] // empty' | sort | uniq -c | sort -rn | head -n $n"
            ;;
        errors|err)
            echo "=== Top $n Error Sources ==="
            _caddy_ssh "cat $logfile 2>/dev/null | jq -r 'select(.status >= 400) | \"\\(.status) \\(.request.remote_ip // \"?\") \\(.request.uri // \"?\")\"' | sort | uniq -c | sort -rn | head -n $n"
            ;;
        *)
            echo "Usage: tcaddy log top <ips|paths|codes|ua|errors> [count]"
            return 1
            ;;
    esac
}

# Export logs to JSON or CSV
_caddy_logs_export() {
    local format="${1:-json}"
    local lines="${2:-1000}"
    local logfile
    logfile=$(_caddy_logfile)
    local output="/tmp/caddy-export-$(date +%Y%m%d-%H%M%S).${format}"

    case "$format" in
        json)
            echo "Exporting $lines lines to $output..."
            _caddy_ssh "tail -n $lines $logfile 2>/dev/null" > "$output"
            echo "Exported to: $output"
            ;;
        csv)
            echo "Exporting $lines lines to $output..."
            echo "timestamp,status,method,host,uri,remote_ip,duration" > "$output"
            _caddy_ssh "tail -n $lines $logfile 2>/dev/null | jq -r '[.ts, .status, .request.method, .request.host, .request.uri, .request.remote_ip, .duration] | @csv'" >> "$output"
            echo "Exported to: $output"
            ;;
        *)
            echo "Usage: tcaddy log export <json|csv> [lines]"
            return 1
            ;;
    esac
}

# Archive old logs (compress with gzip)
_caddy_logs_archive() {
    local days="${1:-7}"

    echo "=== Archiving logs older than $days days ==="
    _caddy_ssh "find /var/log/caddy -name '*.log' -mtime +$days -exec ls -lh {} \;" 2>/dev/null

    read -p "Compress these files? [y/N] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        _caddy_ssh "find /var/log/caddy -name '*.log' -mtime +$days -exec gzip -v {} \;"
        echo "Done. Archived files:"
        _caddy_ssh "ls -lh /var/log/caddy/*.gz 2>/dev/null"
    else
        echo "Cancelled."
    fi
}

# Trigger log rotation
_caddy_logs_rotate() {
    echo "=== Log Rotation ==="

    # Check if logrotate config exists
    if _caddy_ssh "test -f /etc/logrotate.d/caddy" 2>/dev/null; then
        echo "Found /etc/logrotate.d/caddy"
        _caddy_ssh "cat /etc/logrotate.d/caddy"
        echo ""
        read -p "Force rotation now? [y/N] " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            _caddy_ssh "logrotate -f /etc/logrotate.d/caddy"
            echo "Rotation triggered."
        fi
    else
        echo "No logrotate config found at /etc/logrotate.d/caddy"
        echo "Current log sizes:"
        _caddy_logs_size
    fi
}

# =============================================================================
# CERTS COMMANDS
# =============================================================================

# Show certificate info
_caddy_certs() {
    local site=$(_caddy_site)
    local host=$(_caddy_host)
    local domain

    # Determine domain to check
    if [[ -n "$site" && "$site" != "main" ]]; then
        domain="${site}.${host}.pixeljamarcade.com"
    else
        domain="${host}.pixeljamarcade.com"
    fi

    echo "=== Certificate: $domain ==="

    # Check via openssl
    echo | timeout 5 openssl s_client -servername "$domain" -connect "$domain:443" 2>/dev/null | \
        openssl x509 -noout -dates -subject -issuer 2>/dev/null || \
        echo "Could not retrieve certificate info"
}

# List all managed certs
_caddy_certs_list() {
    echo "=== Managed Certificates ==="
    _caddy_ssh "ls -la /var/lib/caddy/.local/share/caddy/certificates/ 2>/dev/null || echo 'No certs found'"
}

# =============================================================================
# ROUTES COMMANDS
# =============================================================================

# List all routes/sites
_caddy_routes() {
    echo "=== Configured Sites ==="
    _caddy_ssh "grep -E '^[a-zA-Z].*\{' /etc/caddy/Caddyfile | sed 's/ {//'"
}

# Show upstream backends
_caddy_upstreams() {
    echo "=== Upstream Backends ==="
    _caddy_ssh "grep -E 'reverse_proxy|proxy_pass' /etc/caddy/Caddyfile | sed 's/^[ \t]*//'"
}

# =============================================================================
# SERVICE COMMANDS
# =============================================================================

_caddy_start() {
    echo "=== Starting Caddy ==="
    _caddy_ssh "systemctl start caddy && systemctl status caddy --no-pager" | head -15
}

_caddy_stop() {
    echo "=== Stopping Caddy ==="
    _caddy_ssh "systemctl stop caddy && echo 'Stopped'"
}

_caddy_restart() {
    echo "=== Restarting Caddy ==="
    _caddy_ssh "systemctl restart caddy && systemctl status caddy --no-pager" | head -15
}

# =============================================================================
# DEPLOY COMMAND
# =============================================================================

# Deploy Caddyfile from local to remote
_caddy_deploy() {
    local caddyfile="${1:-$PWD/Caddyfile}"
    local target
    target=$(_caddy_ssh_target)

    if [[ ! -f "$caddyfile" ]]; then
        echo "Caddyfile not found: $caddyfile" >&2
        return 1
    fi

    if [[ "$target" == "localhost" ]]; then
        echo "Cannot deploy to localhost" >&2
        return 1
    fi

    echo "=== Deploying to $target ==="

    # Validate locally first
    if command -v caddy &>/dev/null; then
        echo "Validating locally..."
        caddy validate --config "$caddyfile" || return 1
    fi

    # Deploy
    echo "Copying Caddyfile..."
    scp "$caddyfile" "$target:/etc/caddy/Caddyfile"

    # Validate on remote
    echo "Validating on remote..."
    _caddy_ssh "caddy validate --config /etc/caddy/Caddyfile" || return 1

    # Reload
    echo "Reloading..."
    _caddy_ssh "systemctl reload caddy"

    echo "Deployed successfully"
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
            echo -e "  ${CMD}set${R} ${ARG}<org> [proj] [env]${R}   ${DIM}Set context${R}"
            echo -e "  ${CMD}proj${R} ${ARG}<name>${R}              ${DIM}Change proj only${R}"
            echo -e "  ${CMD}env${R} ${ARG}<name>${R}               ${DIM}Change env only${R}"
            echo -e "  ${CMD}clear${R}                    ${DIM}Clear context${R}"
            echo -e "  ${CMD}status${R}                   ${DIM}Show current${R}"
            echo -e "  ${CMD}add-env${R} ${ARG}<alias> <ssh>${R}    ${DIM}Add env alias${R}"
            echo ""
            echo -e "  ${DIM}Example: tcaddy ctx pja arcade dev${R}"
            ;;
        log|logs)
            echo -e "${LOG}tcaddy log${R} ${DIM}- Log viewing & analysis${R}"
            echo ""
            echo -e "  ${CMD}show${R} ${ARG}[n]${R}       ${DIM}Formatted logs (default: 50)${R}"
            echo -e "  ${CMD}follow${R}         ${DIM}Tail logs live${R}"
            echo -e "  ${CMD}errors${R} ${ARG}[n]${R}     ${DIM}Errors only (5xx + level:error)${R}"
            echo -e "  ${CMD}list${R}           ${DIM}List log files${R}"
            echo -e "  ${CMD}stats${R}          ${DIM}Error counts per file${R}"
            echo -e "  ${CMD}raw${R} ${ARG}[n]${R}        ${DIM}Raw JSON logs${R}"
            echo ""
            echo -e "  ${CMD}size${R}           ${DIM}Log file sizes and disk usage${R}"
            echo -e "  ${CMD}top${R} ${ARG}<what> [n]${R} ${DIM}Top IPs/paths/codes/ua/errors${R}"
            echo -e "  ${CMD}export${R} ${ARG}<fmt> [n]${R} ${DIM}Export to json/csv${R}"
            echo -e "  ${CMD}archive${R} ${ARG}[days]${R} ${DIM}Compress logs older than N days${R}"
            echo -e "  ${CMD}rotate${R}         ${DIM}Trigger log rotation${R}"
            echo ""
            echo -e "  ${DIM}Examples: tcaddy log top ips 20${R}"
            echo -e "  ${DIM}          tcaddy log export csv 1000${R}"
            ;;
        cfg|config)
            echo -e "${CFG}tcaddy cfg${R} ${DIM}- Configuration management${R}"
            echo ""
            echo -e "  ${CMD}show${R}        ${DIM}Show Caddyfile${R}"
            echo -e "  ${CMD}validate${R}    ${DIM}Validate configuration${R}"
            echo -e "  ${CMD}fmt${R}         ${DIM}Format Caddyfile${R}"
            echo -e "  ${CMD}reload${R}      ${DIM}Reload config (triggers service)${R}"
            echo -e "  ${CMD}deploy${R} ${ARG}[f]${R}  ${DIM}Deploy Caddyfile to host${R}"
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
        f2b|fail2ban|ban)
            echo -e "${LOG}tcaddy f2b${R} ${DIM}- fail2ban monitoring${R}"
            echo ""
            echo -e "  ${CMD}status${R}         ${DIM}fail2ban service status${R}"
            echo -e "  ${CMD}jails${R}          ${DIM}List configured jails${R}"
            echo -e "  ${CMD}banned${R} ${ARG}[jail]${R} ${DIM}Show banned IPs${R}"
            echo -e "  ${CMD}match${R} ${ARG}[jail]${R}  ${DIM}Match bans to caddy errors${R}"
            echo -e "  ${CMD}recent${R} ${ARG}[n]${R}    ${DIM}Recent ban/unban activity${R}"
            echo ""
            echo -e "  ${DIM}Examples: tcaddy f2b banned${R}"
            echo -e "  ${DIM}          tcaddy f2b match caddy-auth${R}"
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
            echo -e "  ${CTX}ctx${R}      ${DIM}Context (org:proj:env)${R}"
            echo -e "  ${LOG}log${R}      ${DIM}Log viewing & analysis${R}"
            echo -e "  ${CFG}cfg${R}      ${DIM}Configuration management${R}"
            echo -e "  ${SVC}svc${R}      ${DIM}Service control${R}"
            echo -e "  ${RTE}route${R}    ${DIM}Sites & certificates${R}"
            echo -e "  ${LOG}f2b${R}      ${DIM}fail2ban monitoring${R}"
            echo ""
            echo -e "  ${CMD}hosts${R}    ${DIM}Local /etc/hosts${R}"
            echo -e "  ${CMD}serve${R}    ${DIM}Run local caddy${R}"
            echo ""
            echo -e "tcaddy ${ARG}<group>${R} help  ${DIM}for details${R}"
            ;;
    esac
}

# =============================================================================
# LOCAL HOSTS MANAGEMENT
# =============================================================================

# Block markers for safe removal
_CADDY_HOSTS_BEGIN="# caddy-managed-begin"
_CADDY_HOSTS_END="# caddy-managed-end"

# Get local IP - try multiple interfaces
_caddy_local_ip() {
    local ip
    # macOS - try common interfaces
    for iface in en0 en1 en2 en3 en4; do
        ip=$(ipconfig getifaddr "$iface" 2>/dev/null)
        [[ -n "$ip" ]] && { echo "$ip"; return; }
    done
    # Linux fallback
    hostname -I 2>/dev/null | awk '{print $1}'
}

# _caddy_domain() is defined in caddy_ctx.sh - reads from tetra.toml

# List configured subdomains for current org
_caddy_subdomains() {
    local domain=$(_caddy_domain)
    local caddyfile="${TETRA_DIR:-$HOME/tetra}/orgs/$(_caddy_org)/caddy/Caddyfile"

    if [[ -f "$caddyfile" ]]; then
        # Extract subdomains from Caddyfile (case insensitive)
        grep -oiE '[a-z0-9]+\.'"$domain" "$caddyfile" 2>/dev/null | tr '[:upper:]' '[:lower:]' | sort -u
    else
        # Default subdomains
        echo "controldeck.$domain"
        echo "divgraphics.$domain"
        echo "asciivision.$domain"
    fi
}

# Generate hosts block for domain
_caddy_hosts_block() {
    local domain=$(_caddy_domain)
    local ip=$(_caddy_local_ip)

    echo "$_CADDY_HOSTS_BEGIN $domain"
    echo "$ip  $domain"
    while IFS= read -r sub; do
        echo "$ip  $sub"
    done < <(_caddy_subdomains)
    echo "$_CADDY_HOSTS_END $domain"
}

# Show current hosts entries for this domain
_caddy_hosts_list() {
    local domain=$(_caddy_domain)
    echo "=== /etc/hosts entries for *.$domain ==="
    grep -E "$domain" /etc/hosts 2>/dev/null || echo "(none)"
}

# Check if hosts are configured
_caddy_hosts_status() {
    local domain=$(_caddy_domain)
    local ip=$(_caddy_local_ip)
    local configured_ip

    echo "Domain: $domain"
    echo "Local IP: $ip"
    echo ""

    if grep -q "$_CADDY_HOSTS_BEGIN $domain" /etc/hosts 2>/dev/null; then
        configured_ip=$(grep -A1 "$_CADDY_HOSTS_BEGIN $domain" /etc/hosts | tail -1 | awk '{print $1}')
        if [[ "$configured_ip" == "$ip" ]]; then
            echo "Status: configured (current)"
        else
            echo "Status: configured (stale IP: $configured_ip)"
            echo "Run: caddy hosts update"
        fi
        echo ""
        _caddy_hosts_list
    else
        echo "Status: not configured"
        echo ""
        echo "Run: caddy hosts add"
    fi
}

# Add hosts entries
_caddy_hosts_add() {
    local domain=$(_caddy_domain)
    local ip=$(_caddy_local_ip)
    local dry_run=false

    [[ "$1" == "-n" || "$1" == "--dry-run" ]] && dry_run=true

    if [[ -z "$ip" ]]; then
        echo "Could not determine local IP" >&2
        return 1
    fi

    # Check if already added
    if grep -q "$_CADDY_HOSTS_BEGIN $domain" /etc/hosts 2>/dev/null; then
        echo "Entries for $domain already exist."
        echo "Use 'caddy hosts update' to refresh IP, or 'caddy hosts remove' first."
        return 0
    fi

    local block
    block=$(_caddy_hosts_block)

    echo "Entries to add:"
    echo "$block"
    echo ""

    if $dry_run; then
        echo "(dry-run, no changes made)"
    else
        echo "$block" | sudo tee -a /etc/hosts > /dev/null
        echo "Added to /etc/hosts"
    fi
}

# Remove hosts entries (safe block removal)
_caddy_hosts_remove() {
    local domain=$(_caddy_domain)

    if ! grep -q "$_CADDY_HOSTS_BEGIN $domain" /etc/hosts 2>/dev/null; then
        echo "No managed entries for $domain"
        return 0
    fi

    echo "Removing hosts entries for $domain"

    # Remove block between markers (inclusive)
    sudo sed -i.bak "/$_CADDY_HOSTS_BEGIN $domain/,/$_CADDY_HOSTS_END $domain/d" /etc/hosts

    echo "Removed from /etc/hosts"
}

# Update hosts (remove + add, for IP changes)
_caddy_hosts_update() {
    local domain=$(_caddy_domain)

    if ! grep -q "$_CADDY_HOSTS_BEGIN $domain" /etc/hosts 2>/dev/null; then
        echo "No existing entries, adding fresh"
        _caddy_hosts_add
        return
    fi

    echo "Updating hosts entries for $domain"
    _caddy_hosts_remove
    _caddy_hosts_add
}

# Edit hosts file directly
_caddy_hosts_edit() {
    sudo ${EDITOR:-vim} /etc/hosts
}

# Main hosts dispatcher
_caddy_hosts() {
    local cmd="${1:-status}"
    shift 2>/dev/null || true

    case "$cmd" in
        list|ls)      _caddy_hosts_list ;;
        status|s)     _caddy_hosts_status ;;
        add|a)        _caddy_hosts_add "$@" ;;
        remove|rm)    _caddy_hosts_remove ;;
        update|u)     _caddy_hosts_update ;;
        edit|e)       _caddy_hosts_edit ;;
        ip)           _caddy_local_ip ;;
        domain)       _caddy_domain ;;
        block)        _caddy_hosts_block ;;
        *)
            echo "Usage: caddy hosts <cmd>"
            echo "  status       Check configuration"
            echo "  list         Show current entries"
            echo "  add [-n]     Add entries (-n: dry-run)"
            echo "  update       Refresh IP (remove + add)"
            echo "  remove       Remove managed entries"
            echo "  edit         Edit /etc/hosts"
            echo "  ip           Show local IP"
            echo "  domain       Show domain for org"
            ;;
    esac
}

# =============================================================================
# LOG POLICY COMMANDS
# =============================================================================

# Get Caddyfile path for current context
_caddy_caddyfile_path() {
    local target=$(_caddy_ssh_target)
    local org=$(_caddy_org_full)

    if [[ "$target" == "localhost" ]]; then
        echo "${TETRA_DIR:-$HOME/tetra}/orgs/${org:-tetra}/caddy/Caddyfile"
    else
        echo "/etc/caddy/Caddyfile"
    fi
}

# Show current log policy from Caddyfile
_caddy_policy_show() {
    local caddyfile=$(_caddy_caddyfile_path)

    echo "=== Log Policy ==="
    echo "Caddyfile: $caddyfile"
    echo ""

    _caddy_ssh "grep -A10 'log {' $caddyfile 2>/dev/null | head -15" || echo "(no log block found)"

    echo ""
    echo "Log file: $(_caddy_logfile)"

    # Show current log file stats
    local logfile=$(_caddy_logfile)
    echo ""
    echo "=== Log Stats ==="
    _caddy_ssh "ls -lh $logfile 2>/dev/null | awk '{print \"Size:\", \$5}'" || echo "Log file not found"
    _caddy_ssh "wc -l < $logfile 2>/dev/null | xargs printf 'Lines: %s\n'" || true
}

# Set log policy in Caddyfile
_caddy_policy_set() {
    local roll_size="${1:-10mb}"
    local roll_keep="${2:-5}"
    local roll_keep_for="${3:-168h}"

    local caddyfile=$(_caddy_caddyfile_path)

    echo "Setting log policy:"
    echo "  roll_size: $roll_size"
    echo "  roll_keep: $roll_keep"
    echo "  roll_keep_for: $roll_keep_for"
    echo ""

    # For local, we can edit directly; for remote, show the command
    local target=$(_caddy_ssh_target)
    if [[ "$target" == "localhost" ]]; then
        echo "Update $caddyfile with:"
        echo ""
        cat << EOF
log {
    output file /tmp/caddy-access.log {
        roll_size $roll_size
        roll_keep $roll_keep
        roll_keep_for $roll_keep_for
    }
    format json
}
EOF
        echo ""
        echo "Then run: tcaddy reload"
    else
        echo "SSH to server and update /etc/caddy/Caddyfile"
        echo "Then run: tcaddy svc reload"
    fi
}

# Force log rotation (by restarting Caddy)
_caddy_policy_rotate() {
    echo "=== Force Log Rotation ==="

    local target=$(_caddy_ssh_target)
    if [[ "$target" == "localhost" ]]; then
        echo "Reloading local Caddy to trigger rotation..."
        local caddyfile=$(_caddy_caddyfile_path)
        (cd "$(dirname "$caddyfile")" && caddy reload --config Caddyfile 2>&1)
    else
        echo "Reloading remote Caddy..."
        _caddy_ssh "systemctl reload caddy 2>/dev/null || caddy reload"
    fi
}

# Clean old log files
_caddy_policy_clean() {
    local days="${1:-7}"

    echo "=== Clean Logs Older Than $days Days ==="

    local target=$(_caddy_ssh_target)
    if [[ "$target" == "localhost" ]]; then
        local logdir=$(dirname "$(_caddy_logfile)")
        echo "Checking $logdir..."
        find "$logdir" -name "*.log*" -mtime +"$days" -ls 2>/dev/null || echo "(no old logs)"
    else
        _caddy_ssh "find /var/log/caddy -name '*.log*' -mtime +$days -ls 2>/dev/null" || echo "(no old logs)"
    fi
}

# Log policy dispatcher
_caddy_policy() {
    local cmd="${1:-show}"
    shift 2>/dev/null || true

    case "$cmd" in
        show|s)     _caddy_policy_show "$@" ;;
        set)        _caddy_policy_set "$@" ;;
        rotate|r)   _caddy_policy_rotate "$@" ;;
        clean|c)    _caddy_policy_clean "$@" ;;
        help|h)
            echo "tcaddy policy - Log policy management"
            echo ""
            echo "  show              Show current log policy"
            echo "  set <size> <keep> <days>  Set policy (e.g., 10mb 5 168h)"
            echo "  rotate            Force log rotation"
            echo "  clean [days]      Show logs older than N days"
            ;;
        *)
            echo "Unknown policy command: $cmd" >&2
            return 1
            ;;
    esac
}

# =============================================================================
# RELOAD COMMAND (wrapper around caddy reload)
# =============================================================================

_caddy_reload() {
    local target=$(_caddy_ssh_target)
    local caddyfile=$(_caddy_caddyfile_path)

    echo "=== Reloading Caddy ==="
    echo "Caddyfile: $caddyfile"

    if [[ "$target" == "localhost" ]]; then
        (cd "$(dirname "$caddyfile")" && caddy reload --config Caddyfile 2>&1)
    else
        _caddy_ssh "systemctl reload caddy 2>/dev/null || caddy reload --config $caddyfile"
    fi
}

# =============================================================================
# LOCAL SERVE
# =============================================================================

# Run caddy locally using context-based Caddyfile
_caddy_serve() {
    local org=$(_caddy_org)
    local caddyfile="${TETRA_DIR:-$HOME/tetra}/orgs/${org:-tetra}/caddy/Caddyfile"
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
        archive|ar)  _caddy_logs_archive "$@" ;;
        rotate|rot)  _caddy_logs_rotate "$@" ;;
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
        help|h)      _caddy_help cfg ;;
        *)
            echo "caddy cfg: unknown '$cmd'" >&2
            _caddy_help cfg
            return 1
            ;;
    esac
}

# Service group: caddy svc [status|start|stop|restart|ping|version]
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

# =============================================================================
# FAIL2BAN MONITORING
# =============================================================================

# fail2ban service status
_caddy_f2b_status() {
    echo "=== fail2ban Status ==="
    _caddy_ssh "systemctl status fail2ban --no-pager -l 2>/dev/null | head -15 || fail2ban-client status 2>/dev/null || echo 'fail2ban not found'"
}

# List all jails
_caddy_f2b_jails() {
    echo "=== fail2ban Jails ==="
    _caddy_ssh "fail2ban-client status 2>/dev/null | grep -A100 'Jail list' | head -20"
}

# Show banned IPs
_caddy_f2b_banned() {
    local jail="${1:-}"

    if [[ -n "$jail" ]]; then
        echo "=== Banned IPs in $jail ==="
        _caddy_ssh "fail2ban-client status $jail 2>/dev/null | grep -E 'Banned|Currently banned'"
    else
        echo "=== All Banned IPs ==="
        _caddy_ssh 'jails=$(fail2ban-client status 2>/dev/null | grep "Jail list" | sed "s/.*:\s*//" | tr -d " " | tr "," " ")
            for j in $jails; do
                count=$(fail2ban-client status "$j" 2>/dev/null | grep "Currently banned" | awk "{print \$NF}")
                [[ "$count" != "0" ]] && {
                    echo "=== $j ($count banned) ==="
                    fail2ban-client status "$j" 2>/dev/null | grep -A100 "Banned IP list"
                }
            done'
    fi
}

# Cross-reference caddy errors with fail2ban bans
_caddy_f2b_match() {
    local jail="${1:-}"

    echo "=== Matching Caddy Errors to Bans ==="

    # Get banned IPs
    local banned_ips
    if [[ -n "$jail" ]]; then
        banned_ips=$(_caddy_ssh "fail2ban-client status $jail 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+'")
    else
        banned_ips=$(_caddy_ssh "fail2ban-client status 2>/dev/null | grep 'Jail list' | sed 's/.*:\s*//' | tr ',' ' ' | xargs -n1 fail2ban-client status 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+'" 2>/dev/null)
    fi

    if [[ -z "$banned_ips" ]]; then
        echo "(no banned IPs found)"
        return
    fi

    echo "Banned IPs with caddy activity:"
    for ip in $banned_ips; do
        local count
        count=$(_caddy_ssh "grep -c '$ip' /var/log/caddy/*.log 2>/dev/null | awk -F: '{s+=\$2} END {print s}'")
        [[ -n "$count" && "$count" != "0" ]] && echo "  $ip: $count requests in caddy logs"
    done
}

# Recent ban/unban activity
_caddy_f2b_recent() {
    local n="${1:-20}"

    echo "=== Recent fail2ban Activity (last $n) ==="
    _caddy_ssh "grep -E 'Ban|Unban' /var/log/fail2ban.log 2>/dev/null | tail -n $n" || \
    _caddy_ssh "journalctl -u fail2ban --no-pager -n $n 2>/dev/null | grep -E 'Ban|Unban'" || \
    echo "(no fail2ban logs found)"
}

# fail2ban group dispatcher
_caddy_f2b() {
    local cmd="${1:-status}"
    shift 2>/dev/null || true

    case "$cmd" in
        status|s)    _caddy_f2b_status "$@" ;;
        jails|j)     _caddy_f2b_jails "$@" ;;
        banned|b)    _caddy_f2b_banned "$@" ;;
        match|m)     _caddy_f2b_match "$@" ;;
        recent|r)    _caddy_f2b_recent "$@" ;;
        help|h)      _caddy_help f2b ;;
        *)
            echo "tcaddy f2b: unknown '$cmd'" >&2
            _caddy_help f2b
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
        f2b|ban)     _caddy_f2b "$@" ;;
        policy|pol)  _caddy_policy "$@" ;;

        # Top-level commands (caddy wrapper)
        reload)      _caddy_reload "$@" ;;

        # Single-letter shortcuts
        s)           _caddy_svc status "$@" ;;
        l)           _caddy_log show "$@" ;;
        c)           _caddy_cfg show "$@" ;;
        r)           _caddy_route list "$@" ;;
        p)           _caddy_policy show "$@" ;;

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

# Core
export -f _caddy_ssh _caddy_hex_to_ansi

# Group dispatchers
export -f _caddy_log _caddy_cfg _caddy_svc _caddy_route _caddy_f2b

# Service commands
export -f _caddy_status _caddy_version _caddy_ping
export -f _caddy_start _caddy_stop _caddy_restart

# Config commands
export -f _caddy_config _caddy_validate _caddy_reload _caddy_fmt _caddy_deploy

# Log commands
export -f _caddy_logfile _caddy_logs _caddy_logs_raw _caddy_logs_json
export -f _caddy_logs_list _caddy_logs_stats _caddy_logs_follow _caddy_errors
export -f _caddy_logs_size _caddy_logs_top _caddy_logs_export
export -f _caddy_logs_archive _caddy_logs_rotate

# Route commands
export -f _caddy_certs _caddy_certs_list _caddy_routes _caddy_upstreams

# fail2ban commands
export -f _caddy_f2b_status _caddy_f2b_jails _caddy_f2b_banned
export -f _caddy_f2b_match _caddy_f2b_recent

# Help
export -f _caddy_help

# Local hosts management
export -f _caddy_local_ip _caddy_subdomains _caddy_hosts_block
export -f _caddy_hosts_list _caddy_hosts_status _caddy_hosts_add _caddy_hosts_remove
export -f _caddy_hosts_update _caddy_hosts_edit _caddy_hosts

# Local serve
export -f _caddy_serve

# Log policy
export -f _caddy_caddyfile_path _caddy_policy _caddy_policy_show
export -f _caddy_policy_set _caddy_policy_rotate _caddy_policy_clean
export -f _caddy_reload

# Main
export -f tcaddy
