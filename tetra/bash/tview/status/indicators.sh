#!/usr/bin/env bash

# Status Indicators Micro-Module
# Renders consistent status badges and indicators

# Render status badge with appropriate color
render_status_badge() {
    local status="$1"

    case "$status" in
        "healthy"|"valid"|"connected"|"active"|"success"|"ok"|"deployed")
            echo "${STATUS_SUCCESS_COLOR}●${COLOR_RESET} $status"
            ;;
        "warning"|"pending"|"syncing"|"deploying"|"partial")
            echo "${STATUS_WARNING_COLOR}●${COLOR_RESET} $status"
            ;;
        "error"|"failed"|"invalid"|"missing"|"inactive"|"disconnected")
            echo "${STATUS_ERROR_COLOR}●${COLOR_RESET} $status"
            ;;
        "unknown"|"checking"|"loading")
            echo "${UI_MUTED_COLOR}●${COLOR_RESET} $status"
            ;;
        *)
            echo "${UI_ACCENT_COLOR}●${COLOR_RESET} $status"
            ;;
    esac
}

# Render multispan tracking status
render_multispan_status() {
    if [[ ${#ACTIVE_MULTISPANS[@]} -eq 0 ]]; then
        echo "   No active multispans"
        return 1
    fi

    echo "   Active multispans (${#ACTIVE_MULTISPANS[@]}):"

    local output=""
    for span in "${ACTIVE_MULTISPANS[@]}"; do
        local location="${MULTISPAN_LOCATIONS[$span]}"
        local line_range=$(echo "$location" | cut -d: -f2)
        output+="   ${UI_ACCENT_COLOR}▸${COLOR_RESET} $span ${UI_MUTED_COLOR}→ lines $line_range${COLOR_RESET}\n"
    done

    echo -e "$output"
}

# Render connection status indicator
render_connection_status() {
    local env="$1"

    case "$env" in
        "TETRA"|"LOCAL")
            echo "${STATUS_SUCCESS_COLOR}●${COLOR_RESET} local"
            ;;
        "DEV"|"STAGING"|"PROD"|"QA")
            local ssh_status=$(test_ssh_connectivity "$env")
            case "$ssh_status" in
                "connected")
                    echo "${STATUS_SUCCESS_COLOR}●${COLOR_RESET} SSH ready"
                    ;;
                "failed")
                    echo "${STATUS_ERROR_COLOR}●${COLOR_RESET} SSH failed"
                    ;;
                *)
                    echo "${STATUS_WARNING_COLOR}●${COLOR_RESET} no config"
                    ;;
            esac
            ;;
        *)
            echo "${UI_MUTED_COLOR}●${COLOR_RESET} unknown"
            ;;
    esac
}

# Render configuration health status
render_config_health() {
    local status="healthy"

    if [[ ! -f "$ACTIVE_TOML" ]]; then
        status="missing"
    elif [[ ! -r "$ACTIVE_TOML" ]]; then
        status="unreadable"
    elif ! validate_toml_syntax "$ACTIVE_TOML"; then
        status="invalid"
    fi

    render_status_badge "$status"
}

# Render variable tracking health
render_variable_health() {
    local var_count=${#VARIABLE_SOURCE_MAP[@]}

    if [[ $var_count -eq 0 ]]; then
        echo "${STATUS_WARNING_COLOR}●${COLOR_RESET} no tracking"
    elif [[ $var_count -lt 5 ]]; then
        echo "${STATUS_WARNING_COLOR}●${COLOR_RESET} $var_count mapped"
    else
        echo "${STATUS_SUCCESS_COLOR}●${COLOR_RESET} $var_count mapped"
    fi
}

# Render progress indicator
render_progress() {
    local current="$1"
    local total="$2"
    local width="${3:-20}"

    if [[ $total -eq 0 ]]; then
        echo "[no items]"
        return
    fi

    local filled=$((current * width / total))
    local empty=$((width - filled))

    local bar=""
    for ((i=0; i<filled; i++)); do
        bar+="█"
    done
    for ((i=0; i<empty; i++)); do
        bar+="░"
    done

    echo "[$bar] $current/$total"
}

# Render service status summary
render_service_summary() {
    local env="$1"

    local service_status=$(check_service_status "$env")
    local connection_status=$(render_connection_status "$env")

    echo "$connection_status | $(render_status_badge "$service_status")"
}

# Render timestamp with relative time
render_timestamp() {
    local timestamp="$1"

    if [[ -z "$timestamp" ]]; then
        echo "${UI_MUTED_COLOR}never${COLOR_RESET}"
        return
    fi

    # Simple relative time (would be more sophisticated in production)
    echo "${UI_MUTED_COLOR}$timestamp${COLOR_RESET}"
}