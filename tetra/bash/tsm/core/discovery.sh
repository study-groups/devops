#!/usr/bin/env bash

# TSM Discovery - Find TSM instances across system users
# Enables visibility into processes owned by dev/staging/prod users
# or any other system users running TSM instances

# === INSTANCE DISCOVERY ===

# Discover all TSM instances (user home directories with TSM runtime)
# Returns list of home directory paths that have TSM installed
tsm_discover_instances() {
    local homes=()

    # Scan /home for users with tetra/tsm runtime
    for user_home in /home/*; do
        [[ -d "$user_home/tetra/tsm/runtime" ]] && homes+=("$user_home")
    done

    # Check root's home
    [[ -d "/root/tetra/tsm/runtime" ]] && homes+=("/root")

    # Check current user's home (macOS style ~/tetra)
    [[ -d "$HOME/tetra/tsm/runtime" && ! " ${homes[*]} " =~ " $HOME " ]] && homes+=("$HOME")

    printf '%s\n' "${homes[@]}"
}

# Get owner (username) from a TSM path
# Works with process dirs, runtime dirs, or any path under a user's tetra install
tsm_get_instance_owner() {
    local path="$1"

    # Extract from /home/username/...
    if [[ "$path" =~ ^/home/([^/]+) ]]; then
        echo "${BASH_REMATCH[1]}"
        return
    fi

    # Extract from /root/...
    if [[ "$path" =~ ^/root ]]; then
        echo "root"
        return
    fi

    # Extract from /Users/username/... (macOS)
    if [[ "$path" =~ ^/Users/([^/]+) ]]; then
        echo "${BASH_REMATCH[1]}"
        return
    fi

    # Fallback: try to derive from path structure
    # Assumes .../tetra/tsm/... pattern
    if [[ "$path" =~ /tetra/tsm/ ]]; then
        local before_tetra="${path%%/tetra/tsm/*}"
        basename "$before_tetra"
        return
    fi

    # Last resort
    echo "unknown"
}

# Get processes directory for a specific owner
tsm_get_owner_processes_dir() {
    local owner="$1"

    case "$owner" in
        root)
            echo "/root/tetra/tsm/runtime/processes"
            ;;
        *)
            # Try /home first (Linux), then /Users (macOS)
            if [[ -d "/home/$owner/tetra/tsm/runtime/processes" ]]; then
                echo "/home/$owner/tetra/tsm/runtime/processes"
            elif [[ -d "/Users/$owner/tetra/tsm/runtime/processes" ]]; then
                echo "/Users/$owner/tetra/tsm/runtime/processes"
            else
                echo "/home/$owner/tetra/tsm/runtime/processes"
            fi
            ;;
    esac
}

# Get all process directories across all discovered instances
# Respects TSM_MULTI_USER_ENABLED setting
tsm_get_all_process_dirs() {
    if [[ $TSM_MULTI_USER_ENABLED -eq 1 ]]; then
        # Multi-user mode: scan all discovered instances
        while IFS= read -r user_home; do
            local processes_dir="$user_home/tetra/tsm/runtime/processes"
            [[ -d "$processes_dir" ]] && echo "$processes_dir"
        done < <(tsm_discover_instances)
    else
        # Single-user mode: only current user's processes
        echo "$TSM_PROCESSES_DIR"
    fi
}

# === INSTANCE LISTING ===

# List all discovered TSM instances with summary info
tsm_list_instances() {
    local C_HEADER='\033[1;36m'
    local C_NC='\033[0m'

    echo -e "${C_HEADER}TSM Instances${C_NC}"
    printf "%-15s %-35s %-8s %s\n" "OWNER" "RUNTIME_DIR" "PROCS" "PORTS"
    printf "%-15s %-35s %-8s %s\n" "-----" "-----------" "-----" "-----"

    while IFS= read -r user_home; do
        local owner=$(tsm_get_instance_owner "$user_home")
        local runtime_dir="$user_home/tetra/tsm/runtime"
        local processes_dir="$runtime_dir/processes"

        # Count running processes
        local proc_count=0
        local ports=()

        if [[ -d "$processes_dir" ]]; then
            for process_dir in "$processes_dir"/*/; do
                [[ -d "$process_dir" ]] || continue
                local meta_file="${process_dir}meta.json"
                [[ -f "$meta_file" ]] || continue

                local pid=$(jq -r '.pid // empty' "$meta_file" 2>/dev/null)
                # Only count if actually running
                if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
                    ((proc_count++))
                    local port=$(jq -r '.port // empty' "$meta_file" 2>/dev/null)
                    [[ -n "$port" && "$port" != "null" && "$port" != "none" ]] && ports+=("$port")
                fi
            done
        fi

        local ports_str="${ports[*]}"
        ports_str="${ports_str// /,}"
        [[ -z "$ports_str" ]] && ports_str="-"

        # Shorten runtime_dir for display
        local display_dir="$runtime_dir"
        [[ "$display_dir" == "$HOME"* ]] && display_dir="~${display_dir#$HOME}"

        printf "%-15s %-35s %-8s %s\n" "$owner" "$display_dir" "$proc_count" "$ports_str"
    done < <(tsm_discover_instances)
}

# === PROCESS OWNERSHIP ===

# Get the owner of a specific process directory
tsm_get_process_owner() {
    local process_dir="$1"
    tsm_get_instance_owner "$process_dir"
}

# Check if current user can control a process
tsm_can_control_process() {
    local process_dir="$1"
    local owner=$(tsm_get_process_owner "$process_dir")

    # Root can always control all
    [[ $TSM_IS_ROOT -eq 1 ]] && return 0

    # User can control their own
    [[ "$owner" == "$TSM_CURRENT_USER" ]] && return 0

    # In multi-user mode but not root: read-only access to others
    return 1
}

# === BACKWARD COMPATIBILITY ALIASES ===
# These will be removed in a future version

tsm_get_user_homes() { tsm_discover_instances "$@"; }
tsm_extract_username_from_path() { tsm_get_instance_owner "$@"; }
tsm_get_user_processes_dir() { tsm_get_owner_processes_dir "$@"; }
tsm_list_users() { tsm_list_instances "$@"; }

# Export discovery functions
export -f tsm_discover_instances
export -f tsm_get_instance_owner
export -f tsm_get_owner_processes_dir
export -f tsm_get_all_process_dirs
export -f tsm_list_instances
export -f tsm_get_process_owner
export -f tsm_can_control_process

# Export compatibility aliases
export -f tsm_get_user_homes
export -f tsm_extract_username_from_path
export -f tsm_get_user_processes_dir
export -f tsm_list_users
