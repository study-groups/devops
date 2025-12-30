#!/usr/bin/env bash
# TSM Multi-User Support
# Enables root to see and control services across all users

# === CONFIGURATION ===

# auto: enabled if root, disabled otherwise
# enabled: always enabled (for testing)
# disabled: always disabled
TSM_MULTI_USER="${TSM_MULTI_USER:-auto}"

# Detect if running as root
TSM_IS_ROOT=$([[ $EUID -eq 0 ]] && echo 1 || echo 0)
TSM_CURRENT_USER="${USER:-$(whoami)}"

# === MULTI-USER STATE ===

# Check if multi-user mode is active
tsm_multi_user_enabled() {
    case "$TSM_MULTI_USER" in
        enabled) return 0 ;;
        disabled) return 1 ;;
        auto|*)
            [[ $TSM_IS_ROOT -eq 1 ]] && return 0 || return 1
            ;;
    esac
}

# === USER HOME DISCOVERY ===

# Discover all user home directories with TSM installations
# Supports Linux (/home/*) and macOS (/Users/*)
tsm_discover_user_homes() {
    local homes=()

    # Linux: scan /home/*
    if [[ -d "/home" ]]; then
        for h in /home/*; do
            [[ -d "$h/tetra/tsm" ]] && homes+=("$h")
        done
    fi

    # macOS: scan /Users/* (skip Shared)
    if [[ -d "/Users" ]]; then
        for h in /Users/*; do
            [[ "$h" == "/Users/Shared" ]] && continue
            [[ -d "$h/tetra/tsm" ]] && homes+=("$h")
        done
    fi

    # Root's home
    [[ -d "/root/tetra/tsm" ]] && homes+=("/root")

    printf '%s\n' "${homes[@]}"
}

# Extract username from home directory path
# /home/dev/... → dev
# /Users/mricos/... → mricos
# /root/... → root
tsm_extract_username() {
    local path="$1"

    if [[ "$path" =~ ^/home/([^/]+) ]]; then
        echo "${BASH_REMATCH[1]}"
    elif [[ "$path" =~ ^/Users/([^/]+) ]]; then
        echo "${BASH_REMATCH[1]}"
    elif [[ "$path" =~ ^/root ]]; then
        echo "root"
    else
        # Fallback: use basename of home dir
        basename "$(dirname "$(dirname "$path")")" 2>/dev/null || echo "unknown"
    fi
}

# Get TSM processes directory for a specific user
tsm_get_user_processes_dir() {
    local username="$1"

    if [[ "$username" == "root" ]]; then
        echo "/root/tetra/tsm/runtime/processes"
    elif [[ -d "/home/$username" ]]; then
        echo "/home/$username/tetra/tsm/runtime/processes"
    elif [[ -d "/Users/$username" ]]; then
        echo "/Users/$username/tetra/tsm/runtime/processes"
    fi
}

# Get all TSM process directories
# Multi-user mode: all users' directories
# Single-user mode: only current user's directory
tsm_get_all_process_dirs() {
    if tsm_multi_user_enabled; then
        # Scan all user homes
        while IFS= read -r user_home; do
            local processes_dir="$user_home/tetra/tsm/runtime/processes"
            [[ -d "$processes_dir" ]] && echo "$processes_dir"
        done < <(tsm_discover_user_homes)
    else
        # Current user only
        echo "$TSM_PROCESSES_DIR"
    fi
}

# === USER:SERVICE PARSING ===

# Parse user:service syntax
# Returns: TSM_TARGET_USER TSM_TARGET_SERVICE
# Examples:
#   "dev:gamma" → user=dev, service=gamma
#   "gamma" → user=current, service=gamma
#   "dev:*" → user=dev, service=* (all)
tsm_parse_user_service() {
    local input="$1"

    if [[ "$input" == *:* ]]; then
        TSM_TARGET_USER="${input%%:*}"
        TSM_TARGET_SERVICE="${input#*:}"
    else
        TSM_TARGET_USER="$TSM_CURRENT_USER"
        TSM_TARGET_SERVICE="$input"
    fi

    export TSM_TARGET_USER TSM_TARGET_SERVICE
}

# === PERMISSION CHECKS ===

# Get owner username from process directory path
tsm_get_process_owner() {
    local process_dir="$1"
    tsm_extract_username "$process_dir"
}

# Check if current user can control a process
# Root can control all, users can only control their own
tsm_can_control() {
    local target_user="$1"

    # Root can control all
    [[ $TSM_IS_ROOT -eq 1 ]] && return 0

    # User can control their own
    [[ "$target_user" == "$TSM_CURRENT_USER" ]] && return 0

    return 1
}

# Verify permission and return error if denied
tsm_require_permission() {
    local target_user="$1"
    local action="${2:-control}"

    if ! tsm_can_control "$target_user"; then
        tsm_error "Permission denied: cannot $action $target_user's services"
        return 1
    fi
    return 0
}

# === CROSS-USER EXECUTION ===

# Run a command as a different user (requires root)
tsm_run_as_user() {
    local target_user="$1"
    shift

    if [[ "$target_user" == "$TSM_CURRENT_USER" ]]; then
        # Same user, run directly
        "$@"
    elif [[ $TSM_IS_ROOT -eq 1 ]]; then
        # Root can sudo to any user
        sudo -u "$target_user" "$@"
    else
        tsm_error "Cannot run as $target_user: not root"
        return 1
    fi
}

# Get the target user's TSM environment
tsm_get_user_env() {
    local target_user="$1"
    local user_home

    if [[ "$target_user" == "root" ]]; then
        user_home="/root"
    elif [[ -d "/home/$target_user" ]]; then
        user_home="/home/$target_user"
    elif [[ -d "/Users/$target_user" ]]; then
        user_home="/Users/$target_user"
    else
        return 1
    fi

    echo "TETRA_DIR=$user_home/tetra"
    echo "TSM_DIR=$user_home/tetra/tsm"
    echo "TSM_PROCESSES_DIR=$user_home/tetra/tsm/runtime/processes"
}

# === LIST USERS ===

# List all users with active TSM installations
tsm_list_users() {
    printf "%-15s %-30s %-10s %s\n" "USER" "TSM_DIR" "PROCESSES" "PORTS"
    printf "%-15s %-30s %-10s %s\n" "----" "-------" "---------" "-----"

    while IFS= read -r user_home; do
        local username=$(tsm_extract_username "$user_home")
        local tsm_dir="$user_home/tetra/tsm"
        local processes_dir="$tsm_dir/runtime/processes"

        # Count processes
        local proc_count=0
        if [[ -d "$processes_dir" ]]; then
            proc_count=$(find "$processes_dir" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')
        fi

        # Collect ports
        local ports=()
        if [[ -d "$processes_dir" ]]; then
            for process_dir in "$processes_dir"/*/; do
                [[ -d "$process_dir" ]] || continue
                local meta_file="${process_dir}meta.json"
                if [[ -f "$meta_file" ]]; then
                    local port=$(jq -r '.port // empty' "$meta_file" 2>/dev/null)
                    [[ -n "$port" && "$port" != "null" ]] && ports+=("$port")
                fi
            done
        fi

        local ports_str="${ports[*]}"
        [[ -z "$ports_str" ]] && ports_str="-"
        ports_str="${ports_str// /,}"

        printf "%-15s %-30s %-10s %s\n" "$username" "$tsm_dir" "$proc_count" "$ports_str"
    done < <(tsm_discover_user_homes)
}

# === EXPORTS ===

export TSM_MULTI_USER TSM_IS_ROOT TSM_CURRENT_USER
export TSM_TARGET_USER TSM_TARGET_SERVICE

export -f tsm_multi_user_enabled
export -f tsm_discover_user_homes tsm_extract_username
export -f tsm_get_user_processes_dir tsm_get_all_process_dirs
export -f tsm_parse_user_service
export -f tsm_get_process_owner tsm_can_control tsm_require_permission
export -f tsm_run_as_user tsm_get_user_env
export -f tsm_list_users
