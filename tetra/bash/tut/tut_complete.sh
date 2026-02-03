#!/usr/bin/env bash
# tut_complete.sh - Tab completion for tut command

# =============================================================================
# COMPLETION CONSTANTS
# =============================================================================

# Top-level commands
_TUT_COMMANDS="ctx list init adopt unadopt edit build validate serve doctor help version"

# Context verbs
_TUT_CTX_VERBS="set subject type clear status"

# Types
_TUT_TYPES="ref guide thesis"

# =============================================================================
# COMPLETION HELPERS
# =============================================================================

_tut_complete_sources() {
    # Complete from org's tut/src directory (without .json extension)
    local src_dir
    src_dir=$(_tut_src_dir 2>/dev/null) || return
    if [[ -d "$src_dir" ]]; then
        for f in "$src_dir"/*.json; do
            [[ -f "$f" ]] && basename "$f" .json
        done
    fi
}

_tut_complete_orgs() {
    # Complete org names from $TETRA_DIR/orgs/
    if [[ -n "$TETRA_DIR" && -d "$TETRA_DIR/orgs" ]]; then
        for d in "$TETRA_DIR/orgs"/*/; do
            [[ -d "$d" ]] && basename "$d"
        done
    fi
}

_tut_complete_subjects() {
    # Extract unique subjects from filenames (subject-type.json -> subject)
    local src_dir
    src_dir=$(_tut_src_dir 2>/dev/null) || return
    if [[ -d "$src_dir" ]]; then
        for f in "$src_dir"/*.json; do
            [[ -f "$f" ]] || continue
            local name=$(basename "$f" .json)
            # Extract subject (everything before last hyphen)
            echo "${name%-*}"
        done | sort -u
    fi
}

# =============================================================================
# MAIN COMPLETION FUNCTION
# =============================================================================

_tut_complete() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"
    local cmd="${COMP_WORDS[1]:-}"

    COMPREPLY=()

    # First argument - complete commands
    if [[ $COMP_CWORD -eq 1 ]]; then
        COMPREPLY=($(compgen -W "$_TUT_COMMANDS" -- "$cur"))
        return
    fi

    # Handle --theme flag
    if [[ "$prev" == "--theme" ]]; then
        # Could complete from terrain themes, for now just return
        return
    fi

    # Second+ arguments based on command
    case "$cmd" in
        ctx|context)
            if [[ $COMP_CWORD -eq 2 ]]; then
                # First could be verb or org name
                COMPREPLY=($(compgen -W "$_TUT_CTX_VERBS $(_tut_complete_orgs)" -- "$cur"))
            elif [[ $COMP_CWORD -eq 3 ]]; then
                local verb="${COMP_WORDS[2]}"
                case "$verb" in
                    set)
                        COMPREPLY=($(compgen -W "$(_tut_complete_orgs)" -- "$cur"))
                        ;;
                    subject)
                        COMPREPLY=($(compgen -W "$(_tut_complete_subjects)" -- "$cur"))
                        ;;
                    type)
                        COMPREPLY=($(compgen -W "$_TUT_TYPES" -- "$cur"))
                        ;;
                    *)
                        # Might be org name, complete subjects
                        COMPREPLY=($(compgen -W "$(_tut_complete_subjects)" -- "$cur"))
                        ;;
                esac
            elif [[ $COMP_CWORD -eq 4 ]]; then
                # Fourth arg is type
                COMPREPLY=($(compgen -W "$_TUT_TYPES" -- "$cur"))
            fi
            ;;
        init|new)
            if [[ $COMP_CWORD -eq 2 ]]; then
                # Subject name - complete existing subjects
                COMPREPLY=($(compgen -W "$(_tut_complete_subjects)" -- "$cur"))
            elif [[ $COMP_CWORD -eq 3 ]]; then
                # Type
                COMPREPLY=($(compgen -W "$_TUT_TYPES" -- "$cur"))
            fi
            ;;
        adopt)
            # Complete JSON files from filesystem
            COMPREPLY=($(compgen -f -X '!*.json' -- "$cur"))
            ;;
        unadopt|rm)
            # Complete from existing tut src files
            COMPREPLY=($(compgen -W "$(_tut_complete_sources)" -- "$cur"))
            ;;
        edit|e)
            COMPREPLY=($(compgen -W "$(_tut_complete_sources)" -- "$cur"))
            ;;
        build|b)
            if [[ "$cur" == -* ]]; then
                COMPREPLY=($(compgen -W "--theme= --out= --all" -- "$cur"))
            elif [[ "$cur" == /* ]]; then
                # Absolute path - complete JSON files
                COMPREPLY=($(compgen -f -X '!*.json' -- "$cur"))
            else
                COMPREPLY=($(compgen -W "$(_tut_complete_sources)" -- "$cur"))
            fi
            ;;
        list|ls)
            # No completions needed
            ;;
        help)
            COMPREPLY=($(compgen -W "ctx list init edit build doctor" -- "$cur"))
            ;;
    esac
}

complete -F _tut_complete tut
