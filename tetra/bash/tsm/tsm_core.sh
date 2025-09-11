#!/usr/bin/env bash

# tetra_tsm_ core - Core lifecycle commands for tsm

tetra_tsm_setup() {
    # Ensure setsid is available on macOS by adding util-linux to PATH
    if [[ "$OSTYPE" == "darwin"* ]]; then
        local util_linux_bin="/opt/homebrew/opt/util-linux/bin"
        if [[ -d "$util_linux_bin" ]] && [[ ":$PATH:" != *":$util_linux_bin:"* ]]; then
            PATH="$util_linux_bin:$PATH"
            export PATH
            echo "tsm: added util-linux to PATH for setsid support"
        fi
        
        # Check if setsid is now available
        if ! command -v setsid >/dev/null 2>&1; then
            echo "tsm: warning - setsid not found. Install with: brew install util-linux" >&2
            return 1
        fi
    fi
    
    # Create required directories
    local dirs=("$TETRA_DIR/tsm/logs" "$TETRA_DIR/tsm/pids" "$TETRA_DIR/tsm/processes")
    for dir in "${dirs[@]}"; do
        mkdir -p "$dir"
    done
    
    # Initialize process ID counter if it doesn't exist
    local id_file="$TETRA_DIR/tsm/next_id"
    [[ -f "$id_file" ]] || echo "0" > "$id_file"
    
    echo "tsm: setup complete"
}

tetra_tsm_start_cli() {
    local script="${1:-}"
    local custom_name="${2:-}"
    local env_file="${3:-}"
    
    [[ -n "$script" ]] || { echo "tsm: start <script.sh> [name]" >&2; return 64; }
    [[ -f "$script" && -x "$script" ]] || { echo "tsm: '$script' not found or not executable" >&2; return 66; }
    
    # Extract PORT
    local port
    port="$(tetra_tsm_extract_port "$script")" || {
        echo "tsm: PORT not set; no valid PORT= in script" >&2
        return 65
    }
    
    # Generate process name: basename-PORT
    local base
    base="$(basename "$script" .sh)"
    local name="${custom_name:-$base}-${port}"
    
    # Check if already running
    if tetra_tsm_is_running "$name"; then
        echo "tsm: process '$name' already running" >&2
        return 1
    fi
    
    # Setup directories
    local logdir="$TETRA_DIR/tsm/logs"
    local piddir="$TETRA_DIR/tsm/pids"
    local procdir="$TETRA_DIR/tsm/processes"
    
    # Start process using double fork for proper daemonization
    local setsid_cmd=$(tetra_tsm_get_setsid)
    if [[ -z "$setsid_cmd" ]]; then
        echo "tsm: setsid not available. Run 'tsm setup' or 'brew install util-linux' on macOS" >&2
        return 1
    fi
    
    (
        $setsid_cmd bash -c "
            # Source env file first (if provided)
            [[ -n '$env_file' && -f '$env_file' ]] && source '$env_file'
            exec '$script' </dev/null >>'$logdir/$name.out' 2>>'$logdir/$name.err' &
            echo \$! > '$piddir/$name.pid'
        " &
    )
    
    # Wait a moment and verify it started
    sleep 0.5
    if tetra_tsm_is_running "$name"; then
        local pid=$(cat "$piddir/$name.pid")
        local tsm_id=$(tetra_tsm_get_next_id)
        
        # Save metadata and environment
        echo "script='$script' pid=$pid port=$port start_time=$(date +%s) type=cli tsm_id=$tsm_id" > "$procdir/$name.meta"
        
        # Save environment for inspection
        (
            # Source env file if provided to capture its variables
            if [[ -n "$env_file" && -f "$env_file" ]]; then
                source "$env_file"
            fi
            # Capture the current environment
            printenv > "$procdir/$name.env"
        )
        
        echo "tsm: started '$name' (TSM ID: $tsm_id, PID: $pid)"
    else
        echo "tsm: failed to start '$name'" >&2
        return 1
    fi
}

tetra_tsm_start() {
    local file="" env_file="" custom_name=""
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --env)
                env_file="$2"
                shift 2
                ;;
            *)
                if [[ -z "$file" ]]; then
                    file="$1"
                elif [[ -z "$custom_name" ]]; then
                    custom_name="$1"
                else
                    echo "tsm: unexpected argument '$1'" >&2
                    return 64
                fi
                shift
                ;;
        esac
    done
    
    [[ -n "$file" ]] || { echo "tsm: start [--env env.sh] <script.sh> [name]" >&2; return 64; }
    [[ -f "$file" ]] || { echo "tsm: '$file' not found" >&2; return 66; }
    
    # Validate env file if provided
    if [[ -n "$env_file" ]]; then
        [[ -f "$env_file" ]] || { echo "tsm: env file '$env_file' not found" >&2; return 66; }
    fi
    
    tetra_tsm_start_cli "$file" "$custom_name" "$env_file"
}

