#!/usr/bin/env bash
# tdocs Shell Command Tab Completion
# This provides completion for the 'tdocs' command in the shell

# Ensure TDOCS_DIR is set
: "${TDOCS_DIR:=$TETRA_DIR/tdocs}"

# Load tree completion if available
if [[ -n "$TETRA_SRC" ]] && [[ -f "$TETRA_SRC/bash/tree/complete.sh" ]]; then
    source "$TETRA_SRC/bash/tree/complete.sh"
fi

# Helper: Get available modules from metadata (for dynamic completion)
_tdocs_shell_get_modules() {
    if [[ -d "$TDOCS_DIR/db" ]]; then
        find "$TDOCS_DIR/db" -name "*.meta" -type f \
            -exec jq -r '.module' {} \; 2>/dev/null | \
            sort -u | \
            grep -v '^null$'
    fi
}

# Ensure tree is initialized (following org pattern)
_tdocs_ensure_tree() {
    # Check if tree is initialized
    if ! tree_exists "help.tdocs" 2>/dev/null; then
        # Build tree if _tdocs_build_help_tree is available
        if declare -F _tdocs_build_help_tree >/dev/null 2>&1; then
            _tdocs_build_help_tree 2>/dev/null
        fi
    fi
}

# Main completion function using tree-based completion
_tdocs_complete() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"

    # Check if tree completion is available
    if ! declare -F tree_complete >/dev/null 2>&1; then
        # Fallback to simple static completion if tree not available
        if [[ $COMP_CWORD -eq 1 ]]; then
            COMPREPLY=($(compgen -W "init view tag ls list search evidence audit discover doctor scan browse index chuck module spec audit-specs about publish nginx-config publish-targets colors help" -- "$cur"))
        fi
        return 0
    fi

    # Ensure tree is built
    _tdocs_ensure_tree

    # Build path from command words (skip flags and values)
    local path="help.tdocs"
    if [[ ${COMP_CWORD} -gt 1 ]]; then
        local i
        for ((i=1; i<${COMP_CWORD}; i++)); do
            local word="${COMP_WORDS[$i]}"
            # Skip flags/options
            [[ "$word" == -* ]] && continue
            path="$path.$word"
        done
    fi

    # Special handling for option values (when previous word was a flag)
    if [[ "$prev" == "--module" ]]; then
        # Dynamic module completion
        local modules=$(_tdocs_shell_get_modules)
        COMPREPLY=($(compgen -W "$modules" -- "$cur"))
        return 0
    elif [[ "$prev" == "--type" ]]; then
        # Get completion values from tree if available, else use static list
        local values=$(tree_complete_values "$path" 2>/dev/null)
        if [[ -z "$values" ]]; then
            values="spec guide reference bug-fix refactor plan summary investigation"
        fi
        COMPREPLY=($(compgen -W "$values" -- "$cur"))
        return 0
    fi

    # Get completions from tree structure
    local completions
    if [[ "$cur" == -* ]]; then
        # Completing a flag - get flags/options for current command
        completions=$(tree_complete_by_type "$path" "flag" "$cur" 2>/dev/null)
        local options=$(tree_complete_by_type "$path" "option" "$cur" 2>/dev/null)
        completions="$completions $options"
    else
        # Completing a command or subcommand
        completions=$(tree_complete "$path" "$cur" 2>/dev/null)
    fi

    # If tree gave us nothing and we're at top level, provide basic fallback
    if [[ -z "$completions" ]] && [[ $COMP_CWORD -eq 1 ]]; then
        completions="init view tag ls list search evidence audit discover doctor scan browse index chuck module spec audit-specs about help"
    fi

    COMPREPLY=($(compgen -W "$completions" -- "$cur"))
}

# Register completion for both 'tdocs' and 'tdoc' (alias)
complete -F _tdocs_complete tdocs
complete -F _tdocs_complete tdoc
