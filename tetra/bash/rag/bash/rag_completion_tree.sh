#!/usr/bin/env bash
# RAG Recursive Tab Completion - Tree-based completion like doctl
# Supports hierarchical command structures with context-aware completion

# Completion tree structure:
# Each node contains: subcommands, flags, argument type, completion function
declare -gA RAG_COMPLETION_TREE

# Initialize completion tree
rag_completion_init_tree() {
    # Root level - top-level commands
    local root_cmds="/cli /prompt /evidence /e /flow /f /mc /ms /mi /mf /qpatch /replace /example /status /history /help /functions /exit /quit"
    RAG_COMPLETION_TREE['/']="$root_cmds"

    # /cli and /prompt subcommands (aliases)
    RAG_COMPLETION_TREE["/cli"]="minimal normal twoline toggle"
    RAG_COMPLETION_TREE["/cli:flags"]="--global"
    RAG_COMPLETION_TREE["/cli:minimal"]="flow global"
    RAG_COMPLETION_TREE["/cli:normal"]="flow global"
    RAG_COMPLETION_TREE["/cli:twoline"]="flow global"

    RAG_COMPLETION_TREE["/prompt"]="minimal normal twoline toggle"
    RAG_COMPLETION_TREE["/prompt:flags"]="--global"
    RAG_COMPLETION_TREE["/prompt:minimal"]="flow global"
    RAG_COMPLETION_TREE["/prompt:normal"]="flow global"
    RAG_COMPLETION_TREE["/prompt:twoline"]="flow global"

    # /evidence (/e) subcommands
    RAG_COMPLETION_TREE["/evidence"]="add list ls toggle on off status remove rebase"
    RAG_COMPLETION_TREE["/e"]="add list ls toggle on off status remove rebase"

    RAG_COMPLETION_TREE["/evidence:add"]="@file"
    RAG_COMPLETION_TREE["/evidence:add:type"]="file"
    RAG_COMPLETION_TREE["/e:add"]="@file"
    RAG_COMPLETION_TREE["/e:add:type"]="file"

    RAG_COMPLETION_TREE["/evidence:toggle"]="@rank @pattern @range"
    RAG_COMPLETION_TREE["/e:toggle"]="@rank @pattern @range"

    RAG_COMPLETION_TREE["/evidence:on"]="@rank @pattern @range"
    RAG_COMPLETION_TREE["/e:on"]="@rank @pattern @range"

    RAG_COMPLETION_TREE["/evidence:off"]="@rank @pattern @range"
    RAG_COMPLETION_TREE["/e:off"]="@rank @pattern @range"

    RAG_COMPLETION_TREE["/evidence:remove"]="@rank @pattern"
    RAG_COMPLETION_TREE["/e:remove"]="@rank @pattern"

    # /flow (/f) subcommands
    RAG_COMPLETION_TREE["/flow"]="create status list resume help"
    RAG_COMPLETION_TREE["/f"]="create status list resume help"

    RAG_COMPLETION_TREE["/flow:create"]="@string"
    RAG_COMPLETION_TREE["/f:create"]="@string"

    RAG_COMPLETION_TREE["/flow:resume"]="@flow_id"
    RAG_COMPLETION_TREE["/f:resume"]="@flow_id"

    # /mc (multicat) flags and options
    RAG_COMPLETION_TREE["/mc"]="@file @directory"
    RAG_COMPLETION_TREE["/mc:flags"]="-r -x -d -m -C --tree-only --agent --ulm-rank --ulm-top --dryrun --example --example-long -h --help"
    RAG_COMPLETION_TREE["/mc:--agent"]="@agent"
    RAG_COMPLETION_TREE["/mc:--ulm-rank"]="@string"

    # /ms (multicat split)
    RAG_COMPLETION_TREE["/ms"]="@mcfile"
    RAG_COMPLETION_TREE["/ms:type"]="mcfile"

    # /mi (multicat info)
    RAG_COMPLETION_TREE["/mi"]="@mcfile"
    RAG_COMPLETION_TREE["/mi:type"]="mcfile"

    # /mf (multicat find)
    RAG_COMPLETION_TREE["/mf"]="@pattern @directory"

    # /qpatch
    RAG_COMPLETION_TREE["/qpatch"]="@file"
    RAG_COMPLETION_TREE["/qpatch:type"]="file"

    # /replace
    RAG_COMPLETION_TREE["/replace"]="@string"

    # /help subcommands
    RAG_COMPLETION_TREE["/help"]="usecase models symbols stages cdp agent flow evidence cli prompt mc ms mi mf qpatch replace"

    # /history subcommands
    RAG_COMPLETION_TREE["/history"]="list ls search clear export import stats"
    RAG_COMPLETION_TREE["/history:export"]="@file"
    RAG_COMPLETION_TREE["/history:import"]="@file"
    RAG_COMPLETION_TREE["/history:search"]="@string"
}

# Get completions for current path in tree
rag_completion_get_node() {
    local path="$1"
    echo "${RAG_COMPLETION_TREE[$path]}"
}

# Build completion path from words
rag_completion_build_path() {
    local -a words=("$@")
    local path=""

    for word in "${words[@]}"; do
        if [[ -z "$path" ]]; then
            path="$word"
        else
            path="$path:$word"
        fi
    done

    echo "$path"
}

# Check if completion needs file path
rag_completion_needs_file() {
    local path="$1"
    local node_value
    node_value=$(rag_completion_get_node "$path")

    [[ "$node_value" == *"@file"* ]] || [[ "$node_value" == *"@directory"* ]]
}

