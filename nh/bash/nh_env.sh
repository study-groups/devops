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
# ALIAS MANAGEMENT (short variable names)
# =============================================================================

# Alias file location for current context
_nh_alias_file() {
    local ctx="${DIGITALOCEAN_CONTEXT:-}"
    [[ -z "$ctx" ]] && return 1
    echo "$NH_DIR/$ctx/aliases.env"
}

# Generate alias mapping: full_name -> short_name -> ip
# - Letter+digit parts kept as-is: do4_n2 -> do4n2
# - Word parts abbreviated to first char: pxjam_arcade_qa01 -> paq
_nh_generate_alias() {
    local varname="$1"

    # Base name without _private or _floating suffix
    local base="${varname%_private}"
    base="${base%_floating}"

    # Generate abbreviation from parts
    local alias=""
    IFS='_' read -ra parts <<< "$base"
    for part in "${parts[@]}"; do
        # Keep letter+digit patterns (do4, n2, etc), abbreviate words
        if [[ "$part" =~ ^[a-zA-Z]+[0-9]+$ ]]; then
            alias+="$part"
        else
            alias+="${part:0:1}"
        fi
    done

    # Add suffix for private/floating
    [[ "$varname" == *_private ]] && alias+="p"
    [[ "$varname" == *_floating ]] && alias+="f"

    echo "$alias"
}

# nh alias show <prefix> - Preview aliases without loading
nh_alias_show() {
    local prefix="$1"

    [[ -z "$prefix" ]] && {
        echo "Usage: nh alias show <prefix>"
        echo "Example: nh alias show pxjam"
        return 1
    }

    echo "Alias preview for prefix '$prefix':"
    echo ""
    printf "  %-28s  %-8s  %s\n" "FULL NAME" "ALIAS" "IP"
    printf "  %s\n" "--------------------------------------------------------"

    declare -A used_aliases
    local count=0

    while IFS='=' read -r varname value; do
        varname="${varname#export }"
        [[ "$varname" =~ ^$prefix ]] || continue

        # Strip comment from value
        value="${value%%#*}"
        value="${value%% }"

        # Generate alias
        local alias=$(_nh_generate_alias "$varname")

        # Handle collisions
        local original="$alias"
        local collision=1
        while [[ -n "${used_aliases[$alias]}" ]]; do
            alias="${original}${collision}"
            ((collision++))
        done
        used_aliases[$alias]=1

        # Determine suffix type
        local suffix=""
        [[ "$varname" == *_private ]] && suffix="(private)"
        [[ "$varname" == *_floating ]] && suffix="(floating)"

        printf "  %-28s  \$%-7s  %s %s\n" "$varname" "$alias" "$value" "$suffix"
        ((count++))
    done < <(nh_env_show)

    echo ""
    echo "$count aliases available. Run 'nh alias make $prefix' to load."
}

# nh alias make <prefix> - Create and load aliases
nh_alias_make() {
    local prefix="$1"

    [[ -z "$prefix" ]] && {
        echo "Usage: nh alias make <prefix>"
        echo "Example: nh alias make pxjam"
        return 1
    }

    local alias_file=$(_nh_alias_file)
    [[ -z "$alias_file" ]] && { echo "No context set"; return 1; }

    echo "Creating aliases for prefix '$prefix':"
    echo ""

    declare -A used_aliases
    local count=0

    # Write header
    {
        echo "# NH Aliases - generated $(date '+%Y-%m-%d %H:%M')"
        echo "# Prefix: $prefix"
        echo "# Source: nh alias make $prefix"
        echo ""
    } > "$alias_file"

    while IFS='=' read -r varname value; do
        varname="${varname#export }"
        [[ "$varname" =~ ^$prefix ]] || continue

        # Strip comment from value
        value="${value%%#*}"
        value="${value%% }"

        # Generate alias
        local alias=$(_nh_generate_alias "$varname")

        # Handle collisions
        local original="$alias"
        local collision=1
        while [[ -n "${used_aliases[$alias]}" ]]; do
            alias="${original}${collision}"
            ((collision++))
        done
        used_aliases[$alias]=1

        # Determine suffix type
        local suffix=""
        [[ "$varname" == *_private ]] && suffix="(private)"
        [[ "$varname" == *_floating ]] && suffix="(floating)"

        # Write to file
        echo "export $alias=$value  # $varname" >> "$alias_file"

        # Display mapping
        printf "  %-28s → \$%-7s = %s %s\n" "$varname" "$alias" "$value" "$suffix"
        ((count++))
    done < <(nh_env_show)

    # Source the file
    source "$alias_file"

    echo ""
    echo "$count aliases loaded. Use: ssh root@\$paq"
    echo "File: $alias_file"
}

# nh alias clear - Remove loaded aliases
nh_alias_clear() {
    local alias_file=$(_nh_alias_file)

    if [[ -z "$alias_file" || ! -f "$alias_file" ]]; then
        echo "No aliases file found"
        return 0
    fi

    local count=0
    while IFS='=' read -r varname _; do
        varname="${varname#export }"
        [[ -z "$varname" || "$varname" == \#* ]] && continue
        unset "$varname"
        ((count++))
    done < "$alias_file"

    rm -f "$alias_file"
    echo "Cleared $count aliases"
}

# nh alias (no args) - Show current aliases status
nh_alias_status() {
    local alias_file=$(_nh_alias_file)

    if [[ -z "$alias_file" ]]; then
        echo "No context set. Run: nh switch <context>"
        return 1
    fi

    if [[ ! -f "$alias_file" ]]; then
        echo "No aliases loaded."
        echo "Run: nh alias make <prefix>"
        return 0
    fi

    echo "Current aliases ($alias_file):"
    echo ""
    grep -v '^#' "$alias_file" | grep -v '^$' | while IFS='=' read -r varname value; do
        varname="${varname#export }"
        local comment="${value#*# }"
        value="${value%%#*}"
        value="${value%% }"
        printf "  \$%-8s = %-16s  # %s\n" "$varname" "$value" "$comment"
    done
}

# Main alias dispatcher
nh_alias() {
    local cmd="${1:-}"
    shift 2>/dev/null || true

    case "$cmd" in
        make|m)     nh_alias_make "$@" ;;
        show|s)     nh_alias_show "$@" ;;
        clear|c)    nh_alias_clear ;;
        "")         nh_alias_status ;;
        *)
            echo "Unknown alias command: $cmd"
            echo "Usage: nh alias {make|show|clear} [prefix]"
            return 1
            ;;
    esac
}

# Legacy compatibility (deprecated)
nh_env_short() {
    echo "DEPRECATED: Use 'nh alias show <prefix>' instead"
    nh_alias_show "$@"
}

nh_env_short_load() {
    echo "DEPRECATED: Use 'nh alias make <prefix>' instead"
    nh_alias_make "$@"
}

# Export functions
export -f _nh_get_public_ips _nh_get_private_ips _nh_get_floating_ips
export -f nh_env_load nh_env_show nh_env_count nh_env_names
export -f _nh_alias_file _nh_generate_alias
export -f nh_alias nh_alias_make nh_alias_show nh_alias_clear nh_alias_status
export -f nh_env_short nh_env_short_load
