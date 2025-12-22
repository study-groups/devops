#!/usr/bin/env bash
# terrain_complete.sh - Tab completion for terrain command

# =============================================================================
# COMPLETION CONSTANTS
# =============================================================================

_TERRAIN_COMMANDS="build local config modes themes doctor help version"
_TERRAIN_CONFIG_VERBS="validate show"
_TERRAIN_MODES_VERBS="list show"
_TERRAIN_THEMES_VERBS="list show"
_TERRAIN_LOCAL_VERBS="clean"

# =============================================================================
# COMPLETION HELPERS
# =============================================================================

_terrain_complete_modes() {
    if [[ -n "$TERRAIN_SRC" && -d "$TERRAIN_SRC/dist/modes" ]]; then
        for f in "$TERRAIN_SRC/dist/modes"/*.mode.json; do
            [[ -f "$f" ]] && basename "$f" .mode.json
        done
    fi
}

_terrain_complete_themes() {
    if [[ -n "$TERRAIN_SRC" && -d "$TERRAIN_SRC/dist/themes" ]]; then
        for f in "$TERRAIN_SRC/dist/themes"/*.theme.css; do
            [[ -f "$f" ]] && basename "$f" .theme.css
        done
    fi
}

# =============================================================================
# MAIN COMPLETION FUNCTION
# =============================================================================

_terrain_complete() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"
    local cmd="${COMP_WORDS[1]:-}"

    COMPREPLY=()

    # First argument - complete commands
    if [[ $COMP_CWORD -eq 1 ]]; then
        COMPREPLY=($(compgen -W "$_TERRAIN_COMMANDS" -- "$cur"))
        return
    fi

    # Handle -o/--output flag
    if [[ "$prev" == "-o" || "$prev" == "--output" ]]; then
        compopt -o filenames
        COMPREPLY=($(compgen -f -- "$cur"))
        return
    fi

    # Second+ arguments based on command
    case "$cmd" in
        build|b)
            if [[ "$cur" == -* ]]; then
                COMPREPLY=($(compgen -W "-o --output" -- "$cur"))
            else
                compopt -o dirnames
                COMPREPLY=($(compgen -d -- "$cur"))
            fi
            ;;
        local|l)
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "$_TERRAIN_LOCAL_VERBS" -- "$cur"))
                compopt -o dirnames
                COMPREPLY+=($(compgen -d -- "$cur"))
            fi
            ;;
        config|c)
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "$_TERRAIN_CONFIG_VERBS" -- "$cur"))
            fi
            ;;
        modes|mode|m)
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "$_TERRAIN_MODES_VERBS" -- "$cur"))
            elif [[ $COMP_CWORD -eq 3 && "${COMP_WORDS[2]}" == "show" ]]; then
                COMPREPLY=($(compgen -W "$(_terrain_complete_modes)" -- "$cur"))
            fi
            ;;
        themes|theme|t)
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "$_TERRAIN_THEMES_VERBS" -- "$cur"))
            elif [[ $COMP_CWORD -eq 3 && "${COMP_WORDS[2]}" == "show" ]]; then
                COMPREPLY=($(compgen -W "$(_terrain_complete_themes)" -- "$cur"))
            fi
            ;;
        doctor|d)
            compopt -o dirnames
            COMPREPLY=($(compgen -d -- "$cur"))
            ;;
        help)
            COMPREPLY=($(compgen -W "build local config modes themes doctor" -- "$cur"))
            ;;
    esac
}

complete -F _terrain_complete terrain
