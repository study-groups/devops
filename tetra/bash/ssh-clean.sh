tetra-ssh-clean-known-hosts() {
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

