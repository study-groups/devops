# Function to generate a new RSA PEM key
openssl_generate_pem() {
    local output_file="$1"
    openssl genpkey -algorithm RSA -out "$output_file" -pkeyopt rsa_keygen_bits:2048
    echo "PEM file generated: $output_file"
}

# Function to extract a public key from a PEM file
openssl_extract_pubkey() {
    local pem_file="$1"
    local pubkey_file="${pem_file}.pub"
    openssl rsa -pubout -in "$pem_file" -out "$pubkey_file"
    echo "Public key extracted: $pubkey_file"
}

# Function to view the contents of a PEM file
openssl_view_pem() {
    local pem_file="$1"
    openssl rsa -in "$pem_file" -text -noout
}

# Function to check the PEM file for validity
openssl_check_pem() {
    local pem_file="$1"
    openssl rsa -in "$pem_file" -check
}

# Function to add a public key to the authorized_keys file
add_pubkey_to_authorized_keys() {
    local pubkey_file="$1"
    local username="$2"
    mkdir -p "/home/$username/.ssh"
    cat "$pubkey_file" >> "/home/$username/.ssh/authorized_keys"
    echo "Public key added to /home/$username/.ssh/authorized_keys"
}

# Function to set correct permissions and ownership for .ssh directory and files
set_ssh_permissions() {
    local username="$1"
    chmod 700 "/home/$username/.ssh"
    chmod 600 "/home/$username/.ssh/authorized_keys"
    chown -R "$username:$username" "/home/$username/.ssh"
    echo "Permissions set for /home/$username/.ssh and its files"
}

# Function to create a Linux user and generate a PEM key for SSH access
tetra_linux_user_create_with_pem() {
    local username="$1"
    local key_comment="${2:-$(hostname)_$(date +%Y%m%d_%H%M%S)}"

    # Create user
    useradd -m "$username"

    # Generate PEM key
    openssl_generate_pem "/home/$username/.ssh/${username}.pem"
    openssl_extract_pubkey "/home/$username/.ssh/${username}.pem"

    # Add public key to authorized_keys
    add_pubkey_to_authorized_keys "/home/$username/.ssh/${username}.pem.pub" "$username"

    # Set permissions
    set_ssh_permissions "$username"

    # Echo instructions
    echo "PEM file created: /home/$username/.ssh/${username}.pem"
    echo "To use this PEM file, add it to your SSH client."
    echo "Example usage: ssh -i /home/$username/.ssh/${username}.pem $username@$(hostname)"
}
