#!/usr/bin/env bash

# tetra_tsm_ utils - Utility functions for tsm

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

# --- Process Info Gathering ---
# Global arrays to hold process info
_tsm_procs_name=()
_tsm_procs_id=()
_tsm_procs_pid=()
_tsm_procs_port=()
_tsm_procs_status=()
_tsm_procs_uptime=()
_tsm_procs_script=()

_tetra_tsm_get_all_processes() {
    # Reset arrays
    _tsm_procs_name=()
    _tsm_procs_id=()
    _tsm_procs_pid=()
    _tsm_procs_port=()
    _tsm_procs_status=()
    _tsm_procs_uptime=()
    _tsm_procs_script=()

    for metafile in "$TETRA_DIR/tsm/processes"/*.meta; do
        [[ -f "$metafile" ]] || continue
        
        local name
        name=$(basename "$metafile" .meta)
        local pid port start_time script tsm_id
        
        # In case a var is not in the file
        pid="-" port="-" start_time="-" script="-" tsm_id="-"
        
        eval "$(cat "$metafile")"
        
        local proc_status uptime
        if tetra_tsm_is_running "$name"; then
            proc_status="online"
            local current_time
            current_time=$(date +%s)
            local elapsed=$((current_time - start_time))
            if (( elapsed < 60 )); then
                uptime="${elapsed}s"
            elif (( elapsed < 3600 )); then
                uptime="$((elapsed / 60))m"
            else
                uptime="$((elapsed / 3600))h"
            fi
        else
            proc_status="stopped"
            uptime="-"
        fi
        
        _tsm_procs_name+=("$name")
        _tsm_procs_id+=("$tsm_id")
        _tsm_procs_pid+=("$pid")
        _tsm_procs_port+=("$port")
        _tsm_procs_status+=("$proc_status")
        _tsm_procs_uptime+=("$uptime")
        _tsm_procs_script+=("$script")
    done
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
    local tetra_port="${TETRA_PORT:-}"

    # If PORT is already set in environment, use it (many-valued)
    if [[ -n "$port" ]]; then
        echo "$port"
        return 0
    fi

    # If TETRA_PORT is set, use it (single value: 4444)
    if [[ -n "$tetra_port" ]]; then
        echo "$tetra_port"
        return 0
    fi

    # Extract PORT from script file
    local line val
    line="$(grep -E '^(export[[:space:]]+)?PORT=' "$script" | head -n1 || true)"
    if [[ -n "$line" ]]; then
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
    fi

    # Try TETRA_PORT from script file
    line="$(grep -E '^(export[[:space:]]+)?TETRA_PORT=' "$script" | head -n1 || true)"
    if [[ -n "$line" ]]; then
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
    fi

    return 1
}
