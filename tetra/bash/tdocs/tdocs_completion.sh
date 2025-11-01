#!/usr/bin/env bash
# tdocs Shell Command Tab Completion
# This provides completion for the 'tdocs' command in the shell

# Ensure TDOCS_DIR is set
: "${TDOCS_DIR:=$TETRA_DIR/tdocs}"

# Helper: Get available modules from metadata
_tdocs_shell_get_modules() {
    if [[ -d "$TDOCS_DIR/db" ]]; then
        find "$TDOCS_DIR/db" -name "*.meta" -type f \
            -exec jq -r '.module' {} \; 2>/dev/null | \
            sort -u | \
            grep -v '^null$'
    fi
}

# Helper: Get available document paths
_tdocs_shell_get_docs() {
    if [[ -d "$TDOCS_DIR/db" ]]; then
        find "$TDOCS_DIR/db" -name "*.meta" -type f \
            -exec jq -r '.path' {} \; 2>/dev/null | \
            grep -v '^null$'
    fi
}

# Main completion function
_tdocs_complete() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"
    local cmd="${COMP_WORDS[1]}"

    # Complete commands (first argument)
    if [[ $COMP_CWORD -eq 1 ]]; then
        COMPREPLY=($(compgen -W "init view tag ls discover search evidence audit index chuck browse repl help" -- "$cur"))
        return 0
    fi

    # Complete flags/options based on command
    case "$cmd" in
        ls)
            if [[ "$cur" == -* ]]; then
                COMPREPLY=($(compgen -W "--core --other --module --preview" -- "$cur"))
            elif [[ "$prev" == "--module" ]]; then
                # Dynamic module completion
                local modules=$(_tdocs_shell_get_modules)
                COMPREPLY=($(compgen -W "$modules" -- "$cur"))
            elif [[ "$prev" == "--tags" ]]; then
                # No specific completion for tags (user-defined)
                return 0
            else
                # Complete with available document names
                local docs=$(_tdocs_shell_get_docs)
                COMPREPLY=($(compgen -W "$docs" -- "$cur"))
            fi
            ;;
        init)
            if [[ "$cur" == -* ]]; then
                COMPREPLY=($(compgen -W "--core --other --type --tags --module" -- "$cur"))
            elif [[ "$prev" == "--type" ]]; then
                COMPREPLY=($(compgen -W "spec guide reference bug-fix refactor plan summary investigation" -- "$cur"))
            elif [[ "$prev" == "--module" ]]; then
                local modules=$(_tdocs_shell_get_modules)
                COMPREPLY=($(compgen -W "$modules" -- "$cur"))
            else
                # File completion for the document path
                COMPREPLY=($(compgen -f -- "$cur"))
            fi
            ;;
        view)
            if [[ "$cur" == -* ]]; then
                COMPREPLY=($(compgen -W "--pager --meta-only --raw" -- "$cur"))
            else
                # Complete with document paths or files
                local docs=$(_tdocs_shell_get_docs)
                if [[ -n "$docs" ]]; then
                    COMPREPLY=($(compgen -W "$docs" -- "$cur"))
                else
                    COMPREPLY=($(compgen -f -- "$cur"))
                fi
            fi
            ;;
        tag)
            if [[ "$cur" == -* ]]; then
                COMPREPLY=($(compgen -W "--add --remove --list" -- "$cur"))
            else
                # Complete with document paths
                local docs=$(_tdocs_shell_get_docs)
                if [[ -n "$docs" ]]; then
                    COMPREPLY=($(compgen -W "$docs" -- "$cur"))
                else
                    COMPREPLY=($(compgen -f -- "$cur"))
                fi
            fi
            ;;
        browse|repl)
            # No arguments for browse/repl
            ;;
        discover)
            if [[ "$cur" == -* ]]; then
                COMPREPLY=($(compgen -W "--auto-init --rebuild" -- "$cur"))
            fi
            ;;
        chuck)
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "save list view promote delete search" -- "$cur"))
            elif [[ "$cur" == -* ]]; then
                case "${COMP_WORDS[2]}" in
                    save)
                        COMPREPLY=($(compgen -W "--from" -- "$cur"))
                        ;;
                    list)
                        COMPREPLY=($(compgen -W "--kind --recent" -- "$cur"))
                        ;;
                    view)
                        COMPREPLY=($(compgen -W "--kind" -- "$cur"))
                        ;;
                    delete)
                        COMPREPLY=($(compgen -W "--force" -- "$cur"))
                        ;;
                esac
            fi
            ;;
        search)
            # No completion for search queries
            ;;
        evidence)
            # Complete with query or recent searches
            # Could be enhanced with history of queries
            ;;
        audit)
            # No arguments for audit
            ;;
        index)
            if [[ "$cur" == -* ]]; then
                COMPREPLY=($(compgen -W "--rebuild --status" -- "$cur"))
            fi
            ;;
        help)
            # Complete with command names
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "init view tag ls discover search evidence audit index chuck browse repl" -- "$cur"))
            fi
            ;;
        *)
            # Default: no extra completions
            ;;
    esac
}

# Register completion for both 'tdocs' and 'tdoc' (alias)
complete -F _tdocs_complete tdocs
complete -F _tdocs_complete tdoc
