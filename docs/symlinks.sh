#!/bin/bash

# Function to display usage and help
usage() {
    echo "Usage: $0 [-d] [-i]"
    echo "  -d: Dry run. Display the actions that would be taken without performing them."
    echo "  -i: Interactive mode. Run the script with a menu for user interaction."
    echo "Without any options, the script starts in interactive mode by default."
}

# Function to create symbolic links for .md files in sibling directories
symlinks_create() {
    local current_dir=$(pwd)
    echo -e "\n=== Creating Symbolic links ==="
    for dir in ../*/; do
        if [ -d "$dir" ]; then
            for md_file in "$dir"*.md; do
                if [ -e "$md_file" ]; then
                    local md_base_name=$(basename "$md_file")
                    echo "Link: $current_dir/$md_base_name --> $md_file"
                    if [[ "$dry_run" != "yes" ]]; then
                        # Create the symbolic link in the current directory
                        ln -sf "$md_file" "$current_dir/$md_base_name"
                        echo "$current_dir/$md_base_name --> $md_file" >> links.txt
                    fi
                fi
            done
        fi
    done

    if [[ "$dry_run" != "yes" ]]; then
        echo "Symbolic links created for .md files in sibling directories."
    else
        echo "No symbolic links were created during the dry run."
    fi
}

# Function to remove the symbolic links created in the current directory
symlinks_remove() {
    local current_dir=$(pwd)
    echo -e "\n=== Removing Symbolic links ==="
    while IFS= read -r line; do
        local link_name=$(echo "$line" | awk '{print $1}')
        if [ -h "$link_name" ]; then
            echo "Remove link: $link_name"
            if [[ "$dry_run" != "yes" ]]; then
                rm "$link_name"
            fi
        fi
    done < links.txt

    if [[ "$dry_run" != "yes" ]]; then
        echo "Symbolic links removed from the current directory."
    else
        echo "No symbolic links were removed during the dry run."
    fi
}

# Main script execution
dry_run="no"
interactive_mode="no"

# Parse command line options
while getopts ":di" opt; do
    case $opt in
        d) dry_run="yes" ;;
        i) interactive_mode="yes" ;;
        ?) usage; exit 1 ;;
    esac
done

# If no options, enter interactive mode by default
if [[ $OPTIND -eq 1 ]]; then
    interactive_mode="yes"
fi

if [[ $interactive_mode == "yes" ]]; then
    while true; do
        echo -e "\nInteractive Mode\nSelect an option:"
        echo "1) Create symbolic links"
        echo "2) Remove symbolic links"
        echo "q) Quit"
        read -r choice
        case $choice in
            1) symlinks_create ;;
            2) symlinks_remove ;;
            q) echo "Exiting..."; exit 0 ;;
            *) echo "Invalid option. Please try again." ;;
        esac
    done
else
    echo "Running in non-interactive mode."
    if [[ $dry_run == "yes" ]]; then
        echo "Dry-run mode is active. No changes will be made."
    fi
    symlinks_create
    symlinks_remove
fi
