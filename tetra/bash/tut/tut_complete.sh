#!/usr/bin/env bash
# tut_complete.sh - Tab completion for tut command

_TUT_COMMANDS="build init validate serve get edit types help"
_TUT_TYPES="tutorial reference"
_TUT_FORMATS="html md all"
_TUT_GET_NOUNS="schemas tutorial-schema reference-schema docs recordings"
_TUT_EDIT_NOUNS="tutorial-schema reference-schema"

_tut_complete_json() {
    shopt -s nullglob
    local files=(*.json)
    shopt -u nullglob
    printf '%s\n' "${files[@]}"
}

_tut_complete_html() {
    shopt -s nullglob
    local files=(*.html)
    shopt -u nullglob
    printf '%s\n' "${files[@]}"

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
            COMPREPLY=($(compgen -W "$_TUT_TYPES" -- "$cur"))
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
                COMPREPLY=($(compgen -W "--type --format --output --no-bump" -- "$cur"))
            else
                COMPREPLY=($(compgen -W "$(_tut_complete_json)" -- "$cur"))
                [[ ${#COMPREPLY[@]} -eq 0 ]] && {
                    compopt -o filenames
                    COMPREPLY=($(compgen -f -X '!*.json' -- "$cur"))
                }
            fi
            ;;
        init|i)
            if [[ "$cur" == -* ]]; then
                COMPREPLY=($(compgen -W "--type" -- "$cur"))
            fi
            ;;
        serve|s)
            COMPREPLY=($(compgen -W "$(_tut_complete_html)" -- "$cur"))
            [[ ${#COMPREPLY[@]} -eq 0 ]] && {
                compopt -o filenames
                COMPREPLY=($(compgen -f -X '!*.html' -- "$cur"))
            }
            ;;
        get)
            COMPREPLY=($(compgen -W "$_TUT_GET_NOUNS" -- "$cur"))
            ;;
        edit)
            COMPREPLY=($(compgen -W "$_TUT_EDIT_NOUNS" -- "$cur"))
            ;;
    esac
}

complete -F _tut_complete tut
