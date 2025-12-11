#!/usr/bin/env bash

# chroma_complete.sh - Tab completion for chroma command

# =============================================================================
# COMPLETION DATA
# =============================================================================

# All chroma subcommands
_CHROMA_COMMANDS="cst doctor parser status reload table help"

# Help topics
_CHROMA_HELP_TOPICS="render parser format doctor options"

# Format flags (shortcuts)
_CHROMA_FORMATS="--toml --json --md --markdown --claude --ansi"

# Options
_CHROMA_OPTIONS="-p --pager -n --no-pager -w --width -m --margin -t --theme -f --format --preset --rule --list-rules --clear-rules -h --help"

# Parser subcommands
_CHROMA_PARSER_COMMANDS="list info"

# Doctor options
_CHROMA_DOCTOR_OPTIONS="-v --verbose --check"

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

# List registered parser names
_chroma_complete_parsers() {
    printf '%s\n' "${CHROMA_PARSER_ORDER[@]}"
}

# List available themes
_chroma_complete_themes() {
    if declare -p TDS_THEME_REGISTRY &>/dev/null; then
        printf '%s\n' "${!TDS_THEME_REGISTRY[@]}"
    else
        echo "default warm cool neutral electric"
    fi
}

# List available presets
_chroma_complete_presets() {
    echo "markers bookmarks sections all"
}

# List doctor check names
_chroma_complete_checks() {
    echo "dependencies tds parsers themes tokens"
}

# =============================================================================
# MAIN COMPLETION FUNCTION
# =============================================================================

_chroma_complete() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"
    local cmd="${COMP_WORDS[1]:-}"

    COMPREPLY=()

    # First argument - could be subcommand, option, or file
    if [[ $COMP_CWORD -eq 1 ]]; then
        if [[ "$cur" == -* ]]; then
            # Option
            COMPREPLY=($(compgen -W "$_CHROMA_OPTIONS $_CHROMA_FORMATS" -- "$cur"))
        elif [[ "$cur" == . || "$cur" == ./* || "$cur" == /* || "$cur" == ~/* ]]; then
            # Explicit path - show all files and directories for navigation
            COMPREPLY=($(compgen -f -- "$cur"))
            compopt -o filenames 2>/dev/null
        else
            # Subcommand or file
            COMPREPLY=($(compgen -W "$_CHROMA_COMMANDS" -- "$cur"))
            # Also complete files (md, toml, json)
            COMPREPLY+=($(compgen -f -X '!*.@(md|toml|json|markdown)' -- "$cur"))
            compopt -o filenames 2>/dev/null
        fi
        return
    fi

    # Handle based on previous word
    case "$prev" in
        # Theme completion
        -t|--theme)
            COMPREPLY=($(compgen -W "$(_chroma_complete_themes)" -- "$cur"))
            return
            ;;

        # Width - no completion (expects number)
        -w|--width)
            return
            ;;

        # Margin - no completion (expects number)
        -m|--margin)
            return
            ;;

        # Format completion
        -f|--format)
            COMPREPLY=($(compgen -W "$(_chroma_complete_parsers)" -- "$cur"))
            return
            ;;

        # Preset completion
        --preset)
            COMPREPLY=($(compgen -W "$(_chroma_complete_presets)" -- "$cur"))
            return
            ;;

        # Rule - no completion (expects sed pattern)
        --rule)
            return
            ;;

        # Doctor --check completion
        --check)
            COMPREPLY=($(compgen -W "$(_chroma_complete_checks)" -- "$cur"))
            return
            ;;
    esac

    # Handle subcommand arguments
    case "$cmd" in
        # Parser subcommand
        parser|parsers)
            if [[ $COMP_CWORD -eq 2 ]]; then
                # Second word: parser subcommand
                COMPREPLY=($(compgen -W "$_CHROMA_PARSER_COMMANDS" -- "$cur"))
            elif [[ $COMP_CWORD -eq 3 && "${COMP_WORDS[2]}" == "info" ]]; then
                # Third word after "parser info": parser name
                COMPREPLY=($(compgen -W "$(_chroma_complete_parsers)" -- "$cur"))
            fi
            return
            ;;

        # Doctor subcommand
        doctor)
            if [[ "$cur" == -* ]]; then
                COMPREPLY=($(compgen -W "$_CHROMA_DOCTOR_OPTIONS" -- "$cur"))
            fi
            return
            ;;

        # Help subcommand - complete topics
        help)
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "$_CHROMA_HELP_TOPICS" -- "$cur"))
            fi
            return
            ;;

        # Status/reload - no additional completion
        status|reload)
            return
            ;;
    esac

    # Default: options or file completion
    if [[ "$cur" == -* ]]; then
        COMPREPLY=($(compgen -W "$_CHROMA_OPTIONS $_CHROMA_FORMATS" -- "$cur"))
    elif [[ "$cur" == . || "$cur" == ./* || "$cur" == /* || "$cur" == ~/* ]]; then
        # Explicit path - show all files and directories for navigation
        COMPREPLY=($(compgen -f -- "$cur"))
        compopt -o filenames 2>/dev/null
    else
        # File completion for supported formats
        COMPREPLY=($(compgen -f -X '!*.@(md|toml|json|markdown)' -- "$cur"))
        compopt -o filenames 2>/dev/null
    fi
}

# Register completion
complete -F _chroma_complete chroma

# =============================================================================
# EXPORTS
# =============================================================================

export -f _chroma_complete
export -f _chroma_complete_parsers _chroma_complete_themes
export -f _chroma_complete_presets _chroma_complete_checks
