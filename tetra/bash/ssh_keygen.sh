# Generates an SSH key pair and a PEM formatted private key
tetra_ssh_keygen() {
    local username=$1
    #local key_path="$TETRA_DIR/users/${username}/keys/id_rsa"
    local key_path="$TETRA_DIR/users/${username}/keys/id_rsa"
  
    local now="$(date +%Y-%m-%d)"
    #ssh-keygen -t rsa -b 2048 -m pem -f $sshkey -C "$user@$org-$now"
    ssh-keygen -t rsa -b 2048 -f ${key_path} -C "$user@$org-$now" -N ""
    chmod 600 ${key_path}

   # openssl rsa -in "${key_path}" -outform pem > "${key_path}.pem"
}

