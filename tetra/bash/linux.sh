# Function to create a Linux user
tetra_linux_user_create() {
    local username="$1"
    useradd -m "$username"
}

# Function to delete a Linux user
tetra_linux_user_delete() {
    local username="$1"
    userdel -r "$username"
}

# Function to create a .pem file for an existing user and add to authorized_keys
tetra_linux_user_add_pem() {
    local username="$1"
    local key_comment="${2:-$(hostname)_$(date +%Y%m%d_%H%M%S)}"

    # Create .ssh directory if it doesn't exist
    mkdir -p "/home/$username/.ssh"

    # Generate a new private key in PEM format
    openssl genpkey -algorithm RSA -out "/home/$username/.ssh/${username}.pem" -pkeyopt rsa_keygen_bits:2048

    # Generate the corresponding public key
    openssl rsa -pubout -in "/home/$username/.ssh/${username}.pem" -out "/home/$username/.ssh/${username}.pem.pub"

    # Set permissions
    chmod 600 "/home/$username/.ssh/${username}.pem"
    chmod 644 "/home/$username/.ssh/${username}.pem.pub"

    # Add the public key to authorized_keys
    cat "/home/$username/.ssh/${username}.pem.pub" >> "/home/$username/.ssh/authorized_keys"

    # Set ownership
    chown -R "$username:$username" "/home/$username/.ssh"

    # Echo instructions
    echo "PEM file created: /home/$username/.ssh/${username}.pem"
    echo "To use this PEM file, add it to your SSH client."
    echo "Example usage: ssh -i /home/$username/.ssh/${username}.pem $username@$(hostname)"
}

# Usage examples
# tetra_linux_user_create "newuser"
# tetra_linux_user_add_pem "newuser" "optional_key_comment"

# Function to show disk usage in human-readable format, login status, authorized keys, and SSH connection methods for a user
tetra_linux_user_status() {
    local username="$1"

    # Check if the user exists
    if ! id "$username" &>/dev/null; then
        echo "User $username does not exist."
        return 1
    fi

    # Show disk usage for the user's home directory
    echo "Disk usage for /home/$username:"
    du -sh "/home/$username"

    # Check if the user is currently logged in
    if who | grep -q "^$username"; then
        echo "User $username is currently logged in."
    else
        echo "User $username is not logged in."
    fi

    # Show authorized keys
    echo "Authorized keys for $username:"
    if [ -f "/home/$username/.ssh/authorized_keys" ]; then
        cat "/home/$username/.ssh/authorized_keys"
    else
        echo "No authorized_keys file found for user $username."
    fi

    # Show SSH connection methods
    echo "Ways to connect via SSH:"
    local hostname
    hostname=$(hostname)
    if [ -f "/home/$username/.ssh/${username}.pem" ]; then
        echo "Using PEM file: ssh -i /home/$username/.ssh/${username}.pem $username@$hostname"
    fi
    echo "Standard SSH: ssh $username@$hostname"
}

# Usage example
# tetra_linux_user_status "username"

