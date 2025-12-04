#!/usr/bin/env bash

# TSM Module Index - Defines metadata and completions for TSM

# Register TSM module metadata
tetra_register_module_meta "tsm" \
    "Tetra Service Manager - native process management with PORT naming and service definitions" \
    "tsm" \
    "tsm:setup|start|stop|delete|restart|list|info|logs|env|paths|scan-ports|webserver|ncserver|repl|services|save|enable|disable|show|startup" \
    "core" "stable"

# Helper: Get available service names from services-available/*.tsm
_tsm_get_available_services() {
    local services_dir="${TETRA_DIR:-$HOME/tetra}/tsm/services-available"
    [[ -d "$services_dir" ]] || return
    for f in "$services_dir"/*.tsm; do
        [[ -f "$f" ]] && basename "$f" .tsm
    done
}

# Helper: Get running process names from processes directory
_tsm_get_running_processes() {
    local processes_dir="${TETRA_DIR:-$HOME/tetra}/tsm/processes"
    [[ -d "$processes_dir" ]] || return
    for d in "$processes_dir"/*/; do
        [[ -d "$d" ]] && basename "$d"
    done
}

# TSM-specific tab completion
_tsm_completion() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"
    local cmd="${COMP_WORDS[1]}"

    # Top-level commands
    local commands="setup init start stop delete del kill restart list ls services save enable disable rm show edit startup info logs env paths scan-ports ports doctor daemon repl patrol ranges runtime patterns monitor stream dashboard help"

    case "$cmd" in
        start)
            # tsm start <tab> -> list available services + options
            if [[ "$cur" == -* ]]; then
                COMPREPLY=($(compgen -W "--env --port --name --pre-hook" -- "$cur"))
            elif [[ "$prev" == "--env" ]]; then
                # Complete with env files in ./env/ or *.env
                COMPREPLY=($(compgen -f -X "!*.env" -- "$cur"))
            elif [[ "$prev" == "--port" ]]; then
                COMPREPLY=($(compgen -W "3000 4000 5000 8000 8080 9000" -- "$cur"))
            elif [[ "$prev" == "--name" || "$prev" == "--pre-hook" ]]; then
                # Free text - no completion
                COMPREPLY=()
            else
                # Complete with available services
                local services=$(_tsm_get_available_services)
                COMPREPLY=($(compgen -W "$services" -- "$cur"))
            fi
            ;;
        stop|delete|del|kill|restart|info|env|paths)
            # Complete with running process names + wildcard
            local processes=$(_tsm_get_running_processes)
            COMPREPLY=($(compgen -W "$processes *" -- "$cur"))
            ;;
        logs)
            if [[ "$cur" == -* ]]; then
                COMPREPLY=($(compgen -W "-f --follow" -- "$cur"))
            else
                local processes=$(_tsm_get_running_processes)
                COMPREPLY=($(compgen -W "$processes *" -- "$cur"))
            fi
            ;;
        enable|disable|show|edit|rm)
            # Complete with available service names
            local services=$(_tsm_get_available_services)
            COMPREPLY=($(compgen -W "$services" -- "$cur"))
            ;;
        save)
            if [[ "$COMP_CWORD" -eq 2 ]]; then
                # First arg: running process name/ID or new service name
                local processes=$(_tsm_get_running_processes)
                COMPREPLY=($(compgen -W "$processes" -- "$cur"))
            fi
            ;;
        list|ls)
            COMPREPLY=($(compgen -W "running available all pwd -l --long help" -- "$cur"))
            ;;
        services)
            COMPREPLY=($(compgen -W "-d --detail --enabled --disabled --available" -- "$cur"))
            ;;
        ports)
            COMPREPLY=($(compgen -W "list detailed scan overview status validate set remove allocate import export conflicts env json" -- "$cur"))
            ;;
        doctor)
            COMPREPLY=($(compgen -W "healthcheck scan port kill env" -- "$cur"))
            ;;
        daemon)
            COMPREPLY=($(compgen -W "install enable start stop status logs help" -- "$cur"))
            ;;
        startup)
            COMPREPLY=($(compgen -W "status" -- "$cur"))
            ;;
        help)
            COMPREPLY=($(compgen -W "all start stop list services ports pre-hooks python" -- "$cur"))
            ;;
        *)
            # Top-level command completion
            COMPREPLY=($(compgen -W "$commands" -- "$cur"))
            ;;
    esac
}

# Register TSM completion
complete -F _tsm_completion tsm
