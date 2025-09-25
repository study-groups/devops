#!/usr/bin/env bash
# Terminal UI Framework with Header, Scrollable Content, and Footer
# Requires: Bash 5.2+, tput, glow (optional)

# Terminal setup and cleanup
setup_terminal() {
    # Save terminal state
    tput smcup  # Save screen
    tput civis  # Hide cursor
    stty -echo  # Disable echo
    
    # Clear screen
    clear
    
    # Get terminal dimensions
    TERM_HEIGHT=$(tput lines)
    TERM_WIDTH=$(tput cols)
    
    # Define layout
    HEADER_LINES=4
    FOOTER_LINES=2
    CONTENT_START=$((HEADER_LINES + 1))
    CONTENT_HEIGHT=$((TERM_HEIGHT - HEADER_LINES - FOOTER_LINES))
    CONTENT_END=$((CONTENT_START + CONTENT_HEIGHT - 1))
    
    # Initialize scroll position
    SCROLL_POS=0
    CONTENT_LINES=0
    
    # Set up signal handlers
    trap 'cleanup; exit 0' INT TERM
    trap 'handle_resize' WINCH
}

cleanup() {
    tput cnorm  # Show cursor
    tput rmcup  # Restore screen
    stty echo   # Enable echo
    clear
}

# Handle terminal resize
handle_resize() {
    TERM_HEIGHT=$(tput lines)
    TERM_WIDTH=$(tput cols)
    CONTENT_HEIGHT=$((TERM_HEIGHT - HEADER_LINES - FOOTER_LINES))
    CONTENT_END=$((CONTENT_START + CONTENT_HEIGHT - 1))
    render_all
}

# Render header (4 lines)
render_header() {
    local title="$1"
    local subtitle="$2"
    local status="$3"
    
    # Save cursor position
    tput sc
    
    # Line 1: Top border
    tput cup 0 0
    tput setaf 6  # Cyan
    printf '═%.0s' $(seq 1 $TERM_WIDTH)
    
    # Line 2: Title
    tput cup 1 0
    tput setaf 7  # White
    tput bold
    printf "║ %-$((TERM_WIDTH - 3))s║" "$title"
    tput sgr0
    
    # Line 3: Subtitle
    tput cup 2 0
    tput setaf 6
    printf "║"
    tput setaf 3  # Yellow
    printf " %-$((TERM_WIDTH - 3))s" "$subtitle"
    tput setaf 6
    printf "║"
    
    # Line 4: Status line and bottom border
    tput cup 3 0
    tput setaf 6
    printf "║"
    tput setaf 2  # Green
    printf " Status: %-$((TERM_WIDTH - 12))s" "$status"
    tput setaf 6
    printf "║"
    
    # Header bottom border
    tput cup 4 0
    printf '╠%.0s' $(seq 1 1)
    printf '═%.0s' $(seq 2 $((TERM_WIDTH - 1)))
    printf '╣'
    
    # Restore cursor
    tput rc
}

# Render footer (2 lines)
render_footer() {
    local info="$1"
    local help="[↑/↓/j/k: Scroll] [g/G: Top/Bottom] [q: Quit]"
    
    # Save cursor position
    tput sc
    
    # Footer top border
    tput cup $((TERM_HEIGHT - 2)) 0
    tput setaf 6
    printf '╠%.0s' $(seq 1 1)
    printf '═%.0s' $(seq 2 $((TERM_WIDTH - 1)))
    printf '╣'
    
    # Footer content
    tput cup $((TERM_HEIGHT - 1)) 0
    printf "║"
    tput setaf 4  # Blue
    printf " %-$((TERM_WIDTH / 2 - 2))s" "$info"
    tput setaf 5  # Magenta
    printf "%-$((TERM_WIDTH / 2 - 1))s" "$help"
    tput setaf 6
    printf "║"
    
    # Bottom border
    tput cup $TERM_HEIGHT 0
    printf '═%.0s' $(seq 1 $TERM_WIDTH)
    
    # Restore cursor
    tput rc
}

# Clear content area
clear_content_area() {
    local line
    for ((line = CONTENT_START; line <= CONTENT_END; line++)); do
        tput cup $line 0
        tput setaf 6
        printf "║"
        tput el  # Clear to end of line
        tput cup $line $((TERM_WIDTH - 1))
        printf "║"
    done
}

