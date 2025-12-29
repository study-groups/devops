#!/usr/bin/env bash
# =============================================================================
# SCANSPEC TAB COMPLETION
# =============================================================================

# Generate completions for magicfind spec
_magicfind_spec_completions() {
    local cur="$1"

    # List available specs (basenames without extension)
    if [[ -d "$SCANSPEC_DIR" ]]; then
        for spec in "$SCANSPEC_DIR"/*.scanspec; do
            [[ -f "$spec" ]] || continue
            local name="${spec##*/}"
            name="${name%.scanspec}"
            [[ "$name" == "$cur"* ]] && echo "$name"
        done
    fi

    # Subcommands
    for cmd in list show run match compare duplicates help; do
        [[ "$cmd" == "$cur"* ]] && echo "$cmd"
    done
}

# Bash completion function for magicfind
_magicfind_complete() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"

    case "${COMP_WORDS[1]}" in
        spec|specs)
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "$(_magicfind_spec_completions "$cur")" -- "$cur"))
            elif [[ $COMP_CWORD -eq 3 ]]; then
                case "$prev" in
                    show|run|compare)
                        # Complete with spec names
                        local specs=""
                        if [[ -d "$SCANSPEC_DIR" ]]; then
                            for spec in "$SCANSPEC_DIR"/*.scanspec; do
                                [[ -f "$spec" ]] || continue
                                local name="${spec##*/}"
                                specs+="${name%.scanspec} "
                            done
                        fi
                        COMPREPLY=($(compgen -W "$specs" -- "$cur"))
                        ;;
                esac
            fi
            ;;
        rules)
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "list add rm clear reset path" -- "$cur"))
            fi
            ;;
        db)
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "stats clean path" -- "$cur"))
            fi
            ;;
        *)
            if [[ $COMP_CWORD -eq 1 ]]; then
                COMPREPLY=($(compgen -W "spec specs rules db list show replay search similar help" -- "$cur"))
            fi
            ;;
    esac
}

# Register completion if running interactively
if [[ -n "${PS1:-}" ]]; then
    complete -F _magicfind_complete magicfind 2>/dev/null
fi

export -f _magicfind_spec_completions
