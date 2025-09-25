#!/usr/bin/env bash

# ============================================================================
# FIXED PRE-RENDER SYSTEM - No Terminal Hijacking
# ============================================================================

# Global variables
GLOW_RENDERED=""
VIEWPORT_START=1
TOTAL_LINES=0

# ============================================================================
# PRE-RENDER GLOW (Safe Version)
# ============================================================================

prerender_glow() {
    local file="${1:-README.md}"
    local width="${2:-80}"
    local style="${3:-dark}"
    
    echo "Pre-rendering $file with glow..."
    
    # Set up path
    GLOW_RENDERED="/tmp/glow_rendered_$$.ansi"
    
    # Pre-render with glow (preserving colors)
    if [ -f "$file" ]; then
        glow -s "$style" -w "$width" "$file" > "$GLOW_RENDERED"
        
        # Count total lines for scrolling
        TOTAL_LINES=$(wc -l < "$GLOW_RENDERED")
        
        echo "✓ Rendered $TOTAL_LINES lines to: $GLOW_RENDERED"
        echo "  View with: view_rendered"
        echo "  Start TUI: start_tui"
        return 0
    else
        echo "Error: File $file not found"
        return 1
    fi
}

# ============================================================================
# SAFE VIEWING OPTIONS (No Terminal Hijacking)
# ============================================================================

# Option 1: View in less (manual command)
view_rendered() {
    if [ -z "$GLOW_RENDERED" ] || [ ! -f "$GLOW_RENDERED" ]; then
        echo "No rendered file. Run: prerender_glow <file> first"
        return 1
    fi
    
    echo "Opening in less... (q to quit)"
    less -R "$GLOW_RENDERED"
}

# Option 2: Display a viewport (safe)
show_viewport() {
    local start="${1:-1}"
    local lines="${2:-30}"
    
    if [ -z "$GLOW_RENDERED" ] || [ ! -f "$GLOW_RENDERED" ]; then
        echo "No rendered file. Run: prerender_glow <file> first"
        return 1
    fi
    
    echo "━━━━━━━━━━ Viewport (lines $start-$((start + lines))) ━━━━━━━━━━"
    sed -n "${start},$((start + lines - 1))p" "$GLOW_RENDERED"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Commands: next_page, prev_page, goto_line <n>"
}

# Navigation helpers
next_page() {
    VIEWPORT_START=$((VIEWPORT_START + 30))
    [ $VIEWPORT_START -gt $TOTAL_LINES ] && VIEWPORT_START=$((TOTAL_LINES - 29))
    show_viewport $VIEWPORT_START 30
}

prev_page() {
    VIEWPORT_START=$((VIEWPORT_START - 30))
    [ $VIEWPORT_START -lt 1 ] && VIEWPORT_START=1
    show_viewport $VIEWPORT_START 30
}

goto_line() {
    VIEWPORT_START="${1:-1}"
    show_viewport $VIEWPORT_START 30
}

# ============================================================================
# DETACHED VIEWER (Runs in Separate Process)
# ============================================================================

create_detached_viewer() {
    if [ -z "$GLOW_RENDERED" ] || [ ! -f "$GLOW_RENDERED" ]; then
        echo "No rendered file. Run: prerender_glow <file> first"
        return 1
    fi
    
    local viewer_script="/tmp/viewer_$$.sh"
    
    # Create a standalone viewer script
    cat > "$viewer_script" << 'EOF'
#!/bin/bash
file="$1"
exec less -R "$file"
EOF
    chmod +x "$viewer_script"
    
    echo "Starting detached viewer..."
    echo "This will open in a new terminal/process"
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS - open in new Terminal window
        osascript -e "tell app \"Terminal\" to do script \"$viewer_script $GLOW_RENDERED\""
    elif [ -n "$DISPLAY" ]; then
        # Linux with X11 - try to open new terminal
        if command -v xterm &>/dev/null; then
            xterm -e "$viewer_script" "$GLOW_RENDERED" &
        elif command -v gnome-terminal &>/dev/null; then
            gnome-terminal -- "$viewer_script" "$GLOW_RENDERED" &
        else
            echo "Can't open new terminal. View with: less -R $GLOW_RENDERED"
        fi
    else
        # No GUI - suggest manual viewing
        echo "View manually with: less -R $GLOW_RENDERED"
    fi
}

# ============================================================================
# STANDALONE TUI (Won't Interfere with Shell)
# ============================================================================

start_tui() {
    if [ -z "$GLOW_RENDERED" ] || [ ! -f "$GLOW_RENDERED" ]; then
        echo "No rendered file. Run: prerender_glow <file> first"
        return 1
    fi
    
    echo "Starting TUI..."
    echo "This will take over your terminal. Press 'q' to quit."
    echo "Press Enter to continue..."
    read
    
    # Run the TUI (this WILL take over terminal, but only after confirmation)
    _run_safe_tui
}

