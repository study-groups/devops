#!/usr/bin/env bash

# games_complete.sh - Tab completion for games command
#
# Provides completion for:
#   - games subcommands
#   - game names (for play, info, controls, pak)
#   - game slugs from manifest (for get, set, rm, access, url, deploy)
#   - org names
#   - gamepak files (for unpak)
#   - zip files (for upload)
#   - help topics

# =============================================================================
# COMPLETION DATA
# =============================================================================

_GAMES_COMMANDS="list play info controls org orgs search pak unpak doctor help"
_GAMES_COMMANDS+=" get set add rm import access"          # CRUD
_GAMES_COMMANDS+=" upload url"                             # Upload
_GAMES_COMMANDS+=" deploy deploy-all deploy-status"        # Deploy
_GAMES_COMMANDS+=" manifest"                               # Manifest

_GAMES_HELP_TOPICS="play orgs pak crud upload deploy manifest all"

_GAMES_ROLES="guest user premium dev admin"
_GAMES_SUBSCRIPTIONS="free basic pro enterprise"

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

# List game names in current org (filesystem)
_games_complete_games() {
    local org=$(_games_complete_active_org)
    local games_dir="$TETRA_DIR/orgs/$org/games"
    [[ -d "$games_dir" ]] || return

    for game_dir in "$games_dir"/*/; do
        [[ -d "$game_dir" ]] && basename "$game_dir"
    done
}

# List game slugs from manifest (for CRUD operations)
_games_complete_slugs() {
    local manifest="${PJA_GAMES_DIR:-${TETRA_DIR}/orgs/pixeljam-arcade/games}/games.json"
    [[ -f "$manifest" ]] || return
    jq -r '.games | keys[]' "$manifest" 2>/dev/null
}

# List gamepak files
_games_complete_gamepaks() {
    local cur="$1"
    compgen -f -X '!*.tar.gz' -- "$cur" 2>/dev/null
    compgen -f -X '!*.gamepak.tar.gz' -- "$cur" 2>/dev/null
}

# List zip files
_games_complete_zips() {
    local cur="$1"
    compgen -f -X '!*.zip' -- "$cur" 2>/dev/null
}

# List manifest fields for games set
_games_complete_fields() {
    echo "name summary version show thumbnail src url_path"
    echo "access_control.requires_auth access_control.min_role access_control.min_subscription"
}

# =============================================================================
# MAIN COMPLETION FUNCTION
# =============================================================================

_games_complete() {
    local cur prev cmd
    local words

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
            # Filesystem game names
            play|run|info|controls|ctrl|pak|pack|backup)
                COMPREPLY=($(compgen -W "$(_games_complete_games)" -- "$cur"))
                ;;
            # Manifest slugs
            get|set|rm|remove|access|url|deploy)
                COMPREPLY=($(compgen -W "$(_games_complete_slugs)" -- "$cur"))
                ;;
            # Add options
            add)
                if [[ "$cur" == -* ]]; then
                    COMPREPLY=($(compgen -W "--name --summary --version --hide --auth --role --subscription" -- "$cur"))
                fi
                ;;
            # Import directory
            import)
                COMPREPLY=($(compgen -d -- "$cur"))
                compopt -o filenames
                ;;
            # Upload zip files
            upload)
                COMPREPLY=($(_games_complete_zips "$cur"))
                [[ ${#COMPREPLY[@]} -gt 0 ]] && compopt -o filenames
                ;;
            # Deploy-all/status takes host
            deploy-all|deploy-status)
                # No completion for hosts
                ;;
            # Org names
            org)
                COMPREPLY=($(compgen -W "$(_games_complete_orgs)" -- "$cur"))
                ;;
            # Gamepak files
            unpak|unpack|restore)
                COMPREPLY=($(_games_complete_gamepaks "$cur"))
                [[ ${#COMPREPLY[@]} -gt 0 ]] && compopt -o filenames
                ;;
            # Manifest subcommands
            manifest)
                COMPREPLY=($(compgen -W "rebuild list validate" -- "$cur"))
                ;;
            # Help topics
            help)
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
                COMPREPLY=($(compgen -W "--controls" -- "$cur"))
                ;;
            pak|pack|backup)
                COMPREPLY=($(compgen -f -- "$cur"))
                compopt -o filenames
                ;;
            # set <slug> <field>
            set)
                COMPREPLY=($(compgen -W "$(_games_complete_fields)" -- "$cur"))
                ;;
            # access <slug> <options>
            access)
                COMPREPLY=($(compgen -W "--auth --no-auth --role --subscription" -- "$cur"))
                ;;
            # add <slug> <options>
            add)
                COMPREPLY=($(compgen -W "--name --summary --version --hide --auth --role --subscription" -- "$cur"))
                ;;
            # upload <file> <options>
            upload)
                COMPREPLY=($(compgen -W "--s3 --sync --dry-run --force" -- "$cur"))
                ;;
            # deploy <slug> <host>
            deploy)
                # No completion for host
                ;;
            *)
                ;;
        esac
        return
    fi

    # Fourth+ arguments - context-aware options
    case "$cmd" in
        access)
            case "$prev" in
                --role)
                    COMPREPLY=($(compgen -W "$_GAMES_ROLES" -- "$cur"))
                    ;;
                --subscription)
                    COMPREPLY=($(compgen -W "$_GAMES_SUBSCRIPTIONS" -- "$cur"))
                    ;;
                *)
                    COMPREPLY=($(compgen -W "--auth --no-auth --role --subscription" -- "$cur"))
                    ;;
            esac
            ;;
        add)
            case "$prev" in
                --role)
                    COMPREPLY=($(compgen -W "$_GAMES_ROLES" -- "$cur"))
                    ;;
                --subscription)
                    COMPREPLY=($(compgen -W "$_GAMES_SUBSCRIPTIONS" -- "$cur"))
                    ;;
                --name|--summary|--version)
                    # No completion for free text
                    ;;
                *)
                    COMPREPLY=($(compgen -W "--name --summary --version --hide --auth --role --subscription" -- "$cur"))
                    ;;
            esac
            ;;
        deploy)
            case "$prev" in
                --key|-i)
                    COMPREPLY=($(compgen -f -- "$cur"))
                    compopt -o filenames
                    ;;
                --dest|-d)
                    COMPREPLY=($(compgen -d -- "$cur"))
                    compopt -o filenames
                    ;;
                --user|-u)
                    # No completion for username
                    ;;
                *)
                    COMPREPLY=($(compgen -W "--key --user --dest --s3 --manifest --dry-run" -- "$cur"))
                    ;;
            esac
            ;;
        upload)
            COMPREPLY=($(compgen -W "--s3 --sync --dry-run --force" -- "$cur"))
            ;;
        play|run)
            if [[ "${COMP_WORDS[3]}" == "--controls" ]]; then
                COMPREPLY=($(compgen -f -X '!*.json' -- "$cur"))
                compopt -o filenames
            fi
            ;;
        *)
            ;;
    esac
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
export -f _games_complete_slugs
export -f _games_complete_gamepaks
export -f _games_complete_zips
export -f _games_complete_fields
