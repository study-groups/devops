#!/usr/bin/env bash

# TSM - Tetra Service Manager
# Main orchestrator with clean dependency-ordered loading

# === MODULE LOADING WITH PROPER DEPENDENCIES ===

_tsm_load_components() {
    # TSM_SRC set by includes.sh, fallback for direct sourcing
    local mod_src="${TSM_SRC:-$TETRA_SRC/tsm}"

    # Load module registry system first (but don't register yet)
    if [[ -f "$TETRA_SRC/utils/module_registry.sh" ]]; then
        source "$TETRA_SRC/utils/module_registry.sh"
    fi

    # Load TSM using full include now that fork issues are resolved
    source "$mod_src/core/include.sh"

    # Initialize TSM module after all components loaded
    if declare -f tsm_module_init >/dev/null; then
        tsm_module_init

        # Register with module system if available (silently)
        if declare -f tetra_module_register >/dev/null; then
            tetra_module_register "tsm" "$mod_src" "active" >/dev/null 2>&1
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
            tetra_tsm_start "$@"
            ;;
        stop)
            tetra_tsm_stop "$@"
            ;;
        delete|del)
            tetra_tsm_delete "$@"
            ;;
        cleanup)
            tetra_tsm_cleanup "$@"
            ;;
        kill)
            tetra_tsm_kill "$@"
            ;;
        restart)
            tetra_tsm_restart "$@"
            ;;
        list|ls)
            # Route to list functions in organized structure
            # Collect options for running list
            local -a list_opts=()
            local subcommand=""
            local tql_query=""

            while [[ $# -gt 0 ]]; do
                case "$1" in
                    --user)      list_opts+=("$1" "$2"); shift 2 ;;
                    --sort|-s)   list_opts+=("--sort" "$2"); shift 2 ;;
                    --filter|-f) list_opts+=("--filter" "$2"); shift 2 ;;
                    --reverse|-r) list_opts+=("--reverse"); shift ;;
                    --query|-q)  tql_query="$2"; shift 2 ;;
                    -*)
                        # Check if it's a subcommand flag
                        case "$1" in
                            -av|--all-verbose|-a|--all|-l|--long|-p|--ports) subcommand="$1"; shift ;;
                            *) tsm_error "Unknown option: $1"; return 1 ;;
                        esac
                        ;;
                    *)
                        [[ -z "$subcommand" ]] && subcommand="$1"
                        shift
                        ;;
                esac
            done

            case "${subcommand:-running}" in
                running|"")
                    if [[ -n "$tql_query" ]]; then
                        tsm_list_tql "$tql_query"
                    else
                        tsm_list_running "${list_opts[@]}"
                    fi
                    ;;
                -av|--all-verbose)
                    tetra_tsm_list_services -v
                    ;;
                available|all|--all|-a)
                    tetra_tsm_list_services
                    ;;
                pwd|--pwd|paths)
                    tsm_list_pwd
                    ;;
                -l|--long|long|detail|detailed)
                    tsm_list_long
                    ;;
                -p|--ports|ports)
                    tsm_list_ports
                    ;;
                tree)
                    tsm_list_tree
                    ;;
                help)
                    echo "Usage: tsm list [running|available|pwd|-l|-p|tree] [OPTIONS]"
                    echo ""
                    echo "Views:"
                    echo "  running    - Show only running processes (default)"
                    echo "  -a, --all  - Show all service definitions (compact)"
                    echo "  -av        - Show all service definitions (verbose)"
                    echo "  pwd        - Show running processes with working directory"
                    echo "  -l         - Show detailed/long format"
                    echo "  -p, ports  - Show port relationships"
                    echo "  tree       - Show process hierarchy as tree"
                    echo ""
                    echo "Filter & Sort (for running view):"
                    echo "  -f, --filter PATTERN  - Filter by regex pattern"
                    echo "  -s, --sort FIELD      - Sort by: id, name, env, port, type, uptime"
                    echo "  -r, --reverse         - Reverse sort order"
                    echo ""
                    echo "TQL Query (advanced):"
                    echo "  -q, --query QUERY     - Natural language-like query"
                    echo ""
                    echo "  Filters:   env=tetra, name~midi, port>8000, type!=udp"
                    echo "  Sort:      sort:uptime, sort:port:desc"
                    echo "  Limit:     limit:10, head:5, tail:3, first, last"
                    echo "  Temporal:  last:7d, last:1h, since:monday, older:30m"
                    echo ""
                    echo "  Examples:"
                    echo "    tsm ls -q 'env=tetra sort:uptime'"
                    echo "    tsm ls -q 'port>8000 limit:5'"
                    echo "    tsm ls -q 'last:1h sort:uptime:desc'"
                    if [[ $TSM_MULTI_USER_ENABLED -eq 1 ]]; then
                        echo ""
                        echo "Multi-user:"
                        echo "  --user <username>  - Filter processes by username"
                    fi
                    ;;
                *)
                    tsm_error "Unknown subcommand: $subcommand"
                    echo "Usage: tsm list [running|-a|-av|pwd|-l|-p|tree]"
                    ;;
            esac
            ;;
        services)
            tetra_tsm_list_services "$@"
            ;;
        orgs)
            tetra_tsm_orgs "$@"
            ;;
        save)
            # Check if this is "save pattern"
            if [[ "$1" == "pattern" ]]; then
                shift
                tetra_tsm_save_pattern "$@"
            else
                tetra_tsm_save "$@"
            fi
            ;;
        enable)
            tetra_tsm_enable "$@"
            ;;
        disable)
            tetra_tsm_disable "$@"
            ;;
        rm)
            tetra_tsm_rm "$@"
            ;;
        show)
            tetra_tsm_show_service "$@"
            ;;
        startup)
            # Handle 'startup status' subcommand
            if [[ "$1" == "status" ]]; then
                shift
                tetra_tsm_startup_status "$@"
            else
                tetra_tsm_startup "$@"
            fi
            ;;
        users|instances)
            # Show all TSM instances (users with active TSM)
            if [[ $TSM_MULTI_USER_ENABLED -eq 1 ]]; then
                tsm_list_instances
            else
                echo "Command 'tsm users' requires multi-user mode"
                echo ""
                echo "Enable multi-user mode:"
                echo "  export TSM_MULTI_USER_MODE=enabled"
                echo ""
                echo "Or run as root:"
                echo "  sudo tsm users"
                return 1
            fi
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
                        tsm_error "Port registry validation failed"
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
                "add")
                    # Add port to running process with relationship type
                    # Usage: tsm ports add <process> <port> [type] [protocol] [relation] [group]
                    if [[ $# -lt 2 ]]; then
                        echo "Usage: tsm ports add <process> <port> [type] [protocol] [relation] [group]"
                        echo ""
                        echo "Arguments:"
                        echo "  process   - Process name (e.g., quasar-1985)"
                        echo "  port      - Port number to add"
                        echo "  type      - tcp or udp (default: tcp)"
                        echo "  protocol  - Protocol label (e.g., osc, http, ws)"
                        echo "  relation  - Port relationship type:"
                        echo "              bind           - Exclusively owns port (default)"
                        echo "              bind-shared    - Binds with SO_REUSEADDR"
                        echo "              multicast-join - Joins multicast group"
                        echo "              send-to        - Sends to port (doesn't bind)"
                        echo "  group     - Multicast group address (for multicast-join)"
                        echo ""
                        echo "Examples:"
                        echo "  tsm ports add quasar-1985 1986 udp osc bind"
                        echo "  tsm ports add midi-1983 1983 udp osc bind-shared"
                        echo "  tsm ports add midi-mp-1987 1983 udp osc-in multicast-join 239.1.1.1"
                        echo "  tsm ports add midi-mp-1987 2020 udp osc-out send-to"
                        return 1
                    fi
                    tsm_add_port "$@"
                    ;;
                "rm"|"del")
                    # Remove secondary port from process
                    if [[ $# -lt 2 ]]; then
                        echo "Usage: tsm ports rm <process> <port>"
                        return 1
                    fi
                    tsm_remove_port "$@"
                    ;;
                "show")
                    # Show all ports for a process
                    if [[ $# -lt 1 ]]; then
                        echo "Usage: tsm ports show <process>"
                        return 1
                    fi
                    echo "Ports for $1:"
                    echo "PORT    TYPE    PROTOCOL"
                    tsm_list_ports "$1"
                    ;;
                "detect")
                    # Auto-detect ports used by a process
                    if [[ $# -lt 1 ]]; then
                        echo "Usage: tsm ports detect <process>"
                        echo ""
                        echo "Scans lsof for all ports used by the process PID"
                        echo "and adds any missing secondary ports to metadata."
                        return 1
                    fi
                    tsm_detect_ports "$@"
                    ;;
                *)
                    tsm_error "Unknown ports subcommand: $subcommand"
                    echo "Usage: tsm ports [list|detailed|scan|overview|status|validate|set|remove|allocate|import|export|conflicts|env|json|add|rm|show|detect]" >&2
                    return 1
                    ;;
            esac
            ;;
        doctor)
            tetra_tsm_doctor "$@"
            ;;
        claim)
            # Claim a port by killing whatever is using it (if not TSM-managed)
            tsm_claim_port "$@"
            ;;
        daemon)
            # Systemd daemon management (loaded from integrations/systemd.sh)
            tsm_daemon "$@"
            ;;
        caddy)
            # Caddy reverse proxy integration (loaded from integrations/caddy.sh)
            tsm_caddy "$@"
            ;;
        repl)
            # Modern bash/repl-based REPL (loaded via core/include.sh)
            if declare -f tsm_repl_main >/dev/null 2>&1; then
                tsm_repl_main
            else
                echo "Error: TSM REPL not available (tsm_repl.sh not loaded)" >&2
                return 1
            fi
            ;;
        patrol)
            tsm_patrol "${@:2}"
            ;;
        ranges)
            tsm_show_port_ranges
            ;;
        runtime)
            # Runtime environment information (loaded from core/runtime_info.sh)
            if declare -f tetra_tsm_runtime >/dev/null 2>&1; then
                tetra_tsm_runtime "$@"
            else
                echo "Error: Runtime info not available (runtime_info.sh not loaded)" >&2
                return 1
            fi
            ;;
        patterns)
            tetra_tsm_list_patterns "$@"
            ;;
        monitor)
            # Already loaded from system/monitor.sh via include.sh
            tsm_monitor_service "$@"
            ;;
        stream)
            # Already loaded from system/monitor.sh via include.sh
            tsm_monitor_stream "$@"
            ;;
        dashboard|analytics)
            # Already loaded from system/monitor.sh via include.sh
            tsm_monitor_dashboard "$@"
            ;;
        clicks|click-timing)
            # Already loaded from system/analytics.sh via include.sh
            tsm_analyze_click_timing "$@"
            ;;
        journey|user-journey)
            # Already loaded from system/analytics.sh via include.sh
            tsm_analyze_user_journey "$@"
            ;;
        click-perf)
            # Already loaded from system/analytics.sh via include.sh
            tsm_analyze_click_performance "$@"
            ;;
        sessions)
            # Already loaded from system/session_aggregator.sh via include.sh
            tsm_extract_sessions "$@"
            ;;
        disambiguate-users)
            # Already loaded from system/session_aggregator.sh via include.sh
            tsm_disambiguate_users "$@"
            ;;
        user-patterns|analyze-patterns)
            # Already loaded from system/session_aggregator.sh via include.sh
            tsm_analyze_user_patterns "$@"
            ;;
        color|colors)
            # Color configuration management (uses TDS module_config via tsm_colors)
            if declare -f tsm_colors >/dev/null 2>&1; then
                tsm_colors "$@"
            else
                echo "TSM colors module not loaded" >&2
                return 1
            fi
            ;;
        help)
            # Parse help arguments
            local help_topic="" no_color_flag=""
            for arg in "$@"; do
                case "$arg" in
                    --no-color) no_color_flag="--no-color" ;;
                    *) [[ -z "$help_topic" ]] && help_topic="$arg" ;;
                esac
            done

            # Check if help.sh is loaded for topic help
            if [[ "$help_topic" == "all" ]]; then
                _tsm_show_detailed_help $no_color_flag
            elif [[ -n "$help_topic" ]] && declare -f tsm_help_topic >/dev/null 2>&1; then
                tsm_help_topic "$help_topic"
            elif [[ -n "$help_topic" ]]; then
                echo "Unknown help topic: $help_topic"
                echo "Use 'tsm help all' for full command list"
            else
                _tsm_show_simple_help $no_color_flag
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
            tsm_error "TSM TView: Unknown command '$command'"
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
    # Support --no-color and NO_COLOR environment variable
    local use_color=true
    [[ "$1" == "--no-color" || -n "$NO_COLOR" ]] && use_color=false

    if [[ "$use_color" == "true" ]]; then
        local C_TITLE='\033[1;36m'
        local C_SEC='\033[1;34m'
        local C_CMD='\033[0;36m'
        local C_ARG='\033[0;33m'
        local C_GRAY='\033[0;90m'
        local C_NC='\033[0m'
    else
        local C_TITLE='' C_SEC='' C_CMD='' C_ARG='' C_GRAY='' C_NC=''
    fi

    cat <<EOF
