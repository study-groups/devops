#!/usr/bin/env bash
# TSM Startup - start all enabled services

# Start all enabled services
tsm_startup() {
    echo "Starting enabled services..."

    mkdir -p "$TSM_SERVICES_ENABLED"

    local started=0
    local failed=0

    for link in "$TSM_SERVICES_ENABLED"/*.tsm; do
        [[ -L "$link" ]] || continue

        local name=$(basename "$link" .tsm)
        local svc_file=$(readlink "$link")

        if [[ ! -f "$svc_file" ]]; then
            echo "  [SKIP] $name (missing file)"
            continue
        fi

        # Source service definition
        local TSM_NAME="" TSM_COMMAND="" TSM_PORT="" TSM_ENV="" TSM_CWD=""
        source "$svc_file" 2>/dev/null

        echo "  Starting: $TSM_NAME"

        # Build start command
        local args=("$TSM_COMMAND")
        [[ -n "$TSM_PORT" ]] && args+=(--port "$TSM_PORT")
        [[ -n "$TSM_ENV" ]] && args+=(--env "$TSM_ENV")

        # Run from service CWD
        (
            cd "${TSM_CWD:-$PWD}" 2>/dev/null || true
            tsm_start "${args[@]}" >/dev/null 2>&1
        )

        if [[ $? -eq 0 ]]; then
            echo "    OK"
            ((started++))
        else
            echo "    FAILED"
            ((failed++))
        fi
    done

    echo ""
    echo "Started: $started, Failed: $failed"
}

export -f tsm_startup
