#!/usr/bin/env bash

# TSM Systemd Integration
# Functions for managing tetra as a systemd service

tetra_systemd_install() {
    local environment="${1:-production}"
    local template_file="$TETRA_SRC/templates/systemd/tetra.service"
    local service_file="/etc/systemd/system/tetra.service"

    # Use environment-specific template if available
    if [[ "$environment" == "dev" ]]; then
        template_file="$TETRA_SRC/templates/systemd/tetra-dev.service"
    fi

    if [[ ! -f "$template_file" ]]; then
        echo "Error: Systemd template not found: $template_file"
        return 1
    fi

    echo "Installing tetra systemd service for $environment environment..."

    # Copy service file (requires sudo)
    if sudo cp "$template_file" "$service_file"; then
        echo "Service file installed: $service_file"
    else
        echo "Error: Failed to install service file (permission denied?)"
        return 1
    fi

    # Reload systemd
    if sudo systemctl daemon-reload; then
        echo "Systemd daemon reloaded"
    else
        echo "Error: Failed to reload systemd daemon"
        return 1
    fi

    # Enable service
    if sudo systemctl enable tetra.service; then
        echo "Tetra service enabled for boot"
    else
        echo "Error: Failed to enable tetra service"
        return 1
    fi

    echo "Tetra systemd service installed successfully!"
    echo "Usage:"
    echo "  sudo systemctl start tetra    # Start service"
    echo "  sudo systemctl stop tetra     # Stop service"
    echo "  sudo systemctl status tetra   # Check status"
    echo "  sudo systemctl restart tetra  # Restart service"
}

tetra_systemd_uninstall() {
    local service_file="/etc/systemd/system/tetra.service"

    echo "Uninstalling tetra systemd service..."

    # Stop service if running
    sudo systemctl stop tetra.service 2>/dev/null || true

    # Disable service
    sudo systemctl disable tetra.service 2>/dev/null || true

    # Remove service file
    if sudo rm -f "$service_file"; then
        echo "Service file removed: $service_file"
    else
        echo "Error: Failed to remove service file"
        return 1
    fi

    # Reload systemd
    if sudo systemctl daemon-reload; then
        echo "Systemd daemon reloaded"
    else
        echo "Error: Failed to reload systemd daemon"
        return 1
    fi

    echo "Tetra systemd service uninstalled successfully!"
}

tetra_systemd_status() {
    echo "=== Tetra Systemd Service Status ==="

    if systemctl is-active --quiet tetra.service; then
        echo "Status: ACTIVE"
    else
        echo "Status: INACTIVE"
    fi

    if systemctl is-enabled --quiet tetra.service; then
        echo "Boot: ENABLED"
    else
        echo "Boot: DISABLED"
    fi

    echo
    echo "=== Service Details ==="
    systemctl status tetra.service --no-pager

    echo
    echo "=== Recent Logs ==="
    journalctl -u tetra.service --no-pager -n 10
}

tetra_systemd_logs() {
    local lines="${1:-50}"
    local follow="${2:-false}"

    if [[ "$follow" == "true" || "$follow" == "-f" ]]; then
        echo "Following tetra service logs (Ctrl+C to stop)..."
        journalctl -u tetra.service -f
    else
        echo "Last $lines lines from tetra service logs:"
        journalctl -u tetra.service --no-pager -n "$lines"
    fi
}

# Add systemd commands to TSM
tsm_systemd() {
    local action="${1:-}"

    case "$action" in
        "install")
            tetra_systemd_install "${2:-production}"
            ;;
        "uninstall")
            tetra_systemd_uninstall
            ;;
        "status")
            tetra_systemd_status
            ;;
        "logs")
            tetra_systemd_logs "${2:-50}" "${3:-false}"
            ;;
        *)
            cat <<'EOF'
TSM Systemd Commands:
  tsm systemd install [dev|production]  Install tetra as systemd service
  tsm systemd uninstall                 Remove tetra systemd service
  tsm systemd status                    Show systemd service status
  tsm systemd logs [lines] [-f]         Show service logs

Examples:
  tsm systemd install dev               Install development service
  tsm systemd install production        Install production service
  tsm systemd logs 100                  Show last 100 log lines
  tsm systemd logs 50 -f               Follow logs in real-time
EOF
            return 1
            ;;
    esac
}

