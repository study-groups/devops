#!/usr/bin/env bash

# TKM Deploy Integration
# Local command center for environment deployment

# Source utilities
TKM_SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$TKM_SRC_DIR/tkm_utils.sh"

# Deploy command entry point
tkm_deploy() {
    local action="${1:-}"

    case "$action" in
        "env")
            tkm_deploy_env "${@:2}"
            ;;
        "service")
            tkm_deploy_service "${@:2}"
            ;;
        "status")
            tkm_deploy_status "${@:2}"
            ;;
        "test")
            tkm_deploy_test "${@:2}"
            ;;
        "list")
            tkm_deploy_list
            ;;
        *)
            tkm_deploy_help
            return 1
            ;;
    esac
}

# Deploy environment file to target
tkm_deploy_env() {
    local environment="$1"
    local target_server="$2"

    if [[ -z "$environment" ]]; then
        echo "Usage: tkm deploy env <environment> [target_server]"
        echo "Example: tkm deploy env staging"
        return 1
    fi

    local env_file="env/${environment}.env"

    # Check if environment file exists
    if [[ ! -f "$env_file" ]]; then
        echo "Environment file not found: $env_file"
        echo "Create it with: tetra env promote dev $environment"
        return 1
    fi

    # Determine target server from organization config or parameter
    if [[ -z "$target_server" ]]; then
        target_server=$(tkm_get_server_for_env "$environment")
        if [[ -z "$target_server" ]]; then
            echo "No target server configured for environment: $environment"
            echo "Configure with: tkm org add or specify server manually"
            return 1
        fi
    fi

    echo "Deploying environment: $environment"
    echo "Source: $env_file"
    echo "Target: $target_server"
    echo

    # Get current organization config
    local current_org=$(tkm_org_current)
    if [[ -z "$current_org" ]]; then
        echo "No organization selected. Run: tkm org select <org>"
        return 1
    fi

    local org_config="$TKM_ORGS_DIR/$current_org/config"
    if [[ ! -f "$org_config" ]]; then
        echo "Organization config not found: $org_config"
        return 1
    fi

    # Source organization config for connection details
    source "$org_config"

    # Determine SSH details based on environment
    local ssh_user="${ENV_USERS[$environment]}"
    local target_path="/home/$ssh_user/src/pixeljam/pja/arcade/env/${environment}.env"

    if [[ -z "$ssh_user" ]]; then
        echo "Unknown user for environment: $environment"
        return 1
    fi

    echo "Deploying to: $ssh_user@$target_server:$target_path"

    # Ensure remote directory exists
    ssh "$ssh_user@$target_server" "mkdir -p $(dirname '$target_path')" || {
        echo "Failed to create remote directory"
        return 1
    }

    # Deploy environment file
    scp "$env_file" "$ssh_user@$target_server:$target_path" || {
        echo "Failed to deploy environment file"
        return 1
    }

    echo "✅ Environment deployed successfully!"

    # Offer to restart services
    read -p "Restart services on $target_server? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        tkm_deploy_restart_services "$environment" "$target_server"
    fi
}

# Deploy and restart services
tkm_deploy_service() {
    local environment="$1"
    local service_name="${2:-pixeljam-arcade}"

    if [[ -z "$environment" ]]; then
        echo "Usage: tkm deploy service <environment> [service_name]"
        return 1
    fi

    local target_server=$(tkm_get_server_for_env "$environment")
    if [[ -z "$target_server" ]]; then
        echo "No target server configured for environment: $environment"
        return 1
    fi

    local ssh_user="${ENV_USERS[$environment]}"

    echo "Deploying service: $service_name to $environment"
    echo "Target: $ssh_user@$target_server"

    # Deploy environment first
    tkm_deploy_env "$environment" "$target_server" || return 1

    # Restart systemd service
    ssh "$ssh_user@$target_server" "sudo systemctl restart $service_name" || {
        echo "Failed to restart service: $service_name"
        return 1
    }

    echo "✅ Service deployed and restarted successfully!"
}

# Show deployment status
tkm_deploy_status() {
    local environment="${1:-all}"

    echo "=== Deployment Status ==="
    echo

    if [[ "$environment" == "all" ]]; then
        for env in dev staging prod; do
            tkm_deploy_status_single "$env"
        done
    else
        tkm_deploy_status_single "$environment"
    fi
}

