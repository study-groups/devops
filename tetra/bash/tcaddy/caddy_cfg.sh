#!/usr/bin/env bash
# tcaddy/caddy_cfg.sh - Configuration commands
#
# Requires: caddy.sh (core helpers), caddy_api.sh (admin API)

# =============================================================================
# CONFIG COMMANDS
# =============================================================================

# Show config (Caddyfile or JSON from API)
# Usage: _caddy_config [--json]
_caddy_config() {
    local format="${1:-file}"
    local caddyfile=$(_caddy_caddyfile_path)
    local target=$(_caddy_ssh_target)

    # JSON format from admin API
    if [[ "$format" == "--json" || "$format" == "-j" ]]; then
        echo "=== Running Config (from admin API) ==="
        local config
        config=$(_caddy_api "config/")
        if [[ -n "$config" ]]; then
            echo "$config" | jq .
        else
            echo "(admin API not responding)"
        fi
        return
    fi

    # File format (Caddyfile)
    local site=$(_caddy_site)
    if [[ -n "$site" ]]; then
        # Show just the site block
        echo "=== $site config ==="
        if [[ "$target" == "localhost" ]]; then
            cat "$caddyfile" 2>/dev/null
        else
            _caddy_ssh "cat $caddyfile"
        fi | awk -v site="$site" '
            $0 ~ site"\\." { found=1 }
            found { print }
            found && /^}$/ { found=0 }
        '
    else
        # Show full config
        echo "=== Caddyfile ($caddyfile) ==="
        if [[ "$target" == "localhost" ]]; then
            cat "$caddyfile" 2>/dev/null || echo "(file not found)"
        else
            _caddy_ssh "cat $caddyfile"
        fi
    fi
}

# Validate config
_caddy_validate() {
    local caddyfile=$(_caddy_caddyfile_path)
    local target=$(_caddy_ssh_target)

    echo "=== Validating $caddyfile ==="
    if [[ "$target" == "localhost" ]]; then
        caddy validate --config "$caddyfile" 2>&1
    else
        _caddy_ssh "caddy validate --config $caddyfile" 2>&1
    fi
}

# Reload caddy (via admin API for local)
_caddy_reload() {
    local caddyfile=$(_caddy_caddyfile_path)
    local target=$(_caddy_ssh_target)

    echo "=== Reloading Caddy ==="

    if [[ "$target" == "localhost" ]]; then
        # Try admin API first (preferred method)
        if _caddy_api "config/" &>/dev/null; then
            echo "Using admin API to reload..."

            # Convert Caddyfile to JSON and POST to /load
            local json_config
            json_config=$(caddy adapt --config "$caddyfile" 2>/dev/null)

            if [[ -z "$json_config" ]]; then
                echo "Failed to adapt Caddyfile" >&2
                return 1
            fi

            local response
            response=$(curl -sf --max-time 10 \
                -X POST \
                -H "Content-Type: application/json" \
                -d "$json_config" \
                "http://localhost:${CADDY_ADMIN_PORT:-2019}/load" 2>&1)

            if [[ $? -eq 0 ]]; then
                echo "Config reloaded via admin API"
            else
                echo "Failed: $response" >&2
                return 1
            fi
        else
            # Fallback to signal
            if pgrep -f "caddy run" &>/dev/null; then
                caddy reload --config "$caddyfile" 2>&1 || \
                    (pkill -USR1 -f "caddy run" && echo "Reload signal sent")
            else
                echo "Caddy not running locally"
                return 1
            fi
        fi
    else
        _caddy_ssh "systemctl reload caddy && systemctl status caddy --no-pager" | head -15
    fi
}

# Format Caddyfile
_caddy_fmt() {
    local caddyfile=$(_caddy_caddyfile_path)
    local target=$(_caddy_ssh_target)

    echo "=== Formatting $caddyfile ==="
    if [[ "$target" == "localhost" ]]; then
        caddy fmt --overwrite "$caddyfile" && echo "Formatted."
    else
        _caddy_ssh "caddy fmt --overwrite $caddyfile && echo 'Formatted.'"
    fi
}

# =============================================================================
# DEPLOY COMMAND
# =============================================================================

