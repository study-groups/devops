#!/usr/bin/env bash

# TView Background Process Manager
# Handles async SSH checks, data loading, and caches results

BACKGROUND_CACHE_DIR="/tmp/tview_cache"
BACKGROUND_PID_FILE="/tmp/tview_background.pid"
BACKGROUND_LOG_FILE="/tmp/tview_background.log"

# Ensure cache directory exists
mkdir -p "$BACKGROUND_CACHE_DIR"

# Background manager state
declare -gA BACKGROUND_STATE=(
    ["ssh_check_running"]="false"
    ["ssh_last_check"]="0"
    ["ssh_check_interval"]="30"  # seconds
)

# Start background SSH checker if not already running
start_background_ssh_checker() {
    # Kill existing background process if running
    if [[ -f "$BACKGROUND_PID_FILE" ]]; then
        local existing_pid
        existing_pid=$(cat "$BACKGROUND_PID_FILE" 2>/dev/null)
        if [[ -n "$existing_pid" ]] && kill -0 "$existing_pid" 2>/dev/null; then
            return 0  # Already running
        fi
    fi

    # Start new background process
    (
        while true; do
            check_ssh_connectivity_background
            sleep 30  # Check every 30 seconds
        done
    ) &

    echo $! > "$BACKGROUND_PID_FILE"
}

# Background SSH connectivity checker
check_ssh_connectivity_background() {
    local cache_file="$BACKGROUND_CACHE_DIR/ssh_status"
    local temp_file="$cache_file.tmp"
    local check_log="$BACKGROUND_CACHE_DIR/ssh_check.log"

    echo "$(date): Starting SSH connectivity check" >> "$check_log"

    # Mark check as running
    BACKGROUND_STATE["ssh_check_running"]="true"
    BACKGROUND_STATE["ssh_last_check"]="$(date +%s)"

    # Initialize status variables with defaults
    local dev_ssh="○ No SSH"
    local staging_ssh="○ No SSH"
    local prod_ssh="○ No SSH"
    local qa_ssh="○ No SSH"

    # Load environment IPs (source from TView if available)
    if [[ -f "$TETRA_DIR/env/local.env" ]]; then
        source "$TETRA_DIR/env/local.env" 2>/dev/null
        echo "$(date): Loaded environment from $TETRA_DIR/env/local.env" >> "$check_log"
    else
        echo "$(date): No local.env found at $TETRA_DIR/env/local.env" >> "$check_log"
    fi

    # Check DEV SSH (non-blocking with timeout)
    if [[ -n "$DEV_IP" && "$DEV_IP" != "Unknown" ]]; then
        echo "$(date): Checking DEV SSH to $DEV_IP" >> "$check_log"
        if timeout 1 ssh -o ConnectTimeout=1 -o BatchMode=yes -o StrictHostKeyChecking=no tetra@"$DEV_IP" exit 2>/dev/null; then
            dev_ssh="✓ Connected"
            echo "$(date): DEV SSH connected successfully" >> "$check_log"
        else
            echo "$(date): DEV SSH failed or timed out" >> "$check_log"
        fi
    else
        echo "$(date): DEV_IP not configured: '$DEV_IP'" >> "$check_log"
    fi

    # Check STAGING SSH
    if [[ -n "$STAGING_IP" && "$STAGING_IP" != "Unknown" ]]; then
        echo "$(date): Checking STAGING SSH to $STAGING_IP" >> "$check_log"
        if timeout 1 ssh -o ConnectTimeout=1 -o BatchMode=yes -o StrictHostKeyChecking=no tetra@"$STAGING_IP" exit 2>/dev/null; then
            staging_ssh="✓ Connected"
            echo "$(date): STAGING SSH connected successfully" >> "$check_log"
        else
            echo "$(date): STAGING SSH failed or timed out" >> "$check_log"
        fi
    else
        echo "$(date): STAGING_IP not configured: '$STAGING_IP'" >> "$check_log"
    fi

    # Check PROD SSH
    if [[ -n "$PROD_IP" && "$PROD_IP" != "Unknown" ]]; then
        echo "$(date): Checking PROD SSH to $PROD_IP" >> "$check_log"
        if timeout 1 ssh -o ConnectTimeout=1 -o BatchMode=yes -o StrictHostKeyChecking=no tetra@"$PROD_IP" exit 2>/dev/null; then
            prod_ssh="✓ Connected"
            echo "$(date): PROD SSH connected successfully" >> "$check_log"
        else
            echo "$(date): PROD SSH failed or timed out" >> "$check_log"
        fi
    else
        echo "$(date): PROD_IP not configured: '$PROD_IP'" >> "$check_log"
    fi

    # Check QA SSH
    if [[ -n "$QA_IP" && "$QA_IP" != "Unknown" ]]; then
        echo "$(date): Checking QA SSH to $QA_IP" >> "$check_log"
        if timeout 1 ssh -o ConnectTimeout=1 -o BatchMode=yes -o StrictHostKeyChecking=no tetra@"$QA_IP" exit 2>/dev/null; then
            qa_ssh="✓ Connected"
            echo "$(date): QA SSH connected successfully" >> "$check_log"
        else
            echo "$(date): QA SSH failed or timed out" >> "$check_log"
        fi
    else
        echo "$(date): QA_IP not configured: '$QA_IP'" >> "$check_log"
    fi

    # Write results atomically
    {
        echo "DEV_SSH_STATUS=\"$dev_ssh\""
        echo "STAGING_SSH_STATUS=\"$staging_ssh\""
        echo "PROD_SSH_STATUS=\"$prod_ssh\""
        echo "QA_SSH_STATUS=\"$qa_ssh\""
        echo "SSH_CACHE_TIMESTAMP=\"$(date +%s)\""
    } > "$temp_file"

    mv "$temp_file" "$cache_file"

    # Mark check as complete
    BACKGROUND_STATE["ssh_check_running"]="false"
    echo "$(date): SSH connectivity check completed" >> "$check_log"
}

