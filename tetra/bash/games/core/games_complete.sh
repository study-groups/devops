#!/usr/bin/env bash

# games_complete.sh - Multi-level tab completion for games command
#
# Provides completion for:
#   - games subcommands
#   - org names
#   - category names
#   - game names (for play)
#   - deploy strings (org:category:env:action)
#   - actions and flags

# =============================================================================
# COMPLETION DATA
# =============================================================================

# Main games subcommands
_GAMES_COMMANDS="list play pak unpak push pull sync status help"

# Deploy string actions
_GAMES_ACTIONS="list validate status sync pull push run pack install"

# Environments
_GAMES_ENVS="dev staging prod"

# Common flags
_GAMES_FLAGS="--dry-run --delete --verbose -v -n"

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

# List organization names
_games_complete_orgs() {
    local orgs_dir="$TETRA_DIR/orgs"
    [[ -d "$orgs_dir" ]] || return
    for dir in "$orgs_dir"/*/; do
        [[ -d "$dir" ]] && basename "$dir"
    done
}

# List game categories for an org
_games_complete_categories() {
    local org="$1"
    [[ -z "$org" ]] && org=$(_games_complete_active_org)
    local games_dir="$TETRA_DIR/orgs/$org/games"

    # List from actual directory if exists
    if [[ -d "$games_dir" ]]; then
        for dir in "$games_dir"/*/; do
            [[ -d "$dir" ]] && basename "$dir"
        done
    fi

    # Also offer standard categories
    echo "games"
    echo "pja-games"
    echo "pja-vector"
}

# Get active org (from GAMES_ORG or org_active)
_games_complete_active_org() {
    if [[ -n "$GAMES_ORG" ]]; then
        echo "$GAMES_ORG"
    elif type org_active &>/dev/null; then
        org_active 2>/dev/null
    else
        echo "tetra"
    fi
}

