#!/bin/bash

# Clear the screen
clear

# Get the terminal size
height=$(tput lines)
width=$(tput cols)

# Define sizes
header_height=3
footer_height=3
content_height=$((height - header_height - footer_height))

# Function to draw a box
draw_box() {
    local -i line=$1
    local -i col=$1
    local -i height=$1
    local -i width=$1
    tput cup $line $col
    printf '┌'
    printf '─%.0s' $(seq 2 $((width-1)))
    printf '┐'
    for ((i = 1; i < height; i++)); do
        tput cup $((line+i)) $col
        printf '│'
        tput cup $((line+i)) $((col + width))
        printf '│'
    done
    tput cup $((line+height)) $col
    printf '└'
    printf '─%.0s' $(seq 2 $((width-1)))
    printf '┘'
}

# Draw Header
draw_box 0 0 $header_height $width
tput cup 1 2
echo "Header: My Cool CLI Windowing System"

# Draw Content
draw_box $header_height 0 $content_height $width

# Draw Footer
draw_box $((header_height + content_height)) 0 $footer_height $width
tput cup $((header_height + content_height + 1)) 2
echo "Footer: Status Information"

# Execute glow for the content inside the content box
tput sc  # Save cursor position
tput cup $((header_height + 1)) 1  # Position cursor at the beginning of the content area
source $HOME/src/mricos/bash/qa/qa.sh && fa  # `-p` to use plain style, `-R` for raw control characters
tput rc  # Restore cursor position

# Wait for a keypress
read -s -n 1

# Cleanup
clear
