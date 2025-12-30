#!/usr/bin/env bash
# TSM Services - save/enable/disable/list service definitions
#
# Services are stored in the org-based structure:
#   available: $TETRA_DIR/orgs/tetra/tsm/services-available/
#   enabled:   $TETRA_DIR/orgs/tetra/tsm/services-enabled/

TSM_SERVICES_AVAILABLE="${TETRA_DIR}/orgs/tetra/tsm/services-available"
TSM_SERVICES_ENABLED="${TETRA_DIR}/orgs/tetra/tsm/services-enabled"

# List available services
tsm_services() {
    local show_all="${1:-}"

    echo "Services:"
    echo ""

    mkdir -p "$TSM_SERVICES_AVAILABLE" "$TSM_SERVICES_ENABLED"

    # List available services
    local count=0
    for f in "$TSM_SERVICES_AVAILABLE"/*.tsm; do
        [[ -f "$f" ]] || continue
        local name=$(basename "$f" .tsm)
        local enabled=" "

        # Check if enabled
        if [[ -L "$TSM_SERVICES_ENABLED/${name}.tsm" ]]; then
            enabled="*"
        fi

        # Read service info
        local cmd="" port=""
        source "$f" 2>/dev/null
        cmd="${TSM_COMMAND:-}"
        port="${TSM_PORT:-}"

        printf " %s %-20s  port:%-5s  %s\n" "$enabled" "$name" "${port:-auto}" "${cmd:0:40}"
        ((count++))
    done

    if [[ $count -eq 0 ]]; then
        echo "  (no services defined)"
        echo ""
        echo "Save a service with: tsm save <name> <command> [--port N]"
    fi

    echo ""
    echo "* = enabled (starts with: tsm startup)"
}

# Save a service definition
# Usage: tsm save <name> <command> [--port N] [--env FILE]
tsm_save() {
    local name=""
    local command=""
    local port=""
    local env_file=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --port|-p) port="$2"; shift 2 ;;
            --env|-e)  env_file="$2"; shift 2 ;;
            *)
                if [[ -z "$name" ]]; then
                    name="$1"
                elif [[ -z "$command" ]]; then
                    command="$1"
                else
                    command="$command $1"
                fi
                shift
                ;;
        esac
    done

    [[ -z "$name" ]] && { tsm_error "name required"; return 1; }
    [[ -z "$command" ]] && { tsm_error "command required"; return 1; }

    mkdir -p "$TSM_SERVICES_AVAILABLE"

    local svc_file="$TSM_SERVICES_AVAILABLE/${name}.tsm"

    # Write service definition
    cat > "$svc_file" <<EOF
# TSM Service: $name
# Created: $(date)
TSM_NAME="$name"
TSM_COMMAND="$command"
TSM_PORT="${port:-}"
TSM_ENV="${env_file:-}"
TSM_CWD="$PWD"
EOF

    echo "Saved service: $name"
    echo "  Command: $command"
    [[ -n "$port" ]] && echo "  Port:    $port"
    [[ -n "$env_file" ]] && echo "  Env:     $env_file"
    echo ""
    echo "Enable with: tsm enable $name"
}

# Remove a service definition
tsm_rm() {
    local name="$1"
    [[ -z "$name" ]] && { tsm_error "name required"; return 1; }

    local svc_file="$TSM_SERVICES_AVAILABLE/${name}.tsm"
    local enabled_link="$TSM_SERVICES_ENABLED/${name}.tsm"

    if [[ ! -f "$svc_file" ]]; then
        tsm_error "service '$name' not found"
        return 1
    fi

    # Disable first if enabled
    [[ -L "$enabled_link" ]] && rm "$enabled_link"

    rm "$svc_file"
    echo "Removed service: $name"
}

# Enable a service
tsm_enable() {
    local name="$1"
    [[ -z "$name" ]] && { tsm_error "name required"; return 1; }

    local svc_file="$TSM_SERVICES_AVAILABLE/${name}.tsm"
    if [[ ! -f "$svc_file" ]]; then
        tsm_error "service '$name' not found"
        return 1
    fi

    mkdir -p "$TSM_SERVICES_ENABLED"
    local enabled_link="$TSM_SERVICES_ENABLED/${name}.tsm"

    if [[ -L "$enabled_link" ]]; then
        echo "Already enabled: $name"
        return 0
    fi

    ln -s "$svc_file" "$enabled_link"
    echo "Enabled: $name"
    echo "Will start with: tsm startup"
}

# Disable a service
tsm_disable() {
    local name="$1"
    [[ -z "$name" ]] && { tsm_error "name required"; return 1; }

    local enabled_link="$TSM_SERVICES_ENABLED/${name}.tsm"

    if [[ ! -L "$enabled_link" ]]; then
        echo "Not enabled: $name"
        return 0
    fi

    rm "$enabled_link"
    echo "Disabled: $name"
}

# Show service details
tsm_show() {
    local name="$1"
    [[ -z "$name" ]] && { tsm_error "name required"; return 1; }

    local svc_file="$TSM_SERVICES_AVAILABLE/${name}.tsm"
    if [[ ! -f "$svc_file" ]]; then
        tsm_error "service '$name' not found"
        return 1
    fi

    # Source and display
    local TSM_NAME="" TSM_COMMAND="" TSM_PORT="" TSM_ENV="" TSM_CWD=""
    source "$svc_file"

    echo "Service: $TSM_NAME"
    echo "  Command: $TSM_COMMAND"
    echo "  Port:    ${TSM_PORT:-auto}"
    echo "  Env:     ${TSM_ENV:-none}"
    echo "  CWD:     ${TSM_CWD:-$PWD}"

    local enabled_link="$TSM_SERVICES_ENABLED/${name}.tsm"
    if [[ -L "$enabled_link" ]]; then
        echo "  Enabled: yes"
    else
        echo "  Enabled: no"
    fi
}

# Add a project-local .tsm file to services-available
# Usage: tsm add <path/to/service.tsm>
# Creates symlink: services-available/<name>.tsm -> <path/to/service.tsm>
tsm_add() {
    local tsm_path="$1"
    [[ -z "$tsm_path" ]] && { tsm_error "path to .tsm file required"; return 1; }

    # Resolve to absolute path
    if [[ "$tsm_path" != /* ]]; then
        tsm_path="$PWD/$tsm_path"
    fi

    if [[ ! -f "$tsm_path" ]]; then
        tsm_error "file not found: $tsm_path"
        return 1
    fi

    if [[ "$tsm_path" != *.tsm ]]; then
        tsm_error "file must have .tsm extension"
        return 1
    fi

    local name=$(basename "$tsm_path" .tsm)
    local link_path="$TSM_SERVICES_AVAILABLE/${name}.tsm"

    mkdir -p "$TSM_SERVICES_AVAILABLE"

    # Check if already exists
    if [[ -e "$link_path" ]]; then
        if [[ -L "$link_path" ]]; then
            local existing=$(readlink "$link_path")
            if [[ "$existing" == "$tsm_path" ]]; then
                echo "Already added: $name -> $tsm_path"
                return 0
            fi
            echo "Updating link: $name"
            rm "$link_path"
        else
            tsm_error "non-symlink file exists: $link_path"
            return 1
        fi
    fi

    ln -s "$tsm_path" "$link_path"
    echo "Added: $name -> $tsm_path"
    echo "Start with: tsm start $name"
}

export -f tsm_services tsm_save tsm_rm tsm_enable tsm_disable tsm_show tsm_add
