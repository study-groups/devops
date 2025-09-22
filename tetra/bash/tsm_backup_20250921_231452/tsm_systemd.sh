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