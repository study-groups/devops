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
  init <env>                 Create environment file from template (shortcut for tetra env init)
  start [--env env.sh] <script.sh|command|service> [name]   Start a script, command, or service
  stop <process|id|*>        Stop processes (by name, TSM ID, or all)
  delete|del|kill <process|id|*> Delete processes and logs
  restart <process|id|*>     Restart processes
  list|ls                    List all processes with TSM IDs
  services                   List all registered services
  save <name> <command>      Save current command as a service definition
  enable <service>           Enable service for automatic startup
  disable <service>          Disable service from automatic startup
  show <service>             Show service configuration
  info <process|id>          Show detailed information for a process
  logs <process|id|*> [-f]   Show last 50 lines. Use -f to follow/stream logs.
  env <process|id>           Show sorted environment variables for a process
  paths <process|id>         Show paths for logs, pid, etc. for a process
  scan-ports                 Scan and report open ports and their owners
  ports                      Show PORT mappings
  repl                       Start interactive REPL with /commands
  help                       Show this help

🔒 Secure Environment Management:
  TSM uses template-based environment files that protect secrets:
  - Templates (*.env.tmpl) are safe to commit to git
  - Environment files (*.env) contain secrets and are never committed
  - TSM validates environment files before starting services

Environment Setup Workflow:
  1. tetra env init dev           # Create env/dev.env from template
  2. edit env/dev.env             # Add your real API keys, secrets
  3. tsm start --env dev server.js  # Use secure environment

Environment Auto-Detection:
  - TSM looks for env/dev.env or env/local.env if no --env specified
  - If environment file missing, provides template initialization guidance
  - Validates environment files for placeholder values and required variables

Examples:
  tsm start --env dev server.js               Sources env/dev.env (after tetra env init dev)
  tsm start --env staging entrypoints/api.sh  Sources env/staging.env explicitly
  tsm start node server.js                    Auto-detects env/dev.env or env/local.env
  tsm start --port 4000 node server.js api    Start as api-4000
  tsm start tetra                              Start tetra service (from registry)
  tsm services                                 List all registered services
  tsm stop server-3000                         Stop by process name
  tsm stop 0                                   Stop by TSM ID
  tsm logs 0 -f                                Follow logs for TSM ID 0
  tsm list                                     Show all processes with IDs

Security Features:
  ✅ Templates safe to commit (no secrets)     ✅ Environment files never committed
  ✅ Validates placeholder replacement         ✅ Checks required variables
  ✅ Clear guidance when files missing         ✅ Integration with tetra env init
EOF
        return 0
    fi
    
    shift || true
    
    case "$action" in
        setup)
            tetra_tsm_setup
            ;;
        init)
            # Shortcut for tetra env init
            if [[ -z "$1" ]]; then
                echo "Usage: tsm init <environment>"
                echo "Examples:"
                echo "  tsm init dev      # Create env/dev.env from template"
                echo "  tsm init staging  # Create env/staging.env from template"
                return 64
            fi
            tetra_env_init "$@"
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
            tetra_tsm_list_services
            ;;
        save)
            tetra_tsm_save "$@"
            ;;
        enable)
            tetra_tsm_enable "$@"
            ;;
        disable)
            tetra_tsm_disable "$@"
            ;;
        show)
            tetra_tsm_show_service "$@"
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