#!/usr/bin/env bash

# TSM Service Start
# Start a service by name from its definition file

# Start a LOCAL .tsm file (from current directory)
# Usage: tetra_tsm_start_local <file.tsm>
# Required in .tsm file: TSM_PORT, TSM_COMMAND
# Defaults: TSM_CWD=".", TSM_ENV="none"
tetra_tsm_start_local() {
    local tsm_file="$1"

    # Resolve to absolute path
    if [[ "$tsm_file" != /* ]]; then
        tsm_file="$PWD/$tsm_file"
    fi

    if [[ ! -f "$tsm_file" ]]; then
        echo "❌ File not found: $tsm_file" >&2
        return 1
    fi

    # Load service config
    local TSM_NAME TSM_COMMAND TSM_CWD TSM_ENV TSM_PORT TSM_PRE_COMMAND TSM_PORTS TSM_SECONDARY_PORTS
    local _tsm_decl_output
    _tsm_decl_output=$(
        export TETRA_SRC="$TETRA_SRC"
        export TETRA_DIR="$TETRA_DIR"
        source "$tsm_file" 2>&1 && \
        declare -p TSM_NAME TSM_COMMAND TSM_CWD TSM_ENV TSM_PORT TSM_PRE_COMMAND TSM_PORTS TSM_SECONDARY_PORTS 2>/dev/null
    )

    [[ "$_tsm_decl_output" != *"declare"* ]] && { echo "❌ Failed to load: $tsm_file" >&2; return 1; }
    eval "$(echo "$_tsm_decl_output" | sed 's/^declare -x /declare /' | sed 's/^declare -- /declare /')"

    # REQUIRED: TSM_PORT must be set for local .tsm files
    if [[ -z "$TSM_PORT" ]]; then
        echo "❌ TSM_PORT required in local .tsm file" >&2
        echo "   Add: TSM_PORT=\"8000\"" >&2
        return 1
    fi

    # REQUIRED: TSM_COMMAND must be set
    if [[ -z "$TSM_COMMAND" ]]; then
        echo "❌ TSM_COMMAND required in local .tsm file" >&2
        return 1
    fi

    # DEFAULTS for local .tsm files
    TSM_CWD="${TSM_CWD:-.}"
    TSM_ENV="${TSM_ENV:-none}"

    # Resolve CWD relative to .tsm file location
    local tsm_dir=$(dirname "$tsm_file")
    if [[ "$TSM_CWD" == "." ]]; then
        TSM_CWD="$tsm_dir"
    elif [[ "$TSM_CWD" != /* ]]; then
        TSM_CWD="$tsm_dir/$TSM_CWD"
    fi

    # Generate name from filename if not set
    if [[ -z "$TSM_NAME" ]]; then
        TSM_NAME=$(basename "$tsm_file" .tsm)
    fi

    # No env file for local .tsm (TSM_ENV defaults to "none")
    local env_file=""

    # Check if already running
    local process_name="${TSM_NAME}-${TSM_PORT}"
    if tetra_tsm_is_running "$process_name" 2>/dev/null; then
        echo "⚠️  Already running: $process_name"
        return 0
    fi

    echo "🚀 Starting local: $TSM_NAME on port $TSM_PORT"

    # Start the service
    (
        cd "$TSM_CWD"
        tsm_start_any_command "$TSM_COMMAND" "$env_file" "$TSM_PORT" "$TSM_NAME" "$TSM_PRE_COMMAND"
    )
    return $?
}

export -f tetra_tsm_start_local

# Start a service by name (supports org/service or just service)
# Usage: tetra_tsm_start_service <service> [directory]
tetra_tsm_start_service() {
    local service_ref="$1"
    local dir_override="$2"  # Optional directory override
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
    # TSM_PORTS format: "port:type:protocol:relation:group,..." (new extended format)
    # TSM_SECONDARY_PORTS format: "port:type:protocol,..." (legacy simple format)
    # TDP fields: TSM_COUPLING_MODE, TSM_TDP_TOPIC, TSM_ADAPTER_TYPE
    local TSM_NAME TSM_COMMAND TSM_CWD TSM_ENV TSM_PORT TSM_PRE_COMMAND TSM_PORTS TSM_SECONDARY_PORTS
    local TSM_COUPLING_MODE TSM_TDP_TOPIC TSM_ADAPTER_TYPE
    local _tsm_decl_output
    _tsm_decl_output=$(
        export TETRA_SRC="$TETRA_SRC"
        export TETRA_DIR="$TETRA_DIR"
        source "$_found_file" 2>&1 && \
        declare -p TSM_NAME TSM_COMMAND TSM_CWD TSM_ENV TSM_PORT TSM_PRE_COMMAND TSM_PORTS TSM_SECONDARY_PORTS \
                   TSM_COUPLING_MODE TSM_TDP_TOPIC TSM_ADAPTER_TYPE 2>/dev/null
    )

    [[ "$_tsm_decl_output" != *"declare"* ]] && { echo "❌ Failed to load: $_found_file" >&2; return 1; }
    eval "$(echo "$_tsm_decl_output" | sed 's/^declare -x /declare /' | sed 's/^declare -- /declare /')"

    # Resolve CWD - directory override takes priority
    if [[ -n "$dir_override" ]]; then
        # Expand ~ and resolve to absolute path
        dir_override="${dir_override/#\~/$HOME}"
        [[ -d "$dir_override" ]] || { echo "❌ Directory not found: $dir_override" >&2; return 1; }
        TSM_CWD="$dir_override"
    elif [[ "$TSM_CWD" == "." || -z "$TSM_CWD" ]]; then
        TSM_CWD="$PWD"
    fi

    # For generic services (http, etc.), prepend directory name
    local dir_name=$(basename "$TSM_CWD")
    if [[ "$TSM_NAME" == "http" || "$TSM_NAME" == "serve" ]]; then
        TSM_NAME="${dir_name}-${TSM_NAME}"
    fi

    # Resolve env file (skip if TSM_ENV="none")
    local env_file=""
    if [[ "${TSM_ENV:-local}" != "none" ]]; then
        env_file="$TSM_CWD/env/${TSM_ENV:-local}.env"
        [[ ! -f "$env_file" ]] && { echo "❌ Env file not found: $env_file" >&2; return 1; }
    fi

    # Auto-increment port if busy (only for ports in managed range 8000-8999)
    local original_port="$TSM_PORT"
    if [[ -n "$TSM_PORT" ]] && ! tsm_port_available "$TSM_PORT"; then
        if [[ $TSM_PORT -ge 8000 && $TSM_PORT -le 8999 ]]; then
            local new_port
            new_port=$(tsm_allocate_port_from "$TSM_PORT")
            if [[ -n "$new_port" ]]; then
                echo "⚠️  Port $TSM_PORT in use, using port $new_port instead"
                # Rewrite command to use new port
                TSM_COMMAND="${TSM_COMMAND//$original_port/$new_port}"
                TSM_PORT="$new_port"
            else
                echo "❌ No available ports in range" >&2
                return 1
            fi
        fi
        # Ports outside managed range: use as-is (user's responsibility)
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
    local start_status=$?

    # Update TDP metadata and register ports if defined
    if [[ $start_status -eq 0 ]]; then
        sleep 0.5

        # Update TDP fields in metadata
        if [[ -n "$TSM_COUPLING_MODE" ]]; then
            tsm_update_metadata "$process_name" "coupling_mode" "$TSM_COUPLING_MODE" 2>/dev/null
        fi
        if [[ -n "$TSM_TDP_TOPIC" ]]; then
            tsm_update_metadata "$process_name" "tdp_topic" "$TSM_TDP_TOPIC" 2>/dev/null
        fi
        if [[ -n "$TSM_ADAPTER_TYPE" ]]; then
            tsm_update_metadata "$process_name" "adapter_type" "$TSM_ADAPTER_TYPE" 2>/dev/null
        fi

        # TSM_PORTS format (new): "port:type:protocol:relation:group,..."
        # Example: "1986:udp:osc:bind,1983:udp:osc-in:multicast-join:239.1.1.1"
        if [[ -n "$TSM_PORTS" ]]; then
            local IFS=','
            for port_spec in $TSM_PORTS; do
                local port type protocol relation group
                IFS=':' read -r port type protocol relation group <<< "$port_spec"
                [[ -z "$port" ]] && continue
                type="${type:-tcp}"
                protocol="${protocol:-secondary}"
                relation="${relation:-bind}"
                tsm_add_port "$process_name" "$port" "$type" "$protocol" "$relation" "$group" 2>/dev/null
            done
        fi

        # TSM_SECONDARY_PORTS format (legacy): "port:type:protocol,..."
        # Example: "1986:udp:osc"
        if [[ -n "$TSM_SECONDARY_PORTS" ]]; then
            local IFS=','
            for port_spec in $TSM_SECONDARY_PORTS; do
                local port type protocol
                IFS=':' read -r port type protocol <<< "$port_spec"
                [[ -z "$port" ]] && continue
                type="${type:-tcp}"
                protocol="${protocol:-secondary}"
                tsm_add_port "$process_name" "$port" "$type" "$protocol" "bind" "" 2>/dev/null
            done
        fi
    fi

    return $start_status
}

export -f tetra_tsm_start_service
