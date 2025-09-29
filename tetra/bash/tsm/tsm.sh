#!/usr/bin/env bash

# TSM - Tetra Service Manager
# Main orchestrator with clean dependency-ordered loading

# === MODULE LOADING WITH PROPER DEPENDENCIES ===

_tsm_load_components() {
    # Use strong globals consistently - MOD_SRC for source files
    local MOD_SRC="$TETRA_SRC/bash/tsm"

    # Load module registry system first (but don't register yet)
    if [[ -f "$TETRA_SRC/bash/utils/module_registry.sh" ]]; then
        source "$TETRA_SRC/bash/utils/module_registry.sh"
    fi

    # Load TSM using full include now that fork issues are resolved
    source "$MOD_SRC/include.sh"

    # Initialize TSM module after all components loaded
    if declare -f tsm_module_init >/dev/null; then
        tsm_module_init

        # Register with module system if available
        if declare -f tetra_module_register >/dev/null; then
            tetra_module_register "tsm" "$MOD_SRC" "active"
        fi
    else
        echo "ERROR: TSM module initialization failed - tsm_module_init not found" >&2
        return 1
    fi
}

# Load components once
_tsm_load_components

# === MAIN TSM COMMAND INTERFACE ===

tsm() {
    local action="${1:-}"

    if [[ -z "$action" ]]; then
        _tsm_show_simple_help
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
            # Patrol cleanup before start
            tsm_patrol_silent
            tetra_tsm_start "$@"
            ;;
        stop)
            # Patrol cleanup after stop
            tetra_tsm_stop "$@"
            tsm_patrol_silent
            ;;
        delete|del|kill)
            tetra_tsm_delete "$@"
            tsm_patrol_silent
            ;;
        restart)
            tsm_patrol_silent
            tetra_tsm_restart "$@"
            ;;
        list|ls)
            # Route to new list command with running|available|all options
            "$TETRA_SRC/bash/tsm/tsm_list.sh" "$@"
            ;;
        services)
            tetra_tsm_list_services "$@"
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
        startup)
            tetra_tsm_startup "$@"
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
            local subcommand="${1:-list}"
            shift || true
            case "$subcommand" in
                "list"|"")
                    tsm_list_named_ports table
                    ;;
                "detailed"|"source"|"info")
                    tsm_list_named_ports detailed
                    ;;
                "scan")
                    tsm_scan_named_ports
                    ;;
                "overview"|"status")
                    tsm_ports_overview
                    ;;
                "validate")
                    if tsm_validate_port_registry; then
                        echo "✅ Port registry validation passed"
                    else
                        echo "❌ Port registry validation failed"
                        return 1
                    fi
                    ;;
                "set")
                    if [[ $# -lt 2 ]]; then
                        echo "Usage: tsm ports set <service> <port>" >&2
                        return 1
                    fi
                    tsm_set_named_port "$1" "$2"
                    ;;
                "remove")
                    if [[ $# -lt 1 ]]; then
                        echo "Usage: tsm ports remove <service>" >&2
                        return 1
                    fi
                    tsm_remove_named_port "$1"
                    ;;
                "conflicts")
                    if [[ "$1" == "--fix" ]]; then
                        tsm_detect_conflicts true
                    else
                        tsm_detect_conflicts false
                    fi
                    ;;
                "allocate")
                    if [[ $# -lt 1 ]]; then
                        echo "Usage: tsm ports allocate <service> [environment]" >&2
                        return 1
                    fi
                    tsm_allocate_port "$1" "$2"
                    ;;
                "import")
                    if [[ $# -lt 1 ]]; then
                        echo "Usage: tsm ports import <file.toml>" >&2
                        return 1
                    fi
                    tsm_import_ports "$1"
                    ;;
                "export")
                    if [[ $# -lt 1 ]]; then
                        echo "Usage: tsm ports export <file> [format]" >&2
                        echo "Formats: toml, json, env" >&2
                        return 1
                    fi
                    tsm_export_ports "$1" "$2"
                    ;;
                "env")
                    tsm_list_named_ports env
                    ;;
                "json")
                    tsm_list_named_ports json
                    ;;
                *)
                    echo "Unknown ports subcommand: $subcommand" >&2
                    echo "Usage: tsm ports [list|detailed|scan|overview|status|validate|set|remove|allocate|import|export|conflicts|env|json]" >&2
                    return 1
                    ;;
            esac
            ;;
        doctor)
            tetra_tsm_doctor "$@"
            ;;
        ports)
            tetra_tsm_ports "$@"
            ;;
        repl)
            source "$TETRA_SRC/bash/tsm/tsm_repl.sh"
            tsm_repl_main
            ;;
        patrol)
            tsm_patrol "${@:2}"
            ;;
        ranges)
            tsm_show_port_ranges
            ;;
        monitor)
            source "$TETRA_SRC/bash/tsm/tsm_monitor.sh"
            tsm_monitor_service "$@"
            ;;
        stream)
            source "$TETRA_SRC/bash/tsm/tsm_monitor.sh"
            tsm_monitor_stream "$@"
            ;;
        dashboard|analytics)
            source "$TETRA_SRC/bash/tsm/tsm_monitor.sh"
            tsm_monitor_dashboard "$@"
            ;;
        clicks|click-timing)
            source "$TETRA_SRC/bash/tsm/tsm_analytics.sh"
            tsm_analyze_click_timing "$@"
            ;;
        journey|user-journey)
            source "$TETRA_SRC/bash/tsm/tsm_analytics.sh"
            tsm_analyze_user_journey "$@"
            ;;
        click-perf)
            source "$TETRA_SRC/bash/tsm/tsm_analytics.sh"
            tsm_analyze_click_performance "$@"
            ;;
        sessions)
            source "$TETRA_SRC/bash/tsm/tsm_session_aggregator.sh"
            tsm_extract_sessions "$@"
            ;;
        users)
            source "$TETRA_SRC/bash/tsm/tsm_session_aggregator.sh"
            tsm_disambiguate_users "$@"
            ;;
        patterns)
            source "$TETRA_SRC/bash/tsm/tsm_session_aggregator.sh"
            tsm_analyze_user_patterns "$@"
            ;;
        help)
            if [[ "$1" == "all" ]]; then
                _tsm_show_detailed_help
            else
                _tsm_show_simple_help
            fi
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

