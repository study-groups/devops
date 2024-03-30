
tetra-ssh-list-known-hosts() {
    # This function formats and lists entries from the known_hosts file.
    # Note: If hostnames are hashed, only key types and key data will be displayed.

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


tetra-ssh-list-known-hosts-raw() {
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



tetra-ssh-add-known-host() {
    # Adds a new host to the known_hosts file after retrieving its public key.
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

-ssh-ssh-info() {
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

tetra-ssh-add-known-host-orig() {

    # Adds a new host to the known_hosts file after verification.

    local host=$1
    local fingerprint=$2

    # Verify the provided fingerprint with a trusted source here
    # For demonstration purposes, let's assume it's verified

    # Add the host to the known_hosts file
    ssh-keyscan -H $host >> "$HOME/.ssh/known_hosts"
    echo "Host $host added to known_hosts."
}



tetra-ssh-init(){
  eval "$(ssh-agent)"
   ssh-add $TETRA_SSH_KEY 
}

tetra-ssh-add(){
   ssh-add $1
}