_run_safe_tui() {
    # Save terminal state
    local saved_tty=$(stty -g)
    
    # Set raw mode for input
    stty -echo -icanon min 0 time 0
    
    # Load content into array
    mapfile -t CONTENT_LINES < "$GLOW_RENDERED"
    local total=${#CONTENT_LINES[@]}
    local viewport_top=0
    local viewport_height=$(($(tput lines) - 4))
    
    # Trap for cleanup
    trap "stty $saved_tty; clear; return 0" INT TERM EXIT
    
    clear
    while true; do
        # Draw frame
        tput cup 0 0
        echo "╔════════════════════════════════════════════════════════════════╗"
        echo "║ Glow Viewer - [j/k:scroll q:quit g:top G:bottom]              ║"
        echo "╚════════════════════════════════════════════════════════════════╝"
        
        # Draw content
        for ((i = 0; i < viewport_height && (viewport_top + i) < total; i++)); do
            tput cup $((i + 3)) 0
            echo "${CONTENT_LINES[$((viewport_top + i))]}"
        done
        
        # Footer
        tput cup $(($(tput lines) - 1)) 0
        local percent=$(( (viewport_top + viewport_height) * 100 / total ))
        echo "Line $((viewport_top + 1))-$((viewport_top + viewport_height)) of $total ($percent%)"
        
        # Read input (non-blocking)
        read -rsn1 -t 0.1 key
        case "$key" in
            j) # Down
                ((viewport_top++))
                [ $viewport_top -gt $((total - viewport_height)) ] && \
                    viewport_top=$((total - viewport_height))
                ;;
            k) # Up
                ((viewport_top--))
                [ $viewport_top -lt 0 ] && viewport_top=0
                ;;
            g) # Top
                viewport_top=0
                ;;
            G) # Bottom
                viewport_top=$((total - viewport_height))
                [ $viewport_top -lt 0 ] && viewport_top=0
                ;;
            q) # Quit
                break
                ;;
        esac
    done
    
    # Restore terminal
    stty "$saved_tty"
    clear
}

# ============================================================================
# EXPORT TO FILE (For External Processing)
# ============================================================================

export_for_external() {
    if [ -z "$GLOW_RENDERED" ] || [ ! -f "$GLOW_RENDERED" ]; then
        echo "No rendered file. Run: prerender_glow <file> first"
        return 1
    fi
    
    local export_file="${1:-/tmp/glow_export.ansi}"
    
    cp "$GLOW_RENDERED" "$export_file"
    echo "Exported to: $export_file"
    echo "You can now:"
    echo "  - Process it with your TUI: cat $export_file"
    echo "  - View it: less -R $export_file"
    echo "  - Get line count: wc -l $export_file"
}

# ============================================================================
# CLEAN HELPERS
# ============================================================================

# Get specific lines without affecting terminal
get_lines() {
    local start="${1:-1}"
    local end="${2:-$start}"
    
    if [ -z "$GLOW_RENDERED" ] || [ ! -f "$GLOW_RENDERED" ]; then
        echo "No rendered file. Run: prerender_glow <file> first"
        return 1
    fi
    
    sed -n "${start},${end}p" "$GLOW_RENDERED"
}

# Get content info
info() {
    if [ -z "$GLOW_RENDERED" ] || [ ! -f "$GLOW_RENDERED" ]; then
        echo "No rendered file loaded"
        return 1
    fi
    
    echo "Rendered file: $GLOW_RENDERED"
    echo "Total lines: $TOTAL_LINES"
    echo "File size: $(du -h "$GLOW_RENDERED" | cut -f1)"
    echo "Current viewport: $VIEWPORT_START"
}

# Clean up
cleanup_rendered() {
    if [ -n "$GLOW_RENDERED" ] && [ -f "$GLOW_RENDERED" ]; then
        rm -f "$GLOW_RENDERED"
        echo "Cleaned up rendered file"
    fi
    GLOW_RENDERED=""
    TOTAL_LINES=0
    VIEWPORT_START=1
}

# ============================================================================
# HELP
# ============================================================================

show_help() {
    cat << 'EOF'
Pre-render TUI Commands:
========================
Setup:
  prerender_glow <file>    - Pre-render markdown file with glow
  
Safe Viewing (won't break terminal):
  view_rendered           - Open in less (press q to quit)
  show_viewport [start] [lines] - Show specific lines
  next_page              - Show next 30 lines  
  prev_page              - Show previous 30 lines
  goto_line <n>          - Jump to line n
  get_lines <start> <end> - Get specific lines
  
Full TUI:
  start_tui              - Start full-screen TUI (with confirmation)
  
Export:
  export_for_external [file] - Export to file for external processing
  
Info:
  info                   - Show current render info
  cleanup_rendered       - Remove rendered file
  show_help              - Show this help
EOF
}

# ============================================================================
# INITIALIZATION
# ============================================================================

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    # Script is being run directly
    echo "Glow Pre-render System"
    echo "======================"
    
    if [ -n "$1" ]; then
        prerender_glow "$1"
        show_viewport 1 30
        echo ""
        echo "Use 'next_page' and 'prev_page' to navigate"
    else
        show_help
    fi
else
    # Script is being sourced
    echo "Pre-render TUI loaded. Commands:"
    echo "  prerender_glow <file>  - Render a markdown file"
    echo "  show_viewport         - Display content"
    echo "  start_tui            - Start full TUI"
    echo "  show_help            - Show all commands"
fi
