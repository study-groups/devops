#!/usr/bin/env bash

# RCM Registry - Command definitions and SSH prefix management
# Single responsibility: Define what commands exist and how to connect to environments

# Global command registry - semantic name → command string
declare -gA RCM_COMMANDS=(
    # File system exploration
    ["home_directory"]="ls -la ~"
    ["log_directory"]="ls -la /var/log"
    ["nginx_config_dir"]="ls -la /etc/nginx"
    ["tetra_workspace"]="ls -la ~/tetra"
    ["system_root"]="ls -la /"
    ["proc_directory"]="ls -la /proc"

    # Configuration viewing
    ["active_config"]="cat ~/tetra/config/tetra.toml"
    ["nginx_main_config"]="cat /etc/nginx/nginx.conf"
    ["system_hosts"]="cat /etc/hosts"
    ["user_profile"]="cat ~/.bashrc"
    ["ssh_config"]="cat ~/.ssh/config"
    ["environment_vars"]="env | sort"

    # Log monitoring
    ["nginx_errors"]="tail -20 /var/log/nginx/error.log"
    ["nginx_access"]="tail -20 /var/log/nginx/access.log"
    ["system_log"]="tail -20 /var/log/syslog"
    ["auth_log"]="tail -20 /var/log/auth.log"
    ["tetra_log"]="tail -20 /var/log/tetra/tetra.log"

    # System monitoring
    ["running_processes"]="ps aux | head -20"
    ["disk_usage"]="df -h"
    ["memory_info"]="free -h"
    ["network_connections"]="ss -tuln | head -20"
    ["system_uptime"]="uptime"
    ["current_users"]="who"

    # Service status
    ["nginx_status"]="systemctl status nginx"
    ["tetra_service_status"]="systemctl status tetra.service"
    ["ssh_status"]="systemctl status ssh"
    ["all_services"]="systemctl list-units --type=service --state=active"
)

# Default SSH prefixes per environment - support multiple users per amigo
declare -gA DEFAULT_SSH_PREFIXES=(
    ["local"]=""
    ["dev_root"]="ssh root@dev.pixeljamarcade.com"
    ["dev_tetra"]="ssh tetra@dev.pixeljamarcade.com"
    ["dev_ubuntu"]="ssh ubuntu@dev.pixeljamarcade.com"
    ["staging_root"]="ssh root@staging.pixeljamarcade.com"
    ["staging_deploy"]="ssh deploy@staging.pixeljamarcade.com"
    ["staging_ubuntu"]="ssh ubuntu@staging.pixeljamarcade.com"
    ["prod_root"]="ssh root@prod.pixeljamarcade.com"
    ["prod_deploy"]="ssh deploy@prod.pixeljamarcade.com"
    ["prod_ubuntu"]="ssh ubuntu@prod.pixeljamarcade.com"
    ["qa_root"]="ssh root@qa.pixeljamarcade.com"
    ["qa_tetra"]="ssh tetra@qa.pixeljamarcade.com"
    ["qa_ubuntu"]="ssh ubuntu@qa.pixeljamarcade.com"
)

# Environment comments for system overview
declare -gA ENV_COMMENTS=(
    ["local"]="Direct execution on mricos@m2.local"
    ["dev_root"]="Full system access to development server"
    ["dev_tetra"]="Tetra service user on development"
    ["dev_ubuntu"]="Standard user on development"
    ["staging_root"]="Full system access to staging server"
    ["staging_deploy"]="Deployment user on staging"
    ["staging_ubuntu"]="Standard user on staging"
    ["prod_root"]="Full system access to production server"
    ["prod_deploy"]="Deployment user on production"
    ["prod_ubuntu"]="Standard user on production"
    ["qa_root"]="Full system access to QA server"
    ["qa_tetra"]="Tetra service user on QA"
    ["qa_ubuntu"]="Standard user on QA"
)

# Current SSH prefixes (editable in TView) - start with defaults
declare -gA CURRENT_SSH_PREFIXES=()

# Initialize current prefixes from defaults
rcm_init_prefixes() {
    for env in "${!DEFAULT_SSH_PREFIXES[@]}"; do
        CURRENT_SSH_PREFIXES["$env"]="${DEFAULT_SSH_PREFIXES[$env]}"
    done
}

# Override SSH prefix for environment (Edit functionality)
rcm_set_ssh_prefix() {
    local env="$1"
    local new_prefix="$2"

    if [[ -z "$env" || -z "$new_prefix" ]]; then
        echo "Usage: rcm_set_ssh_prefix <environment> <ssh_prefix>"
        return 1
    fi

    CURRENT_SSH_PREFIXES["$env"]="$new_prefix"
    echo "SSH prefix for '$env' set to: $new_prefix"
}

# Reset SSH prefix to default (Undo functionality)
rcm_reset_ssh_prefix() {
    local env="$1"

    if [[ -z "$env" ]]; then
        echo "Usage: rcm_reset_ssh_prefix <environment>"
        return 1
    fi

    if [[ -n "${DEFAULT_SSH_PREFIXES[$env]:-}" ]]; then
        CURRENT_SSH_PREFIXES["$env"]="${DEFAULT_SSH_PREFIXES[$env]}"
        echo "SSH prefix for '$env' reset to default: ${DEFAULT_SSH_PREFIXES[$env]}"
    else
        echo "No default SSH prefix found for environment: $env"
        return 1
    fi
}

# List available commands
rcm_list_commands() {
    echo "Available RCM commands:"
    for cmd in "${!RCM_COMMANDS[@]}"; do
        printf "  %-20s → %s\n" "$cmd" "${RCM_COMMANDS[$cmd]}"
    done | sort
}

# List current SSH prefixes
rcm_list_prefixes() {
    echo "Current SSH prefixes:"
    for env in "${!CURRENT_SSH_PREFIXES[@]}"; do
        local prefix="${CURRENT_SSH_PREFIXES[$env]}"
        local default_marker=""
        if [[ "$prefix" == "${DEFAULT_SSH_PREFIXES[$env]:-}" ]]; then
            default_marker=" (default)"
        else
            default_marker=" (modified)"
        fi
        printf "  %-15s → %s%s\n" "$env" "$prefix" "$default_marker"
    done | sort
}

# Initialize on load
rcm_init_prefixes