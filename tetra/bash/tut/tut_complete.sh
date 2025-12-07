#!/usr/bin/env bash
# tut_complete.sh - Tab completion for tut command

_TUT_COMMANDS="build init validate serve get types edit doctor help"
_TUT_DOC_TYPES="guide reference"
_TUT_FORMATS="html md all"
_TUT_GET_NOUNS="sources docs recordings"
_TUT_TYPES_NOUNS="guide reference"

_tut_complete_sources() {
    # Complete from available/ directory (without .json extension)
    # Plus special targets like 'index'
    echo "index"
    if [[ -n "$TUT_SRC" && -d "$TUT_SRC/available" ]]; then
        for f in "$TUT_SRC/available"/*.json; do
            [[ -f "$f" ]] && basename "$f" .json
        done
    fi
}

_tut_complete_generated() {
    # Complete from generated/ directory
    if [[ -n "$TUT_DIR" && -d "$TUT_DIR/generated" ]]; then
        for f in "$TUT_DIR/generated"/*.html; do
            [[ -f "$f" ]] && basename "$f"
        done
    fi
}

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

    # Handle flags
    case "$prev" in
        --type|-t)
            COMPREPLY=($(compgen -W "$_TUT_DOC_TYPES" -- "$cur"))
            return
            ;;
        --format|-f)
            COMPREPLY=($(compgen -W "$_TUT_FORMATS" -- "$cur"))
            return
            ;;
        --output|-o)
            compopt -o filenames
            COMPREPLY=($(compgen -f -- "$cur"))
            return
            ;;
    esac

    # Complete based on command
    case "$cmd" in
        build|b|validate|v)
            if [[ "$cur" == -* ]]; then
                COMPREPLY=($(compgen -W "--type --format --output --no-bump --all" -- "$cur"))
            else
                COMPREPLY=($(compgen -W "$(_tut_complete_sources)" -- "$cur"))
            fi
            ;;
        init|i)
            if [[ "$cur" == -* ]]; then
                COMPREPLY=($(compgen -W "--type" -- "$cur"))
            fi
            ;;
        serve|s)
            if [[ "$cur" == -* ]]; then
                COMPREPLY=($(compgen -W "--stop --status --port" -- "$cur"))
            else
                COMPREPLY=($(compgen -W "$(_tut_complete_generated)" -- "$cur"))
            fi
            ;;
        get)
            COMPREPLY=($(compgen -W "$_TUT_GET_NOUNS" -- "$cur"))
            ;;
        types|t)
            COMPREPLY=($(compgen -W "$_TUT_TYPES_NOUNS" -- "$cur"))
            ;;
        edit)
            # For now, edit doesn't have schema nouns - future: edit source files
            ;;
    esac
}

complete -F _tut_complete tut
