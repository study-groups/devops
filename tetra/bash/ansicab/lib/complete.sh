#!/usr/bin/env bash
# Cabinet Tab Completion

_CABINET_COMMANDS="dev host join games start stop list help"

# Get available game names
_cabinet_games() {
    local games_dir="${TETRA_DIR}/orgs/tetra/games"
    [[ -d "$games_dir" ]] || return
    for game_dir in "$games_dir"/*/; do
        [[ -d "$game_dir" ]] || continue
        local name=$(basename "$game_dir")
        local driver="${game_dir}${name}_driver.js"
        local host="${game_dir}${name}_host.js"
        # Accept either _driver.js or _host.js
        [[ -f "$driver" || -f "$host" ]] && echo "$name"
    done
}

# Main completion function
_cabinet_complete() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"
    local cmd="${COMP_WORDS[1]:-}"

    COMPREPLY=()

    # First arg: complete commands
    if [[ $COMP_CWORD -eq 1 ]]; then
        COMPREPLY=($(compgen -W "$_CABINET_COMMANDS" -- "$cur"))
        return
    fi

    # Second arg: context-sensitive
    case "$cmd" in
        host|start)
            # Complete with available game names
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "$(_cabinet_games)" -- "$cur"))
            elif [[ "$cur" == -* ]]; then
                COMPREPLY=($(compgen -W "--port --http --headless --match-code --max-players" -- "$cur"))
            fi
            ;;
        join)
            # No completion for URLs/codes
            COMPREPLY=()
            ;;
        help)
            # Complete with command names
            COMPREPLY=($(compgen -W "$_CABINET_COMMANDS" -- "$cur"))
            ;;
        dev)
            # Complete with options
            if [[ "$cur" == -* ]]; then
                COMPREPLY=($(compgen -W "--port --headless --http --match-code --max-players" -- "$cur"))
            fi
            ;;
    esac

    # Third+ arg: options for host
    if [[ $COMP_CWORD -ge 3 && "$cur" == -* ]]; then
        case "$cmd" in
            host|dev|start)
                COMPREPLY=($(compgen -W "--port --http --headless --match-code --max-players" -- "$cur"))
                ;;
        esac
    fi
}

# Register completion for the cabinet function/alias
complete -F _cabinet_complete cabinet
