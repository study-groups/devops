#!/usr/bin/env bash
# tcaddy/caddy_svc.sh - Service and status commands
#
# Requires: caddy.sh (core helpers)

# =============================================================================
# STATUS COMMANDS
# =============================================================================

# Show caddy service status (uses admin API when available)
_caddy_status() {
    local target
    target=$(_caddy_ssh_target)
    echo "=== Caddy Status on $target ==="

    # Try admin API first
    local api_status
    api_status=$(_caddy_api "config/" 2>/dev/null)

    if [[ -n "$api_status" ]]; then
        echo "Admin API: responding on port ${CADDY_ADMIN_PORT:-2019}"
        echo ""

        # Extract info from API
        local apps servers
        apps=$(echo "$api_status" | jq -r '.apps | keys | join(", ")' 2>/dev/null)
        servers=$(echo "$api_status" | jq -r '.apps.http.servers | keys | length' 2>/dev/null)

        echo "Apps: ${apps:-none}"
        echo "HTTP Servers: ${servers:-0}"
        echo ""

        # Show listening addresses
        echo "Listeners:"
        echo "$api_status" | jq -r '.apps.http.servers | to_entries[] | "  \(.key): \(.value.listen // ["default"] | join(", "))"' 2>/dev/null
    else
        echo "Admin API: not responding"
        echo ""
        # Fall back to systemctl for remote
        if ! _caddy_is_local; then
            _caddy_ssh "systemctl status caddy --no-pager -l" 2>/dev/null | head -15
        else
            echo "Caddy may not be running. Start with:"
            echo "  caddy run --config \$(_caddy_caddyfile_path)"
        fi
    fi
}

# Show caddy version
_caddy_version() {
    if _caddy_is_local; then
        caddy version 2>/dev/null || echo "Caddy not found in PATH"
    else
        _caddy_ssh "caddy version"
    fi
}

# Test if caddy is running (via admin API)
_caddy_ping() {
    local target
    target=$(_caddy_ssh_target)

    # Try admin API
    if _caddy_api "config/" &>/dev/null; then
        echo "Caddy is running on $target (admin API responding)"
        return 0
    fi

    # Fall back to process check
    if _caddy_is_local; then
        if pgrep -f "caddy run" &>/dev/null; then
            echo "Caddy process running but admin API not responding"
            return 0
        fi
    else
        if _caddy_ssh "systemctl is-active caddy" &>/dev/null; then
            echo "Caddy is running on $target (systemd)"
            return 0
        fi
    fi

    echo "Caddy is NOT running on $target"
    return 1
}

