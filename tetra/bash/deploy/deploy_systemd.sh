#!/usr/bin/env bash
# deploy_systemd.sh - Install systemd unit files on remote servers
#
# Usage:
#   deploy systemd install <host>     Install all unit files
#   deploy systemd enable <host>      Enable services to start on boot
#   deploy systemd start <host>       Start services
#   deploy systemd status <host>      Check service status
#   deploy systemd help               Show help

# =============================================================================
# CONFIGURATION
# =============================================================================

DEPLOY_SYSTEMD_DIR="$DEPLOY_SRC/systemd"

# Unit files to install
DEPLOY_SYSTEMD_UNITS=(
    "tsm.service"
    "tetra-caddy.service"
)

# =============================================================================
# INSTALL
# =============================================================================

# Install systemd unit files on remote
# Usage: deploy systemd install <host> [unit...]
# If no units specified, installs tsm.service only (caddy usually exists)
deploy_systemd_install() {
    local host="$1"
    shift

    if [[ -z "$host" ]]; then
        echo "Usage: deploy systemd install <host> [unit...]" >&2
        echo "  Units: tsm, caddy (or: tsm.service, tetra-caddy.service)" >&2
        echo "  Default: tsm only (system caddy usually exists)" >&2
        return 1
    fi

    # Default to just tsm if no units specified
    local units=("$@")
    if [[ ${#units[@]} -eq 0 ]]; then
        units=("tsm.service")
    fi

    # Normalize unit names
    local normalized=()
    for u in "${units[@]}"; do
        case "$u" in
            tsm|tsm.service)
                normalized+=("tsm.service")
                ;;
            caddy|tetra-caddy|tetra-caddy.service)
                normalized+=("tetra-caddy.service")
                ;;
            *)
                echo "Unknown unit: $u" >&2
                return 1
                ;;
        esac
    done

    echo "=== Installing systemd units on $host ==="
    echo ""

    # Check SSH connectivity
    _deploy_check_ssh "$host" || return 1

    # Check if system caddy exists (skip tetra-caddy if so)
    local has_system_caddy=false
    if ssh "$host" "systemctl is-active caddy &>/dev/null"; then
        has_system_caddy=true
        echo "Note: System caddy.service is active"
    fi

    # Determine remote user and home directory
    local remote_user="${host%@*}"
    [[ "$remote_user" == "$host" ]] && remote_user="root"  # No @ means root
    local remote_home
    remote_home=$(ssh "$host" "echo ~$remote_user")

    # Copy unit files (with template processing)
    for unit in "${normalized[@]}"; do
        if [[ "$unit" == "tetra-caddy.service" && "$has_system_caddy" == "true" ]]; then
            echo "Skipping: $unit (system caddy.service is active)"
            echo "  To install anyway, stop system caddy first: systemctl stop caddy"
            continue
        fi

        local src="$DEPLOY_SYSTEMD_DIR/$unit"
        if [[ -f "$src" ]]; then
            echo "Installing: $unit (user=$remote_user, home=$remote_home)"
            # Process template and install
            sed -e "s|{{user}}|$remote_user|g" \
                -e "s|{{home}}|$remote_home|g" \
                "$src" | ssh "$host" "cat > /etc/systemd/system/$unit"
        else
            echo "Skipping (not found locally): $unit"
        fi
    done

    # Reload systemd
    echo ""
    echo "Reloading systemd daemon..."
    ssh "$host" "systemctl daemon-reload"

    echo ""
    echo "=== Installation complete ==="
    echo ""
    echo "To enable services on boot:"
    echo "  deploy systemd enable $host"
    echo ""
    echo "To start services now:"
    echo "  deploy systemd start $host"
}

# =============================================================================
# ENABLE
# =============================================================================

# Enable services to start on boot
deploy_systemd_enable() {
    local host="$1"

    if [[ -z "$host" ]]; then
        echo "Usage: deploy systemd enable <host>" >&2
        return 1
    fi

    echo "=== Enabling services on $host ==="

    for unit in "${DEPLOY_SYSTEMD_UNITS[@]}"; do
        echo "Enabling: $unit"
        ssh "$host" "systemctl enable $unit"
    done

    echo ""
    echo "Services enabled. They will start on next boot."
}

