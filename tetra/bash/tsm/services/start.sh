#!/usr/bin/env bash

# TSM Service Start
# Start a service by name from its definition file

# Start a service by name (supports org/service or just service)
tetra_tsm_start_service() {
    local service_ref="$1"
    local _found_org _found_file

    if ! _tsm_find_service "$service_ref" _found_org _found_file; then
        echo "❌ Service not found: $service_ref"
        echo "Available services:"
        tetra_tsm_list_services 2>/dev/null | head -20
        return 1
    fi

    # Guard: TETRA_SRC required for service definitions that reference it
    if [[ -z "$TETRA_SRC" ]]; then
        echo "❌ TETRA_SRC not set. Source tetra.sh first." >&2
        return 1
    fi

    # Load service config in isolated way
    local TSM_NAME TSM_COMMAND TSM_CWD TSM_ENV TSM_PORT TSM_PRE_COMMAND
    local _tsm_decl_output
    _tsm_decl_output=$(
        export TETRA_SRC="$TETRA_SRC"
        export TETRA_DIR="$TETRA_DIR"
        source "$_found_file" 2>&1 && \
        declare -p TSM_NAME TSM_COMMAND TSM_CWD TSM_ENV TSM_PORT TSM_PRE_COMMAND 2>/dev/null
    )

    [[ "$_tsm_decl_output" != *"declare"* ]] && { echo "❌ Failed to load: $_found_file" >&2; return 1; }
    eval "$(echo "$_tsm_decl_output" | sed 's/^declare -x /declare /' | sed 's/^declare -- /declare /')"

    # Resolve CWD
    [[ "$TSM_CWD" == "." || -z "$TSM_CWD" ]] && TSM_CWD="$PWD"

    # Resolve env file (skip if TSM_ENV="none")
    local env_file=""
    if [[ "${TSM_ENV:-local}" != "none" ]]; then
        env_file="$TSM_CWD/env/${TSM_ENV:-local}.env"
        [[ ! -f "$env_file" ]] && { echo "❌ Env file not found: $env_file" >&2; return 1; }
    fi

    # Check if already running
    local process_name="${TSM_NAME}-${TSM_PORT:-auto}"
    if tetra_tsm_is_running "$process_name" 2>/dev/null; then
        echo "⚠️  Already running: $process_name"
        return 0
    fi

    echo "Starting $TSM_NAME on port ${TSM_PORT:-auto}..."

    # DIRECT CALL - no CLI re-invocation
    (
        cd "$TSM_CWD"
        tsm_start_any_command "$TSM_COMMAND" "$env_file" "$TSM_PORT" "$TSM_NAME" "$TSM_PRE_COMMAND"
    )
}

export -f tetra_tsm_start_service
