#!/usr/bin/env bash
# nh_import.sh - Import digocean.json → tetra.toml
#
# Minimal, focused converter that generates only what org/tkm need:
#   - [org] name
#   - [environments.*] host, user, ssh_work_user
#   - [connectors] inline format (optional)
#
# Usage:
#   nh_import <json_file> <org_name> [output_dir]
#   nh_import ~/nh/myorg/digocean.json myorg
#   nh_import ~/nh/myorg/digocean.json myorg ~/.tetra/orgs/myorg

# =============================================================================
# JSON PARSING
# =============================================================================

# Extract all droplets from digocean.json
_nh_get_droplets() {
    local json_file="$1"
    jq -c '.[] | select(.Droplets) | .Droplets[]' "$json_file" 2>/dev/null
}

# Extract domains from digocean.json
_nh_get_base_domain() {
    local json_file="$1"
    jq -r '.[] | select(.Domains) | .Domains[0].name // empty' "$json_file" 2>/dev/null
}

# Get droplet public IP
_nh_droplet_ip() {
    local droplet="$1"
    echo "$droplet" | jq -r '.networks.v4[] | select(.type == "public") | .ip_address' | head -1
}

# Get droplet private IP
_nh_droplet_private_ip() {
    local droplet="$1"
    echo "$droplet" | jq -r '.networks.v4[] | select(.type == "private") | .ip_address' | head -1
}

# Get droplet name
_nh_droplet_name() {
    local droplet="$1"
    echo "$droplet" | jq -r '.name'
}

# Get droplet tags as space-separated string
_nh_droplet_tags() {
    local droplet="$1"
    echo "$droplet" | jq -r '.tags[]?' 2>/dev/null | tr '\n' ' '
}

# =============================================================================
# ENVIRONMENT DETECTION
# =============================================================================

# Detect environment from droplet name/tags
# Returns: dev, staging, prod, or empty
_nh_detect_env() {
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
_nh_generate_infrastructure_partial() {
    local base_domain="$1"
    shift
    # Remaining args are: env:ip:private_ip:droplet_name pairs

    cat << EOF
# Infrastructure - environments and connectors
# Generated from digocean.json on $(date -Iseconds)
# Rebuild tetra.toml with: org build

[environments.local]
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

[environments.$env]
description = "${env^} server${droplet_name:+ ($droplet_name)}"
host = "$ip"
user = "root"
ssh_work_user = "$env"
EOF
        [[ -n "$private_ip" ]] && echo "private_ip = \"$private_ip\""
        [[ -n "$domain" ]] && echo "domain = \"$domain\""
    done

    # Generate connectors section (inline format for tkm)
    echo ""
    echo "[connectors]"
    for entry in "$@"; do
        local env="${entry%%:*}"
        local rest="${entry#*:}"
        local ip="${rest%%:*}"

        [[ -z "$env" || -z "$ip" ]] && continue

        echo "\"@$env\" = { auth_user = \"root\", work_user = \"$env\", host = \"$ip\" }"
    done
}

# =============================================================================
# MAIN IMPORT FUNCTION
# =============================================================================

nh_import() {
    local json_file="$1"
    local org_name="$2"
    local no_build="${3:-}"  # pass "no-build" to skip auto-build

    # Validation
    if [[ -z "$json_file" || -z "$org_name" ]]; then
        echo "Usage: nh_import <json_file> <org_name> [no-build]"
        echo ""
        echo "Examples:"
        echo "  nh_import ~/nh/myorg/digocean.json myorg"
        echo "  nh_import ~/nh/myorg/digocean.json myorg no-build"
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
        # Source org_build if not already loaded
        if ! type org_build_init &>/dev/null; then
            source "$TETRA_SRC/bash/org/org_build.sh"
        fi
        org_build_init "$org_name"
        echo ""
    fi

    # Get base domain
    local base_domain
    base_domain=$(_nh_get_base_domain "$json_file")
    [[ -n "$base_domain" ]] && echo "Domain: $base_domain"

    # Parse droplets and detect environments
    declare -A env_map  # env -> "ip:private_ip:droplet_name"
    local unassigned=()

    while IFS= read -r droplet; do
        [[ -z "$droplet" ]] && continue

        local name=$(_nh_droplet_name "$droplet")
        local tags=$(_nh_droplet_tags "$droplet")
        local ip=$(_nh_droplet_ip "$droplet")
        local private_ip=$(_nh_droplet_private_ip "$droplet")
        local env=$(_nh_detect_env "$name" "$tags")

        if [[ -n "$env" ]]; then
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
        else
            unassigned+=("$name:$ip:$private_ip")
        fi
    done < <(_nh_get_droplets "$json_file")

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
    _nh_generate_infrastructure_partial "$base_domain" "${entries[@]}" > "$infra_file"

    echo ""
    echo "Updated: $infra_file"

    # Auto-build unless told not to
    if [[ "$no_build" != "no-build" ]]; then
        echo ""
        # Source org_build if not already loaded
        if ! type org_build &>/dev/null; then
            source "$TETRA_SRC/bash/org/org_build.sh"
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
nh_list() {
    local json_file="$1"

    if [[ -z "$json_file" || ! -f "$json_file" ]]; then
        echo "Usage: nh_list <json_file>"
        return 1
    fi

    echo "Droplets in $json_file:"
    echo ""

    while IFS= read -r droplet; do
        [[ -z "$droplet" ]] && continue

        local name=$(_nh_droplet_name "$droplet")
        local tags=$(_nh_droplet_tags "$droplet")
        local ip=$(_nh_droplet_ip "$droplet")
        local env=$(_nh_detect_env "$name" "$tags")

        printf "  %-25s %-15s -> %s\n" "$name" "$ip" "${env:-?}"
    done < <(_nh_get_droplets "$json_file")

    echo ""
    local domain=$(_nh_get_base_domain "$json_file")
    [[ -n "$domain" ]] && echo "Domain: $domain"
}

# =============================================================================
# CLI
# =============================================================================

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    case "${1:-help}" in
        import)
            shift
            nh_import "$@"
            ;;
        list|ls)
            shift
            nh_list "$@"
            ;;
        help|--help|-h|"")
            cat << 'EOF'
nh_import - Import digocean.json to tetra.toml

USAGE
    nh_import import <json_file> <org_name> [output_dir]
    nh_import list <json_file>

COMMANDS
    import      Convert digocean.json to tetra.toml
    list        Show droplets and detected environments (dry run)

EXAMPLES
    nh_import list ~/nh/myorg/digocean.json
    nh_import import ~/nh/myorg/digocean.json myorg

ENVIRONMENT DETECTION
    Droplets are assigned to environments based on name/tags:
    - "dev", "development" -> dev
    - "staging", "qa" -> staging
    - "prod", "production" -> prod

    Undetected droplets are listed for manual assignment.
EOF
            ;;
        *)
            echo "Unknown command: $1"
            echo "Try: nh_import help"
            exit 1
            ;;
    esac
fi

export -f nh_import nh_list
export -f _nh_get_droplets _nh_get_base_domain _nh_droplet_ip _nh_droplet_private_ip
export -f _nh_droplet_name _nh_droplet_tags _nh_detect_env _nh_generate_toml
