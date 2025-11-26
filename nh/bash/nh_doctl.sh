#!/usr/bin/env bash
# nh_doctl.sh - DigitalOcean API operations via doctl
#
# Fetches infrastructure data and stores as digocean.json

# =============================================================================
# STATUS
# =============================================================================

nh_doctl_status() {
    echo "doctl Status"
    echo "============"
    echo ""
    echo "NH_DIR: $NH_DIR"
    echo "DIGITALOCEAN_CONTEXT: ${DIGITALOCEAN_CONTEXT:-not set}"
    echo ""
    echo "Available contexts:"
    doctl auth list 2>/dev/null || echo "  (doctl not configured)"
    echo ""
    echo "Run: doctl auth init --context <name>"
}

# =============================================================================
# FETCH INFRASTRUCTURE
# =============================================================================

# Resource types to fetch (name:command pairs)
_NH_FETCH_RESOURCES=(
    "Droplets:doctl compute droplet list --output json"
    "Volumes:doctl compute volume list --output json"
    "PrivateImages:doctl compute image list --public=false --output json"
    "Domains:doctl compute domain list --output json"
    "FloatingIPs:doctl compute floating-ip list --output json"
    "LoadBalancers:doctl compute load-balancer list --output json"
    "KubernetesClusters:doctl kubernetes cluster list --output json"
)

# Show what fetch would do without executing
nh_doctl_fetch_dry() {
    local ctx="${DIGITALOCEAN_CONTEXT:-}"

    echo "nh fetch --dry-run"
    echo "==================="
    echo ""
    echo "Context:  ${ctx:-<not set>}"
    echo "NH_DIR:   $NH_DIR"

    if [[ -z "$ctx" ]]; then
        echo ""
        echo "ERROR: No context set. Run: nh switch <context>"
        return 1
    fi

    local output_file="$NH_DIR/$ctx/digocean.json"
    echo "Output:   $output_file"
    echo ""

    # Check if output dir exists
    local output_dir="$(dirname "$output_file")"
    if [[ -d "$output_dir" ]]; then
        echo "Directory exists: $output_dir"
    else
        echo "Will create: $output_dir"
    fi

    # Check if file exists
    if [[ -f "$output_file" ]]; then
        local age=$(nh_json_age "$output_file")
        echo "Existing file: $age days old (will be overwritten)"
    else
        echo "New file: will be created"
    fi

    echo ""
    echo "Commands to execute:"
    echo "--------------------"

    for entry in "${_NH_FETCH_RESOURCES[@]}"; do
        local name="${entry%%:*}"
        local cmd="${entry#*:}"
        printf "  %-20s %s\n" "$name:" "$cmd"
    done

    echo ""
    echo "Output format: JSON array with objects keyed by resource type"
    echo ""
    echo "Run 'nh fetch' to execute (without --dry-run)"
}

# Fetch all infrastructure data from DigitalOcean
nh_doctl_fetch() {
    local dry_run=0

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --dry-run|-n)
                dry_run=1
                shift
                ;;
            *)
                echo "Unknown option: $1"
                echo "Usage: nh fetch [--dry-run|-n]"
                return 1
                ;;
        esac
    done

    # Handle dry run
    if [[ $dry_run -eq 1 ]]; then
        nh_doctl_fetch_dry
        return $?
    fi

    local ctx="${DIGITALOCEAN_CONTEXT:-}"
    [[ -z "$ctx" ]] && { echo "No context. Run: nh switch <context>"; return 1; }

    local output_file="$NH_DIR/$ctx/digocean.json"
    local output_dir="$(dirname "$output_file")"

    echo "Fetching infrastructure from DigitalOcean"
    echo "=========================================="
    echo ""
    echo "Context: $ctx"
    echo "Output:  $output_file"
    echo ""

    # Create directory if needed
    if [[ ! -d "$output_dir" ]]; then
        echo "Creating: $output_dir"
        mkdir -p "$output_dir"
    fi

    # Fetch each resource type
    local total=${#_NH_FETCH_RESOURCES[@]}
    local current=0
    local json_parts=()

    for entry in "${_NH_FETCH_RESOURCES[@]}"; do
        ((current++))
        local name="${entry%%:*}"
        local cmd="${entry#*:}"

        printf "[%d/%d] Fetching %s... " "$current" "$total" "$name"

        local result
        if result=$(eval "$cmd" 2>&1); then
            json_parts+=("{ \"$name\": $result }")
            echo "ok"
        else
            echo "failed"
            echo "  Command: $cmd"
            echo "  Error: $result"
            json_parts+=("{ \"$name\": [] }")
        fi
    done

    echo ""

    # Combine into single JSON array
    {
        echo "["
        local first=1
        for part in "${json_parts[@]}"; do
            [[ $first -eq 0 ]] && echo ","
            echo "$part"
            first=0
        done
        echo "]"
    } > "$output_file"

    # Report results
    local lines=$(wc -l < "$output_file" | tr -d ' ')
    local size=$(du -h "$output_file" | cut -f1)
    echo "Wrote: $output_file ($lines lines, $size)"
    echo ""

    # Auto-load environment variables
    echo "Loading environment variables..."
    nh_env_load

    echo ""
    echo "Done. Run 'nh servers' to see results."
}

