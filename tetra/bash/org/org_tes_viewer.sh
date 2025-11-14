#!/usr/bin/env bash

# Org TES Viewer - Enhanced display of TES endpoints with full SSH commands
# Works with flattened tetra.toml format (single [environments.*] sections)

# Verify TETRA_SRC is set
if [[ -z "$TETRA_SRC" ]]; then
    echo "Error: TETRA_SRC not set. Please source tetra.sh first." >&2
    return 1 2>/dev/null || exit 1
fi

# Source dependencies
source "$TETRA_SRC/bash/deploy/toml.sh"

# ============================================================================
# TES ENDPOINT VIEWER (Flattened Format)
# ============================================================================

# Display all TES endpoints for the active organization
org_tes_view_all() {
    local org_toml="${1:-$TETRA_DIR/config/tetra.toml}"

    if [[ ! -f "$org_toml" ]]; then
        echo "Error: No active organization. Run 'org switch <name>' first." >&2
        return 1
    fi

    # Parse TOML
    toml_parse "$org_toml" "ORG" 2>/dev/null || {
        echo "Error: Failed to parse $org_toml" >&2
        return 1
    }

    echo ""
    echo "═══════════════════════════════════════════════════════════"
    echo "  TES Endpoints - $(basename "$(dirname "$org_toml")")"
    echo "═══════════════════════════════════════════════════════════"
    echo ""

    # Display all environments with full details (flattened format)
    _org_tes_view_environments_flattened
    echo ""
}

# View all environments with inline SSH commands (flattened format)
_org_tes_view_environments_flattened() {
    echo "┌─ Environments with Full Connection Details"
    echo "│"

    # Get list of environments and sort them
    local envs=()
    for var in $(compgen -A variable | grep "^ORG_environments_"); do
        local env_name="${var#ORG_environments_}"
        envs+=("$env_name")
    done

    # Sort: local, dev, staging, prod, then others
    local sorted_envs=()
    for priority in local dev staging prod; do
        for env in "${envs[@]}"; do
            [[ "$env" == "$priority" ]] && sorted_envs+=("$env")
        done
    done
    for env in "${envs[@]}"; do
        [[ ! " ${sorted_envs[@]} " =~ " ${env} " ]] && sorted_envs+=("$env")
    done

    # Display each environment
    for env_name in "${sorted_envs[@]}"; do
        _org_tes_view_single_environment "$env_name"
    done

    echo "└─"
}

# View a single environment with all details
_org_tes_view_single_environment() {
    local env_name="$1"
    local var_name="ORG_environments_${env_name}"

    if ! declare -p "$var_name" &>/dev/null; then
        return
    fi

    local -n env_ref="$var_name"

    # Extract key fields
    local symbol="${env_ref[symbol]}"
    local type="${env_ref[type]}"
    local address="${env_ref[address]:-${env_ref[server_ip]}}"
    local domain="${env_ref[domain]}"
    local url="${env_ref[url]}"

    echo "│"
    printf "│  [%s] %s\n" "$env_name" "$symbol"
    printf "│  ├─ Type:    %s\n" "$type"
    printf "│  ├─ Address: %s\n" "$address"
    [[ -n "$domain" ]] && printf "│  ├─ Domain:  %s\n" "$domain"
    [[ -n "$url" ]] && printf "│  ├─ URL:     %s\n" "$url"

    # Show SSH connection for remote environments
    if [[ "$type" == "remote" ]]; then
        local ssh_auth_user="${env_ref[ssh_auth_user]}"
        local ssh_work_user="${env_ref[ssh_work_user]}"
        local ssh_host="${env_ref[ssh_host]}"
        local ssh_key="${env_ref[ssh_key]}"

        echo "│  │"
        if [[ -n "$ssh_host" && -n "$ssh_auth_user" && -n "$ssh_work_user" ]]; then
            if [[ "$ssh_auth_user" == "$ssh_work_user" ]]; then
                # Single-user SSH
                printf "│  └─ SSH: ssh -i %s %s@%s\n" "${ssh_key:-~/.ssh/id_rsa}" "$ssh_work_user" "$ssh_host"
            else
                # Dual-role SSH
                printf "│  └─ SSH: ssh -i %s %s@%s -t \"sudo -u %s bash\"\n" \
                    "${ssh_key:-~/.ssh/id_rsa}" "$ssh_auth_user" "$ssh_host" "$ssh_work_user"
            fi
        else
            echo "│  └─ SSH: (incomplete configuration)"
        fi
    else
        echo "│  └─ Local: (no SSH needed)"
    fi
}

