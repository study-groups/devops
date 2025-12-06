#!/usr/bin/env bash
# nh_ssh.sh - SSH operations for NodeHolder servers
#
# - Connect to servers by variable name
# - Manage ssh-agent and keys
# - Scan directories for keys

# =============================================================================
# KEY DIRECTORY MANAGEMENT
# =============================================================================

# Directories to scan for SSH keys (override with NH_SSH_KEY_DIRS)
declare -a _NH_SSH_KEY_DIRS=()

# Map fingerprints to file paths (for status display)
declare -A _NH_SSH_KEY_FILES=()

# Persistence file for key mappings
_NH_SSH_MAP_FILE="${HOME}/.nh_ssh_key_files"

# Load saved key mappings
_nh_ssh_load_mappings() {
    [[ -f "$_NH_SSH_MAP_FILE" ]] && source "$_NH_SSH_MAP_FILE"
}

# Save key mappings to file
_nh_ssh_save_mappings() {
    declare -p _NH_SSH_KEY_FILES > "$_NH_SSH_MAP_FILE" 2>/dev/null
}

# Initialize default search dirs
_nh_ssh_init_dirs() {
    [[ ${#_NH_SSH_KEY_DIRS[@]} -gt 0 ]] && return
    _NH_SSH_KEY_DIRS=(
        "$HOME/.ssh"
        "$NH_DIR/pj"
        "$NH_DIR/nodeholder"
    )
}

# Add a directory to search path
nh_ssh_dir_add() {
    local dir="$1"
    [[ -z "$dir" ]] && { echo "Usage: nh ssh dir add <path>"; return 1; }
    [[ ! -d "$dir" ]] && { echo "Not a directory: $dir"; return 1; }

    _nh_ssh_init_dirs
    _NH_SSH_KEY_DIRS+=("$dir")
    echo "Added: $dir"
}

# Remove a directory from search path
nh_ssh_dir_remove() {
    local dir="$1"
    [[ -z "$dir" ]] && { echo "Usage: nh ssh dir remove <path>"; return 1; }

    local new_dirs=()
    for d in "${_NH_SSH_KEY_DIRS[@]}"; do
        [[ "$d" != "$dir" ]] && new_dirs+=("$d")
    done
    _NH_SSH_KEY_DIRS=("${new_dirs[@]}")
    echo "Removed: $dir"
}

# List search directories
nh_ssh_dir_list() {
    _nh_ssh_init_dirs
    echo "SSH key search directories:"
    for dir in "${_NH_SSH_KEY_DIRS[@]}"; do
        if [[ -d "$dir" ]]; then
            echo "  $dir"
        else
            echo "  $dir (missing)"
        fi
    done
}

# =============================================================================
# SSH CONNECTION
# =============================================================================

# Connect to server by variable name
nh_ssh_connect() {
    local server="$1"
    shift
    local ssh_args="$*"

    [[ -z "$server" ]] && {
        echo "Usage: nh ssh <server> [ssh_options]"
        return 1
    }

    local ip="${!server}"
    [[ -z "$ip" ]] && {
        echo "Server not found: $server"
        echo "Available: $(nh_env_names 2>/dev/null | tr '\n' ' ')"
        return 1
    }

    echo "Connecting to $server ($ip)..."
    ssh $ssh_args "root@$ip"
}

# =============================================================================
# SSH AGENT
# =============================================================================

# Start ssh-agent if not running
nh_ssh_agent_start() {
    if ! pgrep -u "$USER" ssh-agent > /dev/null; then
        eval "$(ssh-agent -s)"
        echo "Started ssh-agent"
    else
        echo "ssh-agent already running"
    fi
}

# Show agent and key status
nh_ssh_status() {
    _nh_ssh_load_mappings

    echo "SSH Agent Status"
    echo "================"
    echo ""

    if ! pgrep -u "$USER" ssh-agent > /dev/null; then
        echo "Agent: not running"
        echo "Start with: nh ssh agent"
        return
    fi

    echo "Agent: running"
    local key_count
    key_count=$(ssh-add -l 2>/dev/null | wc -l | tr -d ' ')

    if [[ "$key_count" -eq 0 ]]; then
        echo "Keys: none loaded"
        echo ""
        echo "Load with: nh ssh scan"
        return
    fi

    echo "Keys: $key_count loaded"
    echo ""

    while IFS= read -r line; do
        local fp=$(echo "$line" | awk '{print $2}' | tr -d ':')
        local file="${_NH_SSH_KEY_FILES[$fp]:-unknown}"
        echo "$line"
        echo "  → $file"
    done < <(ssh-add -l 2>/dev/null)
}

# =============================================================================
# KEY OPERATIONS
# =============================================================================

# List loaded keys (simple)
nh_ssh_key_list() {
    ssh-add -l 2>/dev/null || echo "No keys loaded (or agent not running)"
}

# Add a single key
nh_ssh_key_add() {
    local key="$1"
    [[ -z "$key" ]] && { echo "Usage: nh ssh add <keyfile>"; return 1; }
    [[ ! -f "$key" ]] && { echo "Key not found: $key"; return 1; }

    if ssh-add "$key" 2>/dev/null; then
        local fp=$(ssh-keygen -lf "$key" | awk '{print $2}' | tr -d ':')
        _NH_SSH_KEY_FILES[$fp]="$key"
        _nh_ssh_save_mappings
        echo "Added: $key"
    else
        echo "Failed to add: $key"
        return 1
    fi
}

# Remove a key
nh_ssh_key_remove() {
    local key="$1"
    [[ -z "$key" ]] && { echo "Usage: nh ssh remove <keyfile>"; return 1; }

    if ssh-add -d "$key" 2>/dev/null; then
        echo "Removed: $key"
    else
        echo "Failed to remove: $key"
        return 1
    fi
}

# Scan directories and add all keys
nh_ssh_scan() {
    _nh_ssh_init_dirs
    _nh_ssh_load_mappings

    echo "Scanning for SSH keys..."
    echo ""

    local key_files=()
    for dir in "${_NH_SSH_KEY_DIRS[@]}"; do
        [[ ! -d "$dir" ]] && continue
        while IFS= read -r -d '' key; do
            key_files+=("$key")
        done < <(find "$dir" -maxdepth 2 -type f -name 'id_*' ! -name '*.pub' -print0 2>/dev/null)
    done

    if [[ ${#key_files[@]} -eq 0 ]]; then
        echo "No keys found in:"
        printf "  %s\n" "${_NH_SSH_KEY_DIRS[@]}"
        return 1
    fi

    local added=0 failed=0
    for key in "${key_files[@]}"; do
        if ssh-add "$key" 2>/dev/null; then
            local fp=$(ssh-keygen -lf "$key" | awk '{print $2}' | tr -d ':')
            _NH_SSH_KEY_FILES[$fp]="$key"
            echo "  + $key"
            ((added++))
        else
            echo "  - $key (failed)"
            ((failed++))
        fi
    done

    _nh_ssh_save_mappings
    echo ""
    echo "Added $added keys ($failed failed)"
}

# Clear all keys from agent
nh_ssh_clear() {
    if ssh-add -D 2>/dev/null; then
        echo "All keys removed from agent"
    else
        echo "Failed to remove keys"
        return 1
    fi
}

# =============================================================================
# DISPATCHER (called from nh ssh ...)
# =============================================================================

nh_ssh() {
    local cmd="${1:-}"
    shift 2>/dev/null || true

    case "$cmd" in
        ""|status)      nh_ssh_status ;;
        agent)          nh_ssh_agent_start ;;
        scan)           nh_ssh_scan ;;
        add)            nh_ssh_key_add "$@" ;;
        remove|rm)      nh_ssh_key_remove "$@" ;;
        list|ls)        nh_ssh_key_list ;;
        clear)          nh_ssh_clear ;;
        dir)
            local subcmd="${1:-list}"
            shift 2>/dev/null || true
            case "$subcmd" in
                add)    nh_ssh_dir_add "$@" ;;
                remove) nh_ssh_dir_remove "$@" ;;
                list|"") nh_ssh_dir_list ;;
                *)      echo "Usage: nh ssh dir {add|remove|list}" ;;
            esac
            ;;
        *)
            # Assume it's a server name
            nh_ssh_connect "$cmd" "$@"
            ;;
    esac
}

# Legacy alias
nh_ssh_start_agent() { nh_ssh_agent_start; }

# Export functions
export -f nh_ssh nh_ssh_connect nh_ssh_status nh_ssh_key_list nh_ssh_key_add
export -f nh_ssh_key_remove nh_ssh_scan nh_ssh_clear
export -f nh_ssh_agent_start nh_ssh_start_agent
export -f nh_ssh_dir_add nh_ssh_dir_remove nh_ssh_dir_list
export -f _nh_ssh_init_dirs _nh_ssh_load_mappings _nh_ssh_save_mappings
