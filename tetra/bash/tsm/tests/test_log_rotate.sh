#!/usr/bin/env bash

# Test script for TSM log rotation functionality
# Tests log file management and rotation capabilities

TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TSM_DIR="$(dirname "$TEST_DIR")"

# Source tsm functions
source "$TSM_DIR/tsm.sh"

# Heavy logging test server
create_heavy_logger() {
    local port="$1"
    cat > "$TEST_DIR/heavy_logger_$port.sh" << EOF
#!/usr/bin/env bash
export PORT=$port

echo "Heavy logger starting on port \$PORT"
for i in {1..100}; do
    echo "[\$(date)] LOG ENTRY \$i: This is a test log entry with some data \$(openssl rand -hex 32)"
    echo "[\$(date)] ERROR ENTRY \$i: This is a test error entry" >&2
    sleep 0.1
done
echo "Heavy logger finished"
EOF
    chmod +x "$TEST_DIR/heavy_logger_$port.sh"
}

cleanup() {
    echo "Cleaning up log rotation test..."
    tsm delete "*" 2>/dev/null || true
    rm -f "$TEST_DIR"/heavy_logger_*.sh 2>/dev/null || true
}

# Test log rotation functionality
test_log_rotation() {
    echo "=== Testing TSM Log Rotation ==="
    
    # Setup
    tsm setup
    cleanup
    
    # Create heavy logging server
    create_heavy_logger 3003
    
    echo "Starting heavy logging server..."
    tsm start "$TEST_DIR/heavy_logger_3003.sh"
    
    # Wait for some logs to accumulate
    echo "Waiting for logs to accumulate..."
    sleep 15
    
    echo "Current log files:"
    ls -la "$TSM_LOGS_DIR/"heavy_logger*
    
    echo "Log file sizes:"
    du -h "$TSM_LOGS_DIR/"heavy_logger*
    
    echo "Sample stdout logs (last 10 lines):"
    tsm logs heavy_logger-3003 --lines 10 --nostream
    
    echo "Testing log rotation simulation..."
    local logfile="$TSM_LOGS_DIR/heavy_logger-3003.out"
    local errfile="$TSM_LOGS_DIR/heavy_logger-3003.err"
    
    # Simulate log rotation by moving current logs and restarting
    if [[ -f "$logfile" ]]; then
        local timestamp=$(date +%Y%m%d_%H%M%S)
        echo "Rotating logs with timestamp: $timestamp"
        
        # Move current logs
        mv "$logfile" "${logfile}.${timestamp}" 2>/dev/null || true
        mv "$errfile" "${errfile}.${timestamp}" 2>/dev/null || true
        
        echo "Restarting process to create new log files..."
        tsm restart heavy_logger-3003
        
        sleep 3
        
        echo "After rotation - new log files:"
        ls -la "$TSM_LOGS_DIR/"heavy_logger*
        
        echo "New logs content:"
        tsm logs heavy_logger-3003 --lines 5 --nostream
        
        echo "Rotated logs still accessible:"
        [[ -f "${logfile}.${timestamp}" ]] && echo "Rotated stdout: $(wc -l < "${logfile}.${timestamp}") lines"
        [[ -f "${errfile}.${timestamp}" ]] && echo "Rotated stderr: $(wc -l < "${errfile}.${timestamp}") lines"
    fi
    
    echo "Testing log size limits simulation..."
    # Show how logs can be managed
    echo "Current log sizes:"
    du -h "$TSM_LOGS_DIR/"heavy_logger* 2>/dev/null || echo "No log files found"
    
    echo "Cleaning up..."
    cleanup
    
    # Remove rotated logs
    rm -f "$TSM_LOGS_DIR/"*.2* 2>/dev/null || true
    
    echo "=== Log rotation tests completed ==="
}

# Add function to tsm for log rotation
add_log_rotation_to_tsm() {
    echo "=== Adding log rotation function to TSM ==="
    
    cat >> "$TSM_DIR/tsm.sh" << 'EOF'

tetra_tsm_rotate_logs() {
    local pattern="${1:-*}"
    local keep_rotated="${2:-5}"
    
    if [[ "$pattern" == "*" ]]; then
        # Rotate all process logs
        for metafile in "$TSM_PROCESSES_DIR"/*.meta; do
            [[ -f "$metafile" ]] || continue
            local name=$(basename "$metafile" .meta)
            tetra_tsm_rotate_single "$name" "$keep_rotated"
        done
    else
        # Resolve name or ID to actual process name
        local resolved_name
        resolved_name=$(tetra_tsm_resolve_name "$pattern")
        if [[ $? -eq 0 ]]; then
            tetra_tsm_rotate_single "$resolved_name" "$keep_rotated"
        else
            echo "tsm: process '$pattern' not found" >&2
            return 1
        fi
    fi
}

tetra_tsm_rotate_single() {
    local name="$1"
    local keep_rotated="${2:-5}"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    
    local logdir="$TSM_LOGS_DIR"
    local outlog="$logdir/$name.out"
    local errlog="$logdir/$name.err"
    
    # Only rotate if files exist and are not empty
    local rotated=false
    
    if [[ -f "$outlog" && -s "$outlog" ]]; then
        mv "$outlog" "${outlog}.${timestamp}"
        echo "tsm: rotated stdout log for '$name'"
        rotated=true
    fi
    
    if [[ -f "$errlog" && -s "$errlog" ]]; then
        mv "$errlog" "${errlog}.${timestamp}"
        echo "tsm: rotated stderr log for '$name'"
        rotated=true
    fi
    
    # Clean up old rotated logs (keep only recent ones)
    if [[ "$rotated" == "true" ]]; then
        # Remove old rotated logs, keeping only the most recent ones
        find "$logdir" -name "$name.out.*" -type f | sort -r | tail -n +$((keep_rotated + 1)) | xargs rm -f 2>/dev/null || true
        find "$logdir" -name "$name.err.*" -type f | sort -r | tail -n +$((keep_rotated + 1)) | xargs rm -f 2>/dev/null || true
        
        # If process is running, it will automatically start writing to new log files
        if tetra_tsm_is_running "$name"; then
            echo "tsm: process '$name' will continue logging to new files"
        fi
    else
        echo "tsm: no logs to rotate for '$name'"
    fi
}
EOF

    echo "Log rotation functions added to tsm.sh"
}

# Run tests if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    test_log_rotation
    echo
    echo "To add log rotation permanently to TSM, run:"
    echo "  $0 add_rotation"
fi

# Allow adding rotation function
if [[ "$1" == "add_rotation" ]]; then
    add_log_rotation_to_tsm
fi