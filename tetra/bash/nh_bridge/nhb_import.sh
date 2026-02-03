#!/usr/bin/env bash
# nhb_import.sh - Import digocean.json -> tetra.toml
#
# Minimal, focused converter that generates only what org/tkm need:
#   - [org] name
#   - [env.*] host, auth_user, work_user, domain
#
# Usage:
#   nhb_import <json_file> <org_name> [output_dir]
#   nhb_import ~/nh/myorg/digocean.json myorg
#   nhb_import ~/nh/myorg/digocean.json myorg ~/.tetra/orgs/myorg

# =============================================================================
# JSON PARSING
# =============================================================================

# Extract all droplets from digocean.json
_nhb_get_droplets() {
    local json_file="$1"
    jq -c '.[] | select(.Droplets) | .Droplets[]' "$json_file" 2>/dev/null
}

# Extract domains from digocean.json
_nhb_get_base_domain() {
    local json_file="$1"
    jq -r '.[] | select(.Domains) | .Domains[0].name // empty' "$json_file" 2>/dev/null
}

# Get droplet public IP
_nhb_droplet_ip() {
    local droplet="$1"
    echo "$droplet" | jq -r '.networks.v4[] | select(.type == "public") | .ip_address' | head -1
}

# Get droplet private IP
_nhb_droplet_private_ip() {
    local droplet="$1"
    echo "$droplet" | jq -r '.networks.v4[] | select(.type == "private") | .ip_address' | head -1
}

# Get droplet name
_nhb_droplet_name() {
    local droplet="$1"
    echo "$droplet" | jq -r '.name'
}

# Get droplet tags as space-separated string
_nhb_droplet_tags() {
    local droplet="$1"
    echo "$droplet" | jq -r '.tags[]?' 2>/dev/null | tr '\n' ' '
}

# =============================================================================
# ENVIRONMENT MAPPING
# =============================================================================

# Load env-map.conf from context directory
# Format: droplet_name=env1,env2,env3
# Example:
#   do4=staging
#   do4n2=prod,staging
declare -A _NHB_ENV_MAP

