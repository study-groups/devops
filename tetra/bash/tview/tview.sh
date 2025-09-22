#!/usr/bin/env bash

# TView - Tetra View Entry Point
# Real-time monitoring view for environments, configurations, and processes

# Main tview command
tview() {
    local command="${1:-dashboard}"

    case "$command" in
        dashboard|dash|d|"")
            # Source the REPL and launch dashboard
            source "$TETRA_SRC/bash/tview/tview_repl.sh"
            tview_repl
            ;;
        help|h|--help)
            cat << 'EOF'
TView - Tetra View

USAGE:
  tview [command]

COMMANDS:
  dashboard       Launch interactive monitoring view (default)
  help            Show this help

DASHBOARD NAVIGATION:
  a, d            Switch modes (TOML ← → TKM ← → TSM ← → DEPLOY ← → ORG)
  w, s            Switch environments (SYSTEM ↕ LOCAL ↕ DEV ↕ STAGING ↕ PROD)
  j, i, k, l      Navigate items within current view
  Enter           Show detailed view for selected item
  v               View raw TOML configuration file
  t               Execute 'tsm list' command
  g               Execute 'git status' command
  r               Refresh dashboard data
  h               Show help within dashboard
  q               Quit dashboard

MONITORING MODES:
  TOML           Configuration files and environment infrastructure
  TKM            SSH key management and server connectivity
  TSM            Service management (local and remote processes)
  DEPLOY         Deployment status and operations
  ORG            Organization management and multi-environment sync

ENVIRONMENTS:
  SYSTEM         Overview/summary across all environments
  LOCAL          Your development machine
  DEV            Development server
  STAGING        Staging/QA server
  PROD           Production server

The dashboard provides real-time visibility into:
• Infrastructure configuration from tetra.toml
• SSH connectivity to remote environments
• Running processes and services via TSM
• Git status and deployment readiness
• Organization configurations and deployments
• Port assignments and conflicts

Focus: Read-only monitoring for quick navigation and system visibility
EOF
            ;;
        *)
            echo "Unknown command: $command"
            echo "Use 'tview help' for available commands"
            return 1
            ;;
    esac
}

# Export the main function
export -f tview