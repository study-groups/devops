#!/usr/bin/env bash
# RAG Tools Auto-completion
# Provides bash auto-completion for rag_* functions and REPL commands

# Helper function to get cursor IDs
_rag_get_cursor_ids() {
    [[ -d "$RAG_DIR/cursors" ]] || return
    for f in "$RAG_DIR/cursors"/*.json; do
        [[ -f "$f" ]] && jq -r '.id' "$f" 2>/dev/null
    done
}

# Helper function to get multicursor IDs  
_rag_get_mcursor_ids() {
    [[ -d "$RAG_DIR/multicursor" ]] || return
    for f in "$RAG_DIR/multicursor"/*.json; do
        [[ -f "$f" ]] && jq -r '.id' "$f" 2>/dev/null
    done
}

# Helper function to get MULTICAT files
_rag_get_multicat_files() {
    compgen -f -X "!*.mc"
}

# Main completion function for rag_cursor_* commands
_rag_cursor_complete() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"
    local cmd="${COMP_WORDS[0]}"
    
    case "$cmd" in
        rag_cursor_create)
            case "$COMP_CWORD" in
                1) COMPREPLY=($(compgen -f -- "$cur")) ;;  # file
                2|3) COMPREPLY=($(compgen -W "1 10 20 50" -- "$cur")) ;;  # line numbers
                4) COMPREPLY=($(compgen -W "bug critical auth ui" -- "$cur")) ;;  # common tags
                *) ;;
            esac
            ;;
        rag_cursor_show|rag_cursor_delete|rag_cursor_tag|rag_cursor_prompt|rag_cursor_to_multicat)
            [[ $COMP_CWORD -eq 1 ]] && COMPREPLY=($(compgen -W "$(_rag_get_cursor_ids)" -- "$cur"))
            ;;
        rag_cursor_list|rag_cursor_search)
            [[ $COMP_CWORD -eq 1 ]] && COMPREPLY=($(compgen -f -- "$cur"))  # filter/query
            ;;
    esac
}

# Main completion function for rag_mcursor_* commands
_rag_mcursor_complete() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"
    local cmd="${COMP_WORDS[0]}"
    
    case "$cmd" in
        rag_mcursor_create)
            [[ $COMP_CWORD -eq 1 ]] && COMPREPLY=($(compgen -W '"Auth Fixes" "Bug Reports" "Refactoring"' -- "$cur"))
            ;;
        rag_mcursor_show|rag_mcursor_delete|rag_mcursor_tag|rag_mcursor_to_multicat)
            [[ $COMP_CWORD -eq 1 ]] && COMPREPLY=($(compgen -W "$(_rag_get_mcursor_ids)" -- "$cur"))
            ;;
        rag_mcursor_add|rag_mcursor_remove)
            if [[ $COMP_CWORD -eq 1 ]]; then
                COMPREPLY=($(compgen -W "$(_rag_get_mcursor_ids)" -- "$cur"))
            elif [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "$(_rag_get_cursor_ids)" -- "$cur"))
            fi
            ;;
        rag_mcursor_from_multicat)
            case "$COMP_CWORD" in
                1) COMPREPLY=($(compgen -W "$(_rag_get_multicat_files)" -- "$cur")) ;;
                2) COMPREPLY=($(compgen -W '"From MULTICAT" "Extracted Blocks"' -- "$cur")) ;;
                3) COMPREPLY=($(compgen -W "1,2,3 1-5 all" -- "$cur")) ;;
            esac
            ;;
    esac
}

# REPL completion function
_rag_repl_complete() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"
    
    # Check if we're inside rag_repl (this is tricky to detect reliably)
    # For now, this completion works when someone types rag_repl commands outside REPL
    
    case "$prev" in
        cursor)
            COMPREPLY=($(compgen -W "create list show delete tag prompt search" -- "$cur"))
            ;;
        mcursor)
            COMPREPLY=($(compgen -W "create list show add remove delete tag from-multicat to-multicat" -- "$cur"))
            ;;
        cat)
            local multicat_files=$(_rag_get_multicat_files)
            COMPREPLY=($(compgen -W "blocks info $multicat_files" -- "$cur"))
            ;;
        mcat)
            COMPREPLY=($(compgen -W "from-cursors from-files" -- "$cur"))
            [[ ${#COMPREPLY[@]} -eq 0 ]] && COMPREPLY=($(compgen -d -- "$cur"))
            ;;
        create)
            # Context-sensitive completion based on command before 'create'
            case "${COMP_WORDS[COMP_CWORD-2]}" in
                cursor) COMPREPLY=($(compgen -f -- "$cur")) ;;
                mcursor) COMPREPLY=($(compgen -W '"New Collection" "Bug Fixes" "Features"' -- "$cur")) ;;
            esac
            ;;
        show|delete)
            # Context-sensitive completion
            case "${COMP_WORDS[COMP_CWORD-2]}" in
                cursor) COMPREPLY=($(compgen -W "$(_rag_get_cursor_ids)" -- "$cur")) ;;
                mcursor) COMPREPLY=($(compgen -W "$(_rag_get_mcursor_ids)" -- "$cur")) ;;
            esac
            ;;
        add|remove)
            # For mcursor add/remove, complete with cursor IDs
            if [[ "${COMP_WORDS[COMP_CWORD-2]}" == "mcursor" ]]; then
                # If we have mc_id already, complete with cursor_id
                if [[ "${COMP_WORDS[COMP_CWORD-1]}" =~ ^mc_ ]]; then
                    COMPREPLY=($(compgen -W "$(_rag_get_cursor_ids)" -- "$cur"))
                else
                    COMPREPLY=($(compgen -W "$(_rag_get_mcursor_ids)" -- "$cur"))
                fi
            fi
            ;;
        from-cursors)
            COMPREPLY=($(compgen -W "$(_rag_get_mcursor_ids)" -- "$cur"))
            ;;
        blocks)
            COMPREPLY=($(compgen -W "1,2,3 1-5 all" -- "$cur"))
            ;;
    esac
    
    # Top-level REPL commands
    if [[ $COMP_CWORD -eq 0 ]] || [[ "$cur" == /* ]]; then
        local repl_commands="cursor mcursor cat mcat help tutorial demo functions clear exit"
        COMPREPLY=($(compgen -W "$repl_commands" -- "${cur#/}"))
        # Add / prefix back if user started with /
        [[ "$cur" == /* ]] && COMPREPLY=("${COMPREPLY[@]/#/\/}")
    fi
}

# Set up completion for all rag functions
_rag_setup_completion() {
    # Individual cursor functions
    complete -F _rag_cursor_complete rag_cursor_create
    complete -F _rag_cursor_complete rag_cursor_list  
    complete -F _rag_cursor_complete rag_cursor_show
    complete -F _rag_cursor_complete rag_cursor_delete
    complete -F _rag_cursor_complete rag_cursor_tag
    complete -F _rag_cursor_complete rag_cursor_prompt
    complete -F _rag_cursor_complete rag_cursor_to_multicat
    complete -F _rag_cursor_complete rag_cursor_search
    
    # Multicursor functions
    complete -F _rag_mcursor_complete rag_mcursor_create
    complete -F _rag_mcursor_complete rag_mcursor_list
    complete -F _rag_mcursor_complete rag_mcursor_show
    complete -F _rag_mcursor_complete rag_mcursor_add
    complete -F _rag_mcursor_complete rag_mcursor_remove
    complete -F _rag_mcursor_complete rag_mcursor_delete
    complete -F _rag_mcursor_complete rag_mcursor_tag
    complete -F _rag_mcursor_complete rag_mcursor_to_multicat
    complete -F _rag_mcursor_complete rag_mcursor_from_multicat
    
    # REPL function
    complete -F _rag_repl_complete rag_repl
    
    # Existing tools
    complete -f -X "!*.mc" mcinfo.sh
    complete -f -X "!*.mc" multisplit.sh
    complete -d multicat.sh
}

# Dynamic completion for discovering new rag_* functions
_rag_dynamic_complete() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    
    # Complete rag_* function names
    if [[ "$cur" == rag_* ]]; then
        local rag_functions
        rag_functions=$(declare -F | grep -o 'rag_[a-zA-Z_]*' | sort -u)
        COMPREPLY=($(compgen -W "$rag_functions" -- "$cur"))
    fi
}

# Set up dynamic completion for rag_* patterns
complete -F _rag_dynamic_complete -P rag_

# Utility functions for REPL integration
rag_complete_cursor_ids() {
    _rag_get_cursor_ids
}

rag_complete_mcursor_ids() {
    _rag_get_mcursor_ids
}

rag_complete_multicat_files() {
    _rag_get_multicat_files
}

# Enhanced cat completion for blocks
_rag_cat_blocks_complete() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"
    
    case "$COMP_CWORD" in
        1) COMPREPLY=($(compgen -W "1,2,3 1-5 all" -- "$cur")) ;;  # block numbers
        2) COMPREPLY=($(compgen -W "$(_rag_get_multicat_files)" -- "$cur")) ;;  # .mc files
    esac
}

# Enhanced mcat completion
_rag_mcat_from_cursors_complete() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    [[ $COMP_CWORD -eq 1 ]] && COMPREPLY=($(compgen -W "$(_rag_get_mcursor_ids)" -- "$cur"))
}

# Set up additional completions
complete -F _rag_cat_blocks_complete rag_cat_blocks
complete -F _rag_mcat_from_cursors_complete rag_mcat_from_cursors

# Initialize completion when this file is sourced
_rag_setup_completion