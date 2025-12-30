#!/usr/bin/env bash
# TSM Stacks - start/stop groups of related services
#
# Stack files define services to run together with dependency ordering.
# Services are started top-to-bottom, stopped bottom-to-top.
#
# Usage:
#   tsm stack start gamma     # Start all services in gamma.stack
#   tsm stack stop gamma      # Stop all services (reverse order)
#   tsm stack status gamma    # Show status of stack services
#   tsm stack list            # List available stacks

TSM_STACKS_DIR="${TSM_STACKS_DIR:-$TETRA_DIR/orgs/tetra/tsm/stacks}"

# Parse a stack file, returning service names in order
# Skips comments and empty lines
_tsm_parse_stack() {
    local stack_file="$1"
    local services=()

    while IFS= read -r line || [[ -n "$line" ]]; do
        # Trim whitespace
        line="${line##*( )}"
        line="${line%%*( )}"

        # Skip empty lines and comments
        [[ -z "$line" ]] && continue
        [[ "$line" == \#* ]] && continue

        # Extract service name (first word)
        local svc="${line%% *}"
        services+=("$svc")
    done < "$stack_file"

    printf '%s\n' "${services[@]}"
}

# Find stack file by name
_tsm_find_stack() {
    local name="$1"

    # Check stacks directory
    local stack_file="$TSM_STACKS_DIR/${name}.stack"
    if [[ -f "$stack_file" ]]; then
        echo "$stack_file"
        return 0
    fi

    # Check org-specific stacks
    local orgs_dir="$TETRA_DIR/orgs"
    if [[ -d "$orgs_dir" ]]; then
        for org_dir in "$orgs_dir"/*/; do
            [[ -d "$org_dir" ]] || continue
            local org_stack="$org_dir/tsm/stacks/${name}.stack"
            if [[ -f "$org_stack" ]]; then
                echo "$org_stack"
                return 0
            fi
        done
    fi

    return 1
}

# List available stacks
tsm_stack_list() {
    echo "Available stacks:"
    echo ""

    mkdir -p "$TSM_STACKS_DIR"

    local count=0
    declare -A seen_paths

    # Check org-specific stacks (canonical locations)
    local orgs_dir="$TETRA_DIR/orgs"
    if [[ -d "$orgs_dir" ]]; then
        for org_dir in "$orgs_dir"/*/; do
            [[ -d "$org_dir" ]] || continue
            local org_name=$(basename "$org_dir")
            local stacks_dir="$org_dir/tsm/stacks"
            [[ -d "$stacks_dir" ]] || continue

            for f in "$stacks_dir"/*.stack; do
                [[ -f "$f" ]] || continue
                local realpath=$(cd "$(dirname "$f")" && pwd)/$(basename "$f")
                [[ -n "${seen_paths[$realpath]}" ]] && continue
                seen_paths[$realpath]=1

                local name=$(basename "$f" .stack)
                local svc_count=$(_tsm_parse_stack "$f" | wc -l | tr -d ' ')
                printf "  %-20s %d services  [%s]\n" "$name" "$svc_count" "$org_name"
                ((count++))
            done
        done
    fi

    if [[ $count -eq 0 ]]; then
        echo "  (no stacks defined)"
        echo ""
        echo "Create a stack at: $TSM_STACKS_DIR/<name>.stack"
    fi
}

# Start all services in a stack
tsm_stack_start() {
    local name="$1"
    [[ -z "$name" ]] && { tsm_error "stack name required"; return 1; }

    local stack_file
    stack_file=$(_tsm_find_stack "$name") || {
        tsm_error "stack '$name' not found"
        return 1
    }

    echo "Starting stack: $name"
    echo ""

    local services=()
    mapfile -t services < <(_tsm_parse_stack "$stack_file")

    local started=0
    local failed=0
    local skipped=0

    for svc in "${services[@]}"; do
        # Check if already running
        if tsm_process_alive "$svc" 2>/dev/null; then
            printf "  %-16s [already running]\n" "$svc"
            ((skipped++))
            continue
        fi

        printf "  %-16s " "$svc"

        if tsm_start "$svc" >/dev/null 2>&1; then
            echo "[started]"
            ((started++))
            # Small delay between services for port binding
            sleep 0.3
        else
            echo "[FAILED]"
            ((failed++))
        fi
    done

    echo ""
    echo "Stack '$name': started=$started skipped=$skipped failed=$failed"

    [[ $failed -eq 0 ]] && return 0 || return 1
}

# Stop all services in a stack (reverse order)
tsm_stack_stop() {
    local name="$1"
    [[ -z "$name" ]] && { tsm_error "stack name required"; return 1; }

    local stack_file
    stack_file=$(_tsm_find_stack "$name") || {
        tsm_error "stack '$name' not found"
        return 1
    }

    echo "Stopping stack: $name"
    echo ""

    local services=()
    mapfile -t services < <(_tsm_parse_stack "$stack_file")

    # Reverse order for stopping
    local reversed=()
    for ((i=${#services[@]}-1; i>=0; i--)); do
        reversed+=("${services[i]}")
    done

    local stopped=0
    local skipped=0

    for svc in "${reversed[@]}"; do
        # Find running process (handles name-port naming)
        local proc_dir
        proc_dir=$(_tsm_find_service_proc "$svc")

        if [[ -z "$proc_dir" || ! -d "$proc_dir" ]]; then
            printf "  %-16s [not running]\n" "$svc"
            ((skipped++))
            continue
        fi

        # Get actual process name from directory
        local proc_name=$(basename "$proc_dir")

        # Check if actually running
        local pid_file="$proc_dir/pid"
        if [[ ! -f "$pid_file" ]] || ! tsm_is_pid_alive "$(cat "$pid_file")" 2>/dev/null; then
            printf "  %-16s [not running]\n" "$svc"
            ((skipped++))
            continue
        fi

        printf "  %-16s " "$svc"

        if tsm_stop "$proc_name" >/dev/null 2>&1; then
            echo "[stopped]"
            ((stopped++))
        else
            echo "[FAILED]"
        fi
    done

    echo ""
    echo "Stack '$name': stopped=$stopped skipped=$skipped"
}

# Restart all services in a stack
tsm_stack_restart() {
    local name="$1"
    [[ -z "$name" ]] && { tsm_error "stack name required"; return 1; }

    echo "Restarting stack: $name"
    echo ""

    tsm_stack_stop "$name"
    echo ""
    tsm_stack_start "$name"
}

# Find running process for a service (handles name-port naming)
_tsm_find_service_proc() {
    local svc="$1"

    # Check for exact match first
    if [[ -d "$TSM_PROCESSES_DIR/$svc" ]]; then
        echo "$TSM_PROCESSES_DIR/$svc"
        return 0
    fi

    # Check for name-port pattern (e.g., gamma-8085)
    for proc_dir in "$TSM_PROCESSES_DIR"/"$svc"-*; do
        if [[ -d "$proc_dir" ]]; then
            echo "$proc_dir"
            return 0
        fi
    done

    return 1
}

# Show status of stack services
tsm_stack_status() {
    local name="$1"
    [[ -z "$name" ]] && { tsm_error "stack name required"; return 1; }

    local stack_file
    stack_file=$(_tsm_find_stack "$name") || {
        tsm_error "stack '$name' not found"
        return 1
    }

    echo "Stack: $name"
    echo ""
    printf "  %-16s %-8s %-6s %s\n" "SERVICE" "STATUS" "PORT" "PID"
    printf "  %-16s %-8s %-6s %s\n" "-------" "------" "----" "---"

    local services=()
    mapfile -t services < <(_tsm_parse_stack "$stack_file")

    local running=0
    local total=${#services[@]}

    for svc in "${services[@]}"; do
        local status="offline"
        local port="-"
        local pid="-"

        # Try to find process directory (handles name-port naming)
        local proc_dir
        proc_dir=$(_tsm_find_service_proc "$svc")
        if [[ -n "$proc_dir" && -d "$proc_dir" ]]; then
            local pid_file="$proc_dir/pid"
            if [[ -f "$pid_file" ]]; then
                pid=$(cat "$pid_file")
                if tsm_is_pid_alive "$pid" 2>/dev/null; then
                    status="online"
                    ((running++))

                    # Get port from metadata
                    local meta="$proc_dir/meta.json"
                    if [[ -f "$meta" ]] && command -v jq &>/dev/null; then
                        port=$(jq -r '.port // "-"' "$meta")
                    fi
                fi
            fi
        fi

        # Color output
        if [[ "$status" == "online" ]]; then
            printf "  %-16s \033[32m%-8s\033[0m %-6s %s\n" "$svc" "$status" "$port" "$pid"
        else
            printf "  %-16s \033[31m%-8s\033[0m %-6s %s\n" "$svc" "$status" "$port" "$pid"
        fi
    done

    echo ""
    echo "$running/$total services running"
}

# Main stack command router
tsm_stack() {
    local cmd="${1:-list}"
    shift 2>/dev/null || true

    case "$cmd" in
        start)   tsm_stack_start "$@" ;;
        stop)    tsm_stack_stop "$@" ;;
        restart) tsm_stack_restart "$@" ;;
        status)  tsm_stack_status "$@" ;;
        list|ls) tsm_stack_list "$@" ;;
        help|-h|--help)
            echo "TSM Stack - Manage service groups"
            echo ""
            echo "Usage: tsm stack <command> [stack-name]"
            echo ""
            echo "Commands:"
            echo "  list              List available stacks"
            echo "  start <name>      Start all services in stack"
            echo "  stop <name>       Stop all services (reverse order)"
            echo "  restart <name>    Restart all services"
            echo "  status <name>     Show status of stack services"
            echo ""
            echo "Stacks: $TSM_STACKS_DIR/"
            ;;
        *)
            # Check if it's a stack name (implicit status)
            if _tsm_find_stack "$cmd" &>/dev/null; then
                tsm_stack_status "$cmd"
            else
                tsm_error "unknown stack command: $cmd"
                return 1
            fi
            ;;
    esac
}

export TSM_STACKS_DIR
export -f _tsm_parse_stack _tsm_find_stack _tsm_find_service_proc
export -f tsm_stack_list tsm_stack_start tsm_stack_stop tsm_stack_restart tsm_stack_status
export -f tsm_stack
