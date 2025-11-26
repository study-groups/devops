#!/usr/bin/env bash
# nh_complete.sh - Tab completion for nh command

_NH_COMMANDS="status list switch create fetch servers show cat env ssh doctl md cl help"
_NH_FETCH_OPTS="dry-run"
_NH_ENV_SUBCMDS="show load short"
_NH_SSH_SUBCMDS="status keys add"
_NH_DOCTL_SUBCMDS="status droplets fetch clean age resources info"
_NH_HELP_SUBCMDS="env ssh doctl md cl"
_NH_MD_SUBCMDS="list show keys"
_NH_CHECKLIST_SUBCMDS="browse check uncheck status reset env list keys"

# List context names (directories in NH_DIR)
_nh_complete_contexts() {
    [[ ! -d "$NH_DIR" ]] && return
    for dir in "$NH_DIR"/*/; do
        [[ -d "$dir" ]] || continue
        local name=$(basename "$dir")
        [[ "$name" == "json" ]] && continue
        echo "$name"
    done
}

# List server variable names (from environment)
_nh_complete_servers() {
    local ctx="${DIGITALOCEAN_CONTEXT:-}"
    [[ -z "$ctx" ]] && return

    local json="$NH_DIR/$ctx/digocean.json"
    [[ ! -f "$json" ]] && return

    jq -r '.[] | select(.Droplets) | .Droplets[] | .name | gsub("-"; "_")' "$json" 2>/dev/null
}

# List server variables currently exported
_nh_complete_vars() {
    # Match variables that look like server IPs
    env | grep -E '^[a-zA-Z][a-zA-Z0-9_]*=[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' | cut -d= -f1
}

# List checklist section keys
_nh_complete_checklist_sections() {
    # Ensure checklist is parsed
    local checklist_file="${NH_CHECKLIST:-${NH_SRC%/bash}/checklist.md}"
    if [[ -f "$checklist_file" && ${#NH_MD_ORDER[@]} -eq 0 ]]; then
        nh_md_parse "$checklist_file" >/dev/null 2>&1
    fi
    printf '%s\n' "${NH_MD_ORDER[@]}"
}

# List section keys for a specific markdown file
_nh_complete_md_sections() {
    local file="$1"
    [[ ! -f "$file" ]] && return
    # Parse if different file or not parsed
    if [[ "$NH_MD_FILE" != "$file" || ${#NH_MD_ORDER[@]} -eq 0 ]]; then
        nh_md_parse "$file" >/dev/null 2>&1
    fi
    printf '%s\n' "${NH_MD_ORDER[@]}"
}

# Main completion function
_nh_complete() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local cmd="${COMP_WORDS[1]:-}"
    local subcmd="${COMP_WORDS[2]:-}"

    COMPREPLY=()

    # First arg - commands
    if [[ $COMP_CWORD -eq 1 ]]; then
        COMPREPLY=($(compgen -W "$_NH_COMMANDS" -- "$cur"))
        return
    fi

    # Second arg
    if [[ $COMP_CWORD -eq 2 ]]; then
        case "$cmd" in
            switch|sw)
                COMPREPLY=($(compgen -W "$(_nh_complete_contexts)" -- "$cur"))
                ;;
            show|info)
                COMPREPLY=($(compgen -W "$(_nh_complete_servers)" -- "$cur"))
                ;;
            env)
                COMPREPLY=($(compgen -W "$_NH_ENV_SUBCMDS" -- "$cur"))
                ;;
            ssh)
                COMPREPLY=($(compgen -W "$_NH_SSH_SUBCMDS $(_nh_complete_servers)" -- "$cur"))
                ;;
            doctl)
                COMPREPLY=($(compgen -W "$_NH_DOCTL_SUBCMDS" -- "$cur"))
                ;;
            md)
                # Complete markdown files
                COMPREPLY=($(compgen -f -X '!*.md' -- "$cur"))
                # Also complete directories for navigation
                COMPREPLY+=($(compgen -d -- "$cur"))
                ;;
            checklist|cl)
                # Include commands and step numbers (01-15)
                local step_keys=$(_nh_complete_checklist_sections 2>/dev/null | grep -E '^[0-9]+$')
                COMPREPLY=($(compgen -W "$_NH_CHECKLIST_SUBCMDS $step_keys" -- "$cur"))
                ;;
            fetch)
                COMPREPLY=($(compgen -W "$_NH_FETCH_OPTS" -- "$cur"))
                ;;
            help|h)
                COMPREPLY=($(compgen -W "$_NH_HELP_SUBCMDS" -- "$cur"))
                ;;
        esac
        return
    fi

    # Third arg
    if [[ $COMP_CWORD -eq 3 ]]; then
        case "$cmd" in
            env)
                case "$subcmd" in
                    short)
                        COMPREPLY=($(compgen -W "$(_nh_complete_servers | cut -c1-3 | sort -u)" -- "$cur"))
                        ;;
                esac
                ;;
            md)
                # subcmd is the file path - complete with section keys
                COMPREPLY=($(compgen -W "$_NH_MD_SUBCMDS $(_nh_complete_md_sections "$subcmd")" -- "$cur"))
                ;;
            checklist|cl)
                # For check/uncheck, complete with step numbers
                case "$subcmd" in
                    check|c|uncheck|uc)
                        local step_keys=$(_nh_complete_checklist_sections 2>/dev/null | grep -E '^[0-9]+$')
                        COMPREPLY=($(compgen -W "$step_keys" -- "$cur"))
                        ;;
                esac
                ;;
            doctl)
                # Show description as completion hint
                case "$subcmd" in
                    status)     COMPREPLY=("# Show doctl auth status") ;;
                    droplets)   COMPREPLY=("# List droplets live from DO API") ;;
                    fetch)      COMPREPLY=("# Fetch infrastructure to digocean.json") ;;
                    clean)      COMPREPLY=("# Remove verbose fields -> digocean_clean.json") ;;
                    age)        COMPREPLY=("# Show digocean.json age in days") ;;
                    resources)  COMPREPLY=("# Summary counts of all resources") ;;
                    info)       COMPREPLY=("# Explain data flow and tetra integration") ;;
                esac
                ;;
        esac
        return
    fi
}

# Register completion
complete -F _nh_complete nh

# Export functions
export -f _nh_complete _nh_complete_contexts _nh_complete_servers _nh_complete_vars
