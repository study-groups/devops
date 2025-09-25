#!/usr/bin/env bash

# ============================================================================
# PRE-RENDER GLOW OUTPUT FOR TUI WITH SCROLLABLE GHOST PTY
# ============================================================================

# Global variables
GLOW_RENDERED=""
GHOST_PTY=""
GHOST_BUFFER=""
GHOST_PID=""
VIEWER_PID=""
SCROLL_POS=0
TOTAL_LINES=0

# ============================================================================
# MAIN PRE-RENDER AND DISPLAY SYSTEM
# ============================================================================

prerender_glow() {
    local file="${1:-README.md}"
    local width="${2:-80}"
    local style="${3:-dark}"
    
    echo "Pre-rendering $file with glow..."
    
    # Set up paths
    GLOW_RENDERED="/tmp/glow_rendered_$$.ansi"
    GHOST_BUFFER="/tmp/ghost_buffer_$$.log"
    GHOST_PTY="/tmp/ghost_pty_$$"
    
    # Pre-render with glow (preserving colors)
    if [ -f "$file" ]; then
        glow -s "$style" -w "$width" "$file" > "$GLOW_RENDERED"
        
        # Count total lines for scrolling
        TOTAL_LINES=$(wc -l < "$GLOW_RENDERED")
        
        echo "Rendered $TOTAL_LINES lines to: $GLOW_RENDERED"
        return 0
    else
        echo "Error: File $file not found"
        return 1
    fi
}

# ============================================================================
# CREATE SCROLLABLE VIEWER WITH GHOST PTY
# ============================================================================

create_scrollable_viewer() {
    echo "Creating scrollable viewer..."
    
    # Method 1: Use less for viewing (most reliable)
    create_viewer_with_less() {
        # Create PTY with less viewing the pre-rendered content
        socat PTY,link=$GHOST_PTY,raw,echo=0 \
              EXEC:"less -R $GLOW_RENDERED",pty,setsid,sigint,sane &
        GHOST_PID=$!
        
        # Wait for PTY to exist
        while [ ! -e "$GHOST_PTY" ]; do
            sleep 0.1
        done
        
        # Capture output to buffer (optional)
        cat "$GHOST_PTY" > "$GHOST_BUFFER" 2>/dev/null &
        VIEWER_PID=$!
        
        echo "Viewer ready. PTY: $GHOST_PTY"
    }
    
    # Method 2: Custom pager with cat and head/tail
    create_viewer_with_custom_pager() {
        # Create a simple pager script
        cat > /tmp/pager_$$.sh << 'EOF'
#!/bin/bash
file="$1"
lines_per_page=30
total_lines=$(wc -l < "$file")
current_line=1

while true; do
    clear
    sed -n "${current_line},$((current_line + lines_per_page - 1))p" "$file"
    
    read -n 1 -s key
    case "$key" in
        j) ((current_line++)) ;;
        k) ((current_line--)) ;;
        q) exit 0 ;;
    esac
    
    # Bounds checking
    [ $current_line -lt 1 ] && current_line=1
    max_line=$((total_lines - lines_per_page + 1))
    [ $current_line -gt $max_line ] && current_line=$max_line
done
EOF
        chmod +x /tmp/pager_$$.sh
        
        # Run custom pager in PTY
        socat PTY,link=$GHOST_PTY,raw,echo=0 \
              EXEC:"/tmp/pager_$$.sh $GLOW_RENDERED",pty,setsid &
        GHOST_PID=$!
    }
    
    # Use less by default (more reliable)
    create_viewer_with_less
}

# ============================================================================
# SCROLL CONTROL FUNCTIONS
# ============================================================================

scroll_down() {
    echo "j" > "$GHOST_PTY"
}

scroll_up() {
    echo "k" > "$GHOST_PTY"
}

scroll_page_down() {
    echo " " > "$GHOST_PTY"  # Space for page down in less
}

scroll_page_up() {
    echo "b" > "$GHOST_PTY"  # b for page up in less
}

scroll_to_top() {
    echo "g" > "$GHOST_PTY"  # g for top in less
}

scroll_to_bottom() {
    echo "G" > "$GHOST_PTY"  # G for bottom in less
}

quit_viewer() {
    echo "q" > "$GHOST_PTY"  # q to quit less
}

# ============================================================================
# TUI INTEGRATION FUNCTIONS
# ============================================================================

# Get content for TUI viewport
get_viewport_content() {
    local start_line="${1:-1}"
    local num_lines="${2:-30}"
    
    # Extract specific lines from pre-rendered content
    sed -n "${start_line},$((start_line + num_lines - 1))p" "$GLOW_RENDERED"
}

# Get current buffer state
get_buffer_snapshot() {
    if [ -f "$GHOST_BUFFER" ]; then
        cat "$GHOST_BUFFER"
    else
        # Fallback: get from screen capture
        if command -v tmux &>/dev/null && [ -n "$TMUX" ]; then
            tmux capture-pane -p
        else
            tail -n 50 "$GLOW_RENDERED"
        fi
    fi
}

# ============================================================================
# COMPLETE TUI EXAMPLE
# ============================================================================