# =============================================================================
# DROPLETS
# =============================================================================

nh_doctl_droplets() {
    echo "Live droplets from DigitalOcean:"
    echo ""

    doctl compute droplet list --format ID,Name,PublicIPv4,PrivateIPv4,Memory,Region,Tags
}

# =============================================================================
# CAT JSON
# =============================================================================

nh_doctl_cat() {
    local ctx="${DIGITALOCEAN_CONTEXT:-}"

    [[ -z "$ctx" ]] && { echo "No context set"; return 1; }

    local json="$NH_DIR/$ctx/digocean.json"

    [[ ! -f "$json" ]] && { echo "No data. Run: nh fetch"; return 1; }

    jq . "$json"
}

# =============================================================================
# CLEAN (remove verbose fields)
# =============================================================================

nh_doctl_clean() {
    local ctx="${DIGITALOCEAN_CONTEXT:-}"
    [[ -z "$ctx" ]] && { echo "No context set"; return 1; }

    local json="$NH_DIR/$ctx/digocean.json"
    local clean="$NH_DIR/$ctx/digocean_clean.json"

    [[ ! -f "$json" ]] && { echo "No data. Run: nh fetch"; return 1; }

    jq 'walk(
        if type == "object" then
            del(.sizes, .features, .regions) |
            if .PrivateImages? then
                .PrivateImages |= map(select(.slug | not))
            else
                .
            end
        else
            .
        end
    )' "$json" > "$clean"

    local lines=$(wc -l < "$clean")
    echo "Cleaned JSON: $clean ($lines lines)"
}

# =============================================================================
# AGE (show digocean.json age)
# =============================================================================

nh_doctl_age() {
    local ctx="${DIGITALOCEAN_CONTEXT:-}"
    [[ -z "$ctx" ]] && { echo "No context set"; return 1; }

    local json="$NH_DIR/$ctx/digocean.json"
    [[ ! -f "$json" ]] && { echo "No data. Run: nh fetch"; return 1; }

    local age=$(nh_json_age "$json")
    local modified
    if stat -f "%Sm" "$json" >/dev/null 2>&1; then
        modified=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$json")
    else
        modified=$(stat -c "%y" "$json" 2>/dev/null | cut -d. -f1)
    fi

    echo "digocean.json: $age days old"
    echo "Last updated: $modified"
    echo "Location: $json"

    [[ $age -gt 7 ]] && echo "Consider: nh fetch"
}

# =============================================================================
# RESOURCES (summary counts)
# =============================================================================

nh_doctl_resources() {
    local ctx="${DIGITALOCEAN_CONTEXT:-}"
    [[ -z "$ctx" ]] && { echo "No context set"; return 1; }

    local json="$NH_DIR/$ctx/digocean.json"
    [[ ! -f "$json" ]] && { echo "No data. Run: nh fetch"; return 1; }

    echo "Resources in $ctx:"
    jq -r '.[] | to_entries[] | select(.value | type == "array") |
        "  \(.key): \(.value | length)"' "$json"
}

# =============================================================================
# INFO (explain pipeline)
# =============================================================================

nh_doctl_info() {
    local ctx="${DIGITALOCEAN_CONTEXT:-}"
    local json="$NH_DIR/${ctx:-<context>}/digocean.json"

    cat << EOF
nh doctl info - Infrastructure Pipeline

DATA FLOW
    doctl API  ->  digocean.json  ->  env vars  ->  tetra.toml
    (live)         (cached)          (shell)       (deployment)

DIGOCEAN.JSON ($json)
    Contains: Droplets, Volumes, Images, Domains, FloatingIPs, LBs, K8s
    Created by: nh fetch (calls doctl compute * list --output json)
    Used by: nh servers, nh env, nh ssh

TETRA INTEGRATION
    Import: org import nh ~/nh/<ctx>/digocean.json <org>
    Output: ~/.tetra/orgs/<org>/sections/10-infrastructure.toml
    Build:  org build <org>  ->  tetra.toml
EOF
}

# Export functions
export -f nh_doctl_status nh_doctl_fetch nh_doctl_fetch_dry nh_doctl_droplets nh_doctl_cat
export -f nh_doctl_clean nh_doctl_age nh_doctl_resources nh_doctl_info
