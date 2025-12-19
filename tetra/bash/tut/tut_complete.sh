#!/usr/bin/env bash
# tut_complete.sh - Tab completion for tut command (doctl-style)

# =============================================================================
# COMPLETION CONSTANTS
# =============================================================================

# Resources
_TUT_RESOURCES="source doc recording schema extra"

# Resource verbs (primary only - no aliases)
_TUT_SOURCE_VERBS="list build init validate edit hydrate"
_TUT_DOC_VERBS="list serve open index run browse"
_TUT_RECORDING_VERBS="list play capture"
_TUT_SCHEMA_VERBS="list show edit"
_TUT_EXTRA_VERBS="list show"

# Top-level commands (primary only - no aliases or legacy)
_TUT_COMMANDS="source doc recording schema extra doctor help version ls build serve open"

# Types
_TUT_DOC_TYPES="guide reference"
_TUT_FORMATS="html md all"
_TUT_SCHEMAS="guide reference"
_TUT_EXTRAS="design-tokens mindmap tds"

# =============================================================================
# COMPLETION HELPERS
# =============================================================================

_tut_complete_sources() {
    # Complete from available/ directory (without .json extension)
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

_tut_complete_recordings() {
    # Complete from recordings/ directory
    if [[ -n "$TUT_DIR" && -d "$TUT_DIR/recordings" ]]; then
        for d in "$TUT_DIR/recordings"/*/; do
            [[ -d "$d" ]] && basename "$d"
        done
    fi
}

# =============================================================================
# MAIN COMPLETION FUNCTION
# =============================================================================

_tut_complete() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"
    local resource="${COMP_WORDS[1]:-}"
    local verb="${COMP_WORDS[2]:-}"

    COMPREPLY=()

    # First argument - complete resources and top-level commands
    if [[ $COMP_CWORD -eq 1 ]]; then
        COMPREPLY=($(compgen -W "$_TUT_COMMANDS" -- "$cur"))
        return
    fi

    # Handle flags that take values
    case "$prev" in
        --type|-t)
            COMPREPLY=($(compgen -W "$_TUT_DOC_TYPES" -- "$cur"))
            return
            ;;
        --format|-f)
            COMPREPLY=($(compgen -W "$_TUT_FORMATS" -- "$cur"))
            return
            ;;
        --output|-o|--out)
            compopt -o filenames
            COMPREPLY=($(compgen -f -- "$cur"))
            return
            ;;
        --port|-p)
            return  # User types port number
            ;;
        --org)
            return  # User types org name
            ;;
    esac

    # Second argument - complete verbs for resources, or args for shortcuts
    if [[ $COMP_CWORD -eq 2 ]]; then
        case "$resource" in
            source)
                COMPREPLY=($(compgen -W "$_TUT_SOURCE_VERBS" -- "$cur"))
                ;;
            doc)
                COMPREPLY=($(compgen -W "$_TUT_DOC_VERBS" -- "$cur"))
                ;;
            recording)
                COMPREPLY=($(compgen -W "$_TUT_RECORDING_VERBS" -- "$cur"))
                ;;
            schema)
                COMPREPLY=($(compgen -W "$_TUT_SCHEMA_VERBS" -- "$cur"))
                ;;
            extra)
                COMPREPLY=($(compgen -W "$_TUT_EXTRA_VERBS" -- "$cur"))
                ;;
            help)
                COMPREPLY=($(compgen -W "source doc recording schema extra all" -- "$cur"))
                ;;
            # Shortcut completions
            ls)
                COMPREPLY=($(compgen -W "src sources docs doc recordings rec schemas extras" -- "$cur"))
                ;;
            build)
                COMPREPLY=($(compgen -W "$(_tut_complete_sources)" -- "$cur"))
                ;;
            serve)
                if [[ "$cur" == -* ]]; then
                    COMPREPLY=($(compgen -W "--stop --status --port" -- "$cur"))
                else
                    COMPREPLY=($(compgen -W "$(_tut_complete_generated)" -- "$cur"))
                fi
                ;;
            open)
                COMPREPLY=($(compgen -W "$(_tut_complete_generated)" -- "$cur"))
                ;;
        esac
        return
    fi

    # Third+ argument - context-specific completion
    case "$resource" in
        source)
            case "$verb" in
                build)
                    if [[ "$cur" == -* ]]; then
                        COMPREPLY=($(compgen -W "--type --format --output --out --no-bump --all" -- "$cur"))
                    else
                        COMPREPLY=($(compgen -W "$(_tut_complete_sources)" -- "$cur"))
                    fi
                    ;;
                init)
                    if [[ "$cur" == -* ]]; then
                        COMPREPLY=($(compgen -W "--type" -- "$cur"))
                    fi
                    ;;
                validate|edit)
                    COMPREPLY=($(compgen -W "$(_tut_complete_sources)" -- "$cur"))
                    ;;
                list)
                    if [[ "$cur" == -* ]]; then
                        COMPREPLY=($(compgen -W "-v --verbose" -- "$cur"))
                    fi
                    ;;
            esac
            ;;
        doc)
            case "$verb" in
                serve)
                    if [[ "$cur" == -* ]]; then
                        COMPREPLY=($(compgen -W "--stop --status --port" -- "$cur"))
                    else
                        COMPREPLY=($(compgen -W "$(_tut_complete_generated)" -- "$cur"))
                    fi
                    ;;
                open)
                    COMPREPLY=($(compgen -W "$(_tut_complete_generated)" -- "$cur"))
                    ;;
                run)
                    if [[ "$cur" == -* ]]; then
                        COMPREPLY=($(compgen -W "--org --port --no-browser" -- "$cur"))
                    else
                        COMPREPLY=($(compgen -W "$(_tut_complete_sources)" -- "$cur"))
                    fi
                    ;;
                browse)
                    compopt -o filenames
                    COMPREPLY=($(compgen -f -X '!*.md' -- "$cur"))
                    ;;
            esac
            ;;
        recording)
            case "$verb" in
                play|capture)
                    COMPREPLY=($(compgen -W "$(_tut_complete_recordings)" -- "$cur"))
                    ;;
            esac
            ;;
        schema)
            case "$verb" in
                show|edit)
                    COMPREPLY=($(compgen -W "$_TUT_SCHEMAS" -- "$cur"))
                    ;;
            esac
            ;;
        extra)
            case "$verb" in
                show)
                    COMPREPLY=($(compgen -W "$_TUT_EXTRAS" -- "$cur"))
                    ;;
            esac
            ;;
    esac
}

complete -F _tut_complete tut
