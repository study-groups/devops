#!/usr/bin/env bash

# ============================================================================
# DEBUGGING SOCAT ISSUE
# ============================================================================

echo "=== Debugging Socat with Glow ==="

# 1. First, check if glow is installed and working
check_glow() {
    echo "Checking glow setup..."
    
    # Check if glow is installed
    if ! command -v glow &>/dev/null; then
        echo "Error: glow not installed"
        echo "Install with: brew install glow"
        return 1
    fi
    
    # Check if README.md exists
    if [ ! -f "README.md" ]; then
        echo "Error: README.md not found in current directory"
        echo "Current directory: $(pwd)"
        echo "Files here: $(ls -la)"
        return 1
    fi
    
    # Test glow directly
    echo "Testing glow directly..."
    glow README.md
}

# 2. Fixed socat command with better error handling
socat_with_glow() {
    echo "=== Running Socat with Glow ==="
    
    # Make sure we're in the right directory
    local file="${1:-README.md}"
    
    if [ ! -f "$file" ]; then
        echo "Error: File '$file' not found"
        echo "Available files:"
        ls -la *.md 2>/dev/null || echo "No .md files found"
        return 1
    fi
    
    # Method 1: With absolute path
    echo "Method 1: Using absolute path"
    local abs_path="$(pwd)/$file"
    socat -,raw,echo=0 exec:"glow $abs_path",pty,setsid,sigint,sane
    
    # Method 2: With cd command
    echo "Method 2: Using cd first"
    socat -,raw,echo=0 exec:"cd $(pwd) && glow $file",pty,setsid,sigint,sane
    
    # Method 3: Using bash -c
    echo "Method 3: Using bash -c"
    socat -,raw,echo=0 exec:"bash -c 'glow $file'",pty,setsid,sigint,sane
}

# 3. Alternative: Use cat or less if glow fails
socat_alternative() {
    echo "=== Alternative Commands ==="
    
    # Try with less (always works)
    echo "1. Using less:"
    socat -,raw,echo=0 exec:"less README.md",pty,setsid,sigint,sane
    
    # Try with cat (simple test)
    echo "2. Using cat:"
    socat -,raw,echo=0 exec:"cat README.md",pty,setsid,sigint,sane
    
    # Try with a simple command
    echo "3. Using ls:"
    socat -,raw,echo=0 exec:"ls -la",pty,setsid,sigint,sane
}

# ============================================================================
# METHOD 3: EXPECT (Third Option from Original List)
# ============================================================================

# Install expect first:
# macOS: brew install expect
# Linux: sudo apt-get install expect

echo "=== Method 3: Using Expect ==="

# Basic expect example
basic_expect() {
    echo "=== Basic Expect Ghost PTY ==="
    
    if ! command -v expect &>/dev/null; then
        echo "Error: expect not installed"
        echo "Install with:"
        echo "  macOS: brew install expect"
        echo "  Linux: sudo apt-get install expect"
        return 1
    fi
    
    local cmd="${1:-glow README.md}"
    local logfile="/tmp/expect_ghost_$$.log"
    
    # Create expect script
    expect -c "
        # Enable logging
        log_file -a $logfile
        
        # Spawn the command
        spawn $cmd
        
        # Wait for it to complete or timeout
        set timeout -1
        expect eof
    " &
    
    local expect_pid=$!
    
    echo "Started expect with PID: $expect_pid"
    echo "Log file: $logfile"
    
    # Monitor log
    tail -f "$logfile" &
    local tail_pid=$!
    
    echo "Press Enter to stop..."
    read
    
    kill $expect_pid $tail_pid 2>/dev/null
    rm -f "$logfile"
}

# Interactive expect session
interactive_expect() {
    echo "=== Interactive Expect Session ==="
    
    if ! command -v expect &>/dev/null; then
        echo "Error: expect not installed"
        return 1
    fi
    
    # This creates an interactive session you can control
    expect -c '
        # Spawn bash
        spawn bash
        
        # Set up logging
        log_file /tmp/expect_interactive.log
        
        # Make it interactive
        interact {
            ~~ exit  ;# Type ~~ to exit
            ~. {     ;# Type ~. to send commands
                send_user "\nEnter command: "
                expect_user -re "(.*)\n"
                send "$expect_out(1,string)\r"
            }
        }
    '
}