# Render content with scrolling support
render_content() {
    clear_content_area
    
    local line_num=0
    local display_line=$CONTENT_START
    
    while IFS= read -r line && [ $display_line -le $CONTENT_END ]; do
        if [ $line_num -ge $SCROLL_POS ]; then
            tput cup $display_line 2
            
            # Preserve ANSI colors in content
            # Truncate if line is too long
            if [ ${#line} -gt $((TERM_WIDTH - 4)) ]; then
                echo -n "${line:0:$((TERM_WIDTH - 4))}"
            else
                echo -n "$line"
            fi
            
            ((display_line++))
        fi
        ((line_num++))
    done <<< "$CONTENT_BUFFER"
    
    # Update total content lines
    CONTENT_LINES=$line_num
}

# Load content from file or command
load_content() {
    local source="$1"
    
    if [ -f "$source" ]; then
        # Check if glow is available for markdown
        if command -v glow &> /dev/null && [[ "$source" == *.md ]]; then
            CONTENT_BUFFER=$(glow -s dark -w $((TERM_WIDTH - 4)) "$source" 2>/dev/null)
        else
            CONTENT_BUFFER=$(cat "$source")
        fi
    else
        # Assume it's a command
        CONTENT_BUFFER=$(eval "$source" 2>&1)
    fi
    
    # Count total lines
    CONTENT_LINES=$(echo "$CONTENT_BUFFER" | wc -l)
}

# Scroll content
scroll_up() {
    if [ $SCROLL_POS -gt 0 ]; then
        ((SCROLL_POS--))
        render_content
        update_footer
    fi
}

scroll_down() {
    local max_scroll=$((CONTENT_LINES - CONTENT_HEIGHT))
    [ $max_scroll -lt 0 ] && max_scroll=0
    
    if [ $SCROLL_POS -lt $max_scroll ]; then
        ((SCROLL_POS++))
        render_content
        update_footer
    fi
}

scroll_page_up() {
    SCROLL_POS=$((SCROLL_POS - CONTENT_HEIGHT))
    [ $SCROLL_POS -lt 0 ] && SCROLL_POS=0
    render_content
    update_footer
}

scroll_page_down() {
    local max_scroll=$((CONTENT_LINES - CONTENT_HEIGHT))
    [ $max_scroll -lt 0 ] && max_scroll=0
    
    SCROLL_POS=$((SCROLL_POS + CONTENT_HEIGHT))
    [ $SCROLL_POS -gt $max_scroll ] && SCROLL_POS=$max_scroll
    render_content
    update_footer
}

scroll_top() {
    SCROLL_POS=0
    render_content
    update_footer
}

scroll_bottom() {
    local max_scroll=$((CONTENT_LINES - CONTENT_HEIGHT))
    [ $max_scroll -lt 0 ] && max_scroll=0
    SCROLL_POS=$max_scroll
    render_content
    update_footer
}

# Update footer with scroll info
update_footer() {
    local percent=0
    if [ $CONTENT_LINES -gt 0 ]; then
        percent=$(( (SCROLL_POS + CONTENT_HEIGHT) * 100 / CONTENT_LINES ))
        [ $percent -gt 100 ] && percent=100
    fi
    
    local info="Line $((SCROLL_POS + 1))-$((SCROLL_POS + CONTENT_HEIGHT)) of $CONTENT_LINES ($percent%)"
    render_footer "$info"
}

# Render everything
render_all() {
    clear
    render_header "$HEADER_TITLE" "$HEADER_SUBTITLE" "$HEADER_STATUS"
    render_content
    update_footer
}

# Main input loop
input_loop() {
    while true; do
        # Read single character
        IFS= read -r -s -n 1 key
        
        case "$key" in
            q|Q)
                break
                ;;
            k|A)  # k or up arrow (ESC[A)
                scroll_up
                ;;
            j|B)  # j or down arrow (ESC[B)
                scroll_down
                ;;
            ' ')  # Space - page down
                scroll_page_down
                ;;
            b)    # b - page up
                scroll_page_up
                ;;
            g)    # g - go to top
                scroll_top
                ;;
            G)    # G - go to bottom
                scroll_bottom
                ;;
            $'\e')  # ESC sequence
                read -r -s -n 2 -t 0.1 seq
                case "$seq" in
                    '[A') scroll_up ;;      # Up arrow
                    '[B') scroll_down ;;    # Down arrow
                    '[5') scroll_page_up; read -r -s -n 1 -t 0.1 ;; # Page Up
                    '[6') scroll_page_down; read -r -s -n 1 -t 0.1 ;; # Page Down
                esac
                ;;
        esac
    done
}

# Main function
main() {
    # Default values
    HEADER_TITLE="${1:-Terminal UI Framework}"
    HEADER_SUBTITLE="${2:-Scrollable Content Viewer}"
    HEADER_STATUS="${3:-Ready}"
    
    # Setup terminal
    setup_terminal
    
    # Load content (example: load a file or command output)
    # You can modify this to load your specific content
    if [ -n "$4" ]; then
        load_content "$4"
    else
        # Demo content
        CONTENT_BUFFER=$(printf "Line %d: This is a demo line with some content\n" {1..100})
        CONTENT_LINES=100
    fi
    
    # Initial render
    render_all
    
    # Start input loop
    input_loop
    
    # Cleanup
    cleanup
}

# Example usage:
# ./tui.sh "My App" "Viewing: document.md" "Connected" "document.md"
# ./tui.sh "My App" "System Info" "Running" "uname -a"

# Run main if script is executed directly
if [ "${BASH_SOURCE[0]}" == "${0}" ]; then
    main "$@"
fi