# Deploy full caddy config tree (Caddyfile + modules/ + snippets) to remote
# Usage: _caddy_deploy [--dry-run|-n]
_caddy_deploy() {
    local dry_run=""
    local env=$(_caddy_env)
    local target=$(_caddy_ssh_target)

    # Parse flags
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --dry-run|-n) dry_run="-n"; shift ;;
            *) shift ;;
        esac
    done

    if [[ "$target" == "localhost" ]]; then
        echo "Cannot deploy to localhost" >&2
        return 1
    fi

    # Resolve local caddy dir
    local caddy_dir=$(_caddy_config_dir)
    local env_caddyfile="${caddy_dir}/${env}.Caddyfile"

    # Fall back to plain Caddyfile if env-specific doesn't exist
    if [[ ! -f "$env_caddyfile" ]]; then
        env_caddyfile="${caddy_dir}/Caddyfile"
    fi

    if [[ ! -f "$env_caddyfile" ]]; then
        echo "Caddyfile not found: $env_caddyfile" >&2
        return 1
    fi

    if [[ ! -d "$caddy_dir" ]]; then
        echo "Caddy dir not found: $caddy_dir" >&2
        return 1
    fi

    echo "=== Deploying to $target ==="
    echo "  Source:    $caddy_dir"
    echo "  Caddyfile: $(basename "$env_caddyfile")"
    echo "  Env:       $env"
    [[ -n "$dry_run" ]] && echo "  Mode:      DRY RUN"
    echo ""

    # Validate locally first (warn-only since remote paths may not exist locally)
    if command -v caddy &>/dev/null; then
        echo "Validating locally..."
        if ! caddy validate --config "$env_caddyfile" 2>&1; then
            echo "(local validation failed — may be due to remote-only paths)"
            echo "Will validate on remote after sync."
        fi
        echo ""
    fi

    # Stage the env-specific Caddyfile as "Caddyfile" in a temp dir for atomic rsync
    local stage_dir
    stage_dir=$(mktemp -d)
    rsync -a "${caddy_dir}/" "$stage_dir/"
    # Remove all env Caddyfiles, place the correct one as Caddyfile
    rm -f "$stage_dir"/*.Caddyfile "$stage_dir"/Caddyfile
    cp "$env_caddyfile" "$stage_dir/Caddyfile"

    echo "Syncing config tree (atomic)..."
    rsync -avz --delete $dry_run \
        --exclude='*.Caddyfile' \
        --exclude='*.bak*' \
        --temp-dir=/tmp \
        "${stage_dir}/" "${target}:/etc/caddy/"

    rm -rf "$stage_dir"

    if [[ -n "$dry_run" ]]; then
        echo ""
        echo "Dry run complete. Run without -n to deploy."
        return 0
    fi

    # Validate on remote
    echo ""
    echo "Validating on remote..."
    _caddy_ssh "caddy validate --config /etc/caddy/Caddyfile" || return 1

    # Reload
    echo "Reloading..."
    _caddy_ssh "systemctl reload caddy"

    echo ""
    echo "Deployed successfully"
}

# =============================================================================
# AUDIT COMMAND
# =============================================================================

# Compare local caddy config vs remote
# Usage: _caddy_audit
_caddy_audit() {
    local env=$(_caddy_env)
    local target=$(_caddy_ssh_target)

    if [[ "$target" == "localhost" ]]; then
        echo "Audit requires a remote target" >&2
        return 1
    fi

    local caddy_dir=$(_caddy_config_dir)
    local env_caddyfile="${caddy_dir}/${env}.Caddyfile"
    [[ ! -f "$env_caddyfile" ]] && env_caddyfile="${caddy_dir}/Caddyfile"

    echo "=== Caddy Config Audit ==="
    echo "  Local:  $caddy_dir"
    echo "  Remote: $target:/etc/caddy/"
    echo ""

    # Remote caddy version and uptime — single SSH call
    local remote_info
    remote_info=$(_caddy_ssh 'echo "VERSION=$(caddy version 2>/dev/null | head -1)"; echo "UPTIME=$(systemctl show caddy -p ActiveEnterTimestamp --value 2>/dev/null)"' 2>/dev/null)
    local remote_version remote_uptime
    remote_version=$(echo "$remote_info" | sed -n 's/^VERSION=//p')
    remote_uptime=$(echo "$remote_info" | sed -n 's/^UPTIME=//p')

    echo "Remote Caddy: ${remote_version:-unknown}"
    if [[ -n "$remote_uptime" ]]; then
        echo "Remote Since: $remote_uptime"
    fi

    # Local caddy version
    if command -v caddy &>/dev/null; then
        echo "Local Caddy:  $(caddy version 2>/dev/null | head -1)"
    fi
    echo ""

    # Compare Caddyfile
    echo "--- Caddyfile diff ---"
    local remote_caddyfile
    remote_caddyfile=$(_caddy_ssh "cat /etc/caddy/Caddyfile 2>/dev/null")
    if [[ -n "$remote_caddyfile" ]]; then
        diff <(cat "$env_caddyfile") <(echo "$remote_caddyfile") && echo "(identical)" || true
    else
        echo "(remote Caddyfile not found)"
    fi
    echo ""

    # Compare module files
    echo "--- Module files ---"
    local local_modules remote_modules
    local_modules=$(ls "$caddy_dir/modules/"*.caddy 2>/dev/null | xargs -n1 basename | sort)
    remote_modules=$(_caddy_ssh "ls /etc/caddy/modules/*.caddy 2>/dev/null | xargs -n1 basename | sort" 2>/dev/null)

    local local_count=$(echo "$local_modules" | grep -c . 2>/dev/null || echo 0)
    local remote_count=$(echo "$remote_modules" | grep -c . 2>/dev/null || echo 0)

    echo "  Local:  $local_count files"
    echo "  Remote: $remote_count files"

    if [[ "$local_modules" != "$remote_modules" ]]; then
        echo ""
        echo "  File list diff:"
        diff <(echo "$local_modules") <(echo "$remote_modules") | sed 's/^/    /' || true
    else
        echo "  File lists match"
    fi
    echo ""

    # Diff module files — single SSH call fetches all remote content as a tar stream
    local has_diff=false
    local remote_tmp
    remote_tmp=$(mktemp -d)

    # Batch fetch: one SSH call for all module files + snippets
    _caddy_ssh "tar -cf - -C /etc/caddy modules/ snippets.caddy 2>/dev/null || true" \
        | tar -xf - -C "$remote_tmp" 2>/dev/null || true

    while IFS= read -r mod; do
        [[ -z "$mod" ]] && continue
        local local_content remote_content
        local_content=$(cat "$caddy_dir/modules/$mod" 2>/dev/null)
        remote_content=$(cat "$remote_tmp/modules/$mod" 2>/dev/null)
        if [[ "$local_content" != "$remote_content" ]]; then
            has_diff=true
            echo "--- modules/$mod ---"
            diff <(echo "$local_content") <(echo "$remote_content") | head -20
            echo ""
        fi
    done <<< "$local_modules"

    # Check snippets.caddy
    if [[ -f "$caddy_dir/snippets.caddy" ]]; then
        local local_snip remote_snip
        local_snip=$(cat "$caddy_dir/snippets.caddy")
        remote_snip=$(cat "$remote_tmp/snippets.caddy" 2>/dev/null)
        if [[ "$local_snip" != "$remote_snip" ]]; then
            has_diff=true
            echo "--- snippets.caddy ---"
            diff <(echo "$local_snip") <(echo "$remote_snip") | head -20
            echo ""
        fi
    fi

    rm -rf "$remote_tmp"

    if [[ "$has_diff" == false ]]; then
        echo "All module files match."
    fi
}

# =============================================================================
# MAP COMMAND
# =============================================================================

# Parse Caddyfile modules and display proxy/backend map
# Usage: _caddy_map
_caddy_map() {
    local org=$(_caddy_org)
    local env=$(_caddy_env)
    local caddy_dir=$(_caddy_config_dir)
    local env_caddyfile="${caddy_dir}/${env}.Caddyfile"
    [[ ! -f "$env_caddyfile" ]] && env_caddyfile="${caddy_dir}/Caddyfile"

    if [[ ! -f "$env_caddyfile" ]]; then
        echo "Caddyfile not found: $env_caddyfile" >&2
        return 1
    fi

    # Resolve all imports into a single stream
    local full_config=""
    while IFS= read -r line; do
        if [[ "$line" =~ ^[[:space:]]*import[[:space:]]+(.*) ]]; then
            local import_path="${BASH_REMATCH[1]}"
            # Resolve relative to caddy_dir
            local resolved="${caddy_dir}/${import_path}"
            # Expand globs
            for f in $resolved; do
                [[ -f "$f" ]] && full_config+=$'\n'"$(cat "$f")"
            done
        else
            full_config+=$'\n'"$line"
        fi
    done < "$env_caddyfile"

    local domain=$(_caddy_domain)
    local title="${org^^} ${env^} Proxy Map"
    [[ -n "$domain" ]] && title+=" ($domain)"

    echo "$title"
    printf '═%.0s' $(seq 1 ${#title})
    echo ""

    # Parse site blocks and their routes using awk
    echo "$full_config" | awk '
    BEGIN { site=""; indent=0 }

    # Site block header (line starting with a domain, not inside braces)
    /^[a-zA-Z0-9].*\{/ && indent == 0 {
        site = $1
        gsub(/\{/, "", site)
        indent = 1
        printf "\n  %s\n", site
        next
    }

    # Track brace depth
    /\{/ && indent > 0 { indent++ }
    /\}/ && indent > 0 {
        indent--
        if (indent == 0) site = ""
        next
    }

    # handle path { ... reverse_proxy target }
    /handle_path|handle/ && indent > 0 {
        # Extract path matcher
        match($0, /handle(_path)?\s+([^ {]+)/, m)
        if (m[2] != "") {
            current_path = m[2]
        } else {
            current_path = "/*"
        }
    }

    # reverse_proxy lines
    /reverse_proxy/ && indent > 0 {
        match($0, /reverse_proxy\s+([^ }]+)/, m)
        if (m[1] != "") {
            target = m[1]
            # Use current_path if set from handle block
            p = (current_path != "") ? current_path : "/*"
            printf "    %-20s → %s\n", p, target
            current_path = ""
        }
    }

    # file_server lines
    /file_server/ && indent > 0 {
        p = (current_path != "") ? current_path : "/*"
        # Check for root directive nearby
        printf "    %-20s → [file_server]\n", p
        current_path = ""
    }

    # basic_auth annotation
    /basic_auth/ && indent > 0 {
        # Note it for the next route
    }
    '
    echo ""
}

# =============================================================================
# EXPORTS
# =============================================================================

for _fn in $(declare -F | awk '$3 ~ /^_caddy_/ {print $3}'); do
    export -f "$_fn"
done
unset _fn