$(echo -e "${C_TITLE}TSM${C_NC}") - Tetra Service Manager

$(echo -e "${C_SEC}COMMANDS${C_NC}")
  $(echo -e "${C_CMD}list${C_NC}")      Show running services
  $(echo -e "${C_CMD}start${C_NC}")     Start a service or command
  $(echo -e "${C_CMD}stop${C_NC}")      Stop services
  $(echo -e "${C_CMD}restart${C_NC}")   Restart services
  $(echo -e "${C_CMD}services${C_NC}")  List saved service definitions
  $(echo -e "${C_CMD}ports${C_NC}")     Port registry and conflicts
  $(echo -e "${C_CMD}doctor${C_NC}")    Diagnostics and health checks

$(echo -e "${C_SEC}QUERY${C_NC}") $(echo -e "${C_GRAY}(TQL - Tetra Query Language)${C_NC}")
  $(echo -e "${C_CMD}tsm ls -q${C_NC}") $(echo -e "'${C_ARG}env=tetra sort:uptime${C_NC}'")
  $(echo -e "${C_CMD}tsm ls -q${C_NC}") $(echo -e "'${C_ARG}port>8000 limit:5${C_NC}'")
  $(echo -e "${C_CMD}tsm ls -q${C_NC}") $(echo -e "'${C_ARG}name~midi last:1d${C_NC}'")

