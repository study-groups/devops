_tetra_ssh_check () {
    local key="$1"
    if [ ! -f "$key" ]; then
        echo "Error: Key file '$key' does not exist."
        return 1
    fi

    local permissions
    permissions=$(stat -c "%a" "$key" 2>/dev/null || stat -f "%A" "$key") # Handle different `stat` formats.
    if [[ "$permissions" != "600" ]]; then
        echo "chmod 600 $key"
        return 0
    fi

    echo "Key '$key' permissions are correct."
    return 0
}

tetra_ssh_start () {
    local agent_env_file="/tmp/ssh-agent-$USER.env"

    if [ -f "$agent_env_file" ]; then
        source "$agent_env_file"
        if [ -n "$SSH_AUTH_SOCK" ] && [ -e "$SSH_AUTH_SOCK" ]; then
            echo "Using existing SSH agent with socket $SSH_AUTH_SOCK."
            return
        fi
    fi

    echo "Starting new SSH agent..."
    eval "$(ssh-agent -s)" > /dev/null
    echo "export SSH_AUTH_SOCK=$SSH_AUTH_SOCK" > "$agent_env_file"
    echo "export SSH_AGENT_PID=$SSH_AGENT_PID" >> "$agent_env_file"
    echo "SSH agent started and environment variables saved."
}

tetra_ssh_add () {
    local key="$1"
    if [ -z "$key" ]; then
        echo "Error: No key provided. Usage: tetra_ssh_add <key_file>"
        return 1
    fi

    _tetra_ssh_check "$key"
    local chmod_cmd
    chmod_cmd=$(_tetra_ssh_check "$key")
    if [[ "$chmod_cmd" =~ chmod ]]; then
        echo "Fixing permissions: $chmod_cmd"
        eval "$chmod_cmd"
    fi

    ssh-add "$key" > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo "Key '$key' added to the SSH agent."
    else
        echo "Error: Failed to add key '$key' to the SSH agent."
        return 1
    fi
}

tetra_ssh_info () {
    echo "SSH Agent Information:"
    if [ -z "$SSH_AUTH_SOCK" ] || [ ! -e "$SSH_AUTH_SOCK" ]; then
        echo "No SSH agent is running."
        return 1
    fi

    echo "Socket: $SSH_AUTH_SOCK"
    echo "Agent PID: $SSH_AGENT_PID"

    local keys
    keys=$(ssh-add -l 2>/dev/null)
    if [ $? -eq 0 ]; then
        if [ -n "$keys" ]; then
            echo "Keys loaded in agent:"
            echo "$keys"
        else
            echo "No keys currently loaded in the SSH agent."
        fi
    else
        echo "Error: Unable to query SSH agent for keys."
        return 1
    fi
}

tetra_ssh_find () {
    local search_dir="${TETRA_DIR}/data"
    if [ ! -d "$search_dir" ]; then
        echo "Error: Directory $search_dir does not exist."
        return 1
    fi

    find "$search_dir" -type f \( -name "id_rsa" -o -name "*.priv" \) 2>/dev/null
}

tetra_ssh_add_all () {
    tetra_xargs_map "tetra_ssh_add" "$(tetra_ssh_find)"
}
