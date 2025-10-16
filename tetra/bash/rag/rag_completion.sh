#!/usr/bin/env bash
# Bash completion for RAG module (TCS-compliant actions)

_rag_complete() {
    local cur prev words cword
    _init_completion || return

    # Get available agents dynamically
    _rag_get_agents() {
        local sys_dir="${TETRA_SRC:-$HOME/src/devops/tetra}/bash/rag/agents"
        local user_dir="${TETRA_DIR:-$HOME/.tetra}/rag/agents"

        local agents=()
        [[ -d "$sys_dir" ]] && agents+=($(ls "$sys_dir"/*.conf 2>/dev/null | xargs -n1 basename | sed 's/.conf$//'))
        [[ -d "$user_dir" ]] && agents+=($(ls "$user_dir"/*.conf 2>/dev/null | xargs -n1 basename | sed 's/.conf$//'))

        echo "${agents[@]}"
    }

    case $cword in
        1)
            # After "rag" - show verbs
            COMPREPLY=($(compgen -W "query list set generate" -- "$cur"))
            ;;
        2)
            # After "rag <verb>" - show nouns
            case "$prev" in
                query)
                    COMPREPLY=($(compgen -W "ulm qa" -- "$cur"))
                    ;;
                list)
                    COMPREPLY=($(compgen -W "queries agents" -- "$cur"))
                    ;;
                set)
                    COMPREPLY=($(compgen -W "agent" -- "$cur"))
                    ;;
                generate)
                    COMPREPLY=($(compgen -W "context" -- "$cur"))
                    ;;
            esac
            ;;
        3)
            # Context-specific completions
            if [[ "${words[1]}" == "set" && "${words[2]}" == "agent" ]]; then
                # Complete agent names
                COMPREPLY=($(compgen -W "$(_rag_get_agents)" -- "$cur"))
            elif [[ "${words[1]}" == "query" && "${words[2]}" == "ulm" ]]; then
                # Query text - no completion
                COMPREPLY=()
            elif [[ "${words[1]}" == "generate" && "${words[2]}" == "context" ]]; then
                # ULM query text - no completion
                COMPREPLY=()
            fi
            ;;
        4)
            # Additional arguments
            if [[ "${words[1]}" == "query" && "${words[2]}" == "ulm" ]]; then
                # Path completion after query text
                COMPREPLY=($(compgen -d -- "$cur"))
            elif [[ "${words[1]}" == "generate" && "${words[2]}" == "context" ]]; then
                # Agent name after ULM query
                COMPREPLY=($(compgen -W "$(_rag_get_agents)" -- "$cur"))
            fi
            ;;
        5)
            # Path for generate context
            if [[ "${words[1]}" == "generate" && "${words[2]}" == "context" ]]; then
                COMPREPLY=($(compgen -d -- "$cur"))
            fi
            ;;
    esac

    return 0
}

# Multicat (mc) completion
_mc_complete() {
    local cur prev words cword
    _init_completion || return

    # Get available agents
    _mc_get_agents() {
        local sys_dir="${TETRA_SRC:-$HOME/src/devops/tetra}/bash/rag/agents"
        local user_dir="${TETRA_DIR:-$HOME/.tetra}/rag/agents"

        local agents=()
        [[ -d "$sys_dir" ]] && agents+=($(ls "$sys_dir"/*.conf 2>/dev/null | xargs -n1 basename | sed 's/.conf$//'))
        [[ -d "$user_dir" ]] && agents+=($(ls "$user_dir"/*.conf 2>/dev/null | xargs -n1 basename | sed 's/.conf$//'))

        echo "${agents[@]}"
    }

    # Handle flags
    if [[ "$cur" == -* ]]; then
        COMPREPLY=($(compgen -W "-r -x -d -m -C --tree-only --agent --ulm-rank --ulm-top --dryrun --example --example-long -h --help" -- "$cur"))
        return 0
    fi

    # Complete agent name after --agent
    if [[ "$prev" == "--agent" ]]; then
        COMPREPLY=($(compgen -W "$(_mc_get_agents)" -- "$cur"))
        return 0
    fi

    # Complete agent name after --example
    if [[ "$prev" == "--example" ]]; then
        COMPREPLY=($(compgen -W "$(_mc_get_agents)" -- "$cur"))
        return 0
    fi

    # Default to file/directory completion
    COMPREPLY=($(compgen -f -- "$cur"))
    return 0
}

# Register completions (only if bash-completion is loaded)
if declare -F _init_completion >/dev/null 2>&1; then
    complete -F _rag_complete rag
    complete -F _mc_complete mc
    complete -F _mc_complete multicat
fi
