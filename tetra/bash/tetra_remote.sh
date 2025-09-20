#!/usr/bin/env bash

# Tetra Configuration at Distance Functions
# Implements "Do X on Y with Z" paradigm

# Get current TKM organization directory
_tetra_get_tkm_org_dir() {
    local tkm_current_org_file="${TKM_DIR:-$TETRA_DIR/tkm}/.current_org"
    if [[ -f "$tkm_current_org_file" ]]; then
        local org_name=$(cat "$tkm_current_org_file")
        local org_dir="${TKM_ORGS_DIR:-$TETRA_DIR/tkm/organizations}/$org_name"
        if [[ -d "$org_dir" ]]; then
            echo "$org_dir"
            return 0
        fi
    fi
    return 1
}

# Get environment host information from TKM
_tetra_get_env_from_tkm() {
    local env_name="$1"
    local org_dir=$(_tetra_get_tkm_org_dir)

    if [[ -n "$org_dir" && -f "$org_dir/environments/servers.conf" ]]; then
        # Format: ENV_NAME:PUBLIC_IP:PRIVATE_IP:FLOATING_IP:USER:PRIVILEGES:SPECS
        local env_line=$(grep "^${env_name}:" "$org_dir/environments/servers.conf" 2>/dev/null)
        if [[ -n "$env_line" ]]; then
            echo "$env_line"
            return 0
        fi
    fi
    return 1
}

# Parse environment line to get user@host format
_tetra_parse_env_line() {
    local env_line="$1"
    local env_name public_ip private_ip floating_ip user privileges specs

    IFS=':' read -r env_name public_ip private_ip floating_ip user privileges specs <<< "$env_line"

    # Use floating IP if available, otherwise public IP
    local host_ip="${floating_ip:-$public_ip}"
    echo "${user}@${host_ip}"
}

# Get SSH key for environment from TKM
_tetra_get_env_key() {
    local env_name="$1"
    local org_dir=$(_tetra_get_tkm_org_dir)

    if [[ -n "$org_dir" ]]; then
        # Look for active deployment key for this environment
        local key_pattern="${env_name}_deploy_*.key"
        local key_file=$(find "$org_dir/keys" -name "$key_pattern" -type f 2>/dev/null | head -1)
        if [[ -f "$key_file" ]]; then
            echo "$key_file"
            return 0
        fi
    fi

    # Fallback to default SSH key
    echo "$HOME/.ssh/id_rsa"
}

# Resolve target to user@host format
tetra_resolve_target() {
    local target="$1"

    # Try TKM organization data first
    local env_line=$(_tetra_get_env_from_tkm "$target" 2>/dev/null)
    if [[ -n "$env_line" ]]; then
        _tetra_parse_env_line "$env_line"
        return 0
    fi

    # Fallback to hardcoded mappings
    case "$target" in
        local|localhost)
            echo "$USER@127.0.0.1"
            ;;
        staging)
            echo "staging@staging.pixeljamarcade.com"
            ;;
        prod|production)
            echo "production@prod.pixeljamarcade.com"
            ;;
        dev|development)
            echo "dev@dev.pixeljamarcade.com"
            ;;
        *)
            # Assume it's already in user@host format or just a hostname
            if [[ "$target" == *"@"* ]]; then
                echo "$target"
            else
                echo "$USER@$target"
            fi
            ;;
    esac
}

# Get SSH key for target
tetra_get_key_for_target() {
    local target="$1"

    # Try TKM key management first
    local key_file=$(_tetra_get_env_key "$target" 2>/dev/null)
    if [[ -f "$key_file" ]]; then
        echo "$key_file"
        return 0
    fi

    # Fallback to default SSH key
    if [[ -f "$HOME/.ssh/id_rsa" ]]; then
        echo "$HOME/.ssh/id_rsa"
    elif [[ -f "$HOME/.ssh/id_ed25519" ]]; then
        echo "$HOME/.ssh/id_ed25519"
    else
        echo "$HOME/.ssh/id_rsa"  # Let SSH handle the error
    fi
}

# Execute command on remote target
tetra_remote_exec() {
    local target="$1"
    shift
    local command="$*"

    if [[ -z "$target" || -z "$command" ]]; then
        echo "Usage: tetra_remote_exec <target> \"<command>\""
        echo "Example: tetra_remote_exec staging \"tsm list\""
        return 1
    fi

    local ssh_target=$(tetra_resolve_target "$target")
    local key_file=$(tetra_get_key_for_target "$target")

    echo "→ Executing on $target ($ssh_target): $command"

    # SSH with reasonable timeouts and options
    ssh -i "$key_file" \
        -o StrictHostKeyChecking=no \
        -o UserKnownHostsFile=/dev/null \
        -o ConnectTimeout=10 \
        -o ServerAliveInterval=60 \
        -o ServerAliveCountMax=3 \
        "$ssh_target" \
        "$command"
}

