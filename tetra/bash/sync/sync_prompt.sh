# Function to edit the .tetraignore file
edit_tetraignore() {
    local exclude_list=()

    if [[ -f ".tetraignore" ]]; then
        while IFS= read -r line; do
            exclude_list+=("$line")
        done < .tetraignore
    else
        exclude_list=('.git' '*.zip' '*.gz' '.DS_Store' 'ds-env')
    fi

    echo "Current exclude list:"
    for item in "${exclude_list[@]}"; do
        echo "  - $item"
    done

    read -p "Do you want to add or remove items? (add/remove): " action
    if [[ "$action" == "add" ]]; then
        read -p "Enter items to add (comma-separated): " new_items
        IFS=',' read -ra new_items_array <<< "$new_items"
        for item in "${new_items_array[@]}"; do
            exclude_list+=("$item")
        done
    elif [[ "$action" == "remove" ]]; then
        read -p "Enter items to remove (comma-separated): " remove_items
        IFS=',' read -ra remove_items_array <<< "$remove_items"
        for remove_item in "${remove_items_array[@]}"; do
            exclude_list=("${exclude_list[@]/$remove_item}")
        done
    fi

    # Write updated exclude list to .tetraignore
    printf "%s\n" "${exclude_list[@]}" > .tetraignore
    echo ".tetraignore updated."
}

# Function to sync directories with rsync
tetra_sync_tetra_to_prompt() {
    local params="-avzP"
    local exclude_list=()

    # Read exclude list from .tetraignore if it exists
    if [[ -f ".tetraignore" ]]; then
        while IFS= read -r line; do
            exclude_list+=("$line")
        done < .tetraignore
    else
        exclude_list=('.git' '*.zip' '*.gz' '.DS_Store' 'ds-env')
    fi

    # Display current settings
    echo "Current rsync parameters: $params"
    echo "Current exclude list:"
    for item in "${exclude_list[@]}"; do
        echo "  - $item"
    done

    # Prompt user to confirm or change values
    read -p "Do you want to change any parameters? (yes/no): " change_params
    if [[ "$change_params" == "yes" ]]; then
        read -p "Enter new params (default: $params): " new_params
        params=${new_params:-$params}

        read -p "Do you want to edit the exclude list? (yes/no): " edit_exclude
        if [[ "$edit_exclude" == "yes" ]]; then
            edit_tetraignore
            exclude_list=()
            while IFS= read -r line; do
                exclude_list+=("$line")
            done < .tetraignore
        fi
    fi

    # Construct the exclude option for rsync
    local exclude_option=""
    for item in "${exclude_list[@]}"; do
        exclude_option+="--exclude='$item' "
    done

    # Prompt for directories and user/host
    read -p "Enter source directory (default: $TETRA_DIR): " new_src
    read -p "Enter remote user (default: $TETRA_REMOTE_USER): " new_user
    read -p "Enter remote host (default: $TETRA_REMOTE): " new_host
    read -p "Enter remote directory (default: $TETRA_REMOTE_DIR): " new_remote_dir

    TETRA_DIR=${new_src:-$TETRA_DIR}
    TETRA_REMOTE_USER=${new_user:-$TETRA_REMOTE_USER}
    TETRA_REMOTE=${new_host:-$TETRA_REMOTE}
    TETRA_REMOTE_DIR=${new_remote_dir:-$TETRA_REMOTE_DIR}

    # Construct the final rsync command
    local rsync_command="rsync $params $exclude_option \"$TETRA_DIR/\" \"$TETRA_REMOTE_USER@$TETRA_REMOTE:$TETRA_REMOTE_DIR\""
    
    # Display the command to the user
    echo "Please run the following command:"
    echo $rsync_command
}

# Example usage
# TETRA_DIR="path/to/source"
# TETRA_REMOTE_USER="user"
# TETRA_REMOTE="remote.host"
# TETRA_REMOTE_DIR="path/to/destination"
# tetra_sync_tetra_to_prompt