# ===== DAEMON MANAGEMENT COMMANDS =====
# High-level daemon control interface for TSM

tsm_daemon() {
    local action="${1:-help}"
    shift || true

    case "$action" in
        "install")
            tsm_daemon_install "$@"
            ;;
        "uninstall")
            tsm_daemon_uninstall "$@"
            ;;
        "enable")
            tsm_daemon_enable "$@"
            ;;
        "disable")
            tsm_daemon_disable "$@"
            ;;
        "start")
            tsm_daemon_start "$@"
            ;;
        "stop")
            tsm_daemon_stop "$@"
            ;;
        "restart")
            tsm_daemon_restart "$@"
            ;;
        "status")
            tsm_daemon_status "$@"
            ;;
        "logs")
            tsm_daemon_logs "$@"
            ;;
        "help"|*)
            cat <<'EOF'
TSM Daemon Management Commands:

  tsm daemon install [@env]     Install systemd daemon for specified environment
  tsm daemon uninstall [@env]   Remove systemd daemon
  tsm daemon enable             Enable daemon to start at boot
  tsm daemon disable            Disable daemon from starting at boot
  tsm daemon start              Start the daemon
  tsm daemon stop               Stop the daemon
  tsm daemon restart            Restart the daemon
  tsm daemon status             Show daemon status and health
  tsm daemon logs [lines] [-f]  View daemon logs

Examples:
  tsm daemon install @dev       Install daemon for dev environment (runs as root)
  tsm daemon enable             Enable daemon for boot
  tsm daemon start              Start the daemon now
  tsm daemon status             Check daemon status
  tsm daemon logs 50 -f         Follow last 50 lines of logs

Environment Naming:
  @dev         Development (root:root, /root/tetra)
  @production  Production (/opt/tetra, system user)
EOF
            [[ "$action" == "help" ]] && return 0 || return 1
            ;;
    esac
}

# Install daemon for specified environment
tsm_daemon_install() {
    local env_spec="${1:-@production}"
    local environment="${env_spec#@}"  # Remove @ prefix if present

    echo "Installing TSM daemon for environment: $environment"

    # Determine service template and name
    local template_file service_name
    case "$environment" in
        "dev")
            template_file="$TETRA_SRC/templates/systemd/tetra@dev.service"
            service_name="tetra-dev.service"
            ;;
        "production"|"prod")
            template_file="$TETRA_SRC/templates/systemd/tetra.service"
            service_name="tetra.service"
            ;;
        *)
            echo "❌ Unknown environment: $environment"
            echo "Supported environments: dev, production"
            return 1
            ;;
    esac

    if [[ ! -f "$template_file" ]]; then
        echo "❌ Service template not found: $template_file"
        return 1
    fi

    # For @dev, also install service definition
    if [[ "$environment" == "dev" ]]; then
        echo "📄 Installing service definition for @dev environment..."
        local service_def="$TETRA_SRC/templates/services/tetra-dev.tsm"
        if [[ -f "$service_def" ]]; then
            echo "   Template: $service_def"
            echo "   This should be deployed to: /root/tetra/tsm/services-available/tetra.tsm"
        fi
    fi

    echo "📋 Service template: $template_file"
    echo "🎯 Target service: /etc/systemd/system/$service_name"
    echo ""
    echo "To complete installation (requires root access on target system):"
    echo ""
    echo "  # Copy service file"
    echo "  sudo cp $template_file /etc/systemd/system/$service_name"
    echo ""
    echo "  # Reload systemd"
    echo "  sudo systemctl daemon-reload"
    echo ""
    echo "  # Enable and start"
    echo "  sudo systemctl enable $service_name"
    echo "  sudo systemctl start $service_name"
    echo ""
    echo "  # Check status"
    echo "  sudo systemctl status $service_name"

    # If we're on the local system and have sudo, offer to install
    if [[ -w /etc/systemd/system ]] || sudo -n true 2>/dev/null; then
        echo ""
        read -p "Install now on this system? [y/N] " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            sudo cp "$template_file" "/etc/systemd/system/$service_name" && \
            sudo systemctl daemon-reload && \
            echo "✅ Service installed: $service_name" && \
            echo "   Use 'tsm daemon enable' to enable boot startup" && \
            echo "   Use 'tsm daemon start' to start now"
        fi
    fi
}

