#!/usr/bin/env bash
# TSM Tab Completion

_TSM_COMMANDS="start stop restart kill delete list ls info logs describe save add enable disable startup doctor caddy stack build cleanup setup users help"

# Get running process names
_tsm_running_names() {
    [[ -d "$TSM_PROCESSES_DIR" ]] || return
    for dir in "$TSM_PROCESSES_DIR"/*/; do
        [[ -d "$dir" ]] || continue
        local name=$(basename "$dir")
        [[ "$name" == .* ]] && continue
        local meta="${dir}meta.json"
        [[ -f "$meta" ]] || continue
        local pid=$(jq -r '.pid // empty' "$meta" 2>/dev/null)
        kill -0 "$pid" 2>/dev/null && echo "$name"
    done
}

# Get all process names (running + stopped)
_tsm_all_names() {
    [[ -d "$TSM_PROCESSES_DIR" ]] || return
    for dir in "$TSM_PROCESSES_DIR"/*/; do
        [[ -d "$dir" ]] || continue
        local name=$(basename "$dir")
        [[ "$name" != .* ]] && echo "$name"
    done
}

# Get service names
_tsm_service_names() {
    [[ -d "$TSM_SERVICES_DIR" ]] || return
    for f in "$TSM_SERVICES_DIR"/*.tsm; do
        [[ -f "$f" ]] && basename "$f" .tsm
    done
}

# Get enabled service names
_tsm_enabled_services() {
    local enabled_dir="${TSM_SERVICES_DIR}/enabled"
    [[ -d "$enabled_dir" ]] || return
    for f in "$enabled_dir"/*.tsm; do
        [[ -f "$f" || -L "$f" ]] && basename "$f" .tsm
    done
}

# Get stack names
_tsm_stack_names() {
    local orgs_dir="$TETRA_DIR/orgs"
    [[ -d "$orgs_dir" ]] || return
    for org_dir in "$orgs_dir"/*/; do
        [[ -d "$org_dir" ]] || continue
        local stacks_dir="$org_dir/tsm/stacks"
        [[ -d "$stacks_dir" ]] || continue
        for f in "$stacks_dir"/*.stack; do
            [[ -f "$f" ]] && basename "$f" .stack
        done
    done
}

# Get org names
_tsm_org_names() {
    local orgs_dir="$TETRA_DIR/orgs"
    [[ -d "$orgs_dir" ]] || return
    for org_dir in "$orgs_dir"/*/; do
        [[ -d "$org_dir" ]] || continue
        basename "$org_dir"
    done
}

# Get available service names (across all orgs)
_tsm_available_services() {
    local orgs_dir="$TETRA_DIR/orgs"
    [[ -d "$orgs_dir" ]] || return
    for org_dir in "$orgs_dir"/*/; do
        [[ -d "$org_dir" ]] || continue
        local services_dir="$org_dir/tsm/services-available"
        [[ -d "$services_dir" ]] || continue
        for f in "$services_dir"/*.tsm; do
            [[ -f "$f" ]] && basename "$f" .tsm
        done
    done
}

# Main completion function
_tsm_complete() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"
    local cmd="${COMP_WORDS[1]:-}"

    COMPREPLY=()

    # First arg: complete commands
    if [[ $COMP_CWORD -eq 1 ]]; then
        COMPREPLY=($(compgen -W "$_TSM_COMMANDS" -- "$cur"))
        return
    fi

    # Second arg: context-sensitive
    case "$cmd" in
        stop|restart|kill|logs|info)
            # Complete with running process names
            COMPREPLY=($(compgen -W "$(_tsm_running_names)" -- "$cur"))
            ;;
        delete)
            # Complete with all process names (running + stopped)
            COMPREPLY=($(compgen -W "$(_tsm_all_names)" -- "$cur"))
            ;;
        enable)
            # Complete with available (non-enabled) service names
            COMPREPLY=($(compgen -W "$(_tsm_service_names)" -- "$cur"))
            ;;
        disable)
            # Complete with enabled service names
            COMPREPLY=($(compgen -W "$(_tsm_enabled_services)" -- "$cur"))
            ;;
        doctor)
            COMPREPLY=($(compgen -W "health ports orphans clean" -- "$cur"))
            ;;
        caddy)
            COMPREPLY=($(compgen -W "generate show start stop reload status" -- "$cur"))
            ;;
        stack)
            if [[ $COMP_CWORD -eq 2 ]]; then
                # Complete with stack sub-commands
                COMPREPLY=($(compgen -W "start stop restart status list help" -- "$cur"))
            elif [[ $COMP_CWORD -eq 3 ]]; then
                # Complete with stack names for commands that need them
                local subcmd="${COMP_WORDS[2]}"
                case "$subcmd" in
                    start|stop|restart|status)
                        COMPREPLY=($(compgen -W "$(_tsm_stack_names)" -- "$cur"))
                        ;;
                esac
            fi
            ;;
        list|ls)
            # Handle subcommands and flags
            if [[ $COMP_CWORD -eq 2 ]]; then
                # Complete with subcommands and common flags
                COMPREPLY=($(compgen -W "available avail enabled -a --all -U --all-users -p --ports -g --group --json" -- "$cur"))
            else
                local subcmd="${COMP_WORDS[2]}"
                case "$subcmd" in
                    available|avail|enabled)
                        # Complete with flags for available/enabled
                        if [[ "$prev" == "--org" ]]; then
                            # Complete org names
                            COMPREPLY=($(compgen -W "$(_tsm_org_names)" -- "$cur"))
                        else
                            COMPREPLY=($(compgen -W "-U --all-users --org --json" -- "$cur"))
                        fi
                        ;;
                    *)
                        # Flags for running processes view
                        COMPREPLY=($(compgen -W "-a --all -U --all-users -p --ports -g --group --json" -- "$cur"))
                        ;;
                esac
            fi
            ;;
        start)
            # Complete with options, .tsm files, or directories
            if [[ "$cur" == -* ]]; then
                COMPREPLY=($(compgen -W "--port --env --name --dryrun" -- "$cur"))
            else
                # Complete .tsm files and directories for navigation
                local IFS=$'\n'
                local entries=()

                # Get matching files/dirs
                while IFS= read -r path; do
                    [[ -z "$path" ]] && continue
                    if [[ -d "$path" ]]; then
                        # Add trailing slash for directories
                        entries+=("${path}/")
                    elif [[ "$path" == *.tsm ]]; then
                        entries+=("$path")
                    fi
                done < <(compgen -f -- "$cur" 2>/dev/null)

                COMPREPLY=("${entries[@]}")

                # Prevent space after directory completion
                [[ ${#COMPREPLY[@]} -eq 1 && "${COMPREPLY[0]}" == */ ]] && compopt -o nospace
            fi
            ;;
        save)
            # After name, complete with options
            if [[ $COMP_CWORD -gt 2 ]]; then
                COMPREPLY=($(compgen -W "--port --env" -- "$cur"))
            fi
            ;;
        help)
            COMPREPLY=($(compgen -W "$_TSM_COMMANDS" -- "$cur"))
            ;;
    esac
}

# Register completion
complete -F _tsm_complete tsm
