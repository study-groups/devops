#!/usr/bin/env bash

# TSM Startup Functions
# Start all enabled services, show startup status

# Show startup status (what services would start)
tetra_tsm_startup_status() {
    echo "🚀 TSM Startup Configuration"
    echo

    # Check if daemon is enabled
    if command -v systemctl >/dev/null 2>&1; then
        local daemon_status=$(systemctl is-enabled tsm.service 2>/dev/null || echo "not-installed")
        case "$daemon_status" in
            enabled)
                echo "✅ Systemd daemon: enabled (will start on boot)"
                ;;
            disabled)
                echo "⚪ Systemd daemon: disabled (will NOT start on boot)"
                echo "   Run 'tsm daemon enable' to enable boot startup"
                ;;
            *)
                echo "⚠️  Systemd daemon: not installed"
                echo "   Run 'tsm daemon install @dev' to set up boot startup"
                ;;
        esac
        echo
    fi

    # List enabled services from central services-enabled
    echo "📋 Services Configured for Autostart:"

    local enabled_count=0

    [[ -d "$TSM_SERVICES_ENABLED" ]] || {
        echo "  No services enabled"
        echo "  Use 'tsm enable org/service' to enable services for autostart"
        return
    }

    for service_link in "$TSM_SERVICES_ENABLED"/*.tsm; do
        [[ -L "$service_link" ]] || continue

        local link_name=$(basename "$service_link" .tsm)
        local org="${link_name%%-*}"
        local service_name="${link_name#*-}"

        local service_file=$(readlink "$service_link")

        if [[ ! -f "$service_file" ]]; then
            echo "  ⚠️  $org/$service_name (service file missing)"
            continue
        fi

        local port
        port=$(source "$service_file" 2>/dev/null && echo "$TSM_PORT")

        local port_info=""
        [[ -n "$port" ]] && port_info=" :$port"

        local running_status=""
        if tetra_tsm_is_running "$service_name" 2>/dev/null; then
            running_status=" (currently running)"
        fi

        echo "  ✅ $org/$service_name$port_info$running_status"
        ((enabled_count++))
    done

    if [[ $enabled_count -eq 0 ]]; then
        echo "  No services enabled"
        echo "  Use 'tsm enable org/service' to enable services for autostart"
    fi

    echo
    echo "Commands:"
    echo "  tsm services --enabled     - Show enabled services with details"
    echo "  tsm startup                - Start all enabled services now"
    echo "  tsm daemon enable          - Enable boot startup (systemd)"
}

# Start all enabled services from central services-enabled
tetra_tsm_startup() {
    echo "🚀 Starting enabled services..."

    local started_count=0
    local failed_count=0

    [[ -d "$TSM_SERVICES_ENABLED" ]] || {
        echo "No services enabled"
        return 0
    }

    for service_link in "$TSM_SERVICES_ENABLED"/*.tsm; do
        [[ -L "$service_link" ]] || continue

        local link_name=$(basename "$service_link" .tsm)
        local org="${link_name%%-*}"
        local service_name="${link_name#*-}"

        echo "Starting $org/$service_name..."

        if tetra_tsm_start_service "$org/$service_name"; then
            ((started_count++))
        else
            ((failed_count++))
            echo "❌ Failed to start $org/$service_name"
        fi
    done

    echo "✅ Startup complete: $started_count started, $failed_count failed"

    mkdir -p "$TETRA_DIR/tsm"
    echo "$(date): Started $started_count services, $failed_count failed" >> "$TETRA_DIR/tsm/startup.log"
}

export -f tetra_tsm_startup_status
export -f tetra_tsm_startup
