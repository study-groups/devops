#!/usr/bin/env bash
# nh_ssh.sh - SSH operations for NodeHolder servers
#
# Simple SSH to servers using environment variables

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

    # Resolve server variable to IP
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
# SSH AGENT STATUS
# =============================================================================

nh_ssh_status() {
    echo "SSH Agent Status"
    echo "================"
    echo ""

    if pgrep -u "$USER" ssh-agent > /dev/null; then
        echo "Agent: running"

        local key_count
        key_count=$(ssh-add -l 2>/dev/null | wc -l | tr -d ' ')

        if [[ "$key_count" -eq 0 || "$key_count" == "0" ]]; then
            echo "Keys: none loaded"
        else
            echo "Keys: $key_count loaded"
            echo ""
            ssh-add -l 2>/dev/null
        fi
    else
        echo "Agent: not running"
        echo ""
        echo "Start with: eval \$(ssh-agent -s)"
    fi
}

# =============================================================================
# SSH KEY OPERATIONS
# =============================================================================

# List loaded keys
nh_ssh_key_list() {
    ssh-add -l 2>/dev/null || echo "No keys loaded (or agent not running)"
}

# Add a key to agent
nh_ssh_key_add() {
    local key="$1"

    [[ -z "$key" ]] && {
        echo "Usage: nh ssh add <keyfile>"
        return 1
    }

    [[ ! -f "$key" ]] && {
        echo "Key not found: $key"
        return 1
    }

    if ssh-add "$key" 2>/dev/null; then
        echo "Added: $key"
    else
        echo "Failed to add: $key"
        return 1
    fi
}

# Start ssh-agent if not running
nh_ssh_start_agent() {
    if ! pgrep -u "$USER" ssh-agent > /dev/null; then
        eval "$(ssh-agent -s)"
        echo "Started ssh-agent"
    else
        echo "ssh-agent already running"
    fi
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

# Export functions
export -f nh_ssh_connect nh_ssh_status nh_ssh_key_list nh_ssh_key_add
export -f nh_ssh_start_agent nh_ssh_clear
