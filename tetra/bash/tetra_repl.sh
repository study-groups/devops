#!/usr/bin/env bash

# Tetra REPL - Configuration at Distance
# Direct function calls to core tetra functions

# Load shared REPL utilities
source "${TETRA_SRC:-$HOME/src/devops/tetra}/bash/utils/repl_utils.sh"

# Tetra Meta Directory Convention under TETRA_DIR
# Following pattern: TETRA_DIR/.tetra/{config,logs,history}
TETRA_META_DIR="${TETRA_DIR:-$HOME/tetra}/.tetra"
TETRA_CONFIG_DIR="${TETRA_META_DIR}/config"
TETRA_LOGS_DIR="${TETRA_META_DIR}/logs"
TETRA_HISTORY_DIR="${TETRA_META_DIR}/history"

# Source Configuration at Distance functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/tetra_remote.sh"

# Initialize tetra meta environment
tetra_repl_init() {
    # Auto-setup REPL environment
    _repl_auto_setup "tetra"

    # Create tetra meta directories
    mkdir -p "$TETRA_CONFIG_DIR" "$TETRA_LOGS_DIR" "$TETRA_HISTORY_DIR" 2>/dev/null || true

    # Initialize configuration if it doesn't exist
    if [[ ! -f "$TETRA_CONFIG_DIR/tetra.conf" ]]; then
        cat > "$TETRA_CONFIG_DIR/tetra.conf" <<EOF
# Tetra Console REPL Configuration
# Default settings for Configuration at Distance

# Default environment for operations
DEFAULT_ENV=staging

# History settings
HISTORY_SIZE=1000
HISTORY_FILE="$TETRA_HISTORY_DIR/repl_history.log"

# Logging settings
LOG_LEVEL=info
LOG_FILE="$TETRA_LOGS_DIR/tetra.log"
EOF
    fi
}

# Main REPL function
tetra_repl_main() {
    # Initialize environment
    tetra_repl_init

    echo "Tetra Console - Configuration at Distance"
    echo "Type 'help' for commands, 'functions' for all available functions"
    echo "Use 'exit' or Ctrl+C to quit"
    echo

    while true; do
        local prompt
        prompt="$(_repl_get_prompt "tetra")"
        echo -n "$prompt"

        if ! read -r input; then
            echo
            break
        fi

        # Skip empty input
        if [[ -z "$input" ]]; then
            continue
        fi

        # Process bash commands first
        if _repl_process_bash "$input"; then
            echo
            continue
        fi

        # Save to history
        _repl_save_history "tetra" "$input"

        # Handle standard help and exit
        if _repl_handle_help "$input" "tetra_repl_help"; then
            echo
            continue
        fi

        if ! _repl_handle_exit "$input"; then
            break
        fi

        # Parse input
        local cmd args
        _repl_parse_input "$input" cmd args

        case "$cmd" in
            functions|f)
                tetra_repl_functions
                ;;
            status|s)
                tetra_repl_status
                ;;
            config)
                tetra_repl_config "$args"
                ;;
            history)
                _repl_show_history "tetra" "${args:-20}"
                ;;
            *)
                tetra_repl_dispatch "$cmd" "$args"
                ;;
        esac
        echo
    done
}

# Configuration management
tetra_repl_config() {
    local action="$1"

    case "$action" in
        edit|"")
            ${EDITOR:-vim} "$TETRA_CONFIG_DIR/tetra.conf"
            ;;
        show|view)
            echo "=== Tetra Configuration ==="
            cat "$TETRA_CONFIG_DIR/tetra.conf"
            ;;
        path)
            echo "$TETRA_CONFIG_DIR/tetra.conf"
            ;;
        *)
            echo "Usage: config [edit|show|path]"
            ;;
    esac
}

