tetra_linux_clean_path() {
    # Determine the username
    local username="${1:-$USER}"

    # Remove duplicate entries in PATH
    export PATH=$(echo "$PATH" | tr ':' '\n' | awk '!seen[$0]++' | tr '\n' ':' | sed 's/:$//')

    # Define required paths for the user
    local required_paths=(
        "/home/$username/.local/bin"
        "/home/$username/bin"
        "/usr/local/sbin"
        "/usr/local/bin"
        "/usr/sbin"
        "/usr/bin"
        "/sbin"
        "/bin"
    )
    
    # Ensure critical paths are present
    for path in "${required_paths[@]}"; do
        if [[ ":$PATH:" != *":$path:"* ]]; then
            export PATH="$path:$PATH"
        fi
    done

    echo "Cleaned PATH for user $username:"
    echo "$PATH"
}

# Debugging function to analyze the current PATH
tetra_linux_debug_path() {
    echo "=== PATH Debugging ==="
    echo "Current PATH:"
    echo "$PATH" | tr ':' '\n'
    echo
    echo "Number of entries: $(echo "$PATH" | tr ':' '\n' | wc -l)"
    echo "Duplicates:"
    echo "$PATH" | tr ':' '\n' | sort | uniq -d
    echo
    echo "=== End Debugging ==="
}
