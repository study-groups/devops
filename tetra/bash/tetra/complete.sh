#!/usr/bin/env bash
# tetra/complete.sh - Context-aware tab completion for tetra
#
# Features:
# - Completes tetra commands + all loaded modules
# - Context-aware: uses TETRA_CTX_* to inform completions
# - Module subcommand completion (extracts from case statements)
# - Dynamic lists: orgs, modules, services, etc.

# =============================================================================
# DYNAMIC LISTS
# =============================================================================

# Get org names from ~/tetra/orgs/
_tetra_org_names() {
    local orgs_dir="${HOME}/tetra/orgs"
    [[ -d "$orgs_dir" ]] || return
    for d in "$orgs_dir"/*/; do
        [[ -d "$d" && ! -L "${d%/}" ]] && basename "$d"
    done
}

# Get loaded module names
_tetra_module_names() {
    printf '%s\n' "${TETRA_MODULE_LIST[@]}"
}

# Get module subcommands by parsing its main file
_tetra_module_commands() {
    local mod="$1"
    local mod_file="$TETRA_SRC/bash/$mod/$mod.sh"
    [[ -f "$mod_file" ]] || return

    # Extract case patterns like: cmd|alias) or cmd)
    grep -E '^\s+[a-z][a-z0-9_-]*(\|[a-z0-9_-]+)*\)' "$mod_file" 2>/dev/null | \
        sed 's/^[[:space:]]*//' | \
        sed 's/).*//' | \
        tr '|' '\n' | \
        grep -v '^\*$' | \
        grep -v '^-' | \
        sort -u
}

# Get tsm running process names (if tsm loaded)
_tetra_tsm_running() {
    declare -f _tsm_running_names &>/dev/null && _tsm_running_names
}

# Get tsm service names (if tsm loaded)
_tetra_tsm_services() {
    declare -f _tsm_service_names &>/dev/null && _tsm_service_names
}

# =============================================================================
# TETRA COMMANDS
# =============================================================================

_TETRA_COMMANDS="status module ctx repl trepl tui doctor help version"

# =============================================================================
# MAIN COMPLETION
# =============================================================================

_tetra_complete() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"
    local cmd="${COMP_WORDS[1]:-}"

    COMPREPLY=()

    # First arg: tetra commands + all modules
    if [[ $COMP_CWORD -eq 1 ]]; then
        local all_cmds="$_TETRA_COMMANDS ${TETRA_MODULE_LIST[*]}"
        COMPREPLY=($(compgen -W "$all_cmds" -- "$cur"))
        return
    fi

    # Handle tetra subcommands
    case "$cmd" in
        module|mod|m)
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "list info meta stats" -- "$cur"))
            elif [[ $COMP_CWORD -eq 3 ]]; then
                # info/meta need module name
                case "$prev" in
                    info|meta)
                        COMPREPLY=($(compgen -W "${TETRA_MODULE_LIST[*]}" -- "$cur"))
                        ;;
                esac
            fi
            ;;

        ctx)
            if [[ $COMP_CWORD -eq 2 ]]; then
                # ctx subcommands + org names for quick set
                local ctx_cmds="show set clear help"
                local orgs=$(_tetra_org_names | tr '\n' ' ')
                COMPREPLY=($(compgen -W "$ctx_cmds $orgs" -- "$cur"))
            elif [[ $COMP_CWORD -eq 3 && "$prev" == "set" ]]; then
                COMPREPLY=($(compgen -W "org project topic" -- "$cur"))
            elif [[ $COMP_CWORD -eq 4 ]]; then
                # Value for set
                case "${COMP_WORDS[3]}" in
                    org|o)
                        COMPREPLY=($(compgen -W "$(_tetra_org_names)" -- "$cur"))
                        ;;
                    project|p)
                        COMPREPLY=($(compgen -W "${TETRA_MODULE_LIST[*]}" -- "$cur"))
                        ;;
                    topic|t)
                        COMPREPLY=($(compgen -W "local dev staging prod" -- "$cur"))
                        ;;
                esac
            fi
            ;;

        doctor|doc)
            COMPREPLY=()  # No subcommands
            ;;

        repl|trepl|tui)
            COMPREPLY=($(compgen -W "--help -h --midi -m" -- "$cur"))
            ;;

        # Module commands - delegate to module's completion or parse
        org)
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "$(_tetra_module_commands org)" -- "$cur"))
            elif [[ $COMP_CWORD -eq 3 ]]; then
                case "$prev" in
                    switch|use|info)
                        COMPREPLY=($(compgen -W "$(_tetra_org_names)" -- "$cur"))
                        ;;
                esac
            fi
            ;;

        tsm)
            # Use tsm's completion if available
            if declare -f _tsm_complete &>/dev/null; then
                _tsm_complete
            else
                if [[ $COMP_CWORD -eq 2 ]]; then
                    COMPREPLY=($(compgen -W "$(_tetra_module_commands tsm)" -- "$cur"))
                fi
            fi
            ;;

        deploy)
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "$(_tetra_module_commands deploy)" -- "$cur"))
            fi
            ;;

        tls)
            if [[ $COMP_CWORD -eq 2 ]]; then
                # tls takes paths, use file completion
                COMPREPLY=($(compgen -d -- "$cur"))
            fi
            ;;

        *)
            # Unknown module - try to get its commands
            if [[ " ${TETRA_MODULE_LIST[*]} " == *" $cmd "* ]]; then
                if [[ $COMP_CWORD -eq 2 ]]; then
                    COMPREPLY=($(compgen -W "$(_tetra_module_commands "$cmd")" -- "$cur"))
                fi
            fi
            ;;
    esac
}

# =============================================================================
# CONTEXT-AWARE SHORTCUT COMPLETION
# =============================================================================
# When TETRA_CTX_PROJECT is set, provide module-specific completions
# even at the top level for common patterns

_tetra_ctx_complete() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local proj="${TETRA_CTX_PROJECT:-}"

    # If we have a project context, include its commands at top level
    if [[ -n "$proj" && $COMP_CWORD -eq 1 ]]; then
        local proj_cmds=$(_tetra_module_commands "$proj" | tr '\n' ' ')
        local all_cmds="$_TETRA_COMMANDS ${TETRA_MODULE_LIST[*]} $proj_cmds"
        COMPREPLY=($(compgen -W "$all_cmds" -- "$cur"))
        return 0
    fi

    return 1  # Fall through to normal completion
}

# =============================================================================
# REGISTER
# =============================================================================

complete -F _tetra_complete tetra

# Export for subshells
export -f _tetra_complete _tetra_org_names _tetra_module_names
export -f _tetra_module_commands _tetra_tsm_running _tetra_tsm_services
