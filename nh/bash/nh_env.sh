#!/usr/bin/env bash
# nh_env.sh - Environment variable management for server IPs
#
# Parses digocean.json and exports server IPs as shell variables:
#   $servername        - Public IP
#   $servername_private - Private IP
#   $servername_floating - Floating IP

# =============================================================================
# IP EXTRACTION (from digocean.json)
# =============================================================================

# Get public IPs as export statements
_nh_get_public_ips() {
    local json="$1"
    jq -r '
        .[]
        | select(.Droplets != null)
        | .Droplets[]
        | "export " + (.name | gsub("-"; "_")) + "="
          + (.networks.v4
              | map(select(.type == "public"))
              | .[0].ip_address)
          + "  # " + .region.slug + ", "
          + (.memory | tostring) + "MB"
    ' "$json" 2>/dev/null
}

# Get private IPs as export statements
_nh_get_private_ips() {
    local json="$1"
    jq -r '
        .[]
        | select(.Droplets != null)
        | .Droplets[]
        | "export " + (.name | gsub("-"; "_")) + "_private="
          + (.networks.v4[]
              | select(.type == "private")
              | .ip_address)
          + "  # private"
    ' "$json" 2>/dev/null
}

# Get floating IPs as export statements
_nh_get_floating_ips() {
    local json="$1"
    jq -r '
        .[]
        | select(.FloatingIPs != null)
        | .FloatingIPs[]
        | "export " + (.droplet.name | gsub("-"; "_") + "_floating")
          + "=" + .ip
          + "  # floating"
    ' "$json" 2>/dev/null
}

# =============================================================================
# LOAD/SHOW ENVIRONMENT
# =============================================================================

# Load all server IPs into environment
nh_env_load() {
    local ctx="${DIGITALOCEAN_CONTEXT:-}"
    [[ -z "$ctx" ]] && { echo "No context set"; return 1; }

    local json="$NH_DIR/$ctx/digocean.json"
    [[ ! -f "$json" ]] && { echo "No data. Run: nh fetch"; return 1; }

    local env_file="$NH_DIR/$ctx/digocean.env"

    {
        _nh_get_public_ips "$json"
        _nh_get_private_ips "$json"
        _nh_get_floating_ips "$json"
    } > "$env_file"

    source "$env_file"
}

# Show all server variables (without sourcing)
nh_env_show() {
    local filter="${1:-}"
    local ctx="${DIGITALOCEAN_CONTEXT:-}"
    [[ -z "$ctx" ]] && { echo "No context set"; return 1; }

    local json="$NH_DIR/$ctx/digocean.json"
    [[ ! -f "$json" ]] && { echo "No data. Run: nh fetch"; return 1; }

    {
        _nh_get_public_ips "$json"
        _nh_get_private_ips "$json"
        _nh_get_floating_ips "$json"
    } | if [[ -n "$filter" ]]; then
        grep "$filter"
    else
        cat
    fi
}

# Count loaded server variables
nh_env_count() {
    local ctx="${DIGITALOCEAN_CONTEXT:-}"
    [[ -z "$ctx" ]] && { echo "0"; return; }

    local json="$NH_DIR/$ctx/digocean.json"
    [[ ! -f "$json" ]] && { echo "0"; return; }

    local count=$(jq '[.[] | select(.Droplets) | .Droplets[]] | length' "$json" 2>/dev/null)
    echo "${count:-0}"
}

# List server names (for completion)
nh_env_names() {
    local ctx="${DIGITALOCEAN_CONTEXT:-}"
    [[ -z "$ctx" ]] && return

    local json="$NH_DIR/$ctx/digocean.json"
    [[ ! -f "$json" ]] && return

    jq -r '.[] | select(.Droplets) | .Droplets[] | .name | gsub("-"; "_")' "$json" 2>/dev/null
}

# =============================================================================
# SHORT VARIABLE NAMES
# =============================================================================

# Generate short variable names
# - Letter+digit parts kept as-is: do4_n2 -> do4n2
# - Word parts abbreviated to first char: pxjam_arcade -> pa
nh_env_short() {
    local prefix="$1"

    [[ -z "$prefix" ]] && {
        echo "Usage: nh env short <prefix>"
        echo "Example: nh env short pxjam"
        return 1
    }

    declare -A used_vars

    while IFS='=' read -r varname value; do
        # Strip "export " prefix
        varname="${varname#export }"

        [[ "$varname" =~ ^$prefix ]] || continue

        # Base name without _private or _floating suffix
        local base="${varname%_private}"
        base="${base%_floating}"

        # Generate abbreviation from parts
        local newvar=""
        IFS='_' read -ra parts <<< "$base"
        for part in "${parts[@]}"; do
            # Keep letter+digit patterns (do4, n2, etc), abbreviate words
            if [[ "$part" =~ ^[a-zA-Z]+[0-9]+$ ]]; then
                newvar+="$part"
            else
                newvar+="${part:0:1}"
            fi
        done

        # Add suffix for private/floating
        [[ "$varname" == *_private ]] && newvar+="p"
        [[ "$varname" == *_floating ]] && newvar+="f"

        # Strip comment from value
        value="${value%%#*}"
        value="${value%% }"

        # Ensure uniqueness
        local count=1
        local original="$newvar"
        while [[ -n "${used_vars[$newvar]}" ]]; do
            newvar="${original}${count}"
            ((count++))
        done
        used_vars[$newvar]=1

        printf "export %s=%s  # %s\n" "$newvar" "$value" "$varname"
    done < <(nh_env_show)
}

# Load short vars (writes to temp file and sources)
nh_env_short_load() {
    local prefix="$1"
    [[ -z "$prefix" ]] && { echo "Usage: nh env short load <prefix>"; return 1; }

    local tmpfile="/tmp/nh_short_vars.env"
    nh_env_short "$prefix" > "$tmpfile"
    source "$tmpfile"
    echo "Loaded short variables from $tmpfile"
}

# Export functions
export -f _nh_get_public_ips _nh_get_private_ips _nh_get_floating_ips
export -f nh_env_load nh_env_show nh_env_count nh_env_names
export -f nh_env_short nh_env_short_load
