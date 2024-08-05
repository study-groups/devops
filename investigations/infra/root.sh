create_devops_user() {
    # Create the 'devops' user
    sudo adduser devops

    # Add 'devops' user to sudoers file with specific permissions
    # Use tee so you can see what its writing
    echo 'devops ALL=NOPASSWD: /bin/systemctl restart nginx.service' | \
        sudo tee /etc/sudoers.d/devops

}


delete_devops_user() {
    # Remove the 'devops' user
    sudo userdel -r devops

    # Remove 'devops' user from sudoers file
    sudo rm /etc/sudoers.d/devops
}

devops_add_ssh_key() {
    # Create the .ssh directory for devops user if it doesn't exist
    sudo mkdir -p ~devops/.ssh

    # Set the correct permissions for the .ssh directory
    sudo chmod 700 ~devops/.ssh

    # Read from stdin and append the input to the authorized_keys file
    sudo tee -a ~devops/.ssh/authorized_keys

    # Set the correct permissions for the authorized_keys file
    sudo chmod 600 ~devops/.ssh/authorized_keys

    # Change the owner of the .ssh directory and its contents to devops
    sudo chown -R devops:devops ~devops/.ssh
}