# ===== TVIEW INTEGRATION FUNCTIONS =====
# These functions implement the Tetra Module Agreement for TView integration

# Return available TView commands for this module
tsm_tview_commands() {
    cat << 'EOF'
TSM Service Manager TView Commands:
  list         List services [running|available|all] (default: running)
  status       Show service status
  start        Start a service
  stop         Stop a service
  restart      Restart a service
  logs         Show service logs
  doctor       Run diagnostics
  ports        Show port assignments
EOF
}

# Handle TView command routing for TSM
tsm_tview_dispatch() {
    local command="$1"
    shift || true

    case "$command" in
        ""|"help")
            tsm_tview_commands
            ;;
        "list"|"status"|"start"|"stop"|"restart"|"logs"|"doctor"|"ports")
            # Route to main TSM function
            tsm "$command" "$@"
            ;;
        *)
            echo "TSM TView Error: Unknown command '$command'"
            echo ""
            tsm_tview_commands
            return 1
            ;;
    esac
}

# TView-specific status command for enhanced display
tsm_tview_status() {
    echo "TSM Service Manager Status"
    echo "=========================="
    echo ""

    # Show process count
    local process_count=$(tsm list 2>/dev/null | grep -c "TSM ID" || echo "0")
    echo "Active Services: $process_count"

    # Show recent activity
    if [[ -f "$TSM_DIR/logs/tsm.log" ]]; then
        echo ""
        echo "Recent Activity:"
        tail -5 "$TSM_DIR/logs/tsm.log" 2>/dev/null || echo "No recent activity"
    fi

    echo ""
    echo "Commands: Use '/tsm help' for available commands"
}