# List game names
_games_complete_games() {
    local org=$(_games_complete_active_org)
    local games_dir="${GAMES_DIR:-$TETRA_DIR/orgs/$org/games}"
    [[ -d "$games_dir" ]] || return

    # List game directories (check for game markers)
    for game_dir in "$games_dir"/*/; do
        [[ -d "$game_dir" ]] || continue
        # Check if it looks like a game (has index.html or game.json)
        if [[ -f "$game_dir/index.html" || -f "$game_dir/game.json" ]]; then
            basename "$game_dir"
        fi
    done

    # Also list from subdirectories (categories)
    for cat_dir in "$games_dir"/*/; do
        [[ -d "$cat_dir" ]] || continue
        for game_dir in "$cat_dir"/*/; do
            [[ -d "$game_dir" ]] || continue
            if [[ -f "$game_dir/index.html" || -f "$game_dir/game.json" ]]; then
                basename "$game_dir"
            fi
        done
    done
}

# List gamepak files in current directory
_games_complete_gamepaks() {
    local cur="$1"
    compgen -f -X '!*.gamepak.tar.gz' -- "$cur" 2>/dev/null
    compgen -f -X '!*.gamepak' -- "$cur" 2>/dev/null
}

# =============================================================================
# DEPLOY STRING COMPLETION
# =============================================================================

# Complete deploy string parts progressively
# Format: org:category:env:action
_games_complete_deploy_string() {
    local cur="$1"
    local parts
    local count

    # Split by colon
    IFS=':' read -ra parts <<< "$cur"
    count=${#parts[@]}

    # Handle trailing colon (means user wants next part)
    [[ "$cur" == *: ]] && ((count++))

    case $count in
        0|1)
            # First part: org name
            local prefix="${parts[0]:-}"
            local orgs=$(_games_complete_orgs)
            for org in $orgs; do
                [[ -z "$prefix" || "$org" == "$prefix"* ]] && echo "${org}:"
            done
            ;;
        2)
            # Second part: category
            local org="${parts[0]}"
            local prefix="${parts[1]:-}"
            local cats=$(_games_complete_categories "$org" | sort -u)
            for cat in $cats; do
                [[ -z "$prefix" || "$cat" == "$prefix"* ]] && echo "${org}:${cat}:"
            done
            ;;
        3)
            # Third part: env
            local org="${parts[0]}"
            local category="${parts[1]}"
            local prefix="${parts[2]:-}"
            for env in $_GAMES_ENVS; do
                [[ -z "$prefix" || "$env" == "$prefix"* ]] && echo "${org}:${category}:${env}:"
            done
            ;;
        4)
            # Fourth part: action
            local org="${parts[0]}"
            local category="${parts[1]}"
            local env="${parts[2]}"
            local prefix="${parts[3]:-}"
            for action in $_GAMES_ACTIONS; do
                [[ -z "$prefix" || "$action" == "$prefix"* ]] && echo "${org}:${category}:${env}:${action}"
            done
            ;;
        *)
            # Complete, no more parts
            return
            ;;
    esac
}

# Check if string looks like a deploy string (contains colon)
_games_is_deploy_string() {
    [[ "$1" == *:* ]]
}

# =============================================================================
# COLON HANDLING (bash splits on colons by default)
# =============================================================================

_games_complete_colon_fix() {
    local cur="$1"
    [[ "$cur" != *:* || ${#COMPREPLY[@]} -eq 0 ]] && return

    # Use bash-completion helper if available
    __ltrim_colon_completions "$cur" 2>/dev/null && return

    # Manual fix: strip the colon prefix from completions
    local colon_prefix="${cur%"${cur##*:}"}"
    local i
    for i in "${!COMPREPLY[@]}"; do
        COMPREPLY[$i]="${COMPREPLY[$i]#"$colon_prefix"}"
    done
}

# =============================================================================
# MAIN COMPLETION FUNCTION
# =============================================================================

_games_complete() {
    local cur prev cmd

    # Handle colon-split words properly
    _get_comp_words_by_ref -n : cur prev 2>/dev/null || {
        cur="${COMP_WORDS[COMP_CWORD]}"
        prev="${COMP_WORDS[COMP_CWORD-1]}"
    }
    cmd="${COMP_WORDS[1]:-}"

    COMPREPLY=()

    # Handle flags anywhere
    if [[ "$cur" == -* ]]; then
        COMPREPLY=($(compgen -W "$_GAMES_FLAGS" -- "$cur"))
        return
    fi

    # First argument - commands OR deploy strings
    if [[ $COMP_CWORD -eq 1 ]]; then
        if _games_is_deploy_string "$cur"; then
            # Deploy string completion
            local completions=$(_games_complete_deploy_string "$cur")
            COMPREPLY=($(compgen -W "$completions" -- "$cur"))
            _games_complete_colon_fix "$cur"
        else
            # Commands + orgs (for deploy string start)
            local orgs=$(_games_complete_orgs)
            local org_starters=""
            for org in $orgs; do
                org_starters+="$org: "
            done
            COMPREPLY=($(compgen -W "$_GAMES_COMMANDS $orgs" -- "$cur"))

            # If exact match on org, also offer org: to start deploy string
            for org in $orgs; do
                [[ "$org" == "$cur" ]] && COMPREPLY+=("$org:")
            done
        fi
        return
    fi

    # Second argument - depends on first command
    if [[ $COMP_CWORD -eq 2 ]]; then
        # Check if first arg was a deploy string
        if _games_is_deploy_string "$cmd"; then
            # After deploy string, offer flags
            COMPREPLY=($(compgen -W "$_GAMES_FLAGS" -- "$cur"))
            return
        fi

        case "$cmd" in
            play|run)
                # Complete game names
                COMPREPLY=($(compgen -W "$(_games_complete_games)" -- "$cur"))
                ;;
            pak|pack)
                # Complete game names to pack
                COMPREPLY=($(compgen -W "$(_games_complete_games)" -- "$cur"))
                ;;
            unpak|unpack|restore)
                # Complete gamepak files
                COMPREPLY=($(_games_complete_gamepaks "$cur"))
                [[ ${#COMPREPLY[@]} -gt 0 ]] && compopt -o filenames
                ;;
            push|pull|sync)
                # Org or category - support deploy string format
                if _games_is_deploy_string "$cur"; then
                    local completions=$(_games_complete_deploy_string "$cur")
                    COMPREPLY=($(compgen -W "$completions" -- "$cur"))
                    _games_complete_colon_fix "$cur"
                else
                    # Start with orgs
                    local orgs=$(_games_complete_orgs)
                    COMPREPLY=($(compgen -W "$orgs" -- "$cur"))
                    # If exact match, offer colon continuation
                    for org in $orgs; do
                        [[ "$org" == "$cur" ]] && COMPREPLY+=("$org:")
                    done
                fi
                ;;
            status)
                # Status can take org or deploy string
                if _games_is_deploy_string "$cur"; then
                    local completions=$(_games_complete_deploy_string "$cur")
                    COMPREPLY=($(compgen -W "$completions" -- "$cur"))
                    _games_complete_colon_fix "$cur"
                else
                    COMPREPLY=($(compgen -W "$(_games_complete_orgs) --verbose -v" -- "$cur"))
                fi
                ;;
            list|ls)
                # List takes org or flags
                COMPREPLY=($(compgen -W "$(_games_complete_orgs) --verbose -v --json" -- "$cur"))
                ;;
            help)
                # Help topics
                COMPREPLY=($(compgen -W "deploy pak sync play" -- "$cur"))
                ;;
        esac
        return
    fi

    # Third argument
    if [[ $COMP_CWORD -eq 3 ]]; then
        local second="${COMP_WORDS[2]:-}"

        case "$cmd" in
            play|run)
                # After game name, no more args (or --fullscreen etc)
                COMPREPLY=($(compgen -W "--fullscreen --debug" -- "$cur"))
                ;;
            pak|pack)
                # Output filename
                COMPREPLY=($(compgen -f -- "$cur"))
                compopt -o filenames
                ;;
            push|pull|sync)
                # After org, complete category or continue deploy string
                if _games_is_deploy_string "$second"; then
                    # Already a deploy string, offer flags
                    COMPREPLY=($(compgen -W "$_GAMES_FLAGS" -- "$cur"))
                elif _games_is_deploy_string "$cur"; then
                    # Typing a deploy string
                    local completions=$(_games_complete_deploy_string "$cur")
                    COMPREPLY=($(compgen -W "$completions" -- "$cur"))
                    _games_complete_colon_fix "$cur"
                else
                    # After org, offer categories
                    COMPREPLY=($(compgen -W "$(_games_complete_categories "$second")" -- "$cur"))
                fi
                ;;
        esac
        return
    fi

    # Fourth argument
    if [[ $COMP_CWORD -eq 4 ]]; then
        case "$cmd" in
            push|pull|sync)
                # After category, complete env or flags
                COMPREPLY=($(compgen -W "$_GAMES_ENVS $_GAMES_FLAGS" -- "$cur"))
                ;;
        esac
        return
    fi

    # Fifth+ argument - usually flags
    if [[ $COMP_CWORD -ge 5 ]]; then
        COMPREPLY=($(compgen -W "$_GAMES_FLAGS" -- "$cur"))
    fi
}

# =============================================================================
# REGISTER COMPLETIONS
# =============================================================================

complete -F _games_complete games
complete -F _games_complete gamepak

# =============================================================================
# EXPORTS
# =============================================================================

export -f _games_complete
export -f _games_complete_orgs _games_complete_categories _games_complete_active_org
export -f _games_complete_games _games_complete_gamepaks
export -f _games_complete_deploy_string _games_is_deploy_string
export -f _games_complete_colon_fix
