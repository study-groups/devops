#!/bin/bash

# Global array to store SSH key directories
declare -a SSH_KEY_DIRS=(
/home/mricos/.ssh
/home/mricos/nh/pj
/home/mricos/nh/nodeholder
) 

# Associative array to map key fingerprints to file paths
declare -A SSH_KEY_FILES

# Function to start the ssh-agent and export its variables
nh_ssh_start_agent() {
    if ! pgrep -u "$USER" ssh-agent > /dev/null; then
        eval "$(ssh-agent -s)"
    fi
}

# Function to check the status of ssh-agent and list keyring information
nh_ssh_status() {
    if pgrep -u "$USER" ssh-agent > /dev/null; then
        echo "ssh-agent is running."
        [[ -f ~/.ssh_key_files_map ]] && source ~/.ssh_key_files_map

        local key_count
        key_count=$(ssh-add -l 2>/dev/null | wc -l)
        if [[ "$key_count" -eq 0 ]]; then
            echo "No keys loaded in the agent."
        else
            echo "$key_count keys loaded in the agent:"
            while IFS= read -r line; do
                # Remove the colon before lookup for a proper match
                local fingerprint=$(echo "$line" | awk '{print $2}' | tr -d ':')
                local file="${SSH_KEY_FILES[$fingerprint]:-"Unknown file"}"
                echo "$line"
                echo "  File: $file"
            done < <(ssh-add -l 2>/dev/null)
        fi
    else
        echo "ssh-agent is not running."
    fi
}

# Function to refresh the SSH keys by scanning directories
nh_ssh_key_add_list() {
    local key_files
    SSH_KEY_DIRS=("${SSH_KEY_DIRS[@]}")
    for dir in "${SSH_KEY_DIRS[@]}"; do
        if [[ -d "$dir" ]]; then
            while IFS= read -r -d '' key; do
                key_files+=("$key")
            done < <(find "$dir" -type f -name 'id_*' ! -name '*.pub' -print0)
        fi
    done

    for key in "${key_files[@]}"; do
        if ssh-add "$key" 2>/dev/null; then
            # Remove the colon from the fingerprint before storing
            local fingerprint=$(ssh-keygen -lf "$key" | awk '{print $2}' | tr -d ':')
            SSH_KEY_FILES[$fingerprint]="$key"
            echo "Added key: $key"
        else
            echo "Failed to add key: $key"
        fi
    done
    nh_save_key_mappings
}

# Save mappings to a file for persistence
nh_save_key_mappings() {
    declare -p SSH_KEY_FILES > ~/.ssh_key_files_map
}

# Function to add a search directory to the global array
nh_ssh_search_dir_add() {
    local dir="$1"
    if [[ -d "$dir" ]]; then
        SSH_KEY_DIRS+=("$dir")
        echo "Added search directory $dir to SSH_KEY_DIRS."
    else
        echo "Directory $dir does not exist."
    fi
}

# Function to remove a directory from the global array
nh_ssh_search_dir_remove() {
    local dir="$1"
    SSH_KEY_DIRS=("${SSH_KEY_DIRS[@]/$dir}")
    echo "Removed search directory $dir from SSH_KEY_DIRS."
}

# Function to list all directories in the global array
nh_ssh_search_dir_list() {
    for dir in "${SSH_KEY_DIRS[@]}"; do
        echo "$dir"
    done
}

# Function to add a specific key to the agent
nh_ssh_key_add() {
    local key="$1"
    if [[ -f "$key" ]]; then
        if ssh-add "$key" 2>/dev/null; then
            # Remove the colon here too
            local fingerprint=$(ssh-keygen -lf "$key" | awk '{print $2}' | tr -d ':')
            SSH_KEY_FILES[$fingerprint]="$key"
            nh_save_key_mappings
            echo "Added key: $key"
        else
            echo "Failed to add key: $key"
        fi
    else
        echo "Key file $key does not exist."
    fi
}

# Function to remove a specific key from the agent
nh_ssh_key_remove() {
    local key="$1"
    if ssh-add -d "$key" 2>/dev/null; then
        echo "Removed key: $key"
    else
        echo "Failed to remove key: $key"
    fi
}

# Function to clear all keys from the ssh-agent
nh_ssh_clear_keys() {
    if ssh-add -D 2>/dev/null; then
        echo "All keys have been removed from the ssh-agent."
    else
        echo "Failed to remove keys from the ssh-agent."
    fi
}
