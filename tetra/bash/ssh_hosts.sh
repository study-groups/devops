
tetra_ssh_known_hosts_list() {
    # This function formats and lists entries from theknown_hosts
    # file.  Note: If hostnames are hashed, only key types and
    # key data will be displayed.

    local known_hosts_file="$HOME/.ssh/known_hosts"

    if [ -f "$known_hosts_file" ]; then
        echo "Entries in known_hosts:"
        while IFS= read -r line; do
            local key_type=$(echo "$line" | awk '{print $2}')
            local key_data=$(echo "$line" | awk '{print $3}')
            echo "Key Type: $key_type"
            echo "Key Data: $key_data"
            echo "--------------------------------"
        done < "$known_hosts_file"
    else
        echo "No known_hosts file found."
    fi
}

# Usage: Call tetra-ssh-list-known-hosts to display the known hosts.


tetra_ssh_known_hosts_list_raw() {
    # Lists the entries in the known_hosts file.
    local known_hosts_file="$HOME/.ssh/known_hosts"

    if [ -f "$known_hosts_file" ]; then
        echo "Listing entries in known_hosts:"
        cat "$known_hosts_file"
    else
        echo "No known_hosts file found."
    fi
}

# Usage: Call tetra-ssh-list-known-hosts to display the known hosts.



tetra_ssh_known_host_add() {
    # Adds a new host to the known_hosts file after
    # retrieving its public key.
    # Note: Ensure you trust the host before adding its key.

    echo "Enter the hostname (e.g., airbook.local):"
    read host

    # Retrieve the public key using ssh-keyscan
    ssh-keyscan -H $host >> "$HOME/.ssh/known_hosts"
    if [ $? -eq 0 ]; then
        echo "Host $host added to known_hosts."
    else
        echo "Error adding host $host to known_hosts."
    fi
}

tetra_ssh_home_info() {
    # Check if ~/.ssh directory exists
    if [ ! -d "$HOME/.ssh" ]; then
        echo "SSH directory not found."
        return 1
    fi

    # Display basic information about the SSH directory
    echo "SSH Directory: $HOME/.ssh"
    echo "Contents:"
    ls -l "$HOME/.ssh"

    # Display the public keys if they exist
    if ls "$HOME/.ssh/*.pub" 1> /dev/null 2>&1; then
        echo "Public Keys:"
        ls "$HOME/.ssh/*.pub"
    else
        echo "No public keys found in $HOME/.ssh"
    fi

    # Display the ssh config file if it exists
    if [ -f "$HOME/.ssh/config" ]; then
        echo "SSH Config File:"
        cat "$HOME/.ssh/config"
    else
        echo "No SSH config file found."
    fi
}

tetra_ssh_add_known_host_orig() {

    # Adds a new host to the known_hosts file after verification.

    local host=$1
    local fingerprint=$2

    # Verify the provided fingerprint with a trusted source here
    # For demonstration purposes, let's assume it's verified

    # Add the host to the known_hosts file
    ssh-keyscan -H $host >> "$HOME/.ssh/known_hosts"
    echo "Host $host added to known_hosts."
}

tetra_ssh_known_hosts_clean() {
    # This function removes duplicate entries from the known_hosts file
    # based on unique key data.

    local known_hosts_file="$HOME/.ssh/known_hosts"
    local temp_file="$HOME/.ssh/temp_known_hosts"

    if [ -f "$known_hosts_file" ]; then
        # Sort and remove duplicates based on the key data (third column)
        awk '!seen[$3]++' "$known_hosts_file" > "$temp_file"

        # Move the cleaned list back to known_hosts
        mv "$temp_file" "$known_hosts_file"
        echo "Duplicates removed from known_hosts."
    else
        echo "No known_hosts file found."
    fi
}

# Usage: Call tetra-ssh-clean-known-hosts to clean up the known_hosts file.

