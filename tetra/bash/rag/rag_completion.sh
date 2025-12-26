#!/usr/bin/env bash
# Bash completion for RAG module (TCS-compliant actions)

# Source agents utility for completion
: "${TETRA_SRC:=$HOME/src/devops/tetra}"
if [[ -f "$TETRA_SRC/bash/rag/core/utils/agents.sh" ]]; then
    source "$TETRA_SRC/bash/rag/core/utils/agents.sh"
fi

_rag_complete() {
    local cur prev words cword
    _init_completion || return

    # Get available agents dynamically
    _rag_get_agents() {
        if declare -f list_agent_names >/dev/null 2>&1; then
            list_agent_names
        else
            # Fallback if agents.sh not loaded
            local sys_dir="${TETRA_SRC:-$HOME/src/devops/tetra}/bash/rag/agents"
            local user_dir="${TETRA_DIR:-$HOME/.tetra}/rag/agents"
            local agents=()
            [[ -d "$sys_dir" ]] && agents+=($(ls "$sys_dir"/*.conf 2>/dev/null | xargs -n1 basename | sed 's/.conf$//'))
            [[ -d "$user_dir" ]] && agents+=($(ls "$user_dir"/*.conf 2>/dev/null | xargs -n1 basename | sed 's/.conf$//'))
            echo "${agents[@]}"
        fi
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
        if declare -f list_agent_names >/dev/null 2>&1; then
            list_agent_names
        else
            # Fallback if agents.sh not loaded
            local sys_dir="${TETRA_SRC:-$HOME/src/devops/tetra}/bash/rag/agents"
            local user_dir="${TETRA_DIR:-$HOME/.tetra}/rag/agents"
            local agents=()
            [[ -d "$sys_dir" ]] && agents+=($(ls "$sys_dir"/*.conf 2>/dev/null | xargs -n1 basename | sed 's/.conf$//'))
            [[ -d "$user_dir" ]] && agents+=($(ls "$user_dir"/*.conf 2>/dev/null | xargs -n1 basename | sed 's/.conf$//'))
            echo "${agents[@]}"
        fi
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

# Multisplit (ms) completion
_ms_complete() {
    local cur prev
    _init_completion || return

    if [[ "$cur" == -* ]]; then
        COMPREPLY=($(compgen -W "-y -Y -n --dryrun -h --help" -- "$cur"))
        return 0
    fi

    # Default to .mc file completion, then any file
    COMPREPLY=($(compgen -f -X '!*.mc' -- "$cur"))
    [[ ${#COMPREPLY[@]} -eq 0 ]] && COMPREPLY=($(compgen -f -- "$cur"))
    return 0
}

# MULTICAT info (mi) completion
_mi_complete() {
    local cur prev
    _init_completion || return

    if [[ "$cur" == -* ]]; then
        COMPREPLY=($(compgen -W "-j --json -h --help" -- "$cur"))
        return 0
    fi

    # Default to .mc file completion, then any file
    COMPREPLY=($(compgen -f -X '!*.mc' -- "$cur"))
    [[ ${#COMPREPLY[@]} -eq 0 ]] && COMPREPLY=($(compgen -f -- "$cur"))
    return 0
}

# Multimerge (mm) completion
_mm_complete() {
    local cur prev
    _init_completion || return

    if [[ "$cur" == -* ]]; then
        COMPREPLY=($(compgen -W "--rag-dir -h --help" -- "$cur"))
        return 0
    fi

    # After --rag-dir, complete directories
    if [[ "$prev" == "--rag-dir" ]]; then
        COMPREPLY=($(compgen -d -- "$cur"))
        return 0
    fi

    # Default to .mc file completion, then any file
    COMPREPLY=($(compgen -f -X '!*.mc' -- "$cur"))
    [[ ${#COMPREPLY[@]} -eq 0 ]] && COMPREPLY=($(compgen -f -- "$cur"))
    return 0
}

# Multidiff (md) completion
_md_complete() {
    local cur prev
    _init_completion || return

    # Default to .mc file completion, then any file
    COMPREPLY=($(compgen -f -X '!*.mc' -- "$cur"))
    [[ ${#COMPREPLY[@]} -eq 0 ]] && COMPREPLY=($(compgen -f -- "$cur"))
    return 0
}

# Register completions (only if bash-completion is loaded)
if declare -F _init_completion >/dev/null 2>&1; then
    complete -F _rag_complete rag
    complete -F _mc_complete mc
    complete -F _mc_complete multicat
    complete -F _ms_complete ms
    complete -F _ms_complete multisplit
    complete -F _mi_complete mi
    complete -F _mi_complete mcinfo
    complete -F _mm_complete mm
    complete -F _mm_complete multimerge
    complete -F _md_complete md
    complete -F _md_complete multidiff
fi