run_tui_example() {
    local file="${1:-README.md}"
    
    # Step 1: Pre-render
    prerender_glow "$file" 80 dark || return 1
    
    # Step 2: Create viewer
    create_scrollable_viewer
    
    # Step 3: Simple TUI loop
    clear
    local viewport_start=1
    local viewport_height=20
    
    while true; do
        # Clear and draw header
        clear
        tput cup 0 0
        echo "╔════════════════════════════════════════════════════════════════════════════╗"
        echo "║ Glow Viewer - $file (Lines: $TOTAL_LINES) [j/k: scroll, q: quit]          ║"
        echo "╠════════════════════════════════════════════════════════════════════════════╣"
        
        # Draw content
        tput cup 3 0
        get_viewport_content $viewport_start $viewport_height
        
        # Draw footer
        tput cup $((3 + viewport_height + 1)) 0
        echo "╠════════════════════════════════════════════════════════════════════════════╣"
        local percent=$((viewport_start * 100 / TOTAL_LINES))
        echo "║ Line $viewport_start-$((viewport_start + viewport_height)) of $TOTAL_LINES ($percent%)                                          ║"
        echo "╚════════════════════════════════════════════════════════════════════════════╝"
        
        # Read input
        read -n 1 -s key
        case "$key" in
            j) # Scroll down
                ((viewport_start++))
                [ $viewport_start -gt $((TOTAL_LINES - viewport_height)) ] && \
                    viewport_start=$((TOTAL_LINES - viewport_height))
                ;;
            k) # Scroll up
                ((viewport_start--))
                [ $viewport_start -lt 1 ] && viewport_start=1
                ;;
            q) # Quit
                break
                ;;
        esac
    done
    
    # Cleanup
    cleanup_viewer
}

# ============================================================================
# CLEANUP
# ============================================================================

cleanup_viewer() {
    echo "Cleaning up..."
    
    # Kill processes
    [ -n "$GHOST_PID" ] && kill $GHOST_PID 2>/dev/null
    [ -n "$VIEWER_PID" ] && kill $VIEWER_PID 2>/dev/null
    
    # Remove files
    rm -f "$GLOW_RENDERED" "$GHOST_BUFFER" "$GHOST_PTY" /tmp/pager_$$.sh
    
    echo "Cleanup complete"
}

# ============================================================================
# OPTIMIZED VERSION FOR PRODUCTION TUI
# ============================================================================

class_GlowTUI() {
    # This is how you'd structure it for a real TUI
    
    local file="$1"
    local rendered="/tmp/glow_$$.ansi"
    local lines_array=()
    
    # Pre-render once
    echo "Rendering $file..."
    glow -s dark -w "${COLUMNS:-80}" "$file" > "$rendered"
    
    # Load into array for fast access
    mapfile -t lines_array < "$rendered"
    local total_lines=${#lines_array[@]}
    
    # TUI variables
    local viewport_top=0
    local viewport_height=$((LINES - 6))  # Leave room for header/footer
    
    # Render function
    render_frame() {
        clear
        
        # Header
        printf "\033[1;1H"  # Move to top
        printf "\033[44m%-${COLUMNS}s\033[0m\n" " Glow Viewer: $file "
        
        # Content area
        for ((i = 0; i < viewport_height; i++)); do
            local line_num=$((viewport_top + i))
            if [ $line_num -lt $total_lines ]; then
                printf "%s\n" "${lines_array[$line_num]}"
            else
                printf "\n"
            fi
        done
        
        # Footer
        printf "\033[%d;1H" "$LINES"  # Move to bottom
        local percent=$((viewport_top * 100 / (total_lines - viewport_height)))
        printf "\033[42m Line %d-%d of %d (%d%%) | j:↓ k:↑ g:top G:bottom q:quit \033[0m" \
               "$((viewport_top + 1))" \
               "$((viewport_top + viewport_height))" \
               "$total_lines" \
               "$percent"
    }
    
    # Main loop
    while true; do
        render_frame
        
        read -rsn1 key
        case "$key" in
            j) # Down
                ((viewport_top++))
                [ $viewport_top -gt $((total_lines - viewport_height)) ] && \
                    viewport_top=$((total_lines - viewport_height))
                ;;
            k) # Up
                ((viewport_top--))
                [ $viewport_top -lt 0 ] && viewport_top=0
                ;;
            g) # Top
                viewport_top=0
                ;;
            G) # Bottom
                viewport_top=$((total_lines - viewport_height))
                [ $viewport_top -lt 0 ] && viewport_top=0
                ;;
            q) # Quit
                break
                ;;
        esac
    done
    
    rm -f "$rendered"
    clear
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    echo "Glow Pre-render TUI System"
    echo "=========================="
    echo "1. Pre-render and view with less"
    echo "2. Run simple TUI example"
    echo "3. Run optimized TUI"
    echo "4. Just pre-render (no viewer)"
    echo
    read -p "Choice (1-4): " choice
    
    case "$choice" in
        1)
            prerender_glow "README.md"
            create_scrollable_viewer
            echo "Controls: j/k (up/down), space/b (page), g/G (top/bottom), q (quit)"
            echo "Try: echo 'j' > $GHOST_PTY"
            read -p "Press Enter to cleanup..."
            cleanup_viewer
            ;;
        2)
            run_tui_example "README.md"
            ;;
        3)
            class_GlowTUI "README.md"
            ;;
        4)
            prerender_glow "README.md"
            echo "Rendered to: $GLOW_RENDERED"
            echo "Preview:"
            head -20 "$GLOW_RENDERED"
            ;;
    esac
else
    echo "Script sourced. Functions available:"
    echo "  prerender_glow <file>"
    echo "  create_scrollable_viewer"
    echo "  run_tui_example <file>"
    echo "  class_GlowTUI <file>"
fi
