#!/usr/bin/env bash

# Status Providers Micro-Module
# Provides real-time status information

# Get comprehensive status summary
get_status_summary() {
    local mode="${1:-$CURRENT_MODE}"
    local env="${2:-$CURRENT_ENV}"

    case "${mode}_${env}" in
        "TOML_TETRA")
            echo "$(render_config_health) | $(render_variable_health) | ${#ACTIVE_MULTISPANS[@]} sections"
            ;;
        "TOML_"*)
            echo "$(render_connection_status "$env") | $(get_deployment_status "$env")"
            ;;
        "TSM_"*)
            echo "$(render_service_summary "$env")"
            ;;
        *)
            echo "$(render_status_badge "ready")"
            ;;
    esac
}

# Get detailed status information
get_detailed_status() {
    local mode="${1:-$CURRENT_MODE}"
    local env="${2:-$CURRENT_ENV}"

    cat << EOF
Mode: $mode
Environment: $env
Status: $(get_status_summary "$mode" "$env")
Updated: $(date '+%H:%M:%S')
EOF
}

# Check if status needs refresh
needs_status_refresh() {
    # Simple time-based refresh (could be more sophisticated)
    local last_update="${LAST_STATUS_UPDATE:-0}"
    local current_time=$(date +%s)
    local refresh_interval=30  # 30 seconds

    [[ $((current_time - last_update)) -gt $refresh_interval ]]
}

# Update status cache
update_status_cache() {
    LAST_STATUS_UPDATE=$(date +%s)

    # Refresh core data
    detect_active_toml
    refresh_multispan_tracking
    refresh_variable_tracking
}

# Get quick status for header display
get_header_status() {
    echo "$(get_status_summary) | $(date '+%H:%M')"
}