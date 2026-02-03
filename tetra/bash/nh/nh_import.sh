#!/usr/bin/env bash
# nh_import.sh - Import DigitalOcean droplets from NodeHolder JSON
#
# Reads digocean.json (DO API response) and generates TOML for org infrastructure.
#
# Usage:
#   nh_list <json_file>              List droplets with IPs
#   nh_import <json_file> <org_name> Generate 10-infrastructure.toml
#   nh_validate <org_name>           Verify TOML matches source JSON

NH_SRC="${TETRA_SRC}/bash/nh"

# =============================================================================
# HELPERS
# =============================================================================

# Extract public IPv4 from droplet
_nh_get_public_ip() {
    jq -r '.networks.v4[] | select(.type == "public") | .ip_address' 2>/dev/null | head -1
}

# Extract private IPv4 from droplet
_nh_get_private_ip() {
    jq -r '.networks.v4[] | select(.type == "private") | .ip_address' 2>/dev/null | head -1
}

# Map droplet name to env name
# prod01, production, *-prod-* → prod
# dev01, development, *-dev-* → dev
# qa01, staging, *-qa-*, *-staging-* → staging
_nh_name_to_env() {
    local name="$1"
    local lower="${name,,}"  # bash 4+ lowercase

    if [[ "$lower" =~ prod ]]; then
        echo "prod"
    elif [[ "$lower" =~ dev ]]; then
        echo "dev"
    elif [[ "$lower" =~ (qa|staging) ]]; then
        echo "staging"
    else
        # Use sanitized droplet name
        echo "$lower" | tr -c 'a-z0-9' '_' | sed 's/_\+/_/g; s/^_//; s/_$//'
    fi
}

# =============================================================================
# LIST
# =============================================================================