tetra_tsm_stop() {
    local pattern="${1:-}"
    local force="${2:-false}"
    
    [[ -n "$pattern" ]] || { echo "tsm: stop <process|id|*>" >&2; return 64; }
    
    if [[ "$pattern" == "*" ]]; then
        # Stop all processes
        for metafile in "$TETRA_DIR/tsm/processes"/*.meta; do
            [[ -f "$metafile" ]] || continue
            local tsm_id=""
            eval "$(cat "$metafile")"
            tetra_tsm_stop_by_id "$tsm_id" "$force"
        done
    else
        # Resolve name or ID to TSM ID
        local resolved_id
        resolved_id=$(tetra_tsm_resolve_to_id "$pattern")
        if [[ $? -eq 0 ]]; then
            tetra_tsm_stop_by_id "$resolved_id" "$force"
        else
            echo "tsm: process '$pattern' not found" >&2
            return 1
        fi
    fi
}

# Stop process by TSM ID 
tetra_tsm_stop_by_id() {
    local id="$1"
    local force="${2:-false}"
    local name
    name=$(tetra_tsm_id_to_name "$id") || { echo "tsm: process ID '$id' not found" >&2; return 1; }
    tetra_tsm_stop_single "$name" "$force"
}

tetra_tsm_stop_single() {
    local name="$1"
    local force="${2:-false}"
    local pidfile="$TETRA_DIR/tsm/pids/$name.pid"
    
    if ! tetra_tsm_is_running "$name"; then
        echo "tsm: process '$name' not running"
        return 1
    fi
    
    local pid=$(cat "$pidfile")
    
    # Get process group ID for better cleanup
    local pgid=""
    if [[ "$OSTYPE" == "darwin"* ]]; then
        pgid=$(ps -p "$pid" -o pgid= 2>/dev/null | tr -d ' ')
    else
        pgid=$(ps -p "$pid" -o pgid --no-headers 2>/dev/null | tr -d ' ')
    fi
    
    if [[ "$force" == "true" ]]; then
        # Force kill the entire process group
        if [[ -n "$pgid" && "$pgid" != "$pid" ]]; then
            kill -KILL -"$pgid" 2>/dev/null || true
        fi
        kill -KILL "$pid" 2>/dev/null || true
    else
        # Graceful shutdown - kill entire process group
        if [[ -n "$pgid" && "$pgid" != "$pid" ]]; then
            kill -TERM -"$pgid" 2>/dev/null || true
        fi
        kill -TERM "$pid" 2>/dev/null || true
        
        # Wait for graceful shutdown
        local wait_count=0
        local max_wait=5
        
        while [[ $wait_count -lt $max_wait ]] && tetra_tsm_is_running "$name"; do
            sleep 1
            wait_count=$((wait_count + 1))
        done
        
        # Force kill if still running
        if tetra_tsm_is_running "$name"; then
            if [[ -n "$pgid" && "$pgid" != "$pid" ]]; then
                kill -KILL -"$pgid" 2>/dev/null || true
            fi
            kill -KILL "$pid" 2>/dev/null || true
        fi
    fi
    
    # Additional cleanup: kill any processes still using the port
    local metafile="$TETRA_DIR/tsm/processes/$name.meta"
    if [[ -f "$metafile" ]] && command -v lsof >/dev/null 2>&1; then
        local port=""
        eval "$(cat "$metafile")"
        
        if [[ -n "$port" && "$port" != "-" ]]; then
            local port_pids=$(lsof -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)
            if [[ -n "$port_pids" ]]; then
                echo "$port_pids" | xargs kill -KILL 2>/dev/null || true
            fi
        fi
    fi
    
    # Cleanup
    rm -f "$pidfile"
    echo "tsm: stopped '$name'"
}

tetra_tsm_delete() {
    local pattern="${1:-}"
    
    [[ -n "$pattern" ]] || { echo "tsm: delete <process|id|*>" >&2; return 64; }
    
    if [[ "$pattern" == "*" ]]; then
        # Delete all processes
        for metafile in "$TETRA_DIR/tsm/processes"/*.meta; do
            [[ -f "$metafile" ]] || continue
            local tsm_id=""
            eval "$(cat "$metafile")"
            tetra_tsm_delete_by_id "$tsm_id"
        done
    else
        # Resolve name or ID to TSM ID
        local resolved_id
        resolved_id=$(tetra_tsm_resolve_to_id "$pattern")
        if [[ $? -eq 0 ]]; then
            tetra_tsm_delete_by_id "$resolved_id"
        else
            echo "tsm: process '$pattern' not found" >&2
            return 1
        fi
    fi
}

# Delete process by TSM ID
tetra_tsm_delete_by_id() {
    local id="$1"
    local name
    name=$(tetra_tsm_id_to_name "$id") || { echo "tsm: process ID '$id' not found" >&2; return 1; }
    tetra_tsm_delete_single "$name"
}

tetra_tsm_delete_single() {
    local name="$1"
    
    # Stop if running
    if tetra_tsm_is_running "$name"; then
        tetra_tsm_stop_single "$name" "true"
    fi
    
    # Remove all traces
    rm -f "$TETRA_DIR/tsm/pids/$name.pid"
    rm -f "$TETRA_DIR/tsm/processes/$name.meta"
    rm -f "$TETRA_DIR/tsm/processes/$name.env"
    rm -f "$TETRA_DIR/tsm/logs/$name.out"
    rm -f "$TETRA_DIR/tsm/logs/$name.err"
    
    echo "tsm: deleted '$name'"
}

tetra_tsm_restart() {
    local pattern="${1:-}"
    
    [[ -n "$pattern" ]] || { echo "tsm: restart <process|id|*>" >&2; return 64; }
    
    if [[ "$pattern" == "*" ]]; then
        # Restart all processes
        for metafile in "$TETRA_DIR/tsm/processes"/*.meta; do
            [[ -f "$metafile" ]] || continue
            local tsm_id=""
            eval "$(cat "$metafile")"
            tetra_tsm_restart_by_id "$tsm_id"
        done
    else
        # Resolve name or ID to TSM ID
        local resolved_id
        resolved_id=$(tetra_tsm_resolve_to_id "$pattern")
        if [[ $? -eq 0 ]]; then
            tetra_tsm_restart_by_id "$resolved_id"
        else
            echo "tsm: process '$pattern' not found" >&2
            return 1
        fi
    fi
}

# Restart process by TSM ID
tetra_tsm_restart_by_id() {
    local id="$1"
    local name
    name=$(tetra_tsm_id_to_name "$id") || { echo "tsm: process ID '$id' not found" >&2; return 1; }
    tetra_tsm_restart_single "$name"
}

tetra_tsm_restart_single() {
    local name="$1"
    local metafile="$TETRA_DIR/tsm/processes/$name.meta"
    
    [[ -f "$metafile" ]] || { echo "tsm: process '$name' not found" >&2; return 1; }
    
    # Parse metadata to get process info
    local script type cwd port node_env
    eval "$(cat "$metafile")"
    
    # Stop current process
    tetra_tsm_stop_single "$name" "true" 2>/dev/null || true
    
    # For CLI processes, use the original script path
    # Extract original name (pre-port)
    local original_name
    if [[ "$name" =~ ^(.+)-[0-9]+$ ]]; then
        original_name="${BASH_REMATCH[1]}"
    else
        original_name="$name"
    fi
    
    # We don't have the original env file, so restart without it.
    # The environment is captured on start. Restarting will use the original script.
    # User should manage env via scripts or shell env.
    tetra_tsm_start_cli "$script" "$original_name" ""
}

# Get the next unique process ID
tetra_tsm_get_next_id() {
    local id_file="$TETRA_DIR/tsm/next_id"
    local current_id=$(cat "$id_file")
    
    # Increment ID
    current_id=$((current_id + 1))
    echo "$current_id" > "$id_file"
    
    echo "$current_id"
}

# Reset the TSM ID to a value close to 0 while preserving uniqueness
tetra_tsm_reset_id() {
    local id_file="$TETRA_DIR/tsm/next_id"
    local processes_dir="$TETRA_DIR/tsm/processes"
    
    # Find the maximum current TSM ID
    local max_id=0
    local meta_files=("$processes_dir"/*.meta)
    
    # Check if any meta files exist
    if [[ -f "${meta_files[0]}" ]]; then
        for metafile in "${meta_files[@]}"; do
            [[ -f "$metafile" ]] || continue
            local current_tsm_id=""
            eval "$(grep 'tsm_id=' "$metafile")"
            if [[ -n "$current_tsm_id" ]] && [[ "$current_tsm_id" -gt "$max_id" ]]; then
                max_id="$current_tsm_id"
            fi
        done
    fi
    
    # Reset to a small value, but higher than the current max
    local reset_id=$((max_id + 1))
    if [[ "$reset_id" -lt 10 ]]; then
        reset_id=10
    fi
    
    echo "$reset_id" > "$id_file"
    echo "tsm: reset ID to $reset_id"
}
