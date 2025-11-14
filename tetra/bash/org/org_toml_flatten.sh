#!/usr/bin/env bash

# Org TOML Flattener - Converts multi-section TOML to flattened format
# Merges [symbols], [connectors], and [environments] into self-contained [environments.*]

# Verify TETRA_SRC is set
if [[ -z "$TETRA_SRC" ]]; then
    echo "Error: TETRA_SRC not set. Please source tetra.sh first." >&2
    exit 1
fi

# Source TOML parser
source "$TETRA_SRC/bash/deploy/toml.sh"

# ============================================================================
# FLATTENING LOGIC
# ============================================================================

org_toml_flatten() {
    local input_toml="$1"
    local output_toml="$2"

    if [[ ! -f "$input_toml" ]]; then
        echo "Error: Input TOML not found: $input_toml" >&2
        return 1
    fi

    if [[ -z "$output_toml" ]]; then
        echo "Usage: org_toml_flatten <input.toml> <output.toml>" >&2
        return 1
    fi

    echo "Flattening TOML structure..."
    echo "  Input:  $input_toml"
    echo "  Output: $output_toml"
    echo ""

    # Parse the input TOML
    toml_parse "$input_toml" "FLAT" 2>/dev/null || {
        echo "Error: Failed to parse input TOML" >&2
        return 1
    }

    # Extract org name from metadata or org section
    local org_name="${FLAT_metadata[name]}"
    [[ -z "$org_name" ]] && org_name="${FLAT_org[name]}"
    [[ -z "$org_name" ]] && org_name="unknown"

    # Start building output TOML
    cat > "$output_toml" << EOF
# ${org_name} Organization Configuration (Flattened Format)
# Generated from multi-section format on $(date -u '+%Y-%m-%dT%H:%M:%SZ')
# TES v2.1 compliant - Self-contained environments

EOF

    # Write metadata section
    _flatten_write_metadata "$output_toml"

    # Write flattened environments
    _flatten_write_environments "$output_toml"

    # Write infrastructure section (read-only reference)
    _flatten_write_infrastructure "$output_toml"

    # Write domains section if present
    _flatten_write_domains "$output_toml"

    # Write storage section if present
    _flatten_write_storage "$output_toml"

    echo "✓ Flattening complete"
    echo ""
    echo "Next steps:"
    echo "  1. Review: $output_toml"
    echo "  2. Backup original: mv $input_toml ${input_toml}.backup"
    echo "  3. Replace: mv $output_toml $input_toml"
}

# Write metadata section
_flatten_write_metadata() {
    local output="$1"

    cat >> "$output" << EOF
[metadata]
EOF

    if declare -p FLAT_metadata &>/dev/null; then
        local -n meta_ref=FLAT_metadata
        for key in "${!meta_ref[@]}"; do
            printf '%s = "%s"\n' "$key" "${meta_ref[$key]}" >> "$output"
        done
    fi

    echo "" >> "$output"
}

# Write flattened environments
_flatten_write_environments() {
    local output="$1"

    cat >> "$output" << 'EOF'
# ═══════════════════════════════════════════════════════════
# ENVIRONMENTS - Complete Deployment Targets
# Each environment is self-contained with all connection info
# ═══════════════════════════════════════════════════════════

EOF

    # Get list of environments
    local envs=()
    for var in $(compgen -A variable | grep "^FLAT_environments_"); do
        local env_name="${var#FLAT_environments_}"
        envs+=("$env_name")
    done

    # Sort environments: local, dev, staging, prod, then others
    local sorted_envs=()
    for priority_env in local dev staging prod; do
        for env in "${envs[@]}"; do
            if [[ "$env" == "$priority_env" ]]; then
                sorted_envs+=("$env")
            fi
        done
    done
    for env in "${envs[@]}"; do
        if [[ ! " ${sorted_envs[@]} " =~ " ${env} " ]]; then
            sorted_envs+=("$env")
        fi
    done

    # Write each environment
    for env_name in "${sorted_envs[@]}"; do
        _flatten_write_environment "$env_name" "$output"
    done
}