$(echo -e "${C_SEC}HELP${C_NC}")
  $(echo -e "${C_CMD}tsm help${C_NC}") $(echo -e "${C_ARG}<topic>${C_NC}")    start, doctor, ports, services
  $(echo -e "${C_CMD}tsm help all${C_NC}")        Full command reference
EOF
}

_tsm_show_detailed_help() {
    # Support --no-color and NO_COLOR environment variable
    local use_color=true
    [[ "$1" == "--no-color" || -n "$NO_COLOR" ]] && use_color=false

    # Helper functions - defined based on color mode
    if [[ "$use_color" == "true" ]]; then
        # Get colors from TSM color config system (via tsm_color_get or fallback)
        local C_TITLE C_SECTION C_CMD C_DESC C_COMMENT

        # Helper to get color with fallback
        _get_color() {
            local token="$1" fallback="$2"
            if declare -f tsm_color_get >/dev/null 2>&1; then
                local hex=$(tsm_color_get "$token")
                [[ "$hex" != "888888" ]] && { echo "$hex"; return; }
            fi
            echo "$fallback"
        }

        C_TITLE=$(_get_color "help.title" "00AAAA")
        C_SECTION=$(_get_color "help.section" "1E88E5")
        C_CMD=$(_get_color "help.command" "00ACC1")
        C_DESC=$(_get_color "help.description" "999999")
        C_COMMENT=$(_get_color "help.comment" "777777")

        _h() { text_color "$1"; printf "%s" "$2"; reset_color; }
        _hln() { text_color "$1"; printf "%s" "$2"; reset_color; echo; }

        # Example helper with palette cycling
        local -a _example_colors
        if declare -f tsm_color_palette >/dev/null 2>&1; then
            local palette="${TSM_COLOR_TOKENS[help.example.palette]:-verbs}"
            read -ra _example_colors <<< "$(tsm_color_palette "$palette")"
        else
            # VERBS_PRIMARY fallback
            _example_colors=("E53935" "FB8C00" "FDD835" "43A047" "00ACC1" "1E88E5" "8E24AA" "EC407A")
        fi
        local _example_idx=0
        _hex() {
            local color="${_example_colors[$_example_idx]}"
            text_color "$color"
            printf "%s" "$1"
            reset_color
            ((_example_idx = (_example_idx + 1) % ${#_example_colors[@]}))
        }
        unset -f _get_color  # Clean up temp function
    else
        # No-color mode - just print text
        local C_TITLE="" C_SECTION="" C_CMD="" C_DESC="" C_COMMENT=""
        _h() { printf "%s" "$2"; }
        _hln() { printf "%s\n" "$2"; }
        _hex() { printf "%s" "$1"; }
    fi

    _hln "$C_TITLE" "TSM - Tetra Service Manager"
    echo
    _h "$C_DESC" "Usage: "; _hln "$C_CMD" "tsm <command> [args]"
    echo

    # PROCESS MANAGEMENT
    _hln "$C_SECTION" "PROCESS MANAGEMENT"
    _h "$C_CMD" "  start <service|command>   "; _hln "$C_DESC" "Start a service or command"
    _h "$C_CMD" "  start --env <env> <cmd>   "; _hln "$C_DESC" "Start with environment file"
    _h "$C_CMD" "  start --port <port> <cmd> "; _hln "$C_DESC" "Start with explicit port"
    _h "$C_CMD" "  stop <process|id|*>       "; _hln "$C_DESC" "Stop processes (by name, TSM ID, or all)"
    _h "$C_CMD" "  restart <process|id|*>    "; _hln "$C_DESC" "Restart processes"
    _h "$C_CMD" "  delete|del <process|id|*> "; _hln "$C_DESC" "Delete processes and logs"
    _h "$C_CMD" "  kill <process|id|*>       "; _hln "$C_DESC" "Force kill processes (SIGKILL)"
    _h "$C_CMD" "  cleanup                   "; _hln "$C_DESC" "Clean up crashed/dead processes"
    _h "$C_CMD" "  list|ls [opts]            "; _hln "$C_DESC" "List processes (running|all|pwd|-l)"
    _h "$C_CMD" "  info <process|id>         "; _hln "$C_DESC" "Show detailed process information"
    _h "$C_CMD" "  logs <process|id|*> [-f]  "; _hln "$C_DESC" "Show logs (-f to follow)"
    _h "$C_CMD" "  env <process|id>          "; _hln "$C_DESC" "Show environment variables"
    _h "$C_CMD" "  paths <process|id>        "; _hln "$C_DESC" "Show paths (logs, pid, etc.)"
    echo

    # SERVICE DEFINITIONS
    _hln "$C_SECTION" "SERVICE DEFINITIONS"
    _h "$C_CMD" "  services [-d|--detail]    "; _hln "$C_DESC" "List saved service definitions"
    _h "$C_CMD" "  save <name> <command>     "; _hln "$C_DESC" "Save command as service definition"
    _h "$C_CMD" "  save pattern <name> <pat> "; _hln "$C_DESC" "Save command pattern (with variables)"
    _h "$C_CMD" "  patterns                  "; _hln "$C_DESC" "List saved command patterns"
    _h "$C_CMD" "  enable <org/service>      "; _hln "$C_DESC" "Enable service for startup"
    _h "$C_CMD" "  disable <org/service>     "; _hln "$C_DESC" "Disable service from startup"
    _h "$C_CMD" "  rm <org/service>          "; _hln "$C_DESC" "Remove service definition"
    _h "$C_CMD" "  show <org/service>        "; _hln "$C_DESC" "Show service configuration"
    _h "$C_CMD" "  startup [status]          "; _hln "$C_DESC" "Start enabled services / show status"
    _h "$C_CMD" "  orgs                      "; _hln "$C_DESC" "List available organizations"
    echo

    # PORT MANAGEMENT
    _hln "$C_SECTION" "PORT MANAGEMENT"
    _h "$C_CMD" "  ports [subcommand]        "; _hln "$C_DESC" "Named port registry (list|set|remove|conflicts|...)"
    _h "$C_CMD" "  scan-ports                "; _hln "$C_DESC" "Scan and report open ports"
    _h "$C_CMD" "  claim <port> [-f]         "; _hln "$C_DESC" "Kill non-TSM process using port"
    _h "$C_CMD" "  ranges                    "; _hln "$C_DESC" "Show port allocation ranges"
    _h "$C_CMD" "  patrol                    "; _hln "$C_DESC" "Port patrol (conflict detection)"
    echo

    # DIAGNOSTICS
    _hln "$C_SECTION" "DIAGNOSTICS"
    _h "$C_CMD" "  doctor healthcheck        "; _hln "$C_DESC" "Validate TSM environment"
    _h "$C_CMD" "  doctor scan [range]       "; _hln "$C_DESC" "Scan ports (TCP and UDP)"
    _h "$C_CMD" "  doctor port <num>         "; _hln "$C_DESC" "Check specific port"
    _h "$C_CMD" "  doctor kill <port>        "; _hln "$C_DESC" "Kill process on port"
    _h "$C_CMD" "  doctor files [-v]         "; _hln "$C_DESC" "Audit TSM files"
    _h "$C_CMD" "  doctor orphans            "; _hln "$C_DESC" "Find orphaned processes"
    _h "$C_CMD" "  doctor clean [-a]         "; _hln "$C_DESC" "Clean stale tracking files"
    _h "$C_CMD" "  doctor env [file]         "; _hln "$C_DESC" "Diagnose environment loading"
    _h "$C_CMD" "  doctor -A                 "; _hln "$C_DESC" "Show all ports (no filtering)"
    echo

    # MONITORING & ANALYTICS
    _hln "$C_SECTION" "MONITORING & ANALYTICS"
    _h "$C_CMD" "  monitor <service>         "; _hln "$C_DESC" "Monitor service metrics"
    _h "$C_CMD" "  stream <service>          "; _hln "$C_DESC" "Stream service logs/events"
    _h "$C_CMD" "  dashboard|analytics       "; _hln "$C_DESC" "Analytics dashboard"
    _h "$C_CMD" "  sessions                  "; _hln "$C_DESC" "Extract user sessions from logs"
    _h "$C_CMD" "  clicks|click-timing       "; _hln "$C_DESC" "Analyze click timing"
    _h "$C_CMD" "  journey|user-journey      "; _hln "$C_DESC" "Analyze user journey"
    _h "$C_CMD" "  user-patterns             "; _hln "$C_DESC" "Analyze user behavior patterns"
    _h "$C_CMD" "  disambiguate-users        "; _hln "$C_DESC" "Disambiguate user sessions"
    echo

    # RUNTIME & SYSTEM
    _hln "$C_SECTION" "RUNTIME & SYSTEM"
    _h "$C_CMD" "  setup                     "; _hln "$C_DESC" "Setup TSM environment"
    _h "$C_CMD" "  init <env>                "; _hln "$C_DESC" "Create environment from template"
    _h "$C_CMD" "  runtime [type]            "; _hln "$C_DESC" "Show runtime info (node, python, etc.)"
    _h "$C_CMD" "  daemon [cmd]              "; _hln "$C_DESC" "Manage systemd daemon"
    _h "$C_CMD" "  caddy [cmd]               "; _hln "$C_DESC" "Caddy reverse proxy (init|sync|add|status)"
    _h "$C_CMD" "  users|instances           "; _hln "$C_DESC" "List TSM instances (multi-user mode)"
    _h "$C_CMD" "  color [show|edit|init]    "; _hln "$C_DESC" "Color theme configuration"
    _h "$C_CMD" "  repl                      "; _hln "$C_DESC" "Interactive TSM REPL"
    _h "$C_CMD" "  help [all|topic]          "; _hln "$C_DESC" "Show help"
    echo

    # ENVIRONMENT WORKFLOW
    _hln "$C_SECTION" "ENVIRONMENT WORKFLOW"
    _h "$C_COMMENT" "  1. "; _h "$C_CMD" "tsm init dev"; _hln "$C_COMMENT" "              # Create env/dev.env from template"
    _h "$C_COMMENT" "  2. "; _h "$C_CMD" "edit env/dev.env"; _hln "$C_COMMENT" "          # Add API keys, secrets"
    _h "$C_COMMENT" "  3. "; _h "$C_CMD" "tsm start --env dev app"; _hln "$C_COMMENT" "   # Start with environment"
    echo

    # EXAMPLES - each cycles through the example palette
    _hln "$C_SECTION" "EXAMPLES"
    _hex "  tsm start python -m http.server 8000"; _hln "$C_COMMENT" "    # Quick start"
    _hex "  tsm start --env prod api.sh api"; _hln "$C_COMMENT" "         # Named service with env"
    _hex "  tsm stop api-8000"; _hln "$C_COMMENT" "                       # Stop by name"
    _hex "  tsm logs 0 -f"; _hln "$C_COMMENT" "                           # Follow logs for TSM ID 0"
    _hex "  tsm doctor healthcheck"; _hln "$C_COMMENT" "                  # Diagnose issues"
    _hex "  tsm ports conflicts --fix"; _hln "$C_COMMENT" "               # Fix port conflicts"

    # Clean up local helpers
    unset -f _h _hln _hex
}