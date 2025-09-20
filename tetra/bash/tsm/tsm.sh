#!/usr/bin/env bash

# tetra_tsm_ functions - Native service manager for tetra ecosystem
# Preserves pb's PORT naming convention: basename-PORT

# Source all the tsm components
source "$TETRA_SRC/bash/tsm/tsm_utils.sh"
source "$TETRA_SRC/bash/tsm/tsm_core.sh"
source "$TETRA_SRC/bash/tsm/tsm_inspect.sh"
source "$TETRA_SRC/bash/tsm/tsm_services.sh"
source "$TETRA_SRC/bash/tsm/tsm_formatting.sh"

# Main tsm command interface
tsm() {
    local action="${1:-}"
    
    if [[ -z "$action" ]]; then
        cat <<'EOF'
Usage: tsm <command> [args]

Commands:
  setup                      Setup tsm environment (macOS: adds util-linux PATH)
  start [--env env.sh] <script.sh|command|service> [name]   Start a script, command, or service
  stop <process|id|*>        Stop processes (by name, TSM ID, or all)
  delete|del|kill <process|id|*> Delete processes and logs
  restart <process|id|*>     Restart processes
  list|ls                    List all processes with TSM IDs
  services                   List all registered services
  info <process|id>          Show detailed information for a process
  logs <process|id|*> [-f]   Show last 50 lines. Use -f to follow/stream logs.
  env <process|id>           Show sorted environment variables for a process
  paths <process|id>         Show paths for logs, pid, etc. for a process
  scan-ports                 Scan and report open ports and their owners
  ports                      Show PORT mappings
  repl                       Start interactive REPL with /commands
  help                       Show this help

Environment Auto-Detection:
  TSM automatically detects environment files using this convention:
  - entrypoints/local.sh   → env/local.env
  - entrypoints/dev.sh     → env/dev.env
  - entrypoints/staging.sh → env/staging.env
  - entrypoints/prod.sh    → env/prod.env
  - Falls back to env/local.env if script-specific env not found

Examples:
  tsm start entrypoints/local.sh              Auto-sources env/local.env
  tsm start --env dev entrypoints/local.sh    Sources env/dev.env explicitly
  tsm start --env custom.env server.sh        Uses custom.env file directly
  tsm start node server.js                    Command mode (port defaults to 3000)
  tsm start --port 4000 node server.js api    Start as api-4000
  tsm start tetra                              Start tetra service (from registry)
  tsm services                                 List all registered services
  tsm stop server-3000                         Stop by process name
  tsm stop 0                                   Stop by TSM ID
  tsm logs 0 -f                                Follow logs for TSM ID 0
  tsm list                                     Show all processes with IDs
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
        services)
            tsm_list_services
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