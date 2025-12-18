#!/usr/bin/env bash

# games_complete.sh - Tab completion for games command
#
# Provides completion for:
#   - games subcommands
#   - game names (for play, info, controls, pak)
#   - org names
#   - gamepak files (for unpak)
#   - help topics

# =============================================================================
# COMPLETION DATA
# =============================================================================

_GAMES_COMMANDS="list play info controls org orgs search pak unpak doctor help"
_GAMES_HELP_TOPICS="play orgs pak all"

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

# Get active org
_games_complete_active_org() {
    if [[ -n "$GAMES_ORG" ]]; then
        echo "$GAMES_ORG"
    elif [[ -n "$GAMES_CTX_ORG" ]]; then
        echo "$GAMES_CTX_ORG"
    else
        echo "tetra"
    fi
}

# List organization names
_games_complete_orgs() {
    local orgs_dir="$TETRA_DIR/orgs"
    [[ -d "$orgs_dir" ]] || return
    for dir in "$orgs_dir"/*/; do
        [[ -d "$dir" ]] && basename "$dir"
    done
}

# List game names in current org
_games_complete_games() {
    local org=$(_games_complete_active_org)
    local games_dir="$TETRA_DIR/orgs/$org/games"
    [[ -d "$games_dir" ]] || return

    for game_dir in "$games_dir"/*/; do
        [[ -d "$game_dir" ]] && basename "$game_dir"
    done
}

# List gamepak files
_games_complete_gamepaks() {
    local cur="$1"
    compgen -f -X '!*.tar.gz' -- "$cur" 2>/dev/null
    compgen -f -X '!*.gamepak.tar.gz' -- "$cur" 2>/dev/null
}

# =============================================================================
# MAIN COMPLETION FUNCTION
# =============================================================================

_games_complete() {
    local cur prev cmd

    # Handle completion
    if type _get_comp_words_by_ref &>/dev/null; then
        _get_comp_words_by_ref -n : cur prev 2>/dev/null
    else
        cur="${COMP_WORDS[COMP_CWORD]}"
        prev="${COMP_WORDS[COMP_CWORD-1]}"
    fi
    cmd="${COMP_WORDS[1]:-}"

    COMPREPLY=()

    # First argument - commands
    if [[ $COMP_CWORD -eq 1 ]]; then
        COMPREPLY=($(compgen -W "$_GAMES_COMMANDS" -- "$cur"))
        return
    fi

    # Second argument - depends on command
    if [[ $COMP_CWORD -eq 2 ]]; then
        case "$cmd" in
            play|run|info|controls|ctrl|pak|pack|backup)
                # Complete game names
                COMPREPLY=($(compgen -W "$(_games_complete_games)" -- "$cur"))
                ;;
            org)
                # Complete org names
                COMPREPLY=($(compgen -W "$(_games_complete_orgs)" -- "$cur"))
                ;;
            unpak|unpack|restore)
                # Complete gamepak files
                COMPREPLY=($(_games_complete_gamepaks "$cur"))
                [[ ${#COMPREPLY[@]} -gt 0 ]] && compopt -o filenames
                ;;
            search|find)
                # No completion for search query
                ;;
            help)
                # Help topics
                COMPREPLY=($(compgen -W "$_GAMES_HELP_TOPICS" -- "$cur"))
                ;;
            *)
                ;;
        esac
        return
    fi

    # Third argument
    if [[ $COMP_CWORD -eq 3 ]]; then
        case "$cmd" in
            play|run)
                # Options after game name
                COMPREPLY=($(compgen -W "--controls" -- "$cur"))
                ;;
            pak|pack|backup)
                # Output filename after game name
                COMPREPLY=($(compgen -f -- "$cur"))
                compopt -o filenames
                ;;
            *)
                ;;
        esac
        return
    fi

    # Fourth argument
    if [[ $COMP_CWORD -eq 4 ]]; then
        case "$cmd" in
            play|run)
                # After --controls, can specify custom controls file
                if [[ "${COMP_WORDS[3]}" == "--controls" ]]; then
                    COMPREPLY=($(compgen -f -X '!*.json' -- "$cur"))
                    compopt -o filenames
                fi
                ;;
            *)
                ;;
        esac
    fi
}

# =============================================================================
# REGISTER COMPLETIONS
# =============================================================================

complete -F _games_complete games

# =============================================================================
# EXPORTS
# =============================================================================

export -f _games_complete
export -f _games_complete_orgs
export -f _games_complete_active_org
export -f _games_complete_games
export -f _games_complete_gamepaks