# Create SSH tunnel
tetra_ssh_tunnel() {
    local target_port="$1"
    local options="${2:-}"

    if [[ -z "$target_port" ]]; then
        echo "Usage: tetra_ssh_tunnel <target:remote_port[:local_port]> [options]"
        echo "Example: tetra_ssh_tunnel staging:4444"
        echo "Example: tetra_ssh_tunnel prod:3000:8080"
        echo "Options: -f (background), -N (no shell)"
        return 1
    fi

    local target remote_port local_port
    IFS=':' read -r target remote_port local_port <<< "$target_port"
    local_port=${local_port:-$remote_port}

    local ssh_target=$(tetra_resolve_target "$target")
    local key_file=$(tetra_get_key_for_target "$target")

    echo "→ Creating tunnel: localhost:$local_port -> $target:$remote_port"
    echo "→ SSH target: $ssh_target"
    echo "→ Press Ctrl+C to close tunnel"

    # Default to foreground, no shell
    local ssh_options="-N"
    if [[ "$options" == *"-f"* ]]; then
        ssh_options="-f -N"
        echo "→ Running in background"
    fi

    ssh -i "$key_file" \
        -o StrictHostKeyChecking=no \
        -o UserKnownHostsFile=/dev/null \
        -o ServerAliveInterval=60 \
        -o ServerAliveCountMax=3 \
        -L "$local_port:localhost:$remote_port" \
        $ssh_options \
        "$ssh_target"
}

# Execute command remotely (alias for tetra_remote_exec)
tetra_remote_command() {
    tetra_remote_exec "$@"
}

# Execute command on multiple targets
tetra_remote_exec_all() {
    local targets="$1"
    shift
    local command="$*"

    if [[ -z "$targets" || -z "$command" ]]; then
        echo "Usage: tetra_remote_exec_all <target1,target2,...> \"<command>\""
        echo "Example: tetra_remote_exec_all staging,prod \"uptime\""
        return 1
    fi

    IFS=',' read -ra target_array <<< "$targets"

    for target in "${target_array[@]}"; do
        echo "====== $target ======"
        tetra_remote_exec "$target" "$command"
        echo
    done
}

# Test connectivity to target
tetra_test_connection() {
    local target="$1"

    if [[ -z "$target" ]]; then
        echo "Usage: tetra_test_connection <target>"
        return 1
    fi

    local ssh_target=$(tetra_resolve_target "$target")
    local key_file=$(tetra_get_key_for_target "$target")

    echo "→ Testing connection to $target ($ssh_target)"

    if ssh -i "$key_file" \
        -o StrictHostKeyChecking=no \
        -o UserKnownHostsFile=/dev/null \
        -o ConnectTimeout=5 \
        -o BatchMode=yes \
        "$ssh_target" \
        "echo 'Connection successful to $(hostname)'" 2>/dev/null; then
        echo "✅ Connection to $target successful"
        return 0
    else
        echo "❌ Connection to $target failed"
        return 1
    fi
}

# Show available targets from TKM
tetra_list_targets() {
    echo "Available Targets:"
    echo "=================="

    # Try to get from TKM first
    local org_dir=$(_tetra_get_tkm_org_dir)
    if [[ -n "$org_dir" && -f "$org_dir/environments/servers.conf" ]]; then
        echo "From TKM Organization:"
        while IFS=':' read -r env_name public_ip private_ip floating_ip user privileges specs; do
            [[ "$env_name" =~ ^#.*$ ]] && continue  # Skip comments
            [[ -z "$env_name" ]] && continue        # Skip empty lines

            local host_ip="${floating_ip:-$public_ip}"
            printf "  %-12s %s@%s\n" "$env_name" "$user" "$host_ip"
        done < "$org_dir/environments/servers.conf"
    else
        echo "No TKM organization configured. Using fallback targets:"
        echo "  local        $USER@127.0.0.1"
        echo "  staging      staging@staging.pixeljamarcade.com"
        echo "  prod         production@prod.pixeljamarcade.com"
        echo "  dev          dev@dev.pixeljamarcade.com"
    fi

    echo
    echo "You can also use any user@host format directly."
}

# Configuration at Distance help
tetra_remote_help() {
    cat <<'EOF'
Tetra Configuration at Distance
==============================

Commands:
  tetra_remote_exec <target> "<cmd>"    Execute command on target
  tetra_ssh_tunnel <target:port>        Create SSH tunnel
  tetra_remote_exec_all <targets> "<cmd>" Execute on multiple targets
  tetra_test_connection <target>        Test connectivity
  tetra_list_targets                    Show available targets

Target Resolution:
  - TKM organization environments (if configured)
  - Built-in mappings: local, staging, prod, dev
  - Direct user@host format

Examples:
  tetra_remote_exec staging "uptime"
  tetra_ssh_tunnel staging:4444
  tetra_remote_exec_all staging,prod "df -h"
  tetra_test_connection prod

Integration:
  - Uses TKM organization data for target resolution
  - Uses TKM SSH keys when available
  - Fallback to standard SSH keys and hardcoded mappings
EOF
}

# Ensure zero exit when sourced
true