# View specific sections for backward compatibility
org_toml_view_section() {
    local section="$1"
    local org_toml="${2:-$TETRA_DIR/config/tetra.toml}"

    if [[ ! -f "$org_toml" ]]; then
        echo "Error: No active organization" >&2
        return 1
    fi

    # Parse TOML
    toml_parse "$org_toml" "ORG" 2>/dev/null || {
        echo "Error: Failed to parse $org_toml" >&2
        return 1
    }

    case "$section" in
        symbols)
            _org_tes_view_symbols_flattened
            ;;
        connectors)
            _org_tes_view_connectors_flattened
            ;;
        environments|all)
            _org_tes_view_environments_flattened
            ;;
        *)
            echo "Unknown section: $section"
            echo "Available: symbols, connectors, environments"
            return 1
            ;;
    esac
}

# View symbols (extracted from environments)
_org_tes_view_symbols_flattened() {
    echo "┌─ Symbols - Stage → Address Mapping"
    echo "│"

    for var in $(compgen -A variable | grep "^ORG_environments_"); do
        local env_name="${var#ORG_environments_}"
        local -n env_ref="$var"

        local symbol="${env_ref[symbol]}"
        local type="${env_ref[type]}"
        local address="${env_ref[address]:-${env_ref[server_ip]:-${env_ref[ssh_host]}}}"

        if [[ -n "$symbol" && -n "$address" ]]; then
            printf "│  %-10s → %-20s (%s)\n" "$symbol" "$address" "$type"
        fi
    done

    echo "└─"
}

# View connectors (extracted from environments)
_org_tes_view_connectors_flattened() {
    echo "┌─ Connectors - Full SSH Commands (Copy & Paste Ready)"
    echo "│"

    for var in $(compgen -A variable | grep "^ORG_environments_"); do
        local env_name="${var#ORG_environments_}"
        local -n env_ref="$var"

        local type="${env_ref[type]}"
        [[ "$type" != "remote" ]] && continue

        local symbol="${env_ref[symbol]}"
        local ssh_auth_user="${env_ref[ssh_auth_user]}"
        local ssh_work_user="${env_ref[ssh_work_user]}"
        local ssh_host="${env_ref[ssh_host]}"
        local ssh_key="${env_ref[ssh_key]}"

        echo "│"
        printf "│  %s\n" "$symbol"
        printf "│  ├─ Auth user:  %s\n" "$ssh_auth_user"
        printf "│  ├─ Work user:  %s\n" "$ssh_work_user"
        printf "│  ├─ Host:       %s\n" "$ssh_host"
        printf "│  ├─ Key:        %s\n" "${ssh_key:-~/.ssh/id_rsa}"
        echo "│  │"

        if [[ "$ssh_auth_user" == "$ssh_work_user" ]]; then
            printf "│  └─ SSH: ssh -i %s %s@%s\n" "${ssh_key:-~/.ssh/id_rsa}" "$ssh_work_user" "$ssh_host"
        else
            printf "│  └─ SSH: ssh -i %s %s@%s -t \"sudo -u %s bash\"\n" \
                "${ssh_key:-~/.ssh/id_rsa}" "$ssh_auth_user" "$ssh_host" "$ssh_work_user"
        fi
    done

    echo "└─"
}

# ============================================================================
# SSH COMMAND BUILDER
# ============================================================================

# Generate SSH command for a symbol
org_tes_ssh_command() {
    local symbol="$1"
    local org_toml="${2:-$TETRA_DIR/config/tetra.toml}"

    if [[ ! -f "$org_toml" ]]; then
        echo "Error: No active organization" >&2
        return 1
    fi

    # Parse TOML
    toml_parse "$org_toml" "ORG" 2>/dev/null || {
        echo "Error: Failed to parse $org_toml" >&2
        return 1
    }

    # Find environment with matching symbol
    for var in $(compgen -A variable | grep "^ORG_environments_"); do
        local -n env_ref="$var"

        if [[ "${env_ref[symbol]}" == "$symbol" ]]; then
            local type="${env_ref[type]}"

            # Handle local
            if [[ "$type" == "local" ]]; then
                echo "# Local environment - no SSH needed"
                echo "bash"
                return 0
            fi

            # Handle remote
            local ssh_auth_user="${env_ref[ssh_auth_user]}"
            local ssh_work_user="${env_ref[ssh_work_user]}"
            local ssh_host="${env_ref[ssh_host]}"
            local ssh_key="${env_ref[ssh_key]:-~/.ssh/id_rsa}"

            if [[ -z "$ssh_host" || -z "$ssh_auth_user" || -z "$ssh_work_user" ]]; then
                echo "Error: Incomplete SSH configuration for $symbol" >&2
                return 1
            fi

            # SSH connection logic:
            # - auth_user: user we authenticate as (typically root)
            # - work_user: user context for operations (dev/staging/prod)
            # If they differ, use sudo to switch to work_user context
            if [[ "$ssh_auth_user" == "$ssh_work_user" ]]; then
                # Same user - direct SSH
                echo "ssh -i $ssh_key $ssh_work_user@$ssh_host"
            else
                # Different users - SSH as auth_user, sudo to work_user
                # This allows root to operate in /home/{dev,staging,prod} context
                echo "ssh -i $ssh_key $ssh_auth_user@$ssh_host -t \"sudo -u $ssh_work_user bash\""
            fi
            return 0
        fi
    done

    echo "Error: Symbol '$symbol' not found" >&2
    return 1
}