# Check if completion needs .mc file
rag_completion_needs_mcfile() {
    local path="$1"
    local node_value
    node_value=$(rag_completion_get_node "$path")

    [[ "$node_value" == *"@mcfile"* ]]
}

# Check if completion needs agent name
rag_completion_needs_agent() {
    local path="$1"
    local node_value
    node_value=$(rag_completion_get_node "$path")

    [[ "$node_value" == *"@agent"* ]]
}

# Check if completion needs flow ID
rag_completion_needs_flow_id() {
    local path="$1"
    local node_value
    node_value=$(rag_completion_get_node "$path")

    [[ "$node_value" == *"@flow_id"* ]]
}

# Get evidence ranks/patterns for toggle/remove
rag_completion_get_evidence_targets() {
    local flow_dir
    flow_dir=$(get_active_flow_dir 2>/dev/null)

    if [[ -z "$flow_dir" ]] || [[ ! -d "$flow_dir/ctx/evidence" ]]; then
        return
    fi

    # Get evidence file ranks and patterns
    find "$flow_dir/ctx/evidence" -type f -name "*.md" 2>/dev/null | \
        xargs -I {} basename {} .md | \
        sort
}

# Get available flow IDs
rag_completion_get_flow_ids() {
    local rag_dir="${RAG_DIR:-$HOME/.tetra/rag}"

    if [[ ! -d "$rag_dir/flows" ]]; then
        return
    fi

    find "$rag_dir/flows" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | \
        xargs -I {} basename {} | \
        sort -r | \
        head -20
}

# Get available agent names
rag_completion_get_agents() {
    if declare -f list_agent_names >/dev/null 2>&1; then
        list_agent_names
    else
        # Fallback
        local sys_dir="${TETRA_SRC:-$HOME/src/devops/tetra}/bash/rag/agents"
        local user_dir="${TETRA_DIR:-$HOME/.tetra}/rag/agents"
        {
            [[ -d "$sys_dir" ]] && ls "$sys_dir"/*.conf 2>/dev/null | xargs -n1 basename | sed 's/.conf$//'
            [[ -d "$user_dir" ]] && ls "$user_dir"/*.conf 2>/dev/null | xargs -n1 basename | sed 's/.conf$//'
        } | sort -u
    fi
}

# Main recursive completion function
rag_completion_recursive() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"

    # Initialize tree if not done
    [[ -z "${RAG_COMPLETION_TREE['/']}" ]] && rag_completion_init_tree

    # Build path from words
    local -a path_words=()
    local i

    # Collect words up to current position (excluding current word being completed)
    for ((i=0; i<COMP_CWORD; i++)); do
        local word="${COMP_WORDS[$i]}"
        # Skip flags
        [[ "$word" == -* ]] && continue
        path_words+=("$word")
    done

    # Build completion path
    local completion_path
    completion_path=$(rag_completion_build_path "${path_words[@]}")

    # Get node value
    local node_value
    node_value=$(rag_completion_get_node "$completion_path")

    # If empty, try without last word (for subcommands)
    if [[ -z "$node_value" ]] && [[ ${#path_words[@]} -gt 1 ]]; then
        unset 'path_words[-1]'
        completion_path=$(rag_completion_build_path "${path_words[@]}")
        node_value=$(rag_completion_get_node "$completion_path")
    fi

    # Check for flags first
    if [[ "$cur" == -* ]]; then
        local flags_key="${path_words[0]}:flags"
        local flags
        flags=$(rag_completion_get_node "$flags_key")
        if [[ -n "$flags" ]]; then
            COMPREPLY=($(compgen -W "$flags" -- "$cur"))
            return 0
        fi
    fi

    # Check for special completion types
    if [[ -n "$node_value" ]]; then
        case "$node_value" in
            *"@file"*)
                # File completion
                COMPREPLY=($(compgen -f -- "$cur"))
                return 0
                ;;
            *"@directory"*)
                # Directory completion
                COMPREPLY=($(compgen -d -- "$cur"))
                return 0
                ;;
            *"@mcfile"*)
                # .mc file completion
                COMPREPLY=($(compgen -f -X "!*.mc" -- "$cur"))
                return 0
                ;;
            *"@agent"*)
                # Agent name completion
                local agents
                agents=$(rag_completion_get_agents)
                COMPREPLY=($(compgen -W "$agents" -- "$cur"))
                return 0
                ;;
            *"@flow_id"*)
                # Flow ID completion
                local flow_ids
                flow_ids=$(rag_completion_get_flow_ids)
                COMPREPLY=($(compgen -W "$flow_ids" -- "$cur"))
                return 0
                ;;
            *"@rank"*|*"@pattern"*|*"@range"*)
                # Evidence target completion
                local targets
                targets=$(rag_completion_get_evidence_targets)
                COMPREPLY=($(compgen -W "$targets" -- "$cur"))
                return 0
                ;;
            *"@string"*)
                # No completion for free-form strings
                COMPREPLY=()
                return 0
                ;;
            *)
                # Static word list
                COMPREPLY=($(compgen -W "$node_value" -- "$cur"))
                return 0
                ;;
        esac
    fi

    # If nothing found, try root level if current word starts with /
    if [[ "$cur" == /* ]]; then
        local root_cmds
        root_cmds=$(rag_completion_get_node "/")
        COMPREPLY=($(compgen -W "$root_cmds" -- "$cur"))
        return 0
    fi

    # Default: file completion
    COMPREPLY=($(compgen -f -- "$cur"))
    return 0
}

# Export for bash-completion
export -f rag_completion_recursive
export -f rag_completion_init_tree
export -f rag_completion_get_node
export -f rag_completion_build_path
