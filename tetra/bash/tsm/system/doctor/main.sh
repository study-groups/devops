#!/usr/bin/env bash

# TSM Doctor - Main Entry Point
# Coordinates all doctor subcommands

# Main doctor command
tetra_tsm_doctor() {
    local subcommand="$1"
    shift 2>/dev/null || true

    # healthcheck doesn't need lsof dependency check
    if [[ "$subcommand" != "healthcheck" && "$subcommand" != "health" ]]; then
        doctor_check_dependencies || return 1
    fi

    case "$subcommand" in
        "healthcheck"|"health")
            doctor_healthcheck
            ;;
        "files"|"tsm-files")
            local verbose="false"
            if [[ "$1" == "-v" || "$1" == "--verbose" ]]; then
                verbose="true"
            fi
            doctor_diagnose_files "$verbose"
            ;;
        "runtime")
            # Runtime environment diagnostics
            if declare -f tsm_runtime_info >/dev/null 2>&1; then
                local runtime_type="$1"
                if [[ -z "$runtime_type" ]]; then
                    # Show all runtimes with diagnostic focus
                    echo "$(color cyan bold)Runtime Environment Diagnostics:$(color reset)"
                    echo ""
                    tsm_runtime_info_all
                else
                    tsm_runtime_info "$runtime_type"
                fi
            else
                doctor_error "Runtime diagnostics not available (runtime_info.sh not loaded)"
                return 1
            fi
            ;;
        "scan"|"ports"|"")
            # Pass remaining args to scan (supports --range, --exclude, --min, --max)
            doctor_scan_common_ports "$@"
            ;;
        "port")
            local port="$1"
            if [[ -z "$port" ]]; then
                doctor_error "Port number required"
                echo "Usage: tsm doctor port <port-number>"
                return 1
            fi
            doctor_scan_port "$port"
            ;;
        "kill")
            local port="$1"
            local force="$2"
            if [[ -z "$port" ]]; then
                doctor_error "Port number required"
                echo "Usage: tsm doctor kill <port-number> [--force]"
                return 1
            fi
            doctor_kill_port_process "$port" "$([[ "$force" == "--force" ]] && echo "true" || echo "false")"
            ;;
        "env")
            local env_file="$1"
            doctor_diagnose_env_loading "$env_file"
            ;;
        "orphans")
            doctor_scan_orphaned_processes "$@"
            ;;
        "clean")
            local aggressive="false"
            if [[ "$1" == "--aggressive" || "$1" == "-a" ]]; then
                aggressive="true"
            fi
            doctor_clean_stale_processes "$aggressive"
            ;;
        "validate")
            local command="" port="" env_file="" json_output=false

            # Parse validate arguments
            while [[ $# -gt 0 ]]; do
                case $1 in
                    --port)
                        port="$2"
                        shift 2
                        ;;
                    --env)
                        env_file="$2"
                        shift 2
                        ;;
                    --json)
                        json_output=true
                        shift
                        ;;
                    *)
                        if [[ -z "$command" ]]; then
                            command="$1"
                        else
                            command="$command $1"
                        fi
                        shift
                        ;;
                esac
            done

            doctor_validate_command "$command" "$port" "$env_file" "$json_output"
            ;;
        "reconcile"|"ports-reconcile")
            if declare -f tsm_reconcile_ports >/dev/null 2>&1; then
                tsm_reconcile_ports
            else
                doctor_error "Port reconciliation not available (ports_double.sh not loaded)"
                return 1
            fi
            ;;
        "ports-declared")
            if declare -f tsm_show_declared_ports >/dev/null 2>&1; then
                tsm_show_declared_ports
            else
                doctor_error "Port registry not available (ports_double.sh not loaded)"
                return 1
            fi
            ;;
        "ports-actual")
            if declare -f tsm_show_actual_ports >/dev/null 2>&1; then
                tsm_show_actual_ports
            else
                doctor_error "Port scanning not available (ports_double.sh not loaded)"
                return 1
            fi
            ;;
        "help"|"-h"|"--help")
            cat <<EOF
TSM Doctor - Port diagnostics and conflict resolution

Usage:
  tsm doctor healthcheck         Run comprehensive health check (TSM env, deps, processes)
  tsm doctor files [-v]          Audit all TSM files (services, processes, logs, ports)
  tsm doctor [scan] [OPTIONS]    Scan ports (default: 1024-10000)
  tsm doctor port <number>       Check specific port
  tsm doctor kill <port> [--force]  Kill process using port
  tsm doctor env [file]          Diagnose environment file loading
  tsm doctor orphans [--json]    Find potentially orphaned TSM processes
  tsm doctor clean [-a|--aggressive]  Clean up stale process tracking files
  tsm doctor validate <command> [--port <port>] [--env <file>] [--json]  Pre-flight validation
  tsm doctor reconcile           Run port reconciliation (declared vs actual)
  tsm doctor ports-declared      Show TSM port registry (System A)
  tsm doctor ports-actual        Show actual listening ports (System B)
  tsm doctor help                Show this help

Port Range Options (for scan command):
  --range MIN-MAX                Set port range (e.g., --range 3000-4000)
  --min PORT                     Set minimum port (default: 1024)
  --max PORT                     Set maximum port (default: 10000)
  --exclude "RANGE1 RANGE2"      Exclude ranges (e.g., --exclude "5000-5100 8080")
  MIN-MAX                        Shorthand range (e.g., tsm doctor scan 3000-5000)

Environment Variables:
  DOCTOR_PORT_MIN                Default minimum port (1024)
  DOCTOR_PORT_MAX                Default maximum port (10000)
  DOCTOR_PORT_EXCLUDE            Default exclude ranges (space-separated)

Examples:
  tsm doctor healthcheck         # Validate TSM environment and state (START HERE!)
  tsm doctor files               # Audit all TSM-related files
  tsm doctor files -v            # Verbose file audit with details
  tsm doctor                     # Scan default range (1024-10000)
  tsm doctor scan 3000-5000      # Scan ports 3000-5000
  tsm doctor scan --range 8000-9000  # Scan ports 8000-9000
  tsm doctor scan --exclude "5353 8080-8090"  # Exclude mDNS and proxy ports
  tsm doctor port 4000           # Check if port 4000 is free
  tsm doctor kill 4000           # Kill process using port 4000
  tsm doctor kill 3000 --force   # Kill without confirmation
  tsm doctor env env/local.env   # Check environment file
  tsm doctor orphans             # Find processes TSM lost track of
  tsm doctor clean               # Clean up stale tracking files
  tsm doctor reconcile           # Check declared vs actual ports
  tsm doctor validate "node server.js" --port 4000 --env env/dev.env  # Validate before start

Common Issues:
  - TSM variables not set (TSM_PROCESSES_DIR, etc.) → Run: tsm doctor healthcheck
  - Service definitions missing TSM_ENV → Run: tsm doctor files
  - Port conflicts preventing service startup
  - Environment variables not loading
  - TSM defaulting to unexpected ports
  - Processes left running after crashes
  - Orphaned processes from previous TSM sessions
  - Port mismatches (declared vs actual)
EOF
            ;;
        *)
            doctor_error "Unknown subcommand: $subcommand"
            echo "Use 'tsm doctor help' for usage information"
            return 1
            ;;
    esac
}

# Export the function
export -f tetra_tsm_doctor
