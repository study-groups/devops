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

# All available doctl resources (category:name:command:description)
# These are the main resources you can fetch from DigitalOcean
_NH_DOCTL_ALL_RESOURCES=(
    # Compute - core infrastructure
    "compute:Droplets:doctl compute droplet list --output json:Virtual machines (VPS)"
    "compute:Volumes:doctl compute volume list --output json:Block storage volumes"
    "compute:Snapshots:doctl compute snapshot list --output json:Droplet and volume snapshots"
    "compute:PrivateImages:doctl compute image list --public=false --output json:Custom images"

    # Networking
    "network:Domains:doctl compute domain list --output json:DNS domains"
    "network:FloatingIPs:doctl compute floating-ip list --output json:Reserved/floating IPs"
    "network:LoadBalancers:doctl compute load-balancer list --output json:Load balancers"
    "network:Firewalls:doctl compute firewall list --output json:Cloud firewalls"
    "network:VPCs:doctl vpcs list --output json:Virtual private clouds"

    # Databases
    "database:Databases:doctl databases list --output json:Managed databases (Postgres, MySQL, Redis)"

    # Kubernetes
    "kubernetes:KubernetesClusters:doctl kubernetes cluster list --output json:K8s clusters"

    # Apps & Functions
    "apps:Apps:doctl apps list --output json:App Platform applications"
    "apps:Functions:doctl serverless namespaces list --output json:Serverless functions"

    # Storage
    "storage:Spaces:doctl compute cdn list --output json:Spaces CDN endpoints"
    "storage:ContainerRegistry:doctl registry get --output json:Container registry"

    # Account
    "account:SSHKeys:doctl compute ssh-key list --output json:SSH keys"
    "account:Projects:doctl projects list --output json:Projects"
)

# Default resources to fetch (balanced between useful and fast)
_NH_FETCH_DEFAULT="Droplets,Volumes,Domains,FloatingIPs,LoadBalancers,Firewalls"

# Currently configured resources (can be overridden by NH_FETCH_RESOURCES env var)
_nh_fetch_get_resources() {
    echo "${NH_FETCH_RESOURCES:-$_NH_FETCH_DEFAULT}"
}

# Get command for a resource name
_nh_fetch_get_cmd() {
    local name="$1"
    for entry in "${_NH_DOCTL_ALL_RESOURCES[@]}"; do
        local rname=$(echo "$entry" | cut -d: -f2)
        if [[ "$rname" == "$name" ]]; then
            echo "$entry" | cut -d: -f3
            return 0
        fi
    done
    return 1
}

# Show all available resources and current configuration
nh_doctl_fetch_help() {
    local current=$(_nh_fetch_get_resources)

    cat << 'EOF'
nh fetch help - Available DigitalOcean Resources
=================================================

All resources that can be fetched from DigitalOcean API via doctl:

EOF

    local last_category=""
    for entry in "${_NH_DOCTL_ALL_RESOURCES[@]}"; do
        local category=$(echo "$entry" | cut -d: -f1)
        local name=$(echo "$entry" | cut -d: -f2)
        local cmd=$(echo "$entry" | cut -d: -f3)
        local desc=$(echo "$entry" | cut -d: -f4)

        # Print category header
        if [[ "$category" != "$last_category" ]]; then
            echo ""
            printf "%-12s\n" "[$category]"
            last_category="$category"
        fi

        # Check if enabled
        local marker="  "
        if [[ ",$current," == *",$name,"* ]]; then
            marker="* "
        fi

        printf "  %s%-20s %s\n" "$marker" "$name" "$desc"
    done

    cat << EOF

CURRENT CONFIGURATION
  NH_FETCH_RESOURCES="${current}"
  (* = will be fetched)

PRESETS
  minimal   Droplets,Domains
  default   Droplets,Volumes,Domains,FloatingIPs,LoadBalancers,Firewalls
  full      (all resources)

EXAMPLES
  nh fetch                              # Fetch current configuration
  nh fetch dry-run                      # Preview without fetching
  NH_FETCH_RESOURCES="Droplets,Domains" nh fetch   # Custom one-time
  export NH_FETCH_RESOURCES="Droplets,Domains,Databases"  # Persist in shell

DOCTL REFERENCE
  doctl compute -h      # Compute resources (droplets, volumes, images)
  doctl databases -h    # Database resources
  doctl kubernetes -h   # Kubernetes resources
  doctl apps -h         # App Platform
  doctl vpcs -h         # VPC networking
EOF
}

# Show what fetch would do without executing
nh_doctl_fetch_dry() {
    local ctx="${DIGITALOCEAN_CONTEXT:-}"

    echo "nh fetch dry-run"
    echo "================"
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
    echo "Run 'nh fetch' to execute"
}

# Fetch all infrastructure data from DigitalOcean
nh_doctl_fetch() {
    # Parse arguments
    case "${1:-}" in
        dry-run)
            nh_doctl_fetch_dry
            return $?
            ;;
        help)
            nh_doctl_fetch_help
            return $?
            ;;
        minimal)
            NH_FETCH_RESOURCES="Droplets,Domains" nh_doctl_fetch
            return $?
            ;;
        full)
            # Build full list from all resources
            local all_names=""
            for entry in "${_NH_DOCTL_ALL_RESOURCES[@]}"; do
                local name=$(echo "$entry" | cut -d: -f2)
                [[ -n "$all_names" ]] && all_names+=","
                all_names+="$name"
            done
            NH_FETCH_RESOURCES="$all_names" nh_doctl_fetch
            return $?
            ;;
        "")
            # Default - continue below
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: nh fetch [dry-run|help|minimal|full]"
            return 1
            ;;
    esac

    local ctx="${DIGITALOCEAN_CONTEXT:-}"
    [[ -z "$ctx" ]] && { echo "No context. Run: nh switch <context>"; return 1; }

    local output_file="$NH_DIR/$ctx/digocean.json"
    local output_dir="$(dirname "$output_file")"
    local backup_file="$NH_DIR/$ctx/digocean.json.bak"
    local resources=$(_nh_fetch_get_resources)

    echo "Fetching infrastructure from DigitalOcean"
    echo "=========================================="
    echo ""
    echo "Context:   $ctx"
    echo "Output:    $output_file"
    echo "Resources: $resources"
    echo ""

    # Create directory if needed
    if [[ ! -d "$output_dir" ]]; then
        echo "Creating: $output_dir"
        mkdir -p "$output_dir"
    fi

    # Backup existing file
    if [[ -f "$output_file" ]]; then
        cp "$output_file" "$backup_file"
        echo "Backup:    digocean.json.bak"
        echo ""
    fi

    # Convert comma-separated resources to array
    IFS=',' read -ra resource_list <<< "$resources"
    local total=${#resource_list[@]}
    local current=0
    local json_parts=()

    for name in "${resource_list[@]}"; do
        ((current++))
        local cmd=$(_nh_fetch_get_cmd "$name")

        if [[ -z "$cmd" ]]; then
            printf "[%d/%d] %s... unknown resource (skipped)\n" "$current" "$total" "$name"
            continue
        fi

        printf "[%d/%d] Fetching %s... " "$current" "$total" "$name"

        local result
        if result=$(eval "$cmd" 2>&1); then
            json_parts+=("{ \"$name\": $result }")
            echo "ok"
        else
            echo "failed"
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
export -f nh_doctl_status nh_doctl_fetch nh_doctl_fetch_dry nh_doctl_fetch_help
export -f _nh_fetch_get_resources _nh_fetch_get_cmd
export -f nh_doctl_droplets nh_doctl_cat nh_doctl_clean
export -f nh_doctl_age nh_doctl_resources nh_doctl_info
