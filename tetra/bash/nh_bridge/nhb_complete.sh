#!/usr/bin/env bash
# nhb_complete.sh - Tab completion for nhb command

# =============================================================================
# COMPLETION DATA
# =============================================================================

_NHB_COMMANDS="status list import quick validate fetch workflow help"

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

# List Nodeholder contexts (directories with digocean.json)
_nhb_complete_contexts() {
    local nh_dir="${NH_DIR:-$HOME/nh}"
    [[ -d "$nh_dir" ]] || return

    for dir in "$nh_dir"/*/; do
        [[ -f "$dir/digocean.json" ]] && basename "$dir"
    done
}

# List org names
_nhb_complete_orgs() {
    local orgs_dir="$TETRA_DIR/orgs"
    [[ -d "$orgs_dir" ]] || return

    for dir in "$orgs_dir"/*/; do
        [[ -d "$dir" ]] && basename "$dir"
    done
}

# =============================================================================
# MAIN COMPLETION FUNCTION
# =============================================================================

_nhb_complete() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"
    local cmd="${COMP_WORDS[1]:-}"

    COMPREPLY=()

    # First argument - complete subcommands
    if [[ $COMP_CWORD -eq 1 ]]; then
        COMPREPLY=($(compgen -W "$_NHB_COMMANDS" -- "$cur"))
        return
    fi

    # Second argument - depends on command
    if [[ $COMP_CWORD -eq 2 ]]; then
        case "$cmd" in
            # list, import, validate: complete json files
            list|ls|import|i|validate|v)
                COMPREPLY=($(compgen -f -X '!*.json' -- "$cur"))
                compopt -o filenames
                return
                ;;

            # quick, fetch: complete contexts
            quick|q|fetch|f)
                COMPREPLY=($(compgen -W "$(_nhb_complete_contexts)" -- "$cur"))
                return
                ;;
        esac
    fi

    # Third argument for import (org name)
    if [[ $COMP_CWORD -eq 3 ]]; then
        case "$cmd" in
            import|i)
                COMPREPLY=($(compgen -W "$(_nhb_complete_orgs)" -- "$cur"))
                return
                ;;
        esac
    fi
}

# Register completion
complete -F _nhb_complete nhb
