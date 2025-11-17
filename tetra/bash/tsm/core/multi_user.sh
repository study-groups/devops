#!/usr/bin/env bash

# TSM Multi-User Support
# Allows root to scan and view processes from multiple user TSM instances

# === USER HOME DETECTION ===

# Get list of user home directories that have TSM installed
tsm_get_user_homes() {
    local homes=()

    # Scan /home for users with tetra/tsm
    for user_home in /home/*; do
        [[ -d "$user_home/tetra/tsm/runtime" ]] && homes+=("$user_home")
    done

    # Add root's home if it has TSM
    if [[ -d "/root/tetra/tsm/runtime" ]]; then
        homes+=("/root")
    fi

    printf '%s\n' "${homes[@]}"
}

# Get username from home directory path
tsm_extract_username_from_path() {
    local path="$1"

    # Extract from /home/username/... or /root/...
    if [[ "$path" =~ ^/home/([^/]+) ]]; then
        echo "${BASH_REMATCH[1]}"
    elif [[ "$path" =~ ^/root ]]; then
        echo "root"
    else
        # Fallback: use basename of parent directory
        basename "$(dirname "$(dirname "$path")")"
    fi
}

# Get TSM processes directory for a specific user
tsm_get_user_processes_dir() {
    local username="$1"

    if [[ "$username" == "root" ]]; then
        echo "/root/tetra/tsm/runtime/processes"
    else
        echo "/home/$username/tetra/tsm/runtime/processes"
    fi
}

# Get all TSM process directories (all users if root, current user otherwise)
tsm_get_all_process_dirs() {
    if [[ $TSM_IS_ROOT -eq 1 ]]; then
        # Root: scan all user homes
        while IFS= read -r user_home; do
            local processes_dir="$user_home/tetra/tsm/runtime/processes"
            [[ -d "$processes_dir" ]] && echo "$processes_dir"
        done < <(tsm_get_user_homes)
    else
        # Regular user: only their own
        echo "$TSM_PROCESSES_DIR"
    fi
}

# === USER LISTING ===

# List all users with active TSM instances
tsm_list_users() {
    local C_HEADER='\033[1;36m'
    local C_NC='\033[0m'

    echo -e "${C_HEADER}TSM Users${C_NC}"
    printf "%-15s %-30s %-10s %s\n" "USER" "TSM_DIR" "PROCESSES" "PORTS"
    printf "%-15s %-30s %-10s %s\n" "----" "-------" "---------" "-----"

    while IFS= read -r user_home; do
        local username=$(tsm_extract_username_from_path "$user_home")
        local tsm_dir="$user_home/tetra/tsm/runtime"
        local processes_dir="$tsm_dir/processes"

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
                    [[ -n "$port" && "$port" != "null" && "$port" != "none" ]] && ports+=("$port")
                fi
            done
        fi

        local ports_str=$(IFS=,; echo "${ports[*]}")
        [[ -z "$ports_str" ]] && ports_str="-"

        printf "%-15s %-30s %-10s %s\n" "$username" "$tsm_dir" "$proc_count" "$ports_str"
    done < <(tsm_get_user_homes)
}

# === PROCESS OWNERSHIP ===

# Get the owner username from a process directory path
tsm_get_process_owner() {
    local process_dir="$1"

    # Extract username from path
    # /home/dev/tetra/tsm/runtime/processes/name/ → dev
    # /root/tetra/tsm/runtime/processes/name/ → root
    tsm_extract_username_from_path "$process_dir"
}

# Check if current user can control a process
tsm_can_control_process() {
    local process_dir="$1"
    local owner=$(tsm_get_process_owner "$process_dir")

    # Root can control all
    [[ $TSM_IS_ROOT -eq 1 ]] && return 0

    # User can control their own
    [[ "$owner" == "$TSM_CURRENT_USER" ]] && return 0

    return 1
}

# Export all multi-user functions
export -f tsm_get_user_homes
export -f tsm_extract_username_from_path
export -f tsm_get_user_processes_dir
export -f tsm_get_all_process_dirs
export -f tsm_list_users
export -f tsm_get_process_owner
export -f tsm_can_control_process
