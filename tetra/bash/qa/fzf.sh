#!/bin/bash

# Directory containing Q&A files
#QA_DIR="/home/mricos/.qa"

# Use fzf to select a file and display a preview on the right
# --preview will display the content of the file in a preview window
selected_file=$(find "$QA_DIR" -type f | fzf --preview 'cat {}')

# Check if a file was selected
if [[ -n $selected_file ]]; then
    # Display the formatted content of the file (or simply open it)
    clear
    cat "$selected_file"
else
    echo "No file selected."
fi