# Write a single flattened environment
_flatten_write_environment() {
    local env_name="$1"
    local output="$2"

    echo "[environments.${env_name}]" >> "$output"

    # Get environment data
    local var_name="FLAT_environments_${env_name}"
    if ! declare -p "$var_name" &>/dev/null; then
        return
    fi
    local -n env_ref="$var_name"

    # Determine symbol (from env or construct)
    local symbol="${env_ref[symbol]}"
    [[ -z "$symbol" ]] && symbol="@${env_name}"

    # Write basic fields
    echo "symbol = \"$symbol\"" >> "$output"

    # Get type from symbol or default to remote
    local env_type="remote"
    if declare -p FLAT_symbols &>/dev/null; then
        local -n symbols_ref=FLAT_symbols
        local symbol_data="${symbols_ref[$symbol]}"
        if [[ -n "$symbol_data" ]]; then
            env_type=$(echo "$symbol_data" | grep -o 'type = "[^"]*"' | cut -d'"' -f2)
        fi
    fi
    [[ -z "$env_type" ]] && env_type="remote"
    echo "type = \"$env_type\"" >> "$output"

    # Get address from symbol
    local address=""
    if declare -p FLAT_symbols &>/dev/null; then
        local -n symbols_ref=FLAT_symbols
        local symbol_data="${symbols_ref[$symbol]}"
        if [[ -n "$symbol_data" ]]; then
            address=$(echo "$symbol_data" | grep -o 'address = "[^"]*"' | cut -d'"' -f2)
        fi
    fi
    [[ -n "$address" ]] && echo "address = \"$address\"" >> "$output"

    # Write standard environment fields
    for key in description domain url app_port node_env private_ip server_ip floating_ip droplet_id droplet_name; do
        if [[ -n "${env_ref[$key]}" ]]; then
            # Handle numeric vs string values
            if [[ "$key" =~ (app_port|droplet_id) ]]; then
                echo "$key = ${env_ref[$key]}" >> "$output"
            else
                echo "$key = \"${env_ref[$key]}\"" >> "$output"
            fi
        fi
    done

    # Add SSH configuration from connector
    if declare -p FLAT_connectors &>/dev/null && [[ "$env_type" == "remote" ]]; then
        local -n connectors_ref=FLAT_connectors
        local connector_data="${connectors_ref[$symbol]}"

        if [[ -n "$connector_data" ]]; then
            # Extract SSH fields from connector
            local ssh_auth_user=$(echo "$connector_data" | grep -o 'auth_user = "[^"]*"' | cut -d'"' -f2)
            local ssh_work_user=$(echo "$connector_data" | grep -o 'work_user = "[^"]*"' | cut -d'"' -f2)
            local ssh_host=$(echo "$connector_data" | grep -o 'host = "[^"]*"' | cut -d'"' -f2)
            local ssh_key=$(echo "$connector_data" | grep -o 'auth_key = "[^"]*"' | cut -d'"' -f2)

            # Write SSH configuration
            [[ -n "$ssh_host" ]] && echo "ssh_host = \"$ssh_host\"" >> "$output"
            [[ -n "$ssh_auth_user" ]] && echo "ssh_auth_user = \"$ssh_auth_user\"" >> "$output"
            [[ -n "$ssh_work_user" ]] && echo "ssh_work_user = \"$ssh_work_user\"" >> "$output"
            [[ -n "$ssh_key" ]] && echo "ssh_key = \"$ssh_key\"" >> "$output"
            echo "ssh_port = 22" >> "$output"
        fi
    fi

    echo "" >> "$output"
}

# Write infrastructure section (read-only reference)
_flatten_write_infrastructure() {
    local output="$1"

    if ! declare -p FLAT_infrastructure &>/dev/null; then
        return
    fi

    cat >> "$output" << 'EOF'
# ═══════════════════════════════════════════════════════════
# INFRASTRUCTURE - Read-only Reference Data
# Provider metadata - not used for connections
# ═══════════════════════════════════════════════════════════

[infrastructure]
EOF

    local -n infra_ref=FLAT_infrastructure
    for key in "${!infra_ref[@]}"; do
        # Skip droplet-specific fields (they're in environments now)
        if [[ "$key" =~ ^(dev|staging|prod|qa)_ ]]; then
            continue
        fi
        printf '%s = "%s"\n' "$key" "${infra_ref[$key]}" >> "$output"
    done

    echo "" >> "$output"
}

# Write domains section
_flatten_write_domains() {
    local output="$1"

    if ! declare -p FLAT_domains &>/dev/null; then
        return
    fi

    cat >> "$output" << 'EOF'
[domains]
EOF

    local -n domains_ref=FLAT_domains
    for key in "${!domains_ref[@]}"; do
        printf '%s = "%s"\n' "$key" "${domains_ref[$key]}" >> "$output"
    done

    echo "" >> "$output"
}

# Write storage section
_flatten_write_storage() {
    local output="$1"

    # Check for storage.spaces
    if declare -p FLAT_storage_spaces &>/dev/null; then
        cat >> "$output" << 'EOF'
[storage.spaces]
EOF

        local -n storage_ref=FLAT_storage_spaces
        for key in "${!storage_ref[@]}"; do
            printf '%s = "%s"\n' "$key" "${storage_ref[$key]}" >> "$output"
        done

        echo "" >> "$output"
    fi
}

# ============================================================================
# CLI INTERFACE
# ============================================================================

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    # Script is being run directly
    if [[ $# -lt 2 ]]; then
        echo "Usage: $0 <input.toml> <output.toml>"
        echo ""
        echo "Example:"
        echo "  $0 tetra.toml tetra.flattened.toml"
        exit 1
    fi

    org_toml_flatten "$1" "$2"
else
    # Script is being sourced
    export -f org_toml_flatten
    export -f _flatten_write_metadata
    export -f _flatten_write_environments
    export -f _flatten_write_environment
    export -f _flatten_write_infrastructure
    export -f _flatten_write_domains
    export -f _flatten_write_storage
fi
