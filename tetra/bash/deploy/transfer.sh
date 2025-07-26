# ============= tetra_transfer_ (push/pull/status file movement) ===============

# Pushes any file to a remote host as described in a transfer config.
# Usage: tetra_transfer_push <transfer_config> <LOCAL_VAR_NAME> <REMOTE_VAR_NAME>
tetra_transfer_push() {
    local config="$1"
    local local_var="$2"
    local remote_var="$3"
    if [ -z "$config" ] || [ ! -f "$config" ] || [ -z "$local_var" ] || [ -z "$remote_var" ]; then
        echo "Usage: tetra_transfer_push <transfer_config> <LOCAL_VAR_NAME> <REMOTE_VAR_NAME>"
        return 1
    fi
    . "$config"
    local local_file="${!local_var}"
    local remote_file="${!remote_var}"
    if [ ! -f "$local_file" ]; then
        echo "Local file not found: $local_file"
        return 2
    fi
    echo "Pushing $local_file → $REMOTE_USER@$REMOTE_HOST:$remote_file"
    scp "$local_file" "$REMOTE_USER@$REMOTE_HOST:$remote_file"
    if [ $? -eq 0 ]; then
        echo "Pushed $local_file to $REMOTE_USER@$REMOTE_HOST:$remote_file"
    else
        echo "Failed to push"
        return 3
    fi
}

# Pulls any file from a remote host as described in a transfer config.
# Usage: tetra_transfer_pull <transfer_config> <LOCAL_VAR_NAME> <REMOTE_VAR_NAME>
tetra_transfer_pull() {
    local config="$1"
    local local_var="$2"
    local remote_var="$3"
    if [ -z "$config" ] || [ ! -f "$config" ] || [ -z "$local_var" ] || [ -z "$remote_var" ]; then
        echo "Usage: tetra_transfer_pull <transfer_config> <LOCAL_VAR_NAME> <REMOTE_VAR_NAME>"
        return 1
    fi
    . "$config"
    local local_file="${!local_var}"
    local remote_file="${!remote_var}"
    mkdir -p "$(dirname "$local_file")"
    echo "Pulling $REMOTE_USER@$REMOTE_HOST:$remote_file → $local_file"
    scp "$REMOTE_USER@$REMOTE_HOST:$remote_file" "$local_file"
    if [ $? -eq 0 ]; then
        echo "Pulled $remote_file to $local_file"
    else
        echo "Failed to pull"
        return 2
    fi
}

# Summarizes the status of local and remote files for any artifact pair.
# Usage: tetra_transfer_status <transfer_config> <LOCAL_VAR_NAME> <REMOTE_VAR_NAME>
tetra_transfer_status() {
    local config="$1"
    local local_var="$2"
    local remote_var="$3"
    if [ -z "$config" ] || [ ! -f "$config" ] || [ -z "$local_var" ] || [ -z "$remote_var" ]; then
        echo "Usage: tetra_transfer_status <transfer_config> <LOCAL_VAR_NAME> <REMOTE_VAR_NAME>"
        return 1
    fi
    . "$config"
    local local_file="${!local_var}"
    local remote_file="${!remote_var}"
    echo "==== tetra_transfer_status ===="
    echo "  Local path:  $local_file"
    if [ -f "$local_file" ]; then
        local lstat
        lstat=$(stat --format="exists: yes | size: %s bytes | mtime: %y | perms: %A" "$local_file")
        echo "  Local file:  $lstat"
    else
        echo "  Local file:  exists: NO"
    fi
    echo "  Remote:      $REMOTE_USER@$REMOTE_HOST:$remote_file"
    ssh "$REMOTE_USER@$REMOTE_HOST" "if [ -f '$remote_file' ]; then stat --format='exists: yes | size: %s bytes | mtime: %y | perms: %A' '$remote_file'; else echo 'exists: NO'; fi" 2>/dev/null | sed 's/^/  Remote file: /'
    echo "=============================="
}