# Expect with ghost glow
expect_glow() {
    echo "=== Expect with Glow ==="
    
    if ! command -v expect &>/dev/null; then
        echo "Error: expect not installed"
        return 1
    fi
    
    local file="${1:-README.md}"
    local logfile="/tmp/glow_expect_$$.log"
    
    if [ ! -f "$file" ]; then
        echo "Error: $file not found"
        return 1
    fi
    
    # Create expect script for glow
    cat > /tmp/glow_expect_$$.exp << EOF
#!/usr/bin/expect -f

# Set variables
set file "$file"
set logfile "$logfile"

# Enable logging
log_file -a \$logfile

# Spawn glow
spawn glow \$file

# Handle glow interaction
expect {
    # Glow might be waiting for input
    -re ".*" {
        # Send 'j' to scroll down
        after 1000
        send "j"
        exp_continue
    }
    eof {
        puts "Glow session ended"
    }
    timeout {
        puts "Timeout reached"
    }
}

# Keep it running
vwait forever
EOF
    
    chmod +x /tmp/glow_expect_$$.exp
    
    # Run it
    /tmp/glow_expect_$$.exp &
    expect_pid=$!
    
    echo "Glow running in expect (PID: $expect_pid)"
    echo "Log: $logfile"
    
    # Monitor
    tail -f "$logfile" &
    tail_pid=$!
    
    echo "Commands:"
    echo "  Press Enter to stop"
    read
    
    kill $expect_pid $tail_pid 2>/dev/null
    rm -f "$logfile" /tmp/glow_expect_$$.exp
}

# Automated expect with input/output
automated_expect() {
    echo "=== Automated Expect Ghost Terminal ==="
    
    if ! command -v expect &>/dev/null; then
        echo "Error: expect not installed"
        return 1
    fi
    
    local input_fifo="/tmp/expect_in_$$"
    local output_file="/tmp/expect_out_$$"
    
    mkfifo "$input_fifo"
    
    # Start expect with input from FIFO
    expect -c "
        # Open log file
        log_file $output_file
        
        # Spawn bash
        spawn bash
        
        # Read commands from FIFO and send them
        set fifo [open $input_fifo r]
        fconfigure \$fifo -blocking 0
        
        # Event loop
        fileevent \$fifo readable {
            if {[gets \$fifo line] >= 0} {
                send \"\$line\r\"
            }
        }
        
        # Keep running
        vwait forever
    " &
    
    expect_pid=$!
    
    # Keep FIFO open
    exec 3>"$input_fifo"
    
    # Monitor output
    tail -f "$output_file" &
    tail_pid=$!
    
    echo "Ghost terminal ready!"
    echo "Send commands like: echo 'ls' >&3"
    
    # Demo
    sleep 1
    echo "pwd" >&3
    sleep 1
    echo "ls -la" >&3
    sleep 1
    echo "date" >&3
    
    echo "Press Enter to stop..."
    read
    
    exec 3>&-
    kill $expect_pid $tail_pid 2>/dev/null
    rm -f "$input_fifo" "$output_file"
}

# ============================================================================
# COMPLETE WORKING EXAMPLE FOR YOUR TUI
# ============================================================================

working_tui_ghost() {
    echo "=== Working Ghost Terminal for TUI ==="
    
    # Option 1: If socat works
    if command -v socat &>/dev/null; then
        echo "Using socat..."
        
        # Create a simple test file if README.md doesn't exist
        if [ ! -f "README.md" ]; then
            echo "# Test File" > test.md
            echo "This is a test markdown file" >> test.md
            echo "- Item 1" >> test.md
            echo "- Item 2" >> test.md
            local file="test.md"
        else
            local file="README.md"
        fi
        
        local pty="/tmp/ghost_pty_$$"
        local buffer="/tmp/ghost_buffer_$$"
        
        # Start socat with working command
        socat PTY,link=$pty,raw,echo=0 \
              EXEC:"bash -c 'cat $file'",pty,setsid &
        socat_pid=$!
        
        # Capture output
        sleep 0.5
        cat "$pty" > "$buffer" &
        cat_pid=$!
        
        # Display
        sleep 1
        echo "=== Content ==="
        cat "$buffer"
        echo "================"
        
        kill $socat_pid $cat_pid 2>/dev/null
        rm -f "$pty" "$buffer" test.md
        
    # Option 2: If expect works
    elif command -v expect &>/dev/null; then
        echo "Using expect..."
        basic_expect "cat README.md"
        
    # Option 3: Fallback to script
    else
        echo "Using script (fallback)..."
        if [[ "$OSTYPE" == "darwin"* ]]; then
            script -q /tmp/ghost.log cat README.md &
        else
            script -q -f -c "cat README.md" /tmp/ghost.log &
        fi
        sleep 1
        cat /tmp/ghost.log
    fi
}

# ============================================================================
# MAIN MENU
# ============================================================================

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    echo "Ghost PTY Debugging & Expect Examples"
    echo "======================================"
    echo "1. Debug glow setup"
    echo "2. Test socat with glow (fixed)"
    echo "3. Try alternative commands"
    echo "4. Basic expect example"
    echo "5. Interactive expect"
    echo "6. Expect with glow"
    echo "7. Automated expect"
    echo "8. Working TUI example"
    echo
    read -p "Choice (1-8): " choice
    
    case "$choice" in
        1) check_glow ;;
        2) socat_with_glow ;;
        3) socat_alternative ;;
        4) 
            read -p "Enter command [ls -la]: " cmd
            basic_expect "${cmd:-ls -la}"
            ;;
        5) interactive_expect ;;
        6) expect_glow ;;
        7) automated_expect ;;
        8) working_tui_ghost ;;
        *) echo "Invalid choice" ;;
    esac
fi