# TView-specific list command for compact display
tsm_tview_list() {
    echo "Active TSM Services:"
    echo "==================="

    if ! tsm list 2>/dev/null | grep -q "TSM ID"; then
        echo "No services currently running"
        echo ""
        echo "Start services with: /tsm start <service>"
        return 0
    fi

    # Show compact list
    tsm list | head -20

    local total=$(tsm list 2>/dev/null | grep -c "TSM ID" || echo "0")
    if [[ $total -gt 20 ]]; then
        echo "... and $((total - 20)) more services"
        echo "Use 'tsm list' in full terminal for complete list"
    fi
}

# === TSM HELP FUNCTIONS ===

_tsm_show_simple_help() {
    cat <<'EOF'
TSM - Tetra Service Manager

Usage: tsm <command> [args]

Common Commands:
  list|ls [running|available|all]  List services (default: running)
  start <service-name>       Start a service from services-available
  stop <process|id>          Stop a process
  services                   List available service definitions
  logs <process|id> [-f]     Show/follow process logs
  monitor <service>          Monitor service for tetra tokens
  stream <service> [filter]  Stream tetra tokens in real-time
  dashboard <service>        Show tetra analytics dashboard
  clicks <service>           Analyze click timing and patterns
  journey <service>          Show user journey timeline
  click-perf <service>       Correlate clicks with API performance
  sessions <service>         Extract and analyze user sessions
  users <service>            Disambiguate user traffic
  patterns <service> [user]  Analyze user behavioral patterns
  ports overview             Show named ports and status
  doctor                     Scan ports and diagnose issues
  repl                       Interactive command mode
  help all                   Show detailed help

Examples:
  tsm start tserve           Start tserve service
  tsm start devpages         Start devpages service
  tsm start tetra            Start tetra service
  tsm list                   Show running services (default)
  tsm list available         Show all available services
  tsm logs 0 -f             Follow logs for process ID 0
  tsm monitor devpages       Monitor devpages for tetra tokens
  tsm stream devpages PERF   Stream performance tokens
  tsm dashboard devpages     Show analytics dashboard
  tsm ports overview         Show port usage
  tsm help all              Show complete help
EOF
}

_tsm_show_detailed_help() {
    cat <<'EOF'
TSM - Tetra Service Manager (Detailed Help)

Usage: tsm <command> [args]

Commands:
  setup                      Setup tsm environment (macOS: adds util-linux PATH)
  init <env>                 Create environment file from template (shortcut for tetra env init)
  start <service-name>       Start a service from services-available
  start [--env env.sh] <script.sh|command> [name]   Start a script or command
  stop <process|id|*>        Stop processes (by name, TSM ID, or all)
  delete|del|kill <process|id|*> Delete processes and logs
  restart <process|id|*>     Restart processes
  list|ls [running|available|all]  List services by status
  services [-d|--detail]     List saved service definitions (.tsm.sh)
  save <name> <command>      Save current command as a service definition
  enable <service>           Enable service for automatic startup
  disable <service>          Disable service from automatic startup
  show <service>             Show service configuration
  startup                    Start all enabled services
  info <process|id>          Show detailed information for a process
  logs <process|id|*> [-f]   Show last 50 lines. Use -f to follow/stream logs.
  env <process|id>           Show sorted environment variables for a process
  paths <process|id>         Show paths for logs, pid, etc. for a process
  scan-ports                 Scan and report open ports and their owners
  ports [list|detailed|scan|overview|status|validate|set|remove|allocate|import|export|conflicts] Named port registry and mappings
  doctor [scan|port|kill|env] Port diagnostics and conflict resolution
  repl                       Start interactive REPL with /commands
  help [all]                 Show this help

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
  tsm start tserve                             Start tserve service
  tsm start devpages                           Start devpages service
  tsm start tetra                              Start tetra service
  tsm services                                 List all saved service definitions
  tsm stop server-3000                         Stop by process name
  tsm stop 0                                   Stop by TSM ID
  tsm logs 0 -f                                Follow logs for TSM ID 0
  tsm list                                     Show running services
  tsm list available                           Show all available services
  tsm list all                                 Show all services
EOF
}