#!/usr/bin/env bash
# Tetra Orchestrator - Module User (Not a Module)
# Provides 3 interfaces to module actions: cmd, repl, tui

# Tetra Orchestrator Version
TETRA_ORCHESTRATOR_VERSION="1.0.0"

# Bootstrap tetra environment
: "${TETRA_SRC:=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
export TETRA_SRC

# Load core orchestrator components
TETRA_CORE="$TETRA_SRC/bash/tetra/core"

source "$TETRA_CORE/bootstrap.sh" || {
    echo "ERROR: Failed to load bootstrap" >&2
    exit 1
}

# Bootstrap must succeed
tetra_bootstrap || exit 1

# Load remaining core components
source "$TETRA_CORE/module_loader.sh"
source "$TETRA_CORE/action_discovery.sh"
source "$TETRA_CORE/dispatcher.sh"
source "$TETRA_CORE/context.sh"
source "$TETRA_CORE/agents.sh"
source "$TETRA_CORE/help.sh"

# Discover and load modules
tetra_load_modules
tetra_discover_actions

# Main orchestrator command
tetra() {
    local mode="${1:-help}"
    shift || true

    case "$mode" in
        repl)
            # Interactive REPL mode
            if [[ -f "$TETRA_SRC/bash/tetra/interfaces/repl.sh" ]]; then
                source "$TETRA_SRC/bash/tetra/interfaces/repl.sh"

                # Check for --rlwrap flag for enhanced editing
                if [[ "$1" == "--rlwrap" ]]; then
                    shift
                    tetra_repl_with_rlwrap
                else
                    tetra_repl "$@"
                fi
            else
                echo "ERROR: REPL interface not found" >&2
                return 1
            fi
            ;;

        tui)
            # Visual TUI mode (conditional on tetra-tui)
            if [[ -f "$TETRA_SRC/bash/tetra/interfaces/tui.sh" ]]; then
                source "$TETRA_SRC/bash/tetra/interfaces/tui.sh"
                tetra_tui "$@"
            else
                echo "ERROR: TUI interface not found" >&2
                echo "tetra-tui is optional. See docs for installation." >&2
                return 1
            fi
            ;;

        agent)
            # Agent meta-commands
            local subcmd="${1:-list}"
            shift || true
            case "$subcmd" in
                list)
                    tetra_list_agents "$@"
                    ;;
                info)
                    tetra_agent_info "$@"
                    ;;
                status)
                    tetra_agent_status "$@"
                    ;;
                init)
                    tetra_agent_init "$@"
                    ;;
                connect)
                    tetra_agent_connect "$@"
                    ;;
                disconnect)
                    tetra_agent_disconnect "$@"
                    ;;
                cleanup)
                    tetra_agent_cleanup "$@"
                    ;;
                profiles)
                    tetra_agent_list_profiles "$@"
                    ;;
                *)
                    echo "Unknown agent command: $subcmd" >&2
                    echo "Available: list, info, status, init, connect, disconnect, cleanup, profiles" >&2
                    return 1
                    ;;
            esac
            ;;

        help|--help|-h)
            tetra_show_help "$@"
            ;;

        version|--version|-v)
            echo "tetra orchestrator v$TETRA_ORCHESTRATOR_VERSION"
            echo "Loaded modules: $(tetra list modules 2>/dev/null | tr '\n' ' ')"
            ;;

        "")
            # No arguments - show help
            tetra_show_help
            ;;

        *)
            # Direct command mode - dispatch action
            if [[ -f "$TETRA_SRC/bash/tetra/interfaces/cmd.sh" ]]; then
                source "$TETRA_SRC/bash/tetra/interfaces/cmd.sh"
                tetra_cmd "$mode" "$@"
            else
                echo "ERROR: CMD interface not found" >&2
                return 1
            fi
            ;;
    esac
}

# Export main function
export -f tetra
