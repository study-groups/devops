#!/bin/bash

# Function to create symlinks for .md files in sibling directories
symlinks_create() {
    # Get the current working directory
    current_dir=$(pwd)
    
    echo "Dry run mode will show what links would be created. Proceed? (y/n)"
    read -r confirm_dry_run

    if [[ "$confirm_dry_run" == "y" || "$confirm_dry_run" == "Y" ]]; then
        echo "=== Dry Run: Symlinks that would be created ==="
    else
        echo "=== Creating Symlinks ==="
    fi

    # Find all sibling directories and process them
    for dir in ../*/; do
        if [ -d "$dir" ]; then
            # Create symlinks for all .md files in the sibling directory
            for md_file in "$dir"*.md; do
                if [ -e "$md_file" ]; then
                    # Extract the basename of the .md file
                    md_basename=$(basename "$md_file")
                    # Output what would happen
                    echo "Link: $current_dir/$md_basename --> $md_file"

                    if [[ "${confirm_dry_run^^}" != "Y" ]]; then
                        # Create the symlink in the current directory
                        ln -sf "$md_file" "$current_dir/$md_basename"
                    fi
                fi
            done
        fi
    done

    if [[ "${confirm_dry_run^^}" != "Y" ]]; then
        echo "Symlinks created for .md files in sibling directories."
    else
        echo "No symlinks were created during the dry run."
    fi
}

# Function to remove the symlinks created in the current directory
symlinks_remove() {
    # Get the current working directory
    current_dir=$(pwd)

    echo "Dry run mode will show what links would be removed. Proceed? (y/n)"
    read -r confirm_dry_run

    if [[ "$confirm_dry_run" == "y" || "$confirm_dry_run" == "Y" ]]; then
        echo "=== Dry Run: Symlinks that would be removed ==="
    else
        echo "=== Removing Symlinks ==="
    fi

    # Find and remove the symlinks for .md files
    for md_file in *.md; do
        if [ -h "$md_file" ]; then
            # Output what would happen
            echo "Remove link: $md_file"

            if [[ "${confirm_dry_run^^}" != "Y" ]]; then
                rm "$md_file"
            fi
        fi
    done

    if [[ "${confirm_dry_run^^}" != "Y" ]]; then
        echo "Symlinks removed from the current directory."
    else
        echo "No symlinks were removed during the dry run."
    fi
}

