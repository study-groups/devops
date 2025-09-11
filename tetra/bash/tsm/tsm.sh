#!/usr/bin/env bash

# tetra_tsm_ functions - Native service manager for tetra ecosystem
# Preserves pb's PORT naming convention: basename-PORT

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

tetra_tsm_get_setsid() {
    # Get the correct setsid command for the platform
    if [[ "$OSTYPE" == "darwin"* ]]; then
        if command -v setsid >/dev/null 2>&1; then
            echo "setsid"
        elif [[ -x "/opt/homebrew/opt/util-linux/bin/setsid" ]]; then
            echo "/opt/homebrew/opt/util-linux/bin/setsid"
        else
            echo ""
        fi
    else
        echo "setsid"
    fi
}

tetra_tsm_get_next_id() {
    local id_file="$TETRA_DIR/tsm/next_id"
    mkdir -p "$(dirname "$id_file")"
    
    # Get current ID and increment it
    local current_id=0
    [[ -f "$id_file" ]] && current_id=$(cat "$id_file")
    local next_id=$((current_id + 1))
    echo "$next_id" > "$id_file"
    echo "$current_id"
}

# Convert ID to process name
tetra_tsm_id_to_name() {
    local id="$1"
    for metafile in "$TETRA_DIR/tsm/processes"/*.meta; do
        [[ -f "$metafile" ]] || continue
        local tsm_id=""
        eval "$(cat "$metafile")"
        if [[ "$tsm_id" == "$id" ]]; then
            basename "$metafile" .meta
            return 0
        fi
    done
    return 1
}

# Convert name to TSM ID
tetra_tsm_name_to_id() {
    local name="$1"
    local metafile="$TETRA_DIR/tsm/processes/$name.meta"
    [[ -f "$metafile" ]] || return 1
    
    local tsm_id=""
    eval "$(cat "$metafile")"
    [[ -n "$tsm_id" ]] && echo "$tsm_id" || return 1
}

# Resolve input (name or ID) to TSM ID - this is the new primary resolution function
tetra_tsm_resolve_to_id() {
    local input="$1"
    
    # If input is numeric, treat as TSM ID and validate it exists
    if [[ "$input" =~ ^[0-9]+$ ]]; then
        if tetra_tsm_id_to_name "$input" >/dev/null 2>&1; then
            echo "$input"
            return 0
        else
            return 1
        fi
    fi
    
    # Check for exact name match first
    if [[ -f "$TETRA_DIR/tsm/processes/$input.meta" ]]; then
        tetra_tsm_name_to_id "$input"
        return $?
    fi
    
    # Fuzzy matching: find processes containing the input string
    local matches=()
    local match_ids=()
    for metafile in "$TETRA_DIR/tsm/processes"/*.meta; do
        [[ -f "$metafile" ]] || continue
        local name=$(basename "$metafile" .meta)
        if [[ "$name" == *"$input"* ]]; then
            matches+=("$name")
            local tsm_id=""
            eval "$(cat "$metafile")"
            match_ids+=("$tsm_id")
        fi
    done
    
    # Handle fuzzy match results
    case ${#matches[@]} in
        0)
            return 1
            ;;
        1)
            echo "${match_ids[0]}"
            return 0
            ;;
        *)
            # Multiple matches - show options and fail
            echo "tsm: ambiguous name '$input', matches:" >&2
            for i in "${!matches[@]}"; do
                local match_name="${matches[i]}"
                local match_id="${match_ids[i]}"
                [[ -z "$match_id" ]] && match_id="-"
                echo "  $match_id: $match_name" >&2
            done
            return 1
            ;;
    esac
}

tetra_tsm_resolve_name() {
    local input="$1"
    local matches=()
    
    # If input is numeric, treat as TSM ID
    if [[ "$input" =~ ^[0-9]+$ ]]; then
        for metafile in "$TETRA_DIR/tsm/processes"/*.meta; do
            [[ -f "$metafile" ]] || continue
            local tsm_id=""
            eval "$(cat "$metafile")"
            if [[ "$tsm_id" == "$input" ]]; then
                basename "$metafile" .meta
                return 0
            fi
        done
        return 1
    fi
    
    # Check for exact match first
    if [[ -f "$TETRA_DIR/tsm/processes/$input.meta" ]]; then
        echo "$input"
        return 0
    fi
    
    # Fuzzy matching: find processes containing the input string
    for metafile in "$TETRA_DIR/tsm/processes"/*.meta; do
        [[ -f "$metafile" ]] || continue
        local name=$(basename "$metafile" .meta)
        if [[ "$name" == *"$input"* ]]; then
            matches+=("$name")
        fi
    done
    
    # Handle fuzzy match results
    case ${#matches[@]} in
        0)
            return 1
            ;;
        1)
            echo "${matches[0]}"
            return 0
            ;;
        *)
            # Multiple matches - show options and fail
            echo "tsm: ambiguous name '$input', matches:" >&2
            for match in "${matches[@]}"; do
                local tsm_id=""
                eval "$(cat "$TETRA_DIR/tsm/processes/$match.meta")"
                [[ -z "$tsm_id" ]] && tsm_id="-"
                echo "  $tsm_id: $match" >&2
            done
            return 1
            ;;
    esac
}

# Check if process is running by TSM ID
tetra_tsm_is_running_by_id() {
    local id="$1"
    local name
    name=$(tetra_tsm_id_to_name "$id") || return 1
    tetra_tsm_is_running_by_name "$name"
}

# Check if process is running by name
tetra_tsm_is_running_by_name() {
    local name="$1"
    local pidfile="$TETRA_DIR/tsm/pids/$name.pid"
    
    [[ -f "$pidfile" ]] || return 1
    local pid=$(cat "$pidfile")
    
    # Cross-platform process existence check
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS: use ps
        ps -p "$pid" >/dev/null 2>&1
    else
        # Linux: check /proc
        [[ -d "/proc/$pid" ]]
    fi
}

# Legacy wrapper
tetra_tsm_is_running() {
    tetra_tsm_is_running_by_name "$1"
}

tetra_tsm_extract_port() {
    local script="$1"
    local port="${PORT:-}"
    
    # If PORT is already set in environment, use it
    if [[ -n "$port" ]]; then
        echo "$port"
        return 0
    fi
    
    # Extract PORT from script file
    local line val
    line="$(grep -E '^(export[[:space:]]+)?PORT=' "$script" | head -n1 || true)"
    [[ -z "$line" ]] && return 1
    
    val="${line#*=}"
    val="${val%%#*}"
    val="${val//\"/}"
    val="${val//\'/}"
    val="${val//[[:space:]]/}"
    
    # Validate port range
    if [[ "$val" =~ ^[0-9]+$ ]] && (( val >= 1024 && val <= 65535 )); then
        echo "$val"
        return 0
    fi
    
    return 1
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
        echo "script=$script pid=$pid port=$port start_time=$(date +%s) type=cli tsm_id=$tsm_id" > "$procdir/$name.meta"
        echo "tsm: started '$name' (TSM ID: $tsm_id, PID: $pid)"
    else
        echo "tsm: failed to start '$name'" >&2
        return 1
    fi
}

tetra_tsm_start_ecosystem() {
    local config_file="${1:-ecosystem.config.cjs}"
    local env_file="${2:-}"
    
    [[ -f "$config_file" ]] || { echo "tsm: config file '$config_file' not found" >&2; return 1; }
    
    # Parse ecosystem config using node
    local app_json
    app_json="$(node -e "
        const config = require('./$config_file');
        const app = config.apps[0];
        console.log(JSON.stringify({
            name: app.name,
            script: app.script,
            cwd: app.cwd || process.cwd(),
            port: app.env.PORT,
            node_env: app.env.NODE_ENV,
            out_file: app.out_file,
            error_file: app.error_file
        }));
    ")" || { echo "tsm: failed to parse ecosystem config" >&2; return 1; }
    
    local name script cwd port node_env out_file error_file
    name="$(echo "$app_json" | jq -r '.name')"
    script="$(echo "$app_json" | jq -r '.script')"
    cwd="$(echo "$app_json" | jq -r '.cwd')"
    port="$(echo "$app_json" | jq -r '.port')"
    node_env="$(echo "$app_json" | jq -r '.node_env')"
    out_file="$(echo "$app_json" | jq -r '.out_file')"
    error_file="$(echo "$app_json" | jq -r '.error_file')"
    
    # Check if already running
    if tetra_tsm_is_running "$name"; then
        echo "tsm: process '$name' already running" >&2
        return 1
    fi
    
    # Setup directories - use standard TPM log structure
    local logdir="$TETRA_DIR/tsm/logs"
    local piddir="$TETRA_DIR/tsm/pids"
    local procdir="$TETRA_DIR/tsm/processes"
    mkdir -p "$logdir" "$piddir" "$procdir"
    
    # Start process with ecosystem config environment
    local setsid_cmd=$(tetra_tsm_get_setsid)
    if [[ -z "$setsid_cmd" ]]; then
        echo "tsm: setsid not available. Run 'tsm setup' or 'brew install util-linux' on macOS" >&2
        return 1
    fi
    
    (
        cd "$cwd"
        $setsid_cmd bash -c "
            # Source env file first (if provided)
            [[ -n '$env_file' && -f '$env_file' ]] && source '$env_file'
            # Ecosystem config vars override env file
            export PORT='$port'
            export NODE_ENV='$node_env'
            exec node '$script' </dev/null >>'$logdir/$name.out' 2>>'$logdir/$name.err' &
            echo \$! > '$piddir/$name.pid'
        " &
    )
    
    # Wait and verify
    sleep 0.5
    if tetra_tsm_is_running "$name"; then
        local pid=$(cat "$piddir/$name.pid")
        local tsm_id=$(tetra_tsm_get_next_id)
        echo "script=$script pid=$pid port=$port start_time=$(date +%s) type=ecosystem cwd=$cwd node_env=$node_env tsm_id=$tsm_id" > "$procdir/$name.meta"
        echo "tsm: started '$name' (TSM ID: $tsm_id, PID: $pid) from ecosystem config"
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
    
    [[ -n "$file" ]] || { echo "tsm: start [--env env.sh] <script.sh|ecosystem.config.cjs> [name]" >&2; return 64; }
    [[ -f "$file" ]] || { echo "tsm: '$file' not found" >&2; return 66; }
    
    # Validate env file if provided
    if [[ -n "$env_file" ]]; then
        [[ -f "$env_file" ]] || { echo "tsm: env file '$env_file' not found" >&2; return 66; }
    fi
    
    # Detect file type and route to appropriate function
    if [[ "$file" == *.config.cjs || "$file" == *.config.js ]]; then
        tetra_tsm_start_ecosystem "$file" "$env_file"
    else
        tetra_tsm_start_cli "$file" "$custom_name" "$env_file"
    fi
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
    
    if [[ "$force" == "true" ]]; then
        kill -KILL "$pid" 2>/dev/null
    else
        # Graceful shutdown
        kill -TERM "$pid" 2>/dev/null
        sleep 3
        
        # Force if still running
        if tetra_tsm_is_running "$name"; then
            kill -KILL "$pid" 2>/dev/null
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
    
    # Restart based on process type
    if [[ "$type" == "ecosystem" ]]; then
        # For ecosystem processes, we need to recreate the process manually
        # since we don't have access to the original config file
        
        # Setup directories
        local logdir="$TETRA_DIR/tsm/logs"
        local piddir="$TETRA_DIR/tsm/pids"
        local procdir="$TETRA_DIR/tsm/processes"
        
        # Get setsid command
        local setsid_cmd=$(tetra_tsm_get_setsid)
        if [[ -z "$setsid_cmd" ]]; then
            echo "tsm: setsid not available. Run 'tsm setup' or 'brew install util-linux' on macOS" >&2
            return 1
        fi
        
        # Start the process in the original working directory
        (
            cd "$cwd"
            $setsid_cmd bash -c "
                export PORT='$port'
                export NODE_ENV='$node_env'
                exec node '$script' </dev/null >>'$logdir/$name.out' 2>>'$logdir/$name.err' &
                echo \$! > '$piddir/$name.pid'
            " &
        )
        
        # Wait and verify
        sleep 0.5
        if tetra_tsm_is_running "$name"; then
            local new_pid=$(cat "$piddir/$name.pid")
            local tsm_id=$(tetra_tsm_name_to_id "$name")
            echo "script=$script pid=$new_pid port=$port start_time=$(date +%s) type=ecosystem cwd=$cwd node_env=$node_env tsm_id=$tsm_id" > "$procdir/$name.meta"
            echo "tsm: restarted '$name' (TSM ID: $tsm_id, PID: $new_pid)"
        else
            echo "tsm: failed to restart '$name'" >&2
            return 1
        fi
    else
        # For CLI processes, use the original script path
        tetra_tsm_start "$script" "${name%-*}"
    fi
}

tetra_tsm_list() {
    echo "┌──────┬────────────────────┬─────────┬────────┬─────────┬──────────────────────┐"
    echo "│ id   │ name               │ status  │ pid    │ port    │ uptime               │"
    echo "├──────┼────────────────────┼─────────┼────────┼─────────┼──────────────────────┤"
    
    local found=false
    for metafile in "$TETRA_DIR/tsm/processes"/*.meta; do
        [[ -f "$metafile" ]] || continue
        found=true
        
        local name=$(basename "$metafile" .meta)
        local pid port start_time script tsm_id
        
        # Parse metadata
        eval "$(cat "$metafile")"
        
        # Handle legacy processes without tsm_id
        [[ -z "$tsm_id" ]] && tsm_id="-"
        
        local status uptime
        if tetra_tsm_is_running "$name"; then
            status="online"
            local current_time=$(date +%s)
            local elapsed=$((current_time - start_time))
            if (( elapsed < 60 )); then
                uptime="${elapsed}s"
            elif (( elapsed < 3600 )); then
                uptime="$((elapsed / 60))m"
            else
                uptime="$((elapsed / 3600))h"
            fi
        else
            status="stopped"
            uptime="-"
        fi
        
        printf "│ %-4s │ %-18s │ %-7s │ %-6s │ %-7s │ %-20s │\n" \
            "$tsm_id" "$name" "$status" "$pid" "$port" "$uptime"
    done
    
    echo "└──────┴────────────────────┴─────────┴────────┴─────────┴──────────────────────┘"
    
    if [[ "$found" == "false" ]]; then
        echo "No processes found"
    fi
}

tetra_tsm_logs() {
    local pattern="${1:-}"
    local lines="50"
    local follow=false
    local nostream=false
    
    [[ -n "$pattern" ]] || { echo "tsm: logs <process|id|*> [--lines N] [--nostream]" >&2; return 64; }
    
    # Parse arguments like pm2 logs devpages-4000 --lines 50 --nostream
    shift
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --lines)
                lines="$2"
                shift 2
                ;;
            --nostream)
                nostream=true
                shift
                ;;
            -f|--follow)
                follow=true
                shift
                ;;
            *)
                shift
                ;;
        esac
    done
    
    if [[ "$pattern" == "*" ]]; then
        # Show logs for all processes
        for metafile in "$TETRA_DIR/tsm/processes"/*.meta; do
            [[ -f "$metafile" ]] || continue
            local tsm_id=""
            eval "$(cat "$metafile")"
            local name=$(basename "$metafile" .meta)
            echo "==> $name (ID: $tsm_id) <=="
            tetra_tsm_logs_by_id "$tsm_id" "$lines" "$follow" "$nostream"
            echo
        done
    else
        # Resolve name or ID to TSM ID
        local resolved_id
        resolved_id=$(tetra_tsm_resolve_to_id "$pattern")
        if [[ $? -eq 0 ]]; then
            tetra_tsm_logs_by_id "$resolved_id" "$lines" "$follow" "$nostream"
        else
            echo "tsm: process '$pattern' not found" >&2
            return 1
        fi
    fi
}

# Show logs by TSM ID
tetra_tsm_logs_by_id() {
    local id="$1"
    local lines="${2:-50}"
    local follow="${3:-false}"
    local nostream="${4:-false}"
    local name
    name=$(tetra_tsm_id_to_name "$id") || { echo "tsm: process ID '$id' not found" >&2; return 1; }
    tetra_tsm_logs_single "$name" "$lines" "$follow" "$nostream"
}

tetra_tsm_logs_single() {
    local name="$1"
    local lines="${2:-50}"
    local follow="${3:-false}"
    local nostream="${4:-false}"
    
    local metafile="$TETRA_DIR/tsm/processes/$name.meta"
    [[ -f "$metafile" ]] || { echo "tsm: process '$name' not found" >&2; return 1; }
    
    # All processes use standard TSM log structure
    local outlog="$TETRA_DIR/tsm/logs/$name.out"
    local errlog="$TETRA_DIR/tsm/logs/$name.err"
    
    if [[ "$nostream" == "true" ]]; then
        # pm2-style --nostream: just show the logs without streaming
        [[ -f "$outlog" ]] && tail -n "$lines" "$outlog" || echo "(no logs)"
    elif [[ "$follow" == "true" ]]; then
        # Follow logs in real-time
        [[ -f "$outlog" ]] && tail -f "$outlog" "$errlog"
    else
        # Default: show both stdout and stderr
        if [[ -f "$outlog" || -f "$errlog" ]]; then
            echo "=== STDOUT ==="
            [[ -f "$outlog" ]] && tail -n "$lines" "$outlog" 2>/dev/null || echo "(no stdout)"
            echo "=== STDERR ==="
            [[ -f "$errlog" ]] && tail -n "$lines" "$errlog" 2>/dev/null || echo "(no stderr)"
        else
            echo "tsm: no logs found for '$name'"
        fi
    fi
}

tetra_tsm_ports() {
    for metafile in "$TETRA_DIR/tsm/processes"/*.meta; do
        [[ -f "$metafile" ]] || continue
        
        local name=$(basename "$metafile" .meta)
        local port script
        eval "$(cat "$metafile")"
        
        if [[ "$name" =~ ^(.+)-([0-9]+)$ ]]; then
            local process_name="${BASH_REMATCH[1]}"
            local port_num="${BASH_REMATCH[2]}"
            echo "Process: $process_name, Port: $port_num"
        fi
    done
}

# Main tsm command interface
tsm() {
    local action="${1:-}"
    
    if [[ -z "$action" ]]; then
        cat <<'EOF'
Usage: tsm <command> [args]

Commands:
  setup                      Setup tsm environment (macOS: adds util-linux PATH)
  start [--env env.sh] <script.sh|ecosystem.config.cjs> [name]   Start a script
  stop <process|id|*>        Stop processes (by name, TSM ID, or all)
  delete|del|kill <process|id|*> Delete processes and logs
  restart <process|id|*>     Restart processes
  list|ls                    List all processes with TSM IDs
  logs <process|id|*> [--lines N] Show process logs
  ports                      Show PORT mappings
  repl                       Start interactive REPL with /commands
  help                       Show this help

Examples:
  tsm start server.sh        Start server.sh as server-3000 (if PORT=3000)
  tsm stop server-3000       Stop by process name
  tsm stop 0                 Stop by TSM ID
  tsm logs 0 --lines 50      Show logs by TSM ID
  tsm list                   Show all processes with IDs
EOF
        return 0
    fi
    
    shift || true
    
    case "$action" in
        setup)
            tetra_tsm_setup
            ;;
        start)
            # Auto-setup on macOS if needed
            if [[ "$OSTYPE" == "darwin"* ]] && ! command -v setsid >/dev/null 2>&1; then
                tetra_tsm_setup
            fi
            tetra_tsm_start "$@"
            ;;
        stop)
            tetra_tsm_stop "$@"
            ;;
        delete|del|kill)
            tetra_tsm_delete "$@"
            ;;
        restart)
            tetra_tsm_restart "$@"
            ;;
        list|ls)
            tetra_tsm_list
            ;;
        logs)
            tetra_tsm_logs "$@"
            ;;
        ports)
            tetra_tsm_ports
            ;;
        repl)
            source "$TETRA_SRC/bash/tsm/tsm_repl.sh"
            tsm_repl_main
            ;;
        help)
            tsm
            ;;
        *)
            echo "tsm: unknown command '$action'" >&2
            echo "Use 'tsm help' for usage information"
            return 64
            ;;
    esac
}

# Ensure the tsm function takes precedence over any alias
unalias tsm 2>/dev/null || true

# Ensure zero exit when sourced
true