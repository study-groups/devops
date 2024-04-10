tetra_remote_login(){
    local username=${2:-$TETRA_USER}
    local remote=${1:-$TETRA_REMOTE}
    ssh $username@$remote
}

tetra_remote_user_create() {
    local username=${2:-$TETRA_USER}
    local remote=${1:-$TETRA_REMOTE}
    ssh root@"${remote}" \
    "useradd -m -s /bin/bash ${username} && echo 'User ${username} created.'"
    tetra_remote_user_update_ssh
}

tetra_remote_user_backup() {
    local username=${2:-$TETRA_USER}
    local remote=${1:-$TETRA_REMOTE}
    ssh root@"${remote}" \
    "tar czf /home/${username}_backup.tar.gz -C /home \
         ${username} && echo 'Backup of ${username} completed.'"
}

tetra_remote_user_restore() {
    local username=${2:-$TETRA_USER}
    local remote=${1:-$TETRA_REMOTE}
    ssh root@"${remote}" \
    "tar xzf /home/${username}_backup.tar.gz -C / && \
     echo 'Restore of ${username} completed.'"
}

tetra_remote_user_delete() {
    local username=${2:-$TETRA_USER}
    local remote=${1:-$TETRA_REMOTE}
    echo "Proceeding will delete the user ${username}@${remote}."
    echo " Hit CTRL-C to exit now if this is not intended."
    read -p "Press any key to continue..."
    ssh root@"${remote}" \
        "userdel -r ${username} && echo 'User ${username} deleted.'"
}

# Securely transfers the public SSH key to the specified user's
# authorized_keys on the remote system
tetra_remote_user_update_ssh() {
    local username=${2:-$TETRA_USER}
    local hostname=${1:-$TETRA_REMOTE} # The hostname of the remote system

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

tetra_remote_user_create_tetra_dir() {
    local username=${2:-$TETRA_USER}
    local remote=${1:-$TETRA_REMOTE}
    ssh -t $username@$remote bash -s << 'HEREDOC'
        echo "Setting up Tetra environment..."
        rm -r "$HOME/tetra" 2>/dev/null
        mkdir -p "$HOME/tetra"
        echo "Tetra directory setup completed."
HEREDOC
}

tetra_remote_user_create_tetra_src() {
    local username=${2:-$TETRA_USER}
    local remote=${1:-$TETRA_REMOTE}
    ssh -t $username@$remote bash -s << 'HEREDOC'
        echo "Setting up Tetra source directory..."
        mkdir -p "$HOME/src"
        cd "$HOME/src"
        if [ ! -d "$HOME/src/devops-study-group" ]; then
            git clone https://github.com/study-groups/devops-study-group
        fi
        echo "Tetra source directory setup completed."
HEREDOC
}

tetra_remote_user_create_tetra() {
    local username=${2:-$TETRA_USER}
    local remote=${1:-$TETRA_REMOTE}
    tetra_remote_user_create_tetra_dir
    tetra_remote_user_create_tetra_src
    ssh -t $username@$remote bash -s << 'HEREDOC'
        export TETRA_DIR="$HOME/tetra"
        export TETRA_SRC="$HOME/src/devops-study-group/tetra/bash"
        source $TETRA_SRC/init/create.sh
        create_tetra_create
        echo "Tetra environment setup completed."
HEREDOC
}
tetra_remote_user_delete_tetra_dir() {
    local username=${2:-$TETRA_USER}
    local remote=${1:-$TETRA_REMOTE}
    echo "Using $username in silent mode"
    ssh -t $username@$remote bash -s << 'HEREDOC'
        echo "Deleting Tetra environment..."
        rm -r "$HOME/tetra" 2>/dev/null
        echo "Tetra environment deleted."
HEREDOC
}

tetra_remote_user_update_tetra_src() {
    local username=${2:-$TETRA_USER}
    local remote=${1:-$TETRA_REMOTE}
    echo "Using $username in silent mode"
    ssh -t $username@$remote bash -s << 'HEREDOC'
        if [ -d "$HOME/src/devops-study-group" ]; then
            echo "Repository exists. Updating..."
            cd "$HOME/src/devops-study-group" && git pull
        else
            echo "Repository does not exist. Skipping update."
        fi
HEREDOC
}
