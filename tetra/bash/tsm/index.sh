#!/usr/bin/env bash

# TSM Module Index - Defines metadata and completions for TSM

# Register TSM module metadata
tetra_register_module_meta "tsm" \
    "Tetra Service Manager - native process management with PORT naming and service definitions" \
    "tsm" \
    "tsm:setup|start|stop|delete|restart|list|info|logs|env|paths|scan-ports|webserver|ncserver|repl|services|save|enable|disable|show|startup" \
    "core" "stable"

# TSM-specific tab completion
_tsm_completion() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"
    local cmd="${COMP_WORDS[1]}"
    
    case "$cmd" in
        start)
            case "$COMP_CWORD" in
                2) COMPREPLY=($(compgen -W "webserver ncserver --env" -- "$cur")) ;;
                3) 
                    if [[ "$prev" == "--env" ]]; then
                        COMPREPLY=($(compgen -f -X "!*.sh" -- "$cur"))
                    elif [[ "$prev" == "webserver" || "$prev" == "ncserver" ]]; then
                        COMPREPLY=($(compgen -W "3000 8000 8080 9000" -- "$cur"))
                    else
                        COMPREPLY=($(compgen -f -X "!*.sh" -- "$cur"))
                    fi
                    ;;
                4)
                    if [[ "${COMP_WORDS[2]}" != "--env" ]]; then
                        COMPREPLY=($(compgen -W "custom-name" -- "$cur"))
                    fi
                    ;;
            esac
            ;;
        stop|delete|restart|info|logs|env|paths)
            # Complete with running process names and TSM IDs
            local processes=$(tsm list 2>/dev/null | grep -E "^\s*[0-9]+" | awk '{print $2}' 2>/dev/null || echo "")
            COMPREPLY=($(compgen -W "$processes *" -- "$cur"))
            ;;
        enable|disable|show)
            # Complete with service names
            local services=$(ls "$TETRA_DIR/tsm/services-available/"*.tsm 2>/dev/null | xargs -n1 basename | sed 's/\.tsm$//' || echo "")
            COMPREPLY=($(compgen -W "$services" -- "$cur"))
            ;;
        save)
            if [[ "$COMP_CWORD" -eq 2 ]]; then
                # First argument: TSM ID or process name, or new service name
                local processes=$(tsm list 2>/dev/null | grep -E "^\s*[0-9]+" | awk '{print $1 " " $2}' 2>/dev/null || echo "")
                COMPREPLY=($(compgen -W "$processes" -- "$cur"))
            fi
            ;;
        logs)
            if [[ "$cur" == "-"* ]]; then
                COMPREPLY=($(compgen -W "-f" -- "$cur"))
            else
                local processes=$(tsm list 2>/dev/null | grep -E "^\s*[0-9]+" | awk '{print $2}' 2>/dev/null || echo "")
                COMPREPLY=($(compgen -W "$processes *" -- "$cur"))
            fi
            ;;
        *)
            COMPREPLY=($(compgen -W "setup start stop delete restart list info logs env paths scan-ports webserver ncserver repl services save enable disable show startup" -- "$cur"))
            ;;
    esac
}

# Register TSM completion
complete -F _tsm_completion tsm
