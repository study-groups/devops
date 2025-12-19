#!/usr/bin/env bash

# TSM Module Index - Defines metadata and completions for TSM

# Register TSM module metadata (if registry available)
if declare -f tetra_register_module_meta >/dev/null 2>&1; then
    tetra_register_module_meta "tsm" \
        "Tetra Service Manager - native process management with PORT naming and service definitions" \
        "tsm" \
        "tsm:setup|start|stop|delete|restart|list|info|logs|env|paths|scan-ports|ports|claim|doctor|daemon|repl|services|orgs|save|enable|disable|show|startup|help" \
        "core" "stable"
fi

# Get ports currently in use (for completion)
# Returns space-separated list of TCP and UDP ports
_tsm_get_used_ports() {
    local tcp_ports udp_ports
    tcp_ports=$(lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null | awk 'NR>1 {print $9}' | sed 's/.*://g' | sort -nu | head -20)
    udp_ports=$(lsof -iUDP -P -n 2>/dev/null | awk 'NR>1 {print $9}' | sed 's/.*://g' | sort -nu | head -20)
    echo "$tcp_ports $udp_ports" | tr ' ' '\n' | sort -nu | tr '\n' ' '
}

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

    # Default: add space after completion (most common case)
    # Only disable for org/ path-style completions that need trailing slash
    case "$cmd" in
        start)
            case "$COMP_CWORD" in
                2)
                    # Offer services (org/service format) plus other start options
                    local services=$(_tsm_complete_services "$cur")
                    COMPREPLY=($(compgen -W "$services webserver ncserver --env" -- "$cur"))
                    # Disable space for org/ prefixes (need trailing slash)
                    [[ ${#COMPREPLY[@]} -eq 1 && "${COMPREPLY[0]}" == */ ]] && compopt -o nospace
                    ;;
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
        stop|delete|restart|info|env|paths)
            # Complete with running process names and TSM IDs
            local processes=$(tsm list 2>/dev/null | grep -E "^\s*[0-9]+" | awk '{print $2}' 2>/dev/null || echo "")
            COMPREPLY=($(compgen -W "$processes *" -- "$cur"))
            ;;
        enable|disable|show)
            # Complete with org/service format
            local services=$(_tsm_complete_services "$cur")
            COMPREPLY=($(compgen -W "$services" -- "$cur"))
            # Disable space for org/ prefixes
            [[ ${#COMPREPLY[@]} -eq 1 && "${COMPREPLY[0]}" == */ ]] && compopt -o nospace
            ;;
        save)
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
                # Disable space for org/ prefixes
                [[ ${#COMPREPLY[@]} -eq 1 && "${COMPREPLY[0]}" == */ ]] && compopt -o nospace
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
        services)
            COMPREPLY=($(compgen -W "--enabled --disabled --available -d --detail" -- "$cur"))
            ;;
        claim)
            if [[ "$cur" == "-"* ]]; then
                COMPREPLY=($(compgen -W "-f --force" -- "$cur"))
            else
                COMPREPLY=($(compgen -W "$(_tsm_get_used_ports)" -- "$cur"))
            fi
            ;;
        doctor)
            if [[ "$COMP_CWORD" -eq 2 ]]; then
                COMPREPLY=($(compgen -W "healthcheck health files runtime scan ports port kill env orphans clean validate reconcile ports-declared ports-actual help --no-ignore --show-ignored -A --all" -- "$cur"))
            elif [[ "$prev" == "port" || "$prev" == "kill" ]]; then
                COMPREPLY=($(compgen -W "$(_tsm_get_used_ports)" -- "$cur"))
            elif [[ "$prev" == "clean" ]]; then
                COMPREPLY=($(compgen -W "-a --aggressive" -- "$cur"))
            elif [[ "$prev" == "orphans" || "$prev" == "validate" ]]; then
                COMPREPLY=($(compgen -W "--json" -- "$cur"))
            fi
            ;;
        ports)
            COMPREPLY=($(compgen -W "list detailed scan overview status validate set remove allocate import export conflicts env json" -- "$cur"))
            ;;
        list|ls)
            COMPREPLY=($(compgen -W "running available all pwd -l --long -a --all -av help" -- "$cur"))
            ;;
        daemon)
            COMPREPLY=($(compgen -W "install enable start stop status logs disable uninstall help" -- "$cur"))
            ;;
        monitor|stream)
            # Complete with running process names
            local processes=$(tsm list 2>/dev/null | grep -E "^\s*[0-9]+" | awk '{print $2}' 2>/dev/null || echo "")
            COMPREPLY=($(compgen -W "$processes" -- "$cur"))
            ;;
        cleanup|kill)
            # Complete with running process names and TSM IDs
            local processes=$(tsm list 2>/dev/null | grep -E "^\s*[0-9]+" | awk '{print $2}' 2>/dev/null || echo "")
            COMPREPLY=($(compgen -W "$processes * --force -f" -- "$cur"))
            ;;
        runtime)
            COMPREPLY=($(compgen -W "node python ruby go rust java" -- "$cur"))
            ;;
        help)
            COMPREPLY=($(compgen -W "all --no-color start stop list doctor ports services color" -- "$cur"))
            ;;
        color|colors)
            COMPREPLY=($(compgen -W "show edit init reset path get help" -- "$cur"))
            ;;
        *)
            COMPREPLY=($(compgen -W "setup init start stop delete kill cleanup restart list info logs env paths scan-ports ports claim ranges patrol doctor daemon repl monitor stream dashboard analytics sessions clicks journey user-patterns disambiguate-users runtime services orgs patterns save enable disable rm show startup users color help" -- "$cur"))
            ;;
    esac
}

# Register TSM completion
complete -F _tsm_completion tsm