# Uninstall daemon
tsm_daemon_uninstall() {
    local service_name="${1:-tetra-dev.service}"

    echo "Uninstalling systemd daemon: $service_name"

    if ! systemctl list-unit-files | grep -q "^$service_name"; then
        echo "⚠️  Service not installed: $service_name"
        return 0
    fi

    echo "Stopping and disabling service..."
    sudo systemctl stop "$service_name" 2>/dev/null || true
    sudo systemctl disable "$service_name" 2>/dev/null || true

    if sudo rm -f "/etc/systemd/system/$service_name"; then
        sudo systemctl daemon-reload
        echo "✅ Service uninstalled: $service_name"
    else
        echo "❌ Failed to remove service file"
        return 1
    fi
}

# Enable daemon for boot
tsm_daemon_enable() {
    local service_name="${1:-tetra-dev.service}"

    if ! systemctl list-unit-files | grep -q "^$service_name"; then
        echo "❌ Service not installed: $service_name"
        echo "   Run 'tsm daemon install @dev' first"
        return 1
    fi

    if sudo systemctl enable "$service_name"; then
        echo "✅ Daemon enabled for boot: $service_name"
    else
        echo "❌ Failed to enable daemon"
        return 1
    fi
}

# Disable daemon from boot
tsm_daemon_disable() {
    local service_name="${1:-tetra-dev.service}"

    if sudo systemctl disable "$service_name" 2>/dev/null; then
        echo "✅ Daemon disabled from boot: $service_name"
    else
        echo "⚠️  Daemon was not enabled: $service_name"
    fi
}

# Start daemon
tsm_daemon_start() {
    local service_name="${1:-tetra-dev.service}"

    if ! systemctl list-unit-files | grep -q "^$service_name"; then
        echo "❌ Service not installed: $service_name"
        echo "   Run 'tsm daemon install @dev' first"
        return 1
    fi

    echo "Starting daemon: $service_name"
    if sudo systemctl start "$service_name"; then
        sleep 2
        sudo systemctl status "$service_name" --no-pager -l
    else
        echo "❌ Failed to start daemon"
        return 1
    fi
}

# Stop daemon
tsm_daemon_stop() {
    local service_name="${1:-tetra-dev.service}"

    echo "Stopping daemon: $service_name"
    if sudo systemctl stop "$service_name"; then
        echo "✅ Daemon stopped"
    else
        echo "❌ Failed to stop daemon"
        return 1
    fi
}

# Restart daemon
tsm_daemon_restart() {
    local service_name="${1:-tetra-dev.service}"

    echo "Restarting daemon: $service_name"
    if sudo systemctl restart "$service_name"; then
        sleep 2
        sudo systemctl status "$service_name" --no-pager -l
    else
        echo "❌ Failed to restart daemon"
        return 1
    fi
}

# Show daemon status
tsm_daemon_status() {
    local service_name="${1:-tetra-dev.service}"

    echo "=== TSM Daemon Status ==="
    echo "Service: $service_name"
    echo ""

    if ! systemctl list-unit-files | grep -q "^$service_name"; then
        echo "Status: NOT INSTALLED"
        echo ""
        echo "Install with: tsm daemon install @dev"
        return 1
    fi

    # Show systemd status
    sudo systemctl status "$service_name" --no-pager -l || true

    echo ""
    echo "=== Managed Services ==="
    echo "Use 'tsm list' to see services managed by the daemon"
}

# View daemon logs
tsm_daemon_logs() {
    local lines="${1:-50}"
    local follow="${2:-}"
    local service_name="${3:-tetra-dev.service}"

    if ! systemctl list-unit-files | grep -q "^$service_name"; then
        echo "❌ Service not installed: $service_name"
        return 1
    fi

    if [[ "$follow" == "-f" || "$follow" == "--follow" ]]; then
        echo "Following daemon logs (Ctrl+C to stop)..."
        sudo journalctl -u "$service_name" -f
    else
        echo "Last $lines lines from daemon logs:"
        sudo journalctl -u "$service_name" --no-pager -n "$lines"
    fi
}

# Export daemon functions
export -f tsm_daemon
export -f tsm_daemon_install
export -f tsm_daemon_uninstall
export -f tsm_daemon_enable
export -f tsm_daemon_disable
export -f tsm_daemon_start
export -f tsm_daemon_stop
export -f tsm_daemon_restart
export -f tsm_daemon_status
export -f tsm_daemon_logs