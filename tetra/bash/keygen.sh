# Generates an SSH key pair and a PEM formatted private key
tetra_keygen_generate() {
    local username=$1
    mkdir -p "$HOME/tetra/roles/${username}/keys/"
    local key_path="$HOME/tetra/roles/${username}/keys/id_rsa"

    # Generate the SSH key pair
    ssh-keygen -t rsa -b 2048 -f "${key_path}" -N ""

    # NEED TO CHECK INPUT TYPE, don't really need PEM
    # Convert the private key to PEM format
    # openssl rsa -in "${key_path}" -outform pem > "${key_path}.pem"
}

# Securely transfers the public SSH key to the specified user's
# authorized_keys on the remote system
tetra_keygen_distribute() {
    local username=$1
    local hostname=$2 # The hostname of the remote system

    # Ensure .ssh directory exists and has proper permissions
    ssh "root@${hostname}" <<EOF
mkdir -p /home/${username}/.ssh
touch /home/${username}/.ssh/authorized_keys
chmod 700 /home/${username}/.ssh
chmod 600 /home/${username}/.ssh/authorized_keys
chown -R ${username}:${username} /home/${username}/.ssh
EOF

    # Append the public key to authorized_keys
    cat "$HOME/tetra/roles/${username}/keys/id_rsa.pub" | \
ssh "root@${hostname}" "cat >> /home/${username}/.ssh/authorized_keys"
}

# Example usage:
# new_username="exampleuser"
# do5="hostname.example.com"
# tetra_keygen_distribute "${new_username}" "${do5}"

