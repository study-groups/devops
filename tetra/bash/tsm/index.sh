#!/usr/bin/env bash

# TSM Module Index - Defines metadata and completions for TSM

# Register TSM module metadata (if registry available)
if declare -f tetra_register_module_meta >/dev/null 2>&1; then
    tetra_register_module_meta "tsm" \
        "Tetra Service Manager - native process management with PORT naming and service definitions" \
        "tsm" \
        "tsm:setup|start|stop|delete|restart|list|info|logs|env|paths|scan-ports|webserver|ncserver|repl|services|orgs|save|enable|disable|show|startup" \
        "core" "stable"
fi

# Generate org/service completions like filesystem paths
# Usage: _tsm_complete_services "cur"
# Completes: org/ -> org/service, service (from any org)
_tsm_complete_services() {
    local cur="$1"
    local completions=()

    if [[ "$cur" == */* ]]; then
        # User typed org/ - complete with services from that org
        local org="${cur%%/*}"
        local partial="${cur#*/}"
        local services_dir="$TETRA_DIR/orgs/$org/tsm/services-available"

        if [[ -d "$services_dir" ]]; then
            local svc
            for svc in "$services_dir"/*.tsm; do
                [[ -f "$svc" ]] || continue
                local name=$(basename "$svc" .tsm)
                if [[ "$name" == "$partial"* ]]; then
                    completions+=("$org/$name")
                fi
            done
        fi
    else
        # No slash yet - offer orgs (with trailing /) and all services
        # First, add org names with trailing slash
        local org_dir
        for org_dir in "$TETRA_DIR/orgs"/*/tsm; do
            [[ -d "$org_dir" ]] || continue
            local org=$(basename "$(dirname "$org_dir")")
            if [[ "$org" == "$cur"* ]]; then
                completions+=("$org/")
            fi
        done

        # Also add all services as org/service for direct matching
        for org_dir in "$TETRA_DIR/orgs"/*/tsm/services-available; do
            [[ -d "$org_dir" ]] || continue
            local org=$(basename "$(dirname "$(dirname "$org_dir")")")
            local svc
            for svc in "$org_dir"/*.tsm; do
                [[ -f "$svc" ]] || continue
                local name=$(basename "$svc" .tsm)
                # Match if service name starts with cur
                if [[ "$name" == "$cur"* ]]; then
                    completions+=("$org/$name")
                fi
            done
        done
    fi

    echo "${completions[*]}"
}

# TSM-specific tab completion
_tsm_completion() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"
    local cmd="${COMP_WORDS[1]}"

    # Disable default space after completion for org/ prefixes
    compopt -o nospace 2>/dev/null

    case "$cmd" in
        start)
            case "$COMP_CWORD" in
                2)
                    # Offer services (org/service format) plus other start options
                    local services=$(_tsm_complete_services "$cur")
                    COMPREPLY=($(compgen -W "$services webserver ncserver --env" -- "$cur"))
                    # Add space back for non-slash completions
                    [[ ${#COMPREPLY[@]} -eq 1 && "${COMPREPLY[0]}" != */ ]] && compopt +o nospace
                    ;;
                3)
                    if [[ "$prev" == "--env" ]]; then
                        compopt +o nospace
                        COMPREPLY=($(compgen -f -X "!*.sh" -- "$cur"))
                    elif [[ "$prev" == "webserver" || "$prev" == "ncserver" ]]; then
                        compopt +o nospace
                        COMPREPLY=($(compgen -W "3000 8000 8080 9000" -- "$cur"))
                    else
                        compopt +o nospace
                        COMPREPLY=($(compgen -f -X "!*.sh" -- "$cur"))
                    fi
                    ;;
                4)
                    compopt +o nospace
                    if [[ "${COMP_WORDS[2]}" != "--env" ]]; then
                        COMPREPLY=($(compgen -W "custom-name" -- "$cur"))
                    fi
                    ;;
            esac
            ;;
        stop|delete|restart|info|env|paths)
            compopt +o nospace
            # Complete with running process names and TSM IDs
            local processes=$(tsm list 2>/dev/null | grep -E "^\s*[0-9]+" | awk '{print $2}' 2>/dev/null || echo "")
            COMPREPLY=($(compgen -W "$processes *" -- "$cur"))
            ;;
        enable|disable|show)
            # Complete with org/service format
            local services=$(_tsm_complete_services "$cur")
            COMPREPLY=($(compgen -W "$services" -- "$cur"))
            # Add space back for full service names (not org/ prefixes)
            [[ ${#COMPREPLY[@]} -eq 1 && "${COMPREPLY[0]}" != */ ]] && compopt +o nospace
            ;;
        save)
            compopt +o nospace
            if [[ "$COMP_CWORD" -eq 2 ]]; then
                # First argument: TSM ID or process name, or org/new-service-name
                local processes=$(tsm list 2>/dev/null | grep -E "^\s*[0-9]+" | awk '{print $1 " " $2}' 2>/dev/null || echo "")
                # Also offer org/ prefixes for saving to specific org
                local orgs=""
                for org_dir in "$TETRA_DIR/orgs"/*/tsm; do
                    [[ -d "$org_dir" ]] || continue
                    local org=$(basename "$(dirname "$org_dir")")
                    orgs+="$org/ "
                done
                COMPREPLY=($(compgen -W "$processes $orgs" -- "$cur"))
            fi
            ;;
        logs)
            compopt +o nospace
            if [[ "$cur" == "-"* ]]; then
                COMPREPLY=($(compgen -W "-f" -- "$cur"))
            else
                local processes=$(tsm list 2>/dev/null | grep -E "^\s*[0-9]+" | awk '{print $2}' 2>/dev/null || echo "")
                COMPREPLY=($(compgen -W "$processes *" -- "$cur"))
            fi
            ;;
        services)
            compopt +o nospace
            COMPREPLY=($(compgen -W "--enabled --disabled --available -d --detail" -- "$cur"))
            ;;
        *)
            compopt +o nospace
            COMPREPLY=($(compgen -W "setup start stop delete restart list info logs env paths scan-ports webserver ncserver repl services orgs save enable disable show startup" -- "$cur"))
            ;;
    esac
}

# Register TSM completion
complete -F _tsm_completion tsm