# Dispatch commands to core functions
tetra_repl_dispatch() {
    local cmd="$1"
    local args="$2"

    case "$cmd" in
        # Service Management (TSM)
        start)
            if command -v tetra_tsm_start >/dev/null 2>&1; then
                tetra_tsm_start $args
            else
                echo "TSM not loaded. Try: tmod load tsm"
            fi
            ;;
        stop)
            if command -v tetra_tsm_stop >/dev/null 2>&1; then
                tetra_tsm_stop $args
            else
                echo "TSM not loaded. Try: tmod load tsm"
            fi
            ;;
        list|ls)
            if command -v tetra_tsm_list >/dev/null 2>&1; then
                tetra_tsm_list $args
            else
                echo "TSM not loaded. Try: tmod load tsm"
            fi
            ;;
        logs)
            if command -v tetra_tsm_logs >/dev/null 2>&1; then
                tetra_tsm_logs $args
            else
                echo "TSM not loaded. Try: tmod load tsm"
            fi
            ;;
        restart)
            if command -v tetra_tsm_restart >/dev/null 2>&1; then
                tetra_tsm_restart $args
            else
                echo "TSM not loaded. Try: tmod load tsm"
            fi
            ;;

        # Key Management (TKM)
        generate)
            if command -v tkm_generate_keys >/dev/null 2>&1; then
                tkm_generate_keys $args
            else
                echo "TKM not loaded. Try: tmod load tkm"
            fi
            ;;
        deploy-keys)
            if command -v tkm_deploy_keys >/dev/null 2>&1; then
                tkm_deploy_keys $args
            else
                echo "TKM not loaded. Try: tmod load tkm"
            fi
            ;;
        revoke)
            if command -v tkm_revoke_keys >/dev/null 2>&1; then
                tkm_revoke_keys $args
            else
                echo "TKM not loaded. Try: tmod load tkm"
            fi
            ;;
        audit)
            if command -v tkm_security_audit >/dev/null 2>&1; then
                tkm_security_audit $args
            else
                echo "TKM not loaded. Try: tmod load tkm"
            fi
            ;;

        # Module Management (TMOD)
        load)
            if command -v tetra_load_module >/dev/null 2>&1; then
                tetra_load_module $args
            else
                echo "TMOD not available"
            fi
            ;;
        unload)
            if command -v tetra_unload_module >/dev/null 2>&1; then
                tetra_unload_module $args
            else
                echo "TMOD not available"
            fi
            ;;
        modules)
            if command -v tmod >/dev/null 2>&1; then
                tmod ls
            else
                echo "TMOD not available"
            fi
            ;;

        # Configuration at Distance
        run)
            tetra_remote_exec $args
            ;;
        tunnel)
            tetra_ssh_tunnel $args
            ;;
        exec)
            tetra_remote_command $args
            ;;
        targets)
            tetra_list_targets
            ;;
        test)
            tetra_test_connection $args
            ;;

        *)
            echo "Unknown function '$func'. Type 'help' for available commands or 'functions' for complete reference."
            ;;
    esac
}

# Show categorized help
tetra_repl_help() {
    cat <<'EOF'
Tetra Console - Configuration at Distance
===============================================

Service Management:
  start <service>           Start local service (requires tsm)
  stop <process>            Stop process (requires tsm)
  list                      List running processes (requires tsm)
  logs <process> [-f]       Show process logs (requires tsm)
  restart <process>         Restart process (requires tsm)

Key Management:
  generate <env> <type>     Generate SSH keys (requires tkm)
  deploy-keys <env>         Deploy keys to environment (requires tkm)
  revoke <env>              Revoke environment keys (requires tkm)
  audit [env]               Security audit (requires tkm)

Module Management:
  load <module>             Load tetra module
  unload <module>           Unload module
  modules                   List loaded modules

Configuration at Distance:
  run <target> "<command>"      Execute command remotely
  tunnel <target:port>          Create SSH tunnel
  exec <target> "<command>"     Direct remote execution
  targets                       List available targets
  test <target>                 Test connectivity to target

System:
  help, h                   Show this help
  functions, f              Show all available functions
  status, s                 Show system status
  exit, q                   Exit REPL

Examples:
  start tetra               Start tetra-4444 service locally
  run staging "start tetra" Start tetra service on staging
  generate staging deploy   Generate staging deployment keys
  tunnel staging:4444       Access staging tetra via tunnel
  load tsm                  Load service manager module

Type 'functions' for complete function reference.
EOF
}

# Show all available functions by module
tetra_repl_functions() {
    echo "Available Functions by Module:"
    echo "============================="

    echo
    echo "TSM (Service Management):"
    if command -v tetra_tsm_start >/dev/null 2>&1; then
        declare -F | grep "tetra_tsm_" | cut -d' ' -f3 | sed 's/tetra_tsm_/  /' | sort
    else
        echo "  (not loaded - try: load tsm)"
    fi

    echo
    echo "TKM (Key Management):"
    if command -v tkm_generate_keys >/dev/null 2>&1; then
        declare -F | grep "^tkm_" | cut -d' ' -f3 | sed 's/tkm_/  /' | sort
    else
        echo "  (not loaded - try: load tkm)"
    fi

    echo
    echo "TMOD (Module Management):"
    if command -v tetra_load_module >/dev/null 2>&1; then
        declare -F | grep "tetra_.*_module" | cut -d' ' -f3 | sed 's/tetra_/  /' | sort
    else
        echo "  (not available)"
    fi

    echo
    echo "Configuration at Distance:"
    declare -F | grep -E "tetra_remote|tetra_ssh" | cut -d' ' -f3 | sed 's/tetra_/  /' | sort

    echo
    echo "Note: Function availability depends on loaded modules."
    echo "Use 'load <module>' to load additional modules."
}

