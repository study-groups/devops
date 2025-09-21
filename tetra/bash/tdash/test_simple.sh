#!/usr/bin/env bash

# Simple test dashboard to debug hanging issue

echo "Starting simple test dashboard..."

# Check terminal
if [[ ! -t 0 ]]; then
    echo "Not a terminal, exiting"
    exit 1
fi

echo "Terminal check passed"

# Simple render
render_test() {
    clear
    cat << 'EOF'
                          ╔══════════════════════════════╗
                          ║         TEST DASHBOARD       ║
                          ╚══════════════════════════════╝

                         Press 'q' to quit, 'r' to refresh

EOF
}

# Simple input loop
input_loop() {
    local running=true

    while [[ "$running" == true ]]; do
        echo "Waiting for input (q to quit)..."

        local key
        if read -n1 -s -t 1 key; then
            echo "Got key: '$key'"
            case "$key" in
                'q'|'Q')
                    echo "Quitting..."
                    running=false
                    ;;
                'r'|'R')
                    echo "Refreshing..."
                    render_test
                    ;;
                *)
                    echo "Unknown key: '$key'"
                    ;;
            esac
        else
            echo "Timeout, continuing..."
        fi
    done
}

# Main
echo "Rendering..."
render_test

echo "Starting input loop..."
input_loop

echo "Done."