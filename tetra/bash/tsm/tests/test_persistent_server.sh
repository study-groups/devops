#!/usr/bin/env bash

# Persistent server that's harder to kill - for testing TSM kill functionality
# This script creates a process that ignores SIGTERM and requires SIGKILL

export PORT=8889

echo "Starting persistent server on port $PORT (PID: $$)"
echo "Server will ignore SIGTERM and require SIGKILL"

# Trap SIGTERM and ignore it initially
trap 'echo "Received SIGTERM, ignoring for 5 seconds..."; sleep 5; echo "Now exiting gracefully"; exit 0' TERM

# Trap SIGINT for manual testing
trap 'echo "Received SIGINT, exiting"; exit 0' INT

# Function to start a simple HTTP server using bash and nc
start_server() {
    local port="$1"
    
    # Create a named pipe for communication
    local pipe="/tmp/tsm_test_pipe_$$"
    mkfifo "$pipe"
    
    # Cleanup function
    cleanup_pipe() {
        rm -f "$pipe"
    }
    trap cleanup_pipe EXIT
    
    echo "Starting HTTP server on port $port using bash and nc"
    
    while true; do
        # Simple HTTP response
        {
            echo "HTTP/1.1 200 OK"
            echo "Content-Type: text/plain"
            echo "Content-Length: 50"
            echo ""
            echo "Persistent server running on port $port (PID: $$)"
        } | nc -l "$port" || {
            echo "nc failed, retrying in 1 second..."
            sleep 1
        }
    done
}

# Alternative server using Python if nc fails
start_python_server() {
    local port="$1"
    
    echo "Starting Python HTTP server on port $port"
    
    python3 -c "
import http.server
import socketserver
import signal
import time

class MyHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/plain')
        self.end_headers()
        self.wfile.write(f'Persistent server running on port $port (PID: $$)\\n'.encode())
    
    def log_message(self, format, *args):
        pass  # Suppress default logging

def signal_handler(signum, frame):
    if signum == signal.SIGTERM:
        print('Received SIGTERM, ignoring for 5 seconds...')
        time.sleep(5)
        print('Now exiting gracefully')
        exit(0)

signal.signal(signal.SIGTERM, signal_handler)

with socketserver.TCPServer(('', $port), MyHandler) as httpd:
    print(f'Python server started on port $port')
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('Server stopped')
"
}

# Try nc first, fall back to Python
if command -v nc >/dev/null 2>&1; then
    start_server "$PORT"
elif command -v python3 >/dev/null 2>&1; then
    start_python_server "$PORT"
else
    echo "ERROR: Neither nc nor python3 found"
    exit 1
fi
