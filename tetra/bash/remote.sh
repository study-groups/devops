tetra_remote_login(){
    local username=${1:-$TETRA_USER}
    local remote=${2:-$TETRA_REMOTE}
    ssh $username@$remote
}

tetra_remote_user_create() {
    local username=${1:-$TETRA_USER}
    local remote=${2:-$TETRA_REMOTE}
    ssh root@"${remote}" \
    "useradd -m -s /bin/bash ${username} && echo 'User ${username} created.'"
    tetra_remote_user_update_ssh
}

tetra_remote_user_backup() {
    local username=${1:-$TETRA_USER}
    local remote=${2:-$TETRA_REMOTE}
    ssh root@"${remote}" \
    "tar czf /home/${username}_backup.tar.gz -C /home \
         ${username} && echo 'Backup of ${username} completed.'"
}

tetra_remote_user_restore() {
    local username=${1:-$TETRA_USER}
    local remote=${2:-$TETRA_REMOTE}
    ssh root@"${remote}" \
    "tar xzf /home/${username}_backup.tar.gz -C / && \
     echo 'Restore of ${username} completed.'"
}

tetra_remote_user_delete() {
    local username=${1:-$TETRA_USER}
    local remote=${2:-$TETRA_REMOTE}
    ssh root@"${remote}" \
        "userdel -r ${username} && echo 'User ${username} deleted.'"
}

# Securely transfers the public SSH key to the specified user's
# authorized_keys on the remote system
tetra_remote_user_update_ssh() {
    local username=${1:-$TETRA_USER}
    local hostname=${2:-$TETRA_REMOTE} # The hostname of the remote system

    # Ensure .ssh directory exists and has proper permissions
    ssh "root@${hostname}" <<EOF
mkdir -p /home/${username}/.ssh
touch /home/${username}/.ssh/authorized_keys
chmod 700 /home/${username}/.ssh
chmod 600 /home/${username}/.ssh/authorized_keys
chown -R ${username}:${username} /home/${username}/.ssh
EOF

    # Append the public key to authorized_keys
    cat "$TETRA_DIR/users/${username}/keys/id_rsa.pub" | \
ssh "root@${hostname}" "cat >> /home/${username}/.ssh/authorized_keys"
}

tetra_remote_user_update_tetra() {
    local username=${1:-$TETRA_USER}
    local remote=${2:-$TETRA_REMOTE}
    echo "Using $username"
    ssh -t $username@$remote << 'HEREDOC'
        if [ -d "$HOME/src/devops-study-group" ]; then
            echo "Repository already exists. Do you want to update it? [y/N]"
            read -r response
            if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
                echo "Updating repository..."
                cd "$HOME/src/devops-study-group" && git pull
            else
                echo "Skipping update."
            fi
        else
            echo "Repository does not exist. Do you want to clone it? [y/N]"
            read -r response
            if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
                echo "Cloning repository..."
                mkdir -p "$HOME/src"
                cd "$HOME/src"
                git clone https://github.com/study-groups/devops-study-group
            else
                echo "Skipping clone."
            fi
        fi

        export TETRA_DIR=$HOME/tetra
        export TETRA_SRC=$HOME/src/devops-study-group
        if [ -z "$TETRA_DIR" ] || [ ! -d "$TETRA_DIR" ]; then
            echo "TETRA_DIR=$TETRA_DIR is not set or does not exist. Setting up..."
            source "$HOME/src/devops-study-group/tetra/bash/init/create.sh"
        else
            echo "\$TETRA_DIR already exists. Skipping setup."
        fi
HEREDOC
}
