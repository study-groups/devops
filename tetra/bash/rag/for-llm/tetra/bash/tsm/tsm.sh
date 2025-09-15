#!/usr/bin/env bash

# tetra_tsm_ functions - Native service manager for tetra ecosystem
# Preserves pb's PORT naming convention: basename-PORT

# Source all the tsm components
source "$TETRA_SRC/bash/tsm/tsm_utils.sh"
source "$TETRA_SRC/bash/tsm/tsm_core.sh"
source "$TETRA_SRC/bash/tsm/tsm_inspect.sh"

# Main tsm command interface
tsm() {
    local action="${1:-}"
    
    if [[ -z "$action" ]]; then
        cat <<'EOF'
Usage: tsm <command> [args]

Commands:
  setup                      Setup tsm environment (macOS: adds util-linux PATH)
  start [--env env.sh] <script.sh|command> [name]   Start a script or command as a daemon
  stop <process|id|*>        Stop processes (by name, TSM ID, or all)
  delete|del|kill <process|id|*> Delete processes and logs
  restart <process|id|*>     Restart processes
  list|ls                    List all processes with TSM IDs
  info <process|id>          Show detailed information for a process
  logs <process|id|*> [-f]   Show last 50 lines. Use -f to follow/stream logs.
  env <process|id>           Show sorted environment variables for a process
  paths <process|id>         Show paths for logs, pid, etc. for a process
  scan-ports                 Scan and report open ports and their owners
  ports                      Show PORT mappings
  repl                       Start interactive REPL with /commands
  help                       Show this help

Examples:
  tsm start server.sh        Start server.sh as server-3000 (if PORT=3000)
  tsm start node server.js   Start command as node-3000 (port defaults to 3000)
  tsm start --port 4000 node server.js api   Start as api-4000
  tsm stop server-3000       Stop by process name
  tsm stop 0                 Stop by TSM ID
  tsm logs 0 -f              Follow logs for TSM ID 0
  tsm logs 0                 Show last 50 lines of logs for TSM ID 0
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
        info)
            tetra_tsm_info "$@"
            ;;
        logs)
            tetra_tsm_logs "$@"
            ;;
        env)
            tetra_tsm_env "$@"
            ;;
        paths)
            tetra_tsm_paths "$@"
            ;;
        scan-ports)
            tetra_tsm_scan_ports "$@"
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