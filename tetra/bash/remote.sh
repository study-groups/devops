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

# new_username="exampleuser"
# do5="hostname.example.com"
# tetra_user_update_ssh "${username}" "${do5}"

tetra_remote_user_create_tetra() {
    local username=${1:-$TETRA_USER}
    local remote=${2:-$TETRA_REMOTE}
    echo "Using $username"
    ssh $username@$remote << 'HEREDOC'
        echo $USER
        echo $PWD
        mkdir -p $HOME/src
        cd $HOME/src
        git clone https://github.com/study-groups/devops-study-group
        source $HOME/src/devops-study-group/tetra/bash/init/create.sh
HEREDOC
}

tetra_remote_user_update_tetra() {
    local username=${1:-$TETRA_USER}
    local remote=${2:-$TETRA_REMOTE}
    echo "  Assumes local TETRA_DIR/users/${username} exists"
    echo "  Copies local keys to ${username}@${remote}:~/tetra/users/${username}" 
    ##replace
    ##ssh root@"${remote}" \
    ##    "cd userdel -r ${username} && echo 'User ${username} deleted.'"
}