# Show paths, modules, file info
_caddy_info() {
    local target=$(_caddy_ssh_target)
    local org=$(_caddy_org)
    local caddyfile=$(_caddy_caddyfile_path)
    local logfile=$(_caddy_logfile)

    echo "=== Caddy Info ==="
    echo ""
    echo "Context:"
    echo "  Target:   $target"
    echo "  Org:      $org"
    echo ""
    echo "Paths:"
    echo "  Caddyfile: $caddyfile"
    echo "  Logs:      $logfile"

    if [[ "$target" == "localhost" ]]; then
        local modules_dir="$(_caddy_config_dir)/modules"
        echo "  Modules:   $modules_dir"
        echo ""

        # Check file existence
        echo "Files:"
        if [[ -f "$caddyfile" ]]; then
            echo "  Caddyfile: exists ($(wc -l < "$caddyfile" | xargs) lines)"
        else
            echo "  Caddyfile: NOT FOUND"
        fi

        if [[ -d "$modules_dir" ]]; then
            local mod_count=$(ls "$modules_dir"/*.caddy 2>/dev/null | wc -l | xargs)
            echo "  Modules:   $mod_count files"
            if [[ "$mod_count" -gt 0 ]]; then
                ls "$modules_dir"/*.caddy 2>/dev/null | xargs -n1 basename | sed 's/^/    /'
            fi
        else
            echo "  Modules:   (none)"
        fi

        if [[ -f "$logfile" ]]; then
            echo "  Log:       exists ($(du -h "$logfile" | cut -f1))"
        else
            echo "  Log:       NOT FOUND"
        fi
    else
        echo "  Modules:   /etc/caddy/modules"
        echo ""

        echo "Files:"
        _caddy_ssh "
            if [ -f $caddyfile ]; then
                echo \"  Caddyfile: exists (\$(wc -l < $caddyfile) lines)\"
            else
                echo \"  Caddyfile: NOT FOUND\"
            fi

            if [ -d /etc/caddy/modules ]; then
                count=\$(ls /etc/caddy/modules/*.caddy 2>/dev/null | wc -l)
                echo \"  Modules:   \$count files\"
                ls /etc/caddy/modules/*.caddy 2>/dev/null | xargs -n1 basename | sed 's/^/    /'
            else
                echo \"  Modules:   (none)\"
            fi

            if ls /var/log/caddy/*.log &>/dev/null; then
                echo \"  Logs:      \$(du -sh /var/log/caddy 2>/dev/null | cut -f1) total\"
                ls -lh /var/log/caddy/*.log 2>/dev/null | awk '{print \"    \" \$9 \" (\" \$5 \")\"}' | head -5
            else
                echo \"  Logs:      (none)\"
            fi
        "
    fi
}

# Humanize elapsed time from ps etime format (dd-hh:mm:ss or hh:mm:ss or mm:ss)
_caddy_humanize_etime() {
    local etime="$1"
    local days=0 hours=0 mins=0 secs=0

    # dd-hh:mm:ss
    if [[ "$etime" =~ ^([0-9]+)-([0-9]+):([0-9]+):([0-9]+)$ ]]; then
        days=${BASH_REMATCH[1]} hours=${BASH_REMATCH[2]}
        mins=${BASH_REMATCH[3]} secs=${BASH_REMATCH[4]}
    # hh:mm:ss
    elif [[ "$etime" =~ ^([0-9]+):([0-9]+):([0-9]+)$ ]]; then
        hours=${BASH_REMATCH[1]} mins=${BASH_REMATCH[2]} secs=${BASH_REMATCH[3]}
    # mm:ss
    elif [[ "$etime" =~ ^([0-9]+):([0-9]+)$ ]]; then
        mins=${BASH_REMATCH[1]} secs=${BASH_REMATCH[2]}
    else
        echo "$etime"; return
    fi

    # Remove leading zeros for arithmetic
    days=$((10#$days)) hours=$((10#$hours)) mins=$((10#$mins))

    local parts=()
    ((days > 0)) && parts+=("${days}d")
    ((hours > 0)) && parts+=("${hours}h")
    ((mins > 0)) && parts+=("${mins}m")
    ((${#parts[@]} == 0)) && parts+=("${secs}s")
    echo "${parts[*]}"
}

# Show resource usage (CPU, memory, disk)
_caddy_resources() {
    local target=$(_caddy_ssh_target)

    echo "=== Caddy Resources ==="
    echo ""

    if [[ "$target" == "localhost" ]]; then
        local pid=$(pgrep -f "caddy run" 2>/dev/null | head -1)
        if [[ -n "$pid" ]]; then
            echo "Process: PID $pid"
            local ps_out
            ps_out=$(ps -p "$pid" -o %cpu,%mem,rss,vsz,etime --no-headers 2>/dev/null)
            local cpu mem rss vsz etime
            read -r cpu mem rss vsz etime <<< "$ps_out"
            printf "  CPU:      %s%%\n" "$cpu"
            printf "  Memory:   %s%% (%d MB RSS)\n" "$mem" "$(( ${rss:-0} / 1024 ))"
            printf "  Uptime:   %s\n" "$(_caddy_humanize_etime "$etime")"

            # Open files
            local open_files=$(lsof -p "$pid" 2>/dev/null | wc -l | xargs)
            echo "  Files:    $open_files open"
        else
            echo "Caddy not running locally"
        fi

        # Log disk usage
        local logfile=$(_caddy_logfile)
        if [[ -f "$logfile" ]]; then
            echo ""
            echo "Log: $logfile"
            echo "  Size:     $(du -h "$logfile" | cut -f1)"
            echo "  Lines:    $(wc -l < "$logfile" | xargs)"
        fi
    else
        _caddy_ssh '
            humanize_etime() {
                local e="$1" d=0 h=0 m=0 s=0
                if [[ "$e" =~ ^([0-9]+)-([0-9]+):([0-9]+):([0-9]+)$ ]]; then
                    d=${BASH_REMATCH[1]} h=${BASH_REMATCH[2]} m=${BASH_REMATCH[3]} s=${BASH_REMATCH[4]}
                elif [[ "$e" =~ ^([0-9]+):([0-9]+):([0-9]+)$ ]]; then
                    h=${BASH_REMATCH[1]} m=${BASH_REMATCH[2]} s=${BASH_REMATCH[3]}
                elif [[ "$e" =~ ^([0-9]+):([0-9]+)$ ]]; then
                    m=${BASH_REMATCH[1]} s=${BASH_REMATCH[2]}
                else
                    echo "$e"; return
                fi
                d=$((10#$d)) h=$((10#$h)) m=$((10#$m))
                local out=""
                ((d>0)) && out="${d}d "
                ((h>0)) && out+="${h}h "
                ((m>0)) && out+="${m}m"
                [ -z "$out" ] && out="${s}s"
                echo "$out"
            }

            pid=$(pgrep -f "caddy" | head -1)
            if [ -n "$pid" ]; then
                echo "Process: PID $pid"
                read cpu mem rss vsz etime <<< $(ps -p $pid -o %cpu,%mem,rss,vsz,etime --no-headers 2>/dev/null)
                printf "  CPU:      %s%%\n" "$cpu"
                printf "  Memory:   %s%% (%d MB RSS)\n" "$mem" "$(( ${rss:-0} / 1024 ))"
                printf "  Uptime:   %s\n" "$(humanize_etime "$etime")"

                open_files=$(lsof -p $pid 2>/dev/null | wc -l)
                echo "  Files:    $open_files open"
            else
                echo "Caddy not running"
            fi

            echo ""
            echo "Logs: /var/log/caddy/"
            du -sh /var/log/caddy 2>/dev/null | awk "{print \"  Total:    \" \$1}"
            ls -lhS /var/log/caddy/*.log 2>/dev/null | head -5 | awk "{print \"  \" \$9 \": \" \$5}"
        '
    fi
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
# EXPORTS
# =============================================================================

for _fn in $(declare -F | awk '$3 ~ /^_caddy_/ {print $3}'); do
    export -f "$_fn"
done
unset _fn
