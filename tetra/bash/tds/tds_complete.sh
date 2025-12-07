#!/usr/bin/env bash
# tds_complete.sh - Tab completion for tds command
#
# Supports verb-noun syntax: tds <verb> <noun> [args]

# =============================================================================
# COMPLETION DATA
# =============================================================================

# Verbs (operations)
_TDS_VERBS="get set validate create delete copy edit path save doctor help repl"

# Nouns by verb
_TDS_NOUNS_GET="theme themes palette palettes token tokens hex"
_TDS_NOUNS_SET="theme palette token"
_TDS_NOUNS_VALIDATE="theme tokens"
_TDS_NOUNS_CREATE="theme"
_TDS_NOUNS_DELETE="theme"
_TDS_NOUNS_COPY="theme"
_TDS_NOUNS_EDIT="theme"
_TDS_NOUNS_PATH="theme"
_TDS_NOUNS_SAVE="theme"

# Palette names
_TDS_PALETTES="env mode verbs nouns"

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

# List available theme names from registry
_tds_complete_themes() {
    if [[ -n "${TDS_THEME_REGISTRY[*]}" ]]; then
        printf '%s\n' "${!TDS_THEME_REGISTRY[@]}"
    else
        local tds_src="${TDS_SRC:-$TETRA_SRC/bash/tds}"
        if [[ -d "$tds_src/themes" ]]; then
            for f in "$tds_src/themes"/*.sh; do
                [[ -f "$f" ]] || continue
                local name=$(basename "$f" .sh)
                [[ "$name" != "theme_registry" ]] && echo "$name"
            done
        fi
    fi
}

# List custom themes only (excludes built-in)
_tds_complete_custom_themes() {
    local tds_src="${TDS_SRC:-$TETRA_SRC/bash/tds}"
    if [[ -d "$tds_src/themes" ]]; then
        for f in "$tds_src/themes"/*.sh; do
            [[ -f "$f" ]] || continue
            local name=$(basename "$f" .sh)
            case "$name" in
                theme_registry|default|warm|cool|neutral|electric) continue ;;
                *) echo "$name" ;;
            esac
        done
    fi
}

# =============================================================================
# MAIN COMPLETION FUNCTION
# =============================================================================

_tds_complete() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local verb="${COMP_WORDS[1]:-}"
    local noun="${COMP_WORDS[2]:-}"

    COMPREPLY=()

    # Word 1: Complete verbs
    if [[ $COMP_CWORD -eq 1 ]]; then
        COMPREPLY=($(compgen -W "$_TDS_VERBS" -- "$cur"))
        return
    fi

    # Word 2: Complete nouns based on verb
    if [[ $COMP_CWORD -eq 2 ]]; then
        case "$verb" in
            get)      COMPREPLY=($(compgen -W "$_TDS_NOUNS_GET" -- "$cur")) ;;
            set)      COMPREPLY=($(compgen -W "$_TDS_NOUNS_SET" -- "$cur")) ;;
            validate) COMPREPLY=($(compgen -W "$_TDS_NOUNS_VALIDATE" -- "$cur")) ;;
            create)   COMPREPLY=($(compgen -W "$_TDS_NOUNS_CREATE" -- "$cur")) ;;
            delete)   COMPREPLY=($(compgen -W "$_TDS_NOUNS_DELETE" -- "$cur")) ;;
            copy)     COMPREPLY=($(compgen -W "$_TDS_NOUNS_COPY" -- "$cur")) ;;
            edit)     COMPREPLY=($(compgen -W "$_TDS_NOUNS_EDIT" -- "$cur")) ;;
            path)     COMPREPLY=($(compgen -W "$_TDS_NOUNS_PATH" -- "$cur")) ;;
            save)     COMPREPLY=($(compgen -W "$_TDS_NOUNS_SAVE" -- "$cur")) ;;
        esac
        return
    fi

    # Word 3: Complete args based on verb+noun
    if [[ $COMP_CWORD -eq 3 ]]; then
        case "$verb $noun" in
            "get theme")
                # -v flag or theme names
                COMPREPLY=($(compgen -W "-v $(_tds_complete_themes)" -- "$cur"))
                ;;
            "set theme"|"validate theme"|"edit theme"|"path theme")
                COMPREPLY=($(compgen -W "$(_tds_complete_themes)" -- "$cur"))
                ;;
            "delete theme")
                COMPREPLY=($(compgen -W "$(_tds_complete_custom_themes)" -- "$cur"))
                ;;
            "copy theme")
                # Source theme
                COMPREPLY=($(compgen -W "$(_tds_complete_themes)" -- "$cur"))
                ;;
            "get palette"|"set palette")
                COMPREPLY=($(compgen -W "$_TDS_PALETTES" -- "$cur"))
                ;;
        esac
        return
    fi

    # Word 4: Complete based on verb+noun
    if [[ $COMP_CWORD -eq 4 ]]; then
        case "$verb $noun" in
            "set palette")
                # Index 0-7
                COMPREPLY=($(compgen -W "0 1 2 3 4 5 6 7" -- "$cur"))
                ;;
            "copy theme")
                # Destination theme name (no completion, user types new name)
                ;;
        esac
        return
    fi

    # Word 5: hex color for "set palette" (no completion)
}

# Register completion
complete -F _tds_complete tds

# =============================================================================
# EXPORTS
# =============================================================================

while IFS= read -r func; do
    export -f "$func"
done < <(declare -F | awk '{print $3}' | grep -E '^_tds_complete')
