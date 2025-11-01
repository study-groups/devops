#!/usr/bin/env bash

# tubes.sh - Main tubes module entry point

# Source all tube components
source "${TUBES_SRC}/tubes_paths.sh"
source "${TUBES_SRC}/tubes_core.sh"
source "${TUBES_SRC}/tubes_router.sh"

# Initialize the tubes module
tubes_init() {
    tubes_init_dirs

    # Log initialization
    if declare -f tetra_log_info >/dev/null 2>&1; then
        tetra_log_info "tubes" "init" "compact" "jsonl"
    fi

    return 0
}

# Main tubes command dispatcher
tubes() {
    local subcommand="${1:-help}"
    shift 2>/dev/null || true

    case "$subcommand" in
        create)
            tubes_create "$@"
            ;;
        destroy)
            tubes_destroy "$@"
            ;;
        list|ls)
            tubes_list "$@"
            ;;
        send)
            tubes_send "$@"
            ;;
        receive|recv)
            tubes_receive "$@"
            ;;
        listen)
            tubes_listen "$@"
            ;;
        route)
            tubes_route "$@"
            ;;
        discover)
            tubes_discover "$@"
            ;;
        cleanup)
            tubes_cleanup "$@"
            ;;
        router)
            local router_cmd="${1:-status}"
            shift 2>/dev/null || true

            case "$router_cmd" in
                start)
                    tubes_router_start "$@"
                    ;;
                stop)
                    tubes_router_stop "$@"
                    ;;
                status)
                    tubes_router_status "$@"
                    ;;
                *)
                    echo "Unknown router command: $router_cmd"
                    tubes_help
                    return 1
                    ;;
            esac
            ;;
        help|--help|-h)
            tubes_help
            ;;
        *)
            echo "Unknown command: $subcommand"
            tubes_help
            return 1
            ;;
    esac
}

# Display help
tubes_help() {
    cat <<'EOF'
tubes - Terminal network via FIFOs

USAGE:
    tubes <command> [options]

COMMANDS:
    create <name> [description]     Create a new tube endpoint
    destroy <name>                  Destroy a tube endpoint
    list                            List all active tubes
    send <name> <message>           Send message to a tube
    receive <name> [timeout]        Receive message from a tube
    listen <name> [callback]        Listen continuously to a tube
    route <target> <message>        Route message via router
    discover                        Discover and clean up tubes
    cleanup                         Remove all tubes

    router start                    Start the message router
    router stop                     Stop the message router
    router status                   Check router status

EXAMPLES:
    # Create a tube for this terminal
    tubes create my-terminal "Main work terminal"

    # In another terminal, send a message
    tubes send my-terminal "Hello from terminal 2!"

    # Receive the message
    tubes receive my-terminal

    # Listen continuously
    tubes listen my-terminal

    # Using the router
    tubes router start
    tubes create term1 "Terminal 1"
    tubes create term2 "Terminal 2"
    tubes route term2 "Message from term1"

    # List all tubes
    tubes list

    # Cleanup
    tubes cleanup

TES INTEGRATION:
    Tubes are TES endpoints with the pattern: @tube:<name>
    Example: @tube:my-terminal, @tube:repl-main

FIFO LOCATIONS:
    Data:    $TETRA_DIR/tubes/fifos/<name>.fifo
    Control: $TETRA_DIR/tubes/fifos/<name>.control

SEE ALSO:
    docs/TES_Agent_Extension.md - Agent patterns
    bash/tubes/README.md - Detailed documentation
EOF
}

# Export main function and subcommands
export -f tubes
export -f tubes_init
export -f tubes_help