# Quick connect to an endpoint
org_tes_connect() {
    local symbol="$1"
    local org_toml="${2:-$TETRA_DIR/config/tetra.toml}"

    if [[ -z "$symbol" ]]; then
        echo "Usage: org tes connect <symbol>"
        echo "Example: org tes connect @dev"
        return 1
    fi

    # Generate and execute SSH command
    local ssh_cmd
    ssh_cmd=$(org_tes_ssh_command "$symbol" "$org_toml") || return 1

    echo "Connecting to $symbol..."
    echo "Command: $ssh_cmd"
    echo ""

    # Execute the command
    eval "$ssh_cmd"
}

# Test connectivity to an endpoint
org_tes_test() {
    local symbol="$1"
    local org_toml="${2:-$TETRA_DIR/config/tetra.toml}"

    if [[ -z "$symbol" ]]; then
        echo "Usage: org tes test <symbol>"
        echo "Example: org tes test @dev"
        return 1
    fi

    echo "Testing connectivity to $symbol..."

    # Parse TOML and find environment
    toml_parse "$org_toml" "ORG" 2>/dev/null || {
        echo "Error: Failed to parse $org_toml" >&2
        return 1
    }

    for var in $(compgen -A variable | grep "^ORG_environments_"); do
        local -n env_ref="$var"

        if [[ "${env_ref[symbol]}" == "$symbol" ]]; then
            local type="${env_ref[type]}"

            if [[ "$type" == "local" ]]; then
                echo "✓ Local environment - always available"
                return 0
            fi

            local ssh_auth_user="${env_ref[ssh_auth_user]}"
            local ssh_host="${env_ref[ssh_host]}"
            local ssh_key="${env_ref[ssh_key]:-~/.ssh/id_rsa}"

            if timeout 5 ssh -o BatchMode=yes -o ConnectTimeout=5 \
                -i "$ssh_key" "${ssh_auth_user}@${ssh_host}" "echo ok" &>/dev/null; then
                echo "✓ Connection successful"
                return 0
            else
                echo "✗ Connection failed"
                return 1
            fi
        fi
    done

    echo "Error: Symbol '$symbol' not found" >&2
    return 1
}

# ============================================================================
# INTEGRATION WITH ORG REPL
# ============================================================================

# Add to org REPL action preview
org_resolve_tes_preview() {
    local action="$1"
    local env="$2"
    local org_toml="${3:-$TETRA_DIR/config/tetra.toml}"

    # Map environment to symbol
    local symbol="@${env,,}"

    # Get SSH command
    local ssh_cmd
    ssh_cmd=$(org_tes_ssh_command "$symbol" "$org_toml" 2>/dev/null)

    if [[ -n "$ssh_cmd" ]]; then
        if [[ "$ssh_cmd" == "bash" ]]; then
            echo "│   Type:       local"
            echo "│   Command:    (runs locally, no SSH)"
        else
            echo "│   Type:       remote"
            echo "│   Symbol:     $symbol"
            echo "│   SSH:        $ssh_cmd"
        fi
    else
        echo "│   Type:       [UNRESOLVED]"
        echo "│   Symbol:     $symbol"
        echo "│   Error:      Environment not found"
    fi
}

# Export functions
export -f org_tes_view_all
export -f org_tes_ssh_command
export -f org_tes_connect
export -f org_tes_test
export -f org_resolve_tes_preview
export -f org_toml_view_section
export -f _org_tes_view_environments_flattened
export -f _org_tes_view_single_environment
export -f _org_tes_view_symbols_flattened
export -f _org_tes_view_connectors_flattened
