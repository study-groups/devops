tetra_user_create() {
    local username="$1"
    
    if [ -z "$username" ]; then
        echo "Usage: tetra_create_user <username>"
        return 1
    fi

    # Create the user without a password
    sudo useradd -m -s /bin/bash "$username"

    # Disable password login for the user
    sudo passwd -d "$username"

    # Generate SSH key pair
    sudo -u "$username" \
    ssh-keygen -t rsa -b 4096 -f "/home/$username/.ssh/id_rsa" -N ""

    # Ensure the .ssh directory has the correct permissions
    sudo mkdir -p "/home/$username/.ssh"
    sudo chmod 700 "/home/$username/.ssh"
    sudo touch "/home/$username/.ssh/authorized_keys"
    sudo chmod 600 "/home/$username/.ssh/authorized_keys"

    # Add the public key to authorized_keys
    sudo cat "/home/$username/.ssh/id_rsa.pub" \
    | sudo tee -a "/home/$username/.ssh/authorized_keys" > /dev/null

    # Add user to the sudo group
    sudo usermod -aG sudo "$username"

    # Provide feedback
    echo "User '$username' created and configured successfully."
}

tetra_user_delete() {
    local username="$1"
    if [ -z "$username" ]; then
        echo "Usage: tetra_delete_user <username>"
        return 1
    fi

    # Check if the user exists
    if id "$username" &>/dev/null; then
        # Backup user home directory, if needed
        sudo cp -r "/home/$username" "/home/${username}_backup_$(date +%F_%T)"
        
        # Remove the user and their home directory
        sudo userdel -r "$username"
        
        # Provide feedback
        echo "User '$username' deleted successfully."
    else
        echo "User '$username' does not exist."
        return 1
    fi
}