# Show status for single environment
tkm_deploy_status_single() {
    local environment="$1"
    local env_file="env/${environment}.env"

    echo "Environment: $environment"

    if [[ -f "$env_file" ]]; then
        local modified=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$env_file" 2>/dev/null)
        echo "  Local file: $env_file (modified: $modified)"

        local target_server=$(tkm_get_server_for_env "$environment")
        if [[ -n "$target_server" ]]; then
            local ssh_user="${ENV_USERS[$environment]}"
            local remote_path="/home/$ssh_user/src/pixeljam/pja/arcade/env/${environment}.env"

            echo "  Target: $ssh_user@$target_server:$remote_path"

            # Check if remote file exists and get modification time
            local remote_info=$(ssh "$ssh_user@$target_server" "test -f '$remote_path' && stat -c '%Y %s' '$remote_path' 2>/dev/null" 2>/dev/null)

            if [[ -n "$remote_info" ]]; then
                local remote_time=$(echo "$remote_info" | cut -d' ' -f1)
                local remote_date=$(date -r "$remote_time" "+%Y-%m-%d %H:%M" 2>/dev/null)
                echo "  Remote file: exists (modified: $remote_date)"

                # Compare local and remote checksums
                local local_checksum=$(shasum -a 256 "$env_file" | cut -d' ' -f1)
                local remote_checksum=$(ssh "$ssh_user@$target_server" "shasum -a 256 '$remote_path' 2>/dev/null | cut -d' ' -f1" 2>/dev/null)

                if [[ "$local_checksum" == "$remote_checksum" ]]; then
                    echo "  Status: ✅ In sync"
                else
                    echo "  Status: ⚠️  Out of sync"
                fi
            else
                echo "  Remote file: not found"
                echo "  Status: ❌ Not deployed"
            fi
        else
            echo "  Target: not configured"
            echo "  Status: ❌ No target server"
        fi
    else
        echo "  Local file: not found"
        echo "  Status: ❌ Environment file missing"
    fi

    echo
}

# Test local to environment deployment connectivity
tkm_deploy_test() {
    local environment="${1:-all}"

    echo "=== Local to Environment Deployment Testing ==="
    echo

    if [[ "$environment" == "all" ]]; then
        for env in dev staging prod qa; do
            tkm_deploy_test_single "$env"
            echo
        done
    else
        tkm_deploy_test_single "$environment"
    fi
}

# Test deployment connectivity for single environment
tkm_deploy_test_single() {
    local environment="$1"

    # Load organization configuration
    local current_org=$(tkm_org_current)
    if [[ -z "$current_org" ]]; then
        echo "❌ No organization selected. Run: tkm org set <org>"
        return 1
    fi

    # Load tetra.toml (renamed from pixeljam_arcade.toml)
    local org_config="$TKM_ORGS_DIR/$current_org/tetra.toml"
    local custom_config="$TKM_ORGS_DIR/$current_org/custom.toml"

    if [[ ! -f "$org_config" ]]; then
        echo "❌ Organization config not found: $org_config"
        return 1
    fi

    echo "🔍 Testing Environment: $(echo "$environment" | tr '[:lower:]' '[:upper:]')"

    # Extract server info from tetra.toml
    local server_ip=$(grep "${environment}_ip" "$org_config" 2>/dev/null | cut -d'"' -f2)
    local server_hostname=$(grep "${environment}_server" "$org_config" 2>/dev/null | cut -d'"' -f2)

    if [[ -z "$server_ip" ]]; then
        echo "❌ No server IP configured for $environment"
        return 1
    fi

    echo "  Server: $server_hostname ($server_ip)"

    # Test SSH connectivity with both root and environment user
    local ssh_users=("root" "$environment")

    # Load custom SSH users if available
    if [[ -f "$custom_config" ]]; then
        local custom_users_line=$(grep -A1 "\[ssh_users\]" "$custom_config" | grep "$environment")
        if [[ -n "$custom_users_line" ]]; then
            # Parse TOML array format: dev = ["root", "dev"]
            local users_array=$(echo "$custom_users_line" | sed 's/.*\[\(.*\)\].*/\1/' | tr -d '"' | tr ',' ' ')
            read -ra ssh_users <<< "$users_array"
        fi
    fi

    echo "  Testing SSH connectivity:"

    for user in "${ssh_users[@]}"; do
        user=$(echo "$user" | xargs)  # trim whitespace
        [[ -z "$user" ]] && continue

        echo -n "    ${user}@${server_ip}: "

        # Test SSH connection with timeout
        if timeout 5 ssh -o ConnectTimeout=3 -o BatchMode=yes -o StrictHostKeyChecking=no \
           "$user@$server_ip" "echo 'SSH connection successful'" >/dev/null 2>&1; then
            echo "✅ Connected"

            # Test deployment path access
            echo -n "    ${user}@${server_ip} deployment path: "
            if timeout 5 ssh -o ConnectTimeout=3 -o BatchMode=yes \
               "$user@$server_ip" "test -w /var/www || test -w /home/$user" >/dev/null 2>&1; then
                echo "✅ Writable"
            else
                echo "⚠️  Limited access"
            fi
        else
            echo "❌ Connection failed"
        fi
    done

    # Test named port availability via TSM integration
    echo "  Testing service ports:"

    # Check if TSM is available and get named ports
    if command -v tsm >/dev/null 2>&1; then
        local tsm_ports=$(tsm ports scan 2>/dev/null | grep -E "(devpages|arcade|tetra|pbase)" | head -4)
        if [[ -n "$tsm_ports" ]]; then
            echo "$tsm_ports" | while read -r line; do
                local service=$(echo "$line" | awk '{print $1}')
                local port=$(echo "$line" | awk '{print $2}')
                local status=$(echo "$line" | awk '{print $3}')

                echo "    $service:$port → $status"
            done
        else
            echo "    ⚠️  No TSM named ports configured"
        fi
    else
        echo "    ⚠️  TSM not available for port testing"
    fi

    # Test nginx configuration readiness
    echo "  Testing nginx readiness:"
    for user in "${ssh_users[@]}"; do
        user=$(echo "$user" | xargs)
        [[ -z "$user" ]] && continue

        if timeout 5 ssh -o ConnectTimeout=3 -o BatchMode=yes \
           "$user@$server_ip" "which nginx && test -d /etc/nginx/sites-enabled" >/dev/null 2>&1; then
            echo "    ${user}@${server_ip}: ✅ nginx ready"
            break
        fi
    done
}