_nhb_load_env_map() {
    local json_file="$1"
    local map_file="${json_file%/*}/env-map.conf"

    _NHB_ENV_MAP=()

    [[ ! -f "$map_file" ]] && return 0

    while IFS='=' read -r name envs; do
        # Skip comments and empty lines
        [[ -z "$name" || "$name" == \#* ]] && continue
        # Normalize: trim whitespace
        name="${name%% }"
        name="${name## }"
        envs="${envs%% }"
        envs="${envs## }"
        _NHB_ENV_MAP["$name"]="$envs"
    done < "$map_file"
}

# Get environments for a droplet (from map or auto-detect)
# Returns: comma-separated list of envs, or empty
_nhb_get_envs() {
    local name="$1"
    local tags="$2"

    # Check map first (bash 5.2+ -v checks if key exists)
    if [[ -v _NHB_ENV_MAP[$name] ]]; then
        echo "${_NHB_ENV_MAP[$name]}"
        return 0
    fi

    # Fall back to auto-detection
    _nhb_detect_env "$name" "$tags"
}

# Auto-detect environment from droplet name/tags
# Returns: dev, staging, prod, or empty
_nhb_detect_env() {
    local name="$1"
    local tags="$2"
    local combined="$name $tags"

    # Check for environment indicators (order matters: more specific first)
    if [[ "$combined" =~ prod(uction)?[^a-z] ]] || [[ "$combined" =~ -prod$ ]] || [[ "$combined" =~ ^prod- ]]; then
        echo "prod"
    elif [[ "$combined" =~ stag(ing)?[^a-z] ]] || [[ "$combined" =~ -stag ]] || [[ "$combined" =~ qa[^a-z] ]]; then
        echo "staging"
    elif [[ "$combined" =~ dev(el)?[^a-z] ]] || [[ "$combined" =~ -dev$ ]] || [[ "$combined" =~ ^dev- ]]; then
        echo "dev"
    else
        echo ""
    fi
}

# =============================================================================
# PARTIAL GENERATION (for org build)
# =============================================================================

# Generate infrastructure partial (10-infrastructure.toml)
_nhb_generate_infrastructure_partial() {
    local base_domain="$1"
    shift
    # Remaining args are: env:ip:private_ip:droplet_name pairs

    cat << EOF
# Infrastructure - environments
# Generated from digocean.json on $(date -Iseconds)
# Rebuild tetra.toml with: org build

[env.local]
description = "Local development"
EOF

    # Generate environment sections
    for entry in "$@"; do
        local env="${entry%%:*}"
        local rest="${entry#*:}"
        local ip="${rest%%:*}"
        rest="${rest#*:}"
        local private_ip="${rest%%:*}"
        local droplet_name="${rest#*:}"

        [[ -z "$env" || -z "$ip" ]] && continue

        # Determine domain
        local domain=""
        if [[ -n "$base_domain" ]]; then
            if [[ "$env" == "prod" ]]; then
                domain="$base_domain"
            else
                domain="${env}.${base_domain}"
            fi
        fi

        cat << EOF

[env.$env]
description = "${env^} server${droplet_name:+ ($droplet_name)}"
host = "$ip"
auth_user = "root"
work_user = "$env"
EOF
        [[ -n "$private_ip" ]] && echo "private_ip = \"$private_ip\""
        [[ -n "$domain" ]] && echo "domain = \"$domain\""
    done
}

# =============================================================================
# MAIN IMPORT FUNCTION
# =============================================================================

nhb_import() {
    local json_file="$1"
    local org_name="$2"
    local no_build="${3:-}"  # pass "no-build" to skip auto-build

    # Validation
    if [[ -z "$json_file" || -z "$org_name" ]]; then
        echo "Usage: nhb_import <json_file> <org_name> [no-build]"
        echo ""
        echo "Examples:"
        echo "  nhb_import ~/nh/myorg/digocean.json myorg"
        echo "  nhb_import ~/nh/myorg/digocean.json myorg no-build"
        return 1
    fi

    if [[ ! -f "$json_file" ]]; then
        echo "Error: File not found: $json_file" >&2
        return 1
    fi

    # Validate JSON
    if ! jq empty "$json_file" 2>/dev/null; then
        echo "Error: Invalid JSON: $json_file" >&2
        return 1
    fi

    # Determine output location (flat structure)
    local org_dir="$TETRA_DIR/orgs/$org_name"
    local infra_file="$org_dir/10-infrastructure.toml"

    echo "Importing: $json_file"
    echo "Organization: $org_name"
    echo ""

    # Initialize org if needed
    if [[ ! -d "$org_dir" ]]; then
        echo "Initializing org directory..."
        # Source org module if not already loaded
        if ! type org_build_init &>/dev/null; then
            source "$TETRA_SRC/bash/org/org.sh"
        fi
        org_build_init "$org_name"
        echo ""
    fi

    # Load env map if exists
    _nhb_load_env_map "$json_file"
    local map_file="${json_file%/*}/env-map.conf"
    [[ -f "$map_file" ]] && echo "Using: $map_file"

    # Get base domain
    local base_domain
    base_domain=$(_nhb_get_base_domain "$json_file")
    [[ -n "$base_domain" ]] && echo "Domain: $base_domain"

    # Parse droplets and detect environments
    declare -A env_map  # env -> "ip:private_ip:droplet_name"
    local unassigned=()

    while IFS= read -r droplet; do
        [[ -z "$droplet" ]] && continue

        local name=$(_nhb_droplet_name "$droplet")
        local tags=$(_nhb_droplet_tags "$droplet")
        local ip=$(_nhb_droplet_ip "$droplet")
        local private_ip=$(_nhb_droplet_private_ip "$droplet")
        local envs=$(_nhb_get_envs "$name" "$tags")

        if [[ -n "$envs" ]]; then
            # Handle multiple envs (comma-separated)
            IFS=',' read -ra env_list <<< "$envs"
            for env in "${env_list[@]}"; do
                env="${env## }"  # trim leading space
                env="${env%% }"  # trim trailing space
                # Check for conflict
                if [[ -n "${env_map[$env]}" ]]; then
                    echo "Warning: Multiple droplets for '$env' environment"
                    echo "  Existing: ${env_map[$env]##*:}"
                    echo "  New: $name ($ip)"
                    echo "  Keeping first one"
                else
                    env_map[$env]="$ip:$private_ip:$name"
                    echo "  $env: $name ($ip)"
                fi
            done
        else
            unassigned+=("$name:$ip:$private_ip")
        fi
    done < <(_nhb_get_droplets "$json_file")

    # Handle unassigned droplets
    if [[ ${#unassigned[@]} -gt 0 ]]; then
        echo ""
        echo "Unassigned droplets (could not detect environment):"
        for entry in "${unassigned[@]}"; do
            local name="${entry%%:*}"
            local rest="${entry#*:}"
            local ip="${rest%%:*}"
            echo "  - $name ($ip)"
        done
        echo ""
        echo "Edit $infra_file to assign them manually, or"
        echo "re-run with droplets tagged: dev, staging, prod"
    fi

    # Check if we found any environments
    if [[ ${#env_map[@]} -eq 0 ]]; then
        echo ""
        echo "Error: No environments detected from droplets" >&2
        echo "Tag your droplets with: dev, staging, prod" >&2
        return 1
    fi

    # Build argument list for generator
    local entries=()
    for env in "${!env_map[@]}"; do
        entries+=("$env:${env_map[$env]}")
    done

    # Generate infrastructure partial
    _nhb_generate_infrastructure_partial "$base_domain" "${entries[@]}" > "$infra_file"

    echo ""
    echo "Updated: $infra_file"

    # Auto-build unless told not to
    if [[ "$no_build" != "no-build" ]]; then
        echo ""
        # Source org module if not already loaded (includes shared helpers)
        if ! type org_build &>/dev/null; then
            source "$TETRA_SRC/bash/org/org.sh"
        fi
        org_build "$org_name"
    else
        echo ""
        echo "Skipped build. Run manually: org build $org_name"
    fi

    echo ""
    echo "Next steps:"
    echo "  1. Edit source files: \$EDITOR $org_dir/"
    echo "  2. Rebuild if edited: org build $org_name"
    echo "  3. Switch: org switch $org_name"
    echo "  4. Init keys: tkm init && tkm gen all"
}

# List droplets without importing (dry run)
nhb_list() {
    local json_file="$1"

    if [[ -z "$json_file" || ! -f "$json_file" ]]; then
        echo "Usage: nhb_list <json_file>"
        return 1
    fi

    # Load env map if exists
    _nhb_load_env_map "$json_file"
    local map_file="${json_file%/*}/env-map.conf"

    echo "Droplets in $json_file:"
    [[ -f "$map_file" ]] && echo "  (using env-map.conf)"
    echo ""

    while IFS= read -r droplet; do
        [[ -z "$droplet" ]] && continue

        local name=$(_nhb_droplet_name "$droplet")
        local tags=$(_nhb_droplet_tags "$droplet")
        local ip=$(_nhb_droplet_ip "$droplet")
        local envs=$(_nhb_get_envs "$name" "$tags")

        printf "  %-25s %-15s -> %s\n" "$name" "$ip" "${envs:-?}"
    done < <(_nhb_get_droplets "$json_file")

    echo ""
    local domain=$(_nhb_get_base_domain "$json_file")
    [[ -n "$domain" ]] && echo "Domain: $domain"

    if [[ ! -f "$map_file" ]]; then
        echo ""
        echo "Tip: Create $map_file to override mappings:"
        echo "  droplet_name=env1,env2"
    fi
}

