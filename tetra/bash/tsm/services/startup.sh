#!/usr/bin/env bash
# TSM Startup - start all enabled services
#
# Usage:
#   tsm startup              # Start current user's enabled services
#   tsm startup --all-users  # (root only) Start all users' enabled services

# Start enabled services for a single user's TETRA_DIR
# Args: $1 = services_enabled_dir, $2 = username (for logging)
# Sets: _STARTUP_STARTED, _STARTUP_FAILED (global counters)
_tsm_startup_user() {
    local services_enabled="$1"
    local username="${2:-$USER}"
    _STARTUP_STARTED=0
    _STARTUP_FAILED=0

    [[ -d "$services_enabled" ]] || return 0

    for link in "$services_enabled"/*.tsm; do
        [[ -L "$link" ]] || continue

        local name=$(basename "$link" .tsm)
        local svc_file=$(readlink "$link")

        if [[ ! -f "$svc_file" ]]; then
            echo "  [SKIP] $username:$name (missing file)"
            continue
        fi

        # Source service definition
        local TSM_NAME="" TSM_COMMAND="" TSM_PORT="" TSM_ENV="" TSM_CWD=""
        source "$svc_file" 2>/dev/null

        local display_name="${TSM_NAME:-$name}"
        echo "  Starting: $username:$display_name"

        # Build start command
        local args=("$TSM_COMMAND")
        [[ -n "$TSM_PORT" ]] && args+=(--port "$TSM_PORT")
        [[ -n "$TSM_ENV" ]] && args+=(--env "$TSM_ENV")
        [[ -n "$TSM_NAME" ]] && args+=(--name "$TSM_NAME")

        # Run as the target user from service CWD
        local start_ok=false
        if [[ "$username" == "$USER" || "$username" == "$(whoami)" ]]; then
            (
                cd "${TSM_CWD:-$PWD}" 2>/dev/null || true
                tsm_start "${args[@]}" >/dev/null 2>&1
            ) && start_ok=true
        elif [[ $EUID -eq 0 ]]; then
            # Root starting another user's service
            sudo -u "$username" bash -c "
                source ~/tetra/tetra.sh
                cd '${TSM_CWD:-$PWD}' 2>/dev/null || true
                tsm_start ${args[*]@Q} >/dev/null 2>&1
            " && start_ok=true
        fi

        if [[ "$start_ok" == true ]]; then
            echo "    OK"
            ((_STARTUP_STARTED++))
        else
            echo "    FAILED"
            ((_STARTUP_FAILED++))
        fi
    done
}

# Start all enabled services
tsm_startup() {
    local all_users=false

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --all-users|-a) all_users=true; shift ;;
            *) shift ;;
        esac
    done

    local total_started=0
    local total_failed=0

    if [[ "$all_users" == true && $EUID -eq 0 ]]; then
        echo "Starting enabled services for all users..."
        echo ""

        # Start services for each user with TSM installation
        while IFS= read -r user_home; do
            local username=$(tsm_extract_username "$user_home")
            local services_enabled="$user_home/tetra/tsm/services-enabled"

            if [[ -d "$services_enabled" ]] && ls "$services_enabled"/*.tsm &>/dev/null; then
                echo "[$username]"
                _tsm_startup_user "$services_enabled" "$username"
                ((total_started += _STARTUP_STARTED))
                ((total_failed += _STARTUP_FAILED))
                echo ""
            fi
        done < <(tsm_discover_user_homes)
    else
        echo "Starting enabled services..."
        mkdir -p "$TSM_SERVICES_ENABLED"

        _tsm_startup_user "$TSM_SERVICES_ENABLED" "$USER"
        total_started=$_STARTUP_STARTED
        total_failed=$_STARTUP_FAILED
    fi

    echo "Total started: $total_started, Failed: $total_failed"
}

export -f _tsm_startup_user tsm_startup