# List droplets from digocean.json
nh_list() {
    local json_file="$1"

    [[ -z "$json_file" ]] && { echo "Usage: nh_list <json_file>" >&2; return 1; }
    [[ ! -f "$json_file" ]] && { echo "Not found: $json_file" >&2; return 1; }

    # Validate JSON
    if ! jq empty "$json_file" 2>/dev/null; then
        echo "Invalid JSON: $json_file" >&2
        return 1
    fi

    echo "Droplets in: $json_file"
    echo ""

    # Handle both formats: [{"Droplets": [...]}] and {"Droplets": [...]}
    local droplets
    droplets=$(jq -r '
        if type == "array" then .[0].Droplets // []
        else .Droplets // []
        end | .[]
    ' "$json_file" 2>/dev/null)

    if [[ -z "$droplets" ]]; then
        echo "No droplets found"
        return 0
    fi

    # List each droplet
    jq -r '
        if type == "array" then .[0].Droplets // []
        else .Droplets // []
        end | .[] | "\(.name)\t\([.networks.v4[] | select(.type == "public") | .ip_address][0] // "no-ip")"
    ' "$json_file" 2>/dev/null | while IFS=$'\t' read -r name ip; do
        local env=$(_nh_name_to_env "$name")
        printf "  %-30s %-16s → %s\n" "$name" "$ip" "$env"
    done

    echo ""
    echo "Import with: org import nh <org_name>"
}

# =============================================================================
# IMPORT
# =============================================================================

# Import droplets into org's 10-infrastructure.toml
nh_import() {
    local json_file="$1"
    local org_name="$2"

    [[ -z "$json_file" || -z "$org_name" ]] && {
        echo "Usage: nh_import <json_file> <org_name>" >&2
        return 1
    }
    [[ ! -f "$json_file" ]] && { echo "Not found: $json_file" >&2; return 1; }

    local org_dir="$TETRA_DIR/orgs/$org_name"
    [[ ! -d "$org_dir" ]] && { echo "Org not found: $org_name" >&2; return 1; }

    # Ensure sections dir exists
    local sections_dir="$org_dir/sections"
    mkdir -p "$sections_dir"

    local output="$sections_dir/10-infrastructure.toml"
    local backup=""

    # Backup existing
    if [[ -f "$output" ]]; then
        backup="$org_dir/backups/10-infrastructure.$(date +%Y%m%d-%H%M%S).toml"
        mkdir -p "$org_dir/backups"
        cp "$output" "$backup"
    fi

    echo "Import: $json_file → $org_name"
    echo ""

    # Build TOML
    {
        echo "# Infrastructure - environments and connectors"
        echo "# Updated by: org import nh"
        echo "# Source: $json_file"
        echo "# Generated: $(date -Iseconds)"
        echo ""
        echo "[env.local]"
        echo 'description = "Local development"'

        # Track envs for connectors section
        local -A env_hosts
        local -A env_users

        # Process each droplet
        jq -c '
            if type == "array" then .[0].Droplets // []
            else .Droplets // []
            end | .[]
        ' "$json_file" 2>/dev/null | while read -r droplet; do
            local name=$(echo "$droplet" | jq -r '.name')
            local public_ip=$(echo "$droplet" | _nh_get_public_ip)
            local private_ip=$(echo "$droplet" | _nh_get_private_ip)
            local env=$(_nh_name_to_env "$name")

            [[ -z "$public_ip" ]] && continue

            echo ""
            echo "[env.$env]"
            echo "description = \"$env server ($name)\""
            echo "host = \"$public_ip\""
            echo "user = \"root\""
            echo "ssh_work_user = \"$env\""
            [[ -n "$private_ip" ]] && echo "private_ip = \"$private_ip\""

            # Store for connectors (write to temp file for subshell escape)
            echo "$env $public_ip" >> /tmp/nh_import_$$
        done

        # Connectors section
        if [[ -f /tmp/nh_import_$$ ]]; then
            echo ""
            echo "[connectors]"
            while read -r env ip; do
                echo "\"@$env\" = { auth_user = \"root\", work_user = \"$env\", host = \"$ip\" }"
            done < /tmp/nh_import_$$
            rm -f /tmp/nh_import_$$
        fi
    } > "$output"

    # Report
    local env_count=$(grep -c '^\[env\.' "$output" 2>/dev/null || echo 0)
    local conn_count=$(grep -c '"@' "$output" 2>/dev/null || echo 0)

    echo "Output: $output"
    echo "  $env_count environments, $conn_count connectors"
    [[ -n "$backup" ]] && echo "  Backup: $backup"
    echo ""
    echo "Next: org build $org_name"
}

# =============================================================================
# VALIDATE (Round-trip verification)
# =============================================================================

# Parse TOML infrastructure to extract env data for comparison
# Returns: env|host|private_ip lines
_nh_parse_toml_envs() {
    local toml="$1"
    [[ -f "$toml" ]] || return 1

    awk '
        /^\[env\./ {
            # Output previous env if we have one
            if (env && env != "local" && host) {
                print env "|" host "|" private_ip
            }
            # Start new env
            gsub(/[\[\]]/, "")
            split($0, a, ".")
            env = a[2]
            host = ""
            private_ip = ""
            next
        }
        /^\[/ {
            # Non-env section - output and reset
            if (env && env != "local" && host) {
                print env "|" host "|" private_ip
            }
            env = ""
            next
        }
        /^host[[:space:]]*=/ {
            gsub(/^host[[:space:]]*=[[:space:]]*"/, "")
            gsub(/"$/, "")
            host = $0
        }
        /^private_ip[[:space:]]*=/ {
            gsub(/^private_ip[[:space:]]*=[[:space:]]*"/, "")
            gsub(/"$/, "")
            private_ip = $0
        }
        END {
            if (env && env != "local" && host) {
                print env "|" host "|" private_ip
            }
        }
    ' "$toml"
}

# Parse JSON droplets to extract comparable data
# Returns: env|host|private_ip lines
_nh_parse_json_droplets() {
    local json_file="$1"
    [[ -f "$json_file" ]] || return 1

    jq -r '
        if type == "array" then .[0].Droplets // []
        else .Droplets // []
        end | .[] |
        .name as $name |
        ([.networks.v4[] | select(.type == "public") | .ip_address][0] // "") as $public |
        ([.networks.v4[] | select(.type == "private") | .ip_address][0] // "") as $private |
        select($public != "") |
        "\($name)|\($public)|\($private)"
    ' "$json_file" 2>/dev/null | while IFS='|' read -r name public private; do
        local env=$(_nh_name_to_env "$name")
        echo "$env|$public|$private"
    done
}

# Validate that TOML infrastructure matches source JSON
nh_validate() {
    local org_name="$1"
    local nh_dir="${NH_DIR:-$HOME/nh}"

    [[ -z "$org_name" ]] && { echo "Usage: nh_validate <org_name>" >&2; return 1; }

    local json_file="$nh_dir/$org_name/digocean.json"
    local toml_file="$TETRA_DIR/orgs/$org_name/sections/10-infrastructure.toml"

    [[ ! -f "$json_file" ]] && { echo "Not found: $json_file" >&2; return 1; }
    [[ ! -f "$toml_file" ]] && { echo "Not found: $toml_file" >&2; return 1; }

    echo "Validating: $org_name"
    echo ""
    echo "  JSON: $json_file"
    echo "  TOML: $toml_file"
    echo ""

    # Parse both sources
    local json_data toml_data
    json_data=$(_nh_parse_json_droplets "$json_file" | sort)
    toml_data=$(_nh_parse_toml_envs "$toml_file" | sort)

    local json_count=$(echo "$json_data" | grep -c . 2>/dev/null || echo 0)
    local toml_count=$(echo "$toml_data" | grep -c . 2>/dev/null || echo 0)

    echo "  Droplets in JSON: $json_count"
    echo "  Envs in TOML:     $toml_count (excluding local)"
    echo ""

    # Compare
    local errors=0
    local ok=0

    # Check each JSON droplet is in TOML
    while IFS='|' read -r env host private; do
        [[ -z "$env" ]] && continue
        if echo "$toml_data" | grep -q "^$env|$host"; then
            printf "  %-12s %-16s ✓\n" "$env" "$host"
            ((ok++))
        else
            printf "  %-12s %-16s ✗ MISSING in TOML\n" "$env" "$host"
            ((errors++))
        fi
    done <<< "$json_data"

    # Check for extra envs in TOML not in JSON
    while IFS='|' read -r env host private; do
        [[ -z "$env" ]] && continue
        if ! echo "$json_data" | grep -q "^$env|$host"; then
            printf "  %-12s %-16s ✗ EXTRA in TOML\n" "$env" "$host"
            ((errors++))
        fi
    done <<< "$toml_data"

    echo ""
    if [[ $errors -eq 0 ]]; then
        echo "OK - All $ok droplets accounted for"
        return 0
    else
        echo "ERRORS: $errors discrepancies found"
        return 1
    fi
}