# List deployable environments
tkm_deploy_list() {
    echo "=== Deployable Environments ==="
    echo

    for env_file in env/*.env; do
        if [[ -f "$env_file" ]]; then
            local env_name=$(basename "$env_file" .env)
            local target_server=$(tkm_get_server_for_env "$env_name")
            local size=$(wc -l < "$env_file" 2>/dev/null)

            printf "  %-10s %s → %s (%d variables)\n" \
                "$env_name" \
                "$env_file" \
                "${target_server:-not configured}" \
                "$size"
        fi
    done

    if ! ls env/*.env >/dev/null 2>&1; then
        echo "  No environment files found"
        echo "  Create with: tetra env promote dev staging"
    fi
}

# Restart services on target
tkm_deploy_restart_services() {
    local environment="$1"
    local target_server="$2"
    local ssh_user="${ENV_USERS[$environment]}"

    echo "Restarting services on $target_server..."

    # Try different service names based on environment
    local service_names=("pixeljam-arcade" "arcade-${environment}" "pja-${environment}")

    for service in "${service_names[@]}"; do
        if ssh "$ssh_user@$target_server" "systemctl is-active --quiet $service" 2>/dev/null; then
            echo "Restarting service: $service"
            ssh "$ssh_user@$target_server" "sudo systemctl restart $service"
            break
        fi
    done
}

# Get server for environment from organization config
tkm_get_server_for_env() {
    local environment="$1"

    # For now, use simple mapping - can be enhanced with NH integration
    case "$environment" in
        "dev")
            echo "dev.pixeljamarcade.com"
            ;;
        "staging"|"prod")
            echo "pixeljamarcade.com"  # shared server
            ;;
        *)
            echo ""
            ;;
    esac
}

# Get current organization
tkm_org_current() {
    if [[ -f "$TKM_CURRENT_ORG_FILE" ]]; then
        cat "$TKM_CURRENT_ORG_FILE"
    fi
}

# Help function
tkm_deploy_help() {
    cat <<'EOF'
TKM Deploy - Local Command Center for Environment Deployment

Usage: tkm deploy <command> [options]

Commands:
  env <environment> [server]      Deploy environment file to target server
  service <environment> [name]    Deploy environment and restart service
  status [environment]            Show deployment status for environments
  test [environment]              Test local to environment connectivity (root/user SSH)
  list                           List deployable environments

Environment Deployment:
  tkm deploy env staging          Deploy staging.env to staging server
  tkm deploy env prod             Deploy prod.env to production server
  tkm deploy service staging      Deploy and restart staging service

Testing and Validation:
  tkm deploy test                 Test connectivity to all environments
  tkm deploy test dev             Test connectivity to dev environment
  tkm deploy test staging         Test staging deployment readiness

Status and Management:
  tkm deploy status               Show status for all environments
  tkm deploy status staging       Show status for staging environment
  tkm deploy list                 List all deployable environments

The Tetra Way - Local Command Center:
  1. Local machine serves as TKM command center
  2. Manage SSH keys and deployment credentials locally
  3. Deploy environment files securely to target servers
  4. Coordinate service restarts across environments
  5. Track deployment status and synchronization

Prerequisites:
  - SSH keys configured for target servers (tkm generate/deploy)
  - Organization configured (tkm org add)
  - Environment files created (tetra env promote)
EOF
}

# Environment user mappings (matches tetra_env.sh)
declare -A ENV_USERS=(
    ["dev"]="dev"
    ["staging"]="staging"
    ["prod"]="prod"
)