# =============================================================================
# START
# =============================================================================

# Start services
deploy_systemd_start() {
    local host="$1"

    if [[ -z "$host" ]]; then
        echo "Usage: deploy systemd start <host>" >&2
        return 1
    fi

    echo "=== Starting services on $host ==="

    # Start TSM first
    echo "Starting tsm.service..."
    ssh "$host" "systemctl start tsm.service"

    # Wait a moment for TSM to start services
    sleep 2

    # Start Caddy
    echo "Starting tetra-caddy.service..."
    ssh "$host" "systemctl start tetra-caddy.service"

    echo ""
    deploy_systemd_status "$host"
}

# =============================================================================
# STOP
# =============================================================================

# Stop services
deploy_systemd_stop() {
    local host="$1"

    if [[ -z "$host" ]]; then
        echo "Usage: deploy systemd stop <host>" >&2
        return 1
    fi

    echo "=== Stopping services on $host ==="

    # Stop Caddy first
    echo "Stopping tetra-caddy.service..."
    ssh "$host" "systemctl stop tetra-caddy.service" 2>/dev/null || true

    # Stop TSM
    echo "Stopping tsm.service..."
    ssh "$host" "systemctl stop tsm.service" 2>/dev/null || true

    echo "Services stopped."
}

# =============================================================================
# STATUS
# =============================================================================

# Check service status
deploy_systemd_status() {
    local host="$1"

    if [[ -z "$host" ]]; then
        echo "Usage: deploy systemd status <host>" >&2
        return 1
    fi

    echo "=== Service status on $host ==="
    echo ""

    for unit in "${DEPLOY_SYSTEMD_UNITS[@]}"; do
        echo "--- $unit ---"
        ssh "$host" "systemctl status $unit --no-pager -l 2>/dev/null | head -15" || echo "  Not installed or not running"
        echo ""
    done
}

# =============================================================================
# LOGS
# =============================================================================

# Show service logs
deploy_systemd_logs() {
    local host="$1"
    local unit="${2:-tsm.service}"
    local lines="${3:-50}"

    if [[ -z "$host" ]]; then
        echo "Usage: deploy systemd logs <host> [unit] [lines]" >&2
        return 1
    fi

    echo "=== Logs for $unit on $host (last $lines) ==="
    ssh "$host" "journalctl -u $unit -n $lines --no-pager"
}

# =============================================================================
# DISPATCHER
# =============================================================================

deploy_systemd() {
    local cmd="${1:-help}"
    shift 2>/dev/null || true

    case "$cmd" in
        install|i)
            deploy_systemd_install "$@"
            ;;
        enable|e)
            deploy_systemd_enable "$@"
            ;;
        start)
            deploy_systemd_start "$@"
            ;;
        stop)
            deploy_systemd_stop "$@"
            ;;
        restart)
            deploy_systemd_stop "$@"
            sleep 1
            deploy_systemd_start "$@"
            ;;
        status|st)
            deploy_systemd_status "$@"
            ;;
        logs|log)
            deploy_systemd_logs "$@"
            ;;
        help|h|--help)
            cat << 'EOF'
deploy systemd - Manage systemd services on remote servers

Commands:
  install <host>              Install unit files
  enable <host>               Enable services (start on boot)
  start <host>                Start services
  stop <host>                 Stop services
  restart <host>              Restart services
  status <host>               Check service status
  logs <host> [unit] [lines]  Show service logs

Unit files installed:
  tsm.service          - Tetra Service Manager
  tetra-caddy.service  - Caddy HTTP Server (managed by tetra)

Examples:
  deploy systemd install root@dev.example.com
  deploy systemd enable root@dev.example.com
  deploy systemd start root@dev.example.com
  deploy systemd logs root@dev.example.com tsm.service 100
EOF
            ;;
        *)
            echo "deploy systemd: unknown command '$cmd'" >&2
            echo "Use 'deploy systemd help' for usage" >&2
            return 1
            ;;
    esac
}

# =============================================================================
# EXPORTS
# =============================================================================