# Show system status
tetra_repl_status() {
    echo "Tetra System Status"
    echo "=================="
    echo "Directory: ${TETRA_DIR:-not set}"
    echo "Source:    ${TETRA_SRC:-not set}"
    echo

    # Module status
    echo "Loaded Modules:"
    if command -v tmod >/dev/null 2>&1; then
        tmod ls 2>/dev/null | head -1
        tmod ls 2>/dev/null | tail -n +2 | sed 's/^/  /'
    else
        echo "  TMOD not available"
    fi
    echo

    # Service status
    echo "Running Services:"
    if command -v tetra_tsm_list >/dev/null 2>&1; then
        local service_count=$(tetra_tsm_list 2>/dev/null | grep -c "^[0-9]" || echo "0")
        if [[ "$service_count" -gt 0 ]]; then
            tetra_tsm_list 2>/dev/null | head -5
        else
            echo "  No services running"
        fi
    else
        echo "  TSM not loaded"
    fi
    echo

    # Key status
    echo "SSH Key Status:"
    if command -v tkm >/dev/null 2>&1; then
        tkm status 2>/dev/null | head -3 || echo "  TKM not configured"
    else
        echo "  TKM not loaded"
    fi
}

# Configuration at Distance functions
tetra_remote_exec() {
    local target="$1"
    shift
    local command="$*"

    if [[ -z "$target" || -z "$command" ]]; then
        echo "Usage: run <target> \"<command>\""
        echo "Example: run staging \"tsm list\""
        return 1
    fi

    local ssh_target=$(tetra_resolve_target "$target")
    local key_file=$(tetra_get_key_for_target "$target")

    echo "Executing on $target: $command"
    ssh -i "$key_file" \
        -o StrictHostKeyChecking=no \
        -o UserKnownHostsFile=/dev/null \
        -o ConnectTimeout=10 \
        "$ssh_target" \
        "$command"
}

tetra_ssh_tunnel() {
    local target_port="$1"

    if [[ -z "$target_port" ]]; then
        echo "Usage: tunnel <target:remote_port[:local_port]>"
        echo "Example: tunnel staging:4444"
        echo "Example: tunnel prod:3000:8080"
        return 1
    fi

    local target remote_port local_port
    IFS=':' read -r target remote_port local_port <<< "$target_port"
    local_port=${local_port:-$remote_port}

    local ssh_target=$(tetra_resolve_target "$target")
    local key_file=$(tetra_get_key_for_target "$target")

    echo "Creating tunnel: localhost:$local_port -> $target:$remote_port"
    echo "Press Ctrl+C to close tunnel"
    ssh -i "$key_file" \
        -o StrictHostKeyChecking=no \
        -o UserKnownHostsFile=/dev/null \
        -L "$local_port:localhost:$remote_port" \
        -N "$ssh_target"
}

tetra_remote_command() {
    tetra_remote_exec "$@"
}

# Target resolution - integrates with TKM when available
tetra_resolve_target() {
    local target="$1"

    # Try TKM organization data first
    if command -v tkm >/dev/null && tkm org status >/dev/null 2>&1; then
        case "$target" in
            staging)
                # Try to get from TKM, fallback to default
                tkm_get_env_host "staging" 2>/dev/null || echo "staging@staging.pixeljamarcade.com"
                ;;
            prod)
                tkm_get_env_host "prod" 2>/dev/null || echo "production@prod.pixeljamarcade.com"
                ;;
            dev)
                tkm_get_env_host "dev" 2>/dev/null || echo "dev@dev.pixeljamarcade.com"
                ;;
            *)
                echo "$target"  # Assume user@host format
                ;;
        esac
    else
        # Fallback mapping when TKM not available
        case "$target" in
            staging) echo "staging@staging.pixeljamarcade.com" ;;
            prod) echo "production@prod.pixeljamarcade.com" ;;
            dev) echo "dev@dev.pixeljamarcade.com" ;;
            *) echo "$target" ;;
        esac
    fi
}

tetra_get_key_for_target() {
    local target="$1"

    # Try TKM key management first
    if command -v tkm >/dev/null; then
        tkm_get_active_key "$target" 2>/dev/null || echo "$HOME/.ssh/id_rsa"
    else
        echo "$HOME/.ssh/id_rsa"
    fi
}

# Aliases for common patterns
alias trepl='tetra_repl_main'

# Entry point - can be called directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    tetra_repl_main "$@"
fi