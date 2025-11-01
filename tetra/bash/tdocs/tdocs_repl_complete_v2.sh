#!/usr/bin/env bash
# TDOCS REPL Completion - works with read -e
# Integrates with REPL's slash command registry

# Ensure TDOCS_DIR is set
: "${TDOCS_DIR:=$TETRA_DIR/tdocs}"

# Helper: Get available modules from metadata
_tdocs_complete_get_modules() {
    if [[ -d "$TDOCS_DIR/db" ]]; then
        find "$TDOCS_DIR/db" -name "*.meta" -type f \
            -exec jq -r '.module' {} \; 2>/dev/null | \
            sort -u | \
            grep -v '^null$'
    fi
}

# Helper: Get available document paths
_tdocs_complete_get_docs() {
    if [[ -d "$TDOCS_DIR/db" ]]; then
        find "$TDOCS_DIR/db" -name "*.meta" -type f \
            -exec jq -r '.path' {} \; 2>/dev/null | \
            grep -v '^null$'
    fi
}

# Helper: Get available document types
_tdocs_complete_get_types() {
    echo "spec guide reference bug-fix refactor plan summary investigation"
}

# Main completion function for REPL (uses COMP_* variables from bash)
_tdocs_repl_complete() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev=""

    # Get previous word safely
    if [[ ${COMP_CWORD} -gt 0 ]]; then
        prev="${COMP_WORDS[COMP_CWORD-1]}"
    fi

    local cmd=""
    # Get first word (command)
    if [[ ${COMP_CWORD} -gt 0 ]]; then
        cmd="${COMP_WORDS[0]}"
    fi

    local completions=()

    # If we're at the start, complete with registered commands + common ones
    if [[ ${COMP_CWORD} -eq 0 ]] || [[ -z "$cmd" && "$cur" != -* ]]; then
        # Get registered slash commands from REPL
        if [[ -v REPL_SLASH_HANDLERS ]]; then
            for key in "${!REPL_SLASH_HANDLERS[@]}"; do
                completions+=("$key")
            done
        fi

        # Add common commands
        completions+=(ls list view search filter tag init discover evidence audit env help exit quit)

        COMPREPLY=($(compgen -W "${completions[*]}" -- "$cur"))
        return 0
    fi

    # Context-specific completion based on command
    case "$cmd" in
        ls|list)
            if [[ "$cur" == --* ]]; then
                completions=(--core --other --module --preview --tags)
            elif [[ "$prev" == "--module" ]]; then
                completions=($(_tdocs_complete_get_modules))
            else
                # Document paths
                completions=($(_tdocs_complete_get_docs | xargs -n1 basename 2>/dev/null))
            fi
            ;;

        view|v)
            if [[ "$cur" == --* ]]; then
                completions=(--pager --meta-only --raw)
            else
                completions=($(_tdocs_complete_get_docs | xargs -n1 basename 2>/dev/null))
            fi
            ;;

        filter|f)
            if [[ ${COMP_CWORD} -eq 1 ]]; then
                completions=(core other module clear reset)
            elif [[ ${COMP_CWORD} -eq 2 && "$prev" == "module" ]]; then
                completions=($(_tdocs_complete_get_modules))
            fi
            ;;

        tag)
            completions=($(_tdocs_complete_get_docs | xargs -n1 basename 2>/dev/null))
            ;;

        init)
            if [[ "$cur" == --* ]]; then
                completions=(--core --other --type --tags --module)
            elif [[ "$prev" == "--type" ]]; then
                completions=($(_tdocs_complete_get_types))
            elif [[ "$prev" == "--module" ]]; then
                completions=($(_tdocs_complete_get_modules))
            else
                # File completion
                COMPREPLY=($(compgen -f -- "$cur"))
                return 0
            fi
            ;;

        discover)
            if [[ "$cur" == --* ]]; then
                completions=(--auto-init --rebuild)
            fi
            ;;

        env)
            completions=(toggle set)
            ;;

        help|h|\?)
            # Get registered commands for help
            if [[ -v REPL_SLASH_HANDLERS ]]; then
                for key in "${!REPL_SLASH_HANDLERS[@]}"; do
                    completions+=("$key")
                done
            fi
            completions+=(ls view search filter tag init discover evidence audit)
            ;;

        *)
            # Unknown command - no completion
            ;;
    esac

    COMPREPLY=($(compgen -W "${completions[*]}" -- "$cur"))
}

# Enable completion for REPL (works with read -e)
tdocs_repl_enable_completion() {
    # Use complete -E for "empty command" completion
    # This makes completion work during read -e
    complete -E -F _tdocs_repl_complete 2>/dev/null

    # Also set default completion
    complete -D -F _tdocs_repl_complete 2>/dev/null

    # Configure readline for better completion
    bind 'set completion-ignore-case on' 2>/dev/null || true
    bind 'set show-all-if-ambiguous on' 2>/dev/null || true
    bind 'set colored-completion-prefix on' 2>/dev/null || true
}

# Disable completion
tdocs_repl_disable_completion() {
    complete -r -E 2>/dev/null || true
    complete -r -D 2>/dev/null || true
}

# Export functions
export -f _tdocs_complete_get_modules
export -f _tdocs_complete_get_docs
export -f _tdocs_complete_get_types
export -f _tdocs_repl_complete
export -f tdocs_repl_enable_completion
export -f tdocs_repl_disable_completion
