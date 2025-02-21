#!/bin/bash

# Function to display usage and help
usage() {
    echo "Usage: $0 [command] [-i] [-b backup_dir]"
    echo "Commands:"
    echo "  create     Create symbolic links"
    echo "  remove     Remove symbolic links" 
    echo "  dryrun     Show what would be done without making changes"
    echo "Options:"
    echo "  -i: Interactive mode. Run the script with a menu for user interaction."
    echo "  -b: Specify backup directory for links.txt (default: ./backup)"
    echo "Without any command or options, the script starts in interactive mode by default."
}

# Function to backup links.txt
backup_links_file() {
    local backup_dir="${1:-backup}"
    if [[ -f "links.txt" ]]; then
        mkdir -p "$backup_dir"
        cp "links.txt" "$backup_dir/links.txt.$(date +%Y%m%d_%H%M%S)"
    fi
}

# Function to validate directory
validate_dir() {
    local dir="$1"
    # Check if directory contains suspicious patterns
    if [[ "$dir" =~ \.\./\.\. || "$dir" =~ /\.\{2,\}/ ]]; then
        return 1
    fi
    return 0
}

# Function to verify link consistency
verify_links() {
    local success=0
    if [ -f links.txt ]; then
        while IFS= read -r line; do
            local link_name=$(echo "$line" | awk '{print $1}')
            local target=$(echo "$line" | awk '{print $3}')
            if [ ! -h "$link_name" ]; then
                echo "Error: Symlink $link_name doesn't exist"
                success=1
            elif [ "$(readlink "$link_name")" != "$target" ]; then
                echo "Error: Symlink $link_name points to wrong target"
                echo "Expected: $target"
                echo "Actual: $(readlink "$link_name")"
                success=1
            fi
        done < links.txt
    fi
    return $success
}

# Function to cleanup inconsistent state
cleanup_inconsistent_state() {
    echo "Cleaning up inconsistent state..."
    if [ -f links.txt ]; then
        while IFS= read -r line; do
            local link_name=$(echo "$line" | awk '{print $1}')
            if [ -h "$link_name" ]; then
                rm "$link_name"
            fi
        done < links.txt
    fi
    rm -f links.txt
}

# Function to create symbolic links for .md files in sibling directories
symlinks_create() {
    local dryrun="$1"
    local current_dir=$(pwd)
    echo -e "\n=== Creating Symbolic links ==="
    
    # Create temporary links file
    local temp_links=$(mktemp)
    local creation_failed=0
    
    for dir in ../*/; do
        if ! validate_dir "$dir"; then
            echo "Warning: Skipping suspicious directory pattern: $dir"
            continue
        fi
        
        if [ -d "$dir" ] && [ "$(readlink -f "$dir")" != "$(readlink -f "$current_dir")" ]; then
            for md_file in "$dir"*.md; do
                if [ -f "$md_file" ] && [ ! -h "$md_file" ]; then
                    local md_base_name=$(basename "$md_file")
                    local target_link="$current_dir/$md_base_name"
                    local relative_path=$(realpath --relative-to="$current_dir" "$md_file")
                    
                    if [ -e "$target_link" ] && [ ! -h "$target_link" ]; then
                        echo "Warning: Would skip $md_base_name - file exists and is not a symlink"
                        continue
                    fi
                    
                    echo "Would create: $target_link --> $md_file"
                    if [[ "$dryrun" != "yes" ]]; then
                        if ln -sf "$relative_path" "$target_link"; then
                            echo "$target_link --> $relative_path" >> "$temp_links"
                        else
                            echo "Error: Failed to create symlink for $md_file"
                            creation_failed=1
                            break 2
                        fi
                    fi
                fi
            done
        fi
    done
    
    if [[ "$dryrun" != "yes" ]]; then
        if [ $creation_failed -eq 0 ]; then
            mv "$temp_links" links.txt
            if ! verify_links; then
                echo "Error: Link verification failed after creation"
                cleanup_inconsistent_state
                return 1
            fi
            echo "Symbolic links created and verified."
        else
            rm -f "$temp_links"
            cleanup_inconsistent_state
            echo "Failed to create all symbolic links. Cleaned up partial changes."
            return 1
        fi
    else
        rm -f "$temp_links"
        echo "Dry run complete - no changes made."
    fi
}

# Function to remove the symbolic links created in the current directory
symlinks_remove() {
    local dryrun="$1"
    local current_dir=$(pwd)
    echo -e "\n=== Removing Symbolic links ==="
    
    if [ ! -f links.txt ]; then
        echo "Warning: links.txt not found. Nothing to remove."
        return
    fi
    
    if [[ "$dryrun" != "yes" ]]; then
        if ! verify_links; then
            echo "Error: Inconsistent state detected before removal"
            echo "Please check links.txt and symlinks manually"
            return 1
        fi
    fi
    
    local removal_failed=0
    while IFS= read -r line; do
        local link_name=$(echo "$line" | awk '{print $1}')
        if [ -h "$link_name" ]; then
            echo "Would remove link: $link_name"
            if [[ "$dryrun" != "yes" ]]; then
                if ! rm "$link_name"; then
                    echo "Error: Failed to remove symlink $link_name"
                    removal_failed=1
                    break
                fi
            fi
        fi
    done < links.txt
    
    if [[ "$dryrun" != "yes" ]]; then
        if [ $removal_failed -eq 0 ]; then
            rm links.txt
            echo "Symbolic links removed successfully."
        else
            echo "Error: Failed to remove all symlinks"
            echo "System may be in inconsistent state"
            return 1
        fi
    else
        echo "Dry run complete - no changes made."
    fi
}

# Main script execution
interactive_mode="no"
backup_dir="backup"
command=""

# Parse command
if [ $# -gt 0 ]; then
    case "$1" in
        create|remove|dryrun)
            command="$1"
            shift
            ;;
    esac
fi

# Parse remaining options
while getopts ":ib:" opt; do
    case $opt in
        i) interactive_mode="yes" ;;
        b) backup_dir="$OPTARG" ;;
        ?) usage; exit 1 ;;
    esac
done

# If no command and no options, enter interactive mode by default
if [ -z "$command" ] && [[ $OPTIND -eq 1 ]]; then
    interactive_mode="yes"
fi

if [[ $interactive_mode == "yes" ]]; then
    while true; do
        echo -e "\nInteractive Mode\nSelect an option:"
        echo "1) Create symbolic links"
        echo "2) Remove symbolic links"
        echo "3) Show current links"
        echo "4) Verify links consistency"
        echo "5) Dry run - show what would be done"
        echo "q) Quit"
        read -r choice
        case $choice in
            1) symlinks_create "no" ;;
            2) symlinks_remove "no" ;;
            3) if [ -f links.txt ]; then cat links.txt; else echo "No links file found."; fi ;;
            4) if verify_links; then echo "All links are consistent."; fi ;;
            5) 
                echo "=== Dry run mode ==="
                symlinks_create "yes"
                symlinks_remove "yes"
                ;;
            q) echo "Exiting..."; exit 0 ;;
            *) echo "Invalid option. Please try again." ;;
        esac
    done
else
    case "$command" in
        create)
            backup_links_file "$backup_dir"
            symlinks_create "no"
            ;;
        remove)
            backup_links_file "$backup_dir"
            symlinks_remove "no"
            ;;
        dryrun)
            echo "=== Dry run mode ==="
            symlinks_create "yes"
            symlinks_remove "yes"
            ;;
        *)
            usage
            exit 1
            ;;
    esac
fi
