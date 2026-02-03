#!/usr/bin/env bash
# tcaddy/caddy_log.sh - Log viewing and analysis commands
#
# Requires: caddy.sh (core helpers)

# =============================================================================
# LOG PATH
# =============================================================================

# Get log file path for current context
_caddy_logfile() {
    local env=$(_caddy_env)
    local domain=$(_caddy_domain)
    local target=$(_caddy_ssh_target)

    # Local: use standard caddy.log path
    if [[ "$target" == "localhost" ]]; then
        local caddy_log="${TETRA_DIR:-$HOME/tetra}/run/logs/caddy.log"
        echo "$caddy_log"
        return 0
    fi

    # Remote: use domain-based log path
    if [[ -n "$domain" && "$domain" != "localhost" ]]; then
        echo "/var/log/caddy/${domain}.log"
    else
        echo "/var/log/caddy/*.log"
    fi
}

# =============================================================================
# LOG VIEWING
# =============================================================================

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

# =============================================================================
# LOG STATISTICS
# =============================================================================

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
        awk -v name="$name" '"'"'
            { lines++ }
            /"level":"error"/ { errors++ }
            /"status":5/ { s5xx++ }
            END { printf "%-40s %6d lines, %4d errors, %4d 5xx\n", name, lines, errors+0, s5xx+0 }
        '"'"' "$f"
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
            _caddy_ssh "jq -r '.request.remote_ip // .request.client_ip // empty' $logfile 2>/dev/null | sort | uniq -c | sort -rn | head -n $n"
            ;;
        paths|path|uri)
            echo "=== Top $n Paths ==="
            _caddy_ssh "jq -r '.request.uri // empty' $logfile 2>/dev/null | sort | uniq -c | sort -rn | head -n $n"
            ;;
        codes|status)
            echo "=== Status Code Distribution ==="
            _caddy_ssh "jq -r '.status // empty' $logfile 2>/dev/null | sort | uniq -c | sort -rn | head -n $n"
            ;;
        ua|useragent|agents)
            echo "=== Top $n User Agents ==="
            _caddy_ssh "jq -r '.request.headers[\"User-Agent\"][0] // empty' $logfile 2>/dev/null | sort | uniq -c | sort -rn | head -n $n"
            ;;
        errors|err)
            echo "=== Top $n Error Sources ==="
            _caddy_ssh "jq -r 'select(.status >= 400) | \"\\(.status) \\(.request.remote_ip // \"?\") \\(.request.uri // \"?\")\"' $logfile 2>/dev/null | sort | uniq -c | sort -rn | head -n $n"
            ;;
        all|a)
            echo "=== Top $n Analysis (single pass) ==="
            _caddy_ssh "jq -r '[.request.remote_ip // .request.client_ip // \"-\", .request.uri // \"-\", (.status // 0 | tostring), .request.headers[\"User-Agent\"][0] // \"-\"] | @tsv' $logfile 2>/dev/null" | awk -F'\t' -v n="$n" '
                { ips[$1]++; paths[$2]++; codes[$3]++; uas[$4]++ }
                END {
                    print "--- IPs ---"
                    PROCINFO["sorted_in"]="@val_num_desc"
                    i=0; for(k in ips) { if(++i>n) break; printf "%7d %s\n", ips[k], k }
                    print "\n--- Paths ---"
                    i=0; for(k in paths) { if(++i>n) break; printf "%7d %s\n", paths[k], k }
                    print "\n--- Status Codes ---"
                    i=0; for(k in codes) { if(++i>n) break; printf "%7d %s\n", codes[k], k }
                    print "\n--- User Agents ---"
                    i=0; for(k in uas) { if(++i>n) break; printf "%7d %s\n", uas[k], k }
                }'
            ;;
        *)
            echo "Usage: tcaddy log top <ips|paths|codes|ua|errors|all> [count]"
            return 1
            ;;
    esac
}

# =============================================================================
# LOG EXPORT & ARCHIVE
# =============================================================================

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

# =============================================================================
# LOG POLICY
# =============================================================================

# Show Caddy's roll (rotation) settings
_caddy_logs_roll() {
    echo "=== Roll Settings ==="
    echo ""
    echo "Configured:"
    _caddy_ssh "grep -A10 'output file' /etc/caddy/Caddyfile 2>/dev/null | grep -E 'roll_|output file' | sed 's/^[ \t]*/  /' | head -20" || echo "  (using defaults)"
    echo ""
    echo "Caddy defaults:"
    echo "  roll_size      100 MiB"
    echo "  roll_keep      10 files"
    echo "  roll_keep_for  90 days (2160h)"
    echo "  compression    gzip"
    echo ""
    echo "Current files:"
    _caddy_ssh "ls -lhS /var/log/caddy/*.log* 2>/dev/null | head -10" || echo "  (none)"
}

# Show complete logging policy: roll, filter, alerts
_caddy_logs_policy() {
    local section="${1:-all}"

    case "$section" in
        roll|r)
            _caddy_logs_roll
            ;;
        filter|f)
            echo "=== Filter Policy ==="
            echo ""
            # Check for include/exclude directives
            _caddy_ssh "grep -E 'include|exclude|level|format' /etc/caddy/Caddyfile 2>/dev/null | grep -v '^#' | sed 's/^[ \t]*/  /' | head -20" || echo "  (no filters configured)"
            echo ""
            echo "Filter options:"
            echo "  level    INFO, WARN, ERROR"
            echo "  include  paths to log"
            echo "  exclude  paths to skip"
            ;;
        alert|a)
            echo "=== Alert Policy ==="
            echo ""
            # Check for any alert/notification config
            local alert_conf="$(_caddy_config_dir)/alerts.conf"
            if [[ -f "$alert_conf" ]]; then
                echo "Config: $alert_conf"
                cat "$alert_conf"
            else
                echo "(not configured)"
                echo ""
                echo "Create: $alert_conf"
                echo ""
                echo "  error_threshold=10      # errors per minute"
                echo "  5xx_threshold=5         # 5xx per minute"
                echo "  latency_threshold=2.0   # seconds"
                echo "  notify=slack,email"
            fi
            ;;
        all|*)
            echo "=== Log Policy ==="
            echo ""
            echo "ROLL:"
            _caddy_ssh "grep -A5 'output file' /etc/caddy/Caddyfile 2>/dev/null | grep -E 'roll_' | sed 's/^[ \t]*/  /' | head -5" || echo "  (defaults)"
            echo ""
            echo "FILTER:"
            _caddy_ssh "grep -E 'level|format' /etc/caddy/Caddyfile 2>/dev/null | grep -v '^#' | sed 's/^[ \t]*/  /' | head -3" || echo "  (all levels, json)"
            echo ""
            echo "ALERTS:"
            local alert_conf="$(_caddy_config_dir)/alerts.conf"
            if [[ -f "$alert_conf" ]]; then
                head -3 "$alert_conf" | sed 's/^/  /'
            else
                echo "  (not configured)"
            fi
            echo ""
            echo "tcaddy log policy <roll|filter|alert>"
            ;;
    esac
}

# =============================================================================
# EXPORTS
# =============================================================================

for _fn in $(declare -F | awk '$3 ~ /^_caddy_/ {print $3}'); do
    export -f "$_fn"
done
unset _fn