# Get cached SSH status (instant retrieval)
get_cached_ssh_status() {
    local cache_file="$BACKGROUND_CACHE_DIR/ssh_status"

    if [[ -f "$cache_file" ]]; then
        # Check if cache is recent (less than 60 seconds old)
        local cache_age=0
        if [[ -f "$cache_file" ]]; then
            cache_age=$(( $(date +%s) - $(stat -f %m "$cache_file" 2>/dev/null || echo 0) ))
        fi

        if [[ $cache_age -lt 60 ]]; then
            source "$cache_file"
            return 0
        fi
    fi

    # Set defaults if no cache or cache is stale
    DEV_SSH_STATUS="○ Checking..."
    STAGING_SSH_STATUS="○ Checking..."
    PROD_SSH_STATUS="○ Checking..."
    QA_SSH_STATUS="○ Checking..."
}

# Stop background processes
stop_background_processes() {
    if [[ -f "$BACKGROUND_PID_FILE" ]]; then
        local pid
        pid=$(cat "$BACKGROUND_PID_FILE" 2>/dev/null)
        if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null
        fi
        rm -f "$BACKGROUND_PID_FILE"
    fi
}

# Cleanup function for script exit
cleanup_background() {
    stop_background_processes
    rm -rf "$BACKGROUND_CACHE_DIR"
}

# Set trap for cleanup
trap cleanup_background EXIT

# Get status of background processes
get_background_status() {
    local cache_file="$BACKGROUND_CACHE_DIR/ssh_status"
    local check_log="$BACKGROUND_CACHE_DIR/ssh_check.log"

    echo "Background SSH Checker Status:"
    echo "=============================="

    if [[ -f "$BACKGROUND_PID_FILE" ]]; then
        local pid
        pid=$(cat "$BACKGROUND_PID_FILE" 2>/dev/null)
        if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
            echo "Status: RUNNING (PID: $pid)"
        else
            echo "Status: NOT RUNNING (stale PID file)"
        fi
    else
        echo "Status: NOT STARTED"
    fi

    echo "Check running: ${BACKGROUND_STATE[ssh_check_running]}"
    echo "Last check: $(date -r "${BACKGROUND_STATE[ssh_last_check]}" 2>/dev/null || echo "Never")"
    echo "Check interval: ${BACKGROUND_STATE[ssh_check_interval]} seconds"

    if [[ -f "$cache_file" ]]; then
        echo "Cache age: $(( $(date +%s) - $(stat -f %m "$cache_file" 2>/dev/null || echo 0) )) seconds"
        echo "Cached results:"
        source "$cache_file"
        echo "  DEV: ${DEV_SSH_STATUS:-Not set}"
        echo "  STAGING: ${STAGING_SSH_STATUS:-Not set}"
        echo "  PROD: ${PROD_SSH_STATUS:-Not set}"
        echo "  QA: ${QA_SSH_STATUS:-Not set}"
    else
        echo "No cache file found"
    fi

    if [[ -f "$check_log" ]]; then
        echo ""
        echo "Recent log entries:"
        tail -5 "$check_log" 2>/dev/null || echo "No log entries"
    fi
}

# Force a manual SSH check (for testing)
force_ssh_check() {
    echo "Forcing manual SSH connectivity check..."
    check_ssh_connectivity_background
    echo "Manual check completed. Use get_background_status to see results."
}

# Export functions
export -f start_background_ssh_checker get_cached_ssh_status stop_background_processes get_background_status force_ssh_check