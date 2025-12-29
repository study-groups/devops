#!/usr/bin/env bash
# RAG Tab Completion - Multilevel data-driven completions

_RAG_COMMANDS="quick q bundle compare diff session flow select evidence assemble plan submit repl r mc ms mi example ex status s help h init"
_RAG_SESSION_SUBCMDS="create start status resume switch list"
_RAG_FLOW_SUBCMDS="create start status resume list complete"
_RAG_EVIDENCE_SUBCMDS="add list"

# Get flow IDs for completion
_rag_flow_ids() {
    local flows_dir="${RAG_DIR:-$TETRA_DIR/rag}/flows"
    [[ -d "$PWD/rag/flows" ]] && flows_dir="$PWD/rag/flows"
    [[ -d "$flows_dir" ]] || return

    local index=0
    for flow_dir in "$flows_dir"/*/; do
        [[ -d "$flow_dir" ]] || continue
        local fid=$(basename "$flow_dir")
        [[ "$fid" == "active" ]] && continue
        ((index++))
        echo "$index"
        echo "$fid"
    done
}

# Get session IDs for completion
_rag_session_ids() {
    local sessions_dir="${RAG_DIR:-$TETRA_DIR/rag}/sessions"
    [[ -d "$sessions_dir" ]] || return

    local index=0
    for sess_dir in "$sessions_dir"/*/; do
        [[ -d "$sess_dir" ]] || continue
        local sid=$(basename "$sess_dir")
        [[ "$sid" == "current" ]] && continue
        ((index++))
        echo "$index"
        echo "$sid"
    done
}

# Get evidence files in active flow
_rag_evidence_files() {
    local flows_dir="${RAG_DIR:-$TETRA_DIR/rag}/flows"
    [[ -d "$PWD/rag/flows" ]] && flows_dir="$PWD/rag/flows"

    local active="$flows_dir/active"
    [[ -L "$active" ]] || return

    local evidence_dir="$active/ctx/evidence"
    [[ -d "$evidence_dir" ]] || return

    for f in "$evidence_dir"/*.evidence.md*; do
        [[ -f "$f" ]] && basename "$f" | cut -d'_' -f1
    done
}

# Get MULTICAT files
_rag_mc_files() {
    for f in *.mc; do
        [[ -f "$f" ]] && echo "$f"
    done
}

# Main completion function
_rag_complete() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"
    local cmd="${COMP_WORDS[1]:-}"
    local subcmd="${COMP_WORDS[2]:-}"

    COMPREPLY=()

    # First arg: complete commands
    if [[ $COMP_CWORD -eq 1 ]]; then
        COMPREPLY=($(compgen -W "$_RAG_COMMANDS" -- "$cur"))
        return
    fi

    # Second+ arg: context-sensitive completion
    case "$cmd" in
        # Quick mode: rag quick "<query>" <files...>
        quick|q)
            if [[ $COMP_CWORD -ge 3 ]]; then
                # Complete with files after query
                COMPREPLY=($(compgen -f -- "$cur"))
            fi
            ;;

        # Bundle: rag bundle <files...> [--output <file>]
        bundle)
            if [[ "$prev" == "--output" || "$prev" == "-o" ]]; then
                COMPREPLY=($(compgen -f -- "$cur"))
            elif [[ "$cur" == -* ]]; then
                COMPREPLY=($(compgen -W "--output -o --exclude -x" -- "$cur"))
            else
                COMPREPLY=($(compgen -f -- "$cur"))
            fi
            ;;

        # Compare: rag compare <file1> <file2> [context]
        compare|diff)
            if [[ $COMP_CWORD -eq 2 || $COMP_CWORD -eq 3 ]]; then
                COMPREPLY=($(compgen -f -- "$cur"))
            elif [[ "$prev" == "--output" || "$prev" == "-o" ]]; then
                COMPREPLY=($(compgen -f -- "$cur"))
            elif [[ "$cur" == -* ]]; then
                COMPREPLY=($(compgen -W "--output -o --context -c" -- "$cur"))
            fi
            ;;

        # Session subcommands
        session)
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "$_RAG_SESSION_SUBCMDS" -- "$cur"))
            elif [[ $COMP_CWORD -eq 3 ]]; then
                case "$subcmd" in
                    resume|switch)
                        COMPREPLY=($(compgen -W "$(_rag_session_ids)" -- "$cur"))
                        ;;
                esac
            fi
            ;;

        # Flow subcommands
        flow)
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "$_RAG_FLOW_SUBCMDS" -- "$cur"))
            elif [[ $COMP_CWORD -eq 3 ]]; then
                case "$subcmd" in
                    resume)
                        COMPREPLY=($(compgen -W "$(_rag_flow_ids)" -- "$cur"))
                        ;;
                    complete)
                        if [[ "$cur" == -* ]]; then
                            COMPREPLY=($(compgen -W "--outcome -o --lesson -l --artifact -a --tag -t --effort -e" -- "$cur"))
                        else
                            COMPREPLY=($(compgen -W "success partial abandoned failed" -- "$cur"))
                        fi
                        ;;
                esac
            elif [[ $COMP_CWORD -ge 4 ]]; then
                case "$subcmd" in
                    complete)
                        if [[ "$prev" == "--outcome" || "$prev" == "-o" ]]; then
                            COMPREPLY=($(compgen -W "success partial abandoned failed" -- "$cur"))
                        elif [[ "$cur" == -* ]]; then
                            COMPREPLY=($(compgen -W "--outcome -o --lesson -l --artifact -a --tag -t --effort -e" -- "$cur"))
                        fi
                        ;;
                esac
            fi
            ;;

        # Evidence subcommands
        evidence)
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "$_RAG_EVIDENCE_SUBCMDS" -- "$cur"))
            elif [[ $COMP_CWORD -eq 3 ]]; then
                case "$subcmd" in
                    add)
                        # Complete with files
                        COMPREPLY=($(compgen -f -- "$cur"))
                        ;;
                esac
            fi
            ;;

        # Select: complete with nothing (expects query string)
        select)
            ;;

        # Assemble/Plan: no args needed
        assemble|plan)
            ;;

        # Submit: complete with targets
        submit)
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "@qa @local" -- "$cur"))
            fi
            ;;

        # MULTICAT tools
        mc)
            if [[ "$prev" == "--output" || "$prev" == "-o" ]]; then
                COMPREPLY=($(compgen -f -- "$cur"))
            elif [[ "$cur" == -* ]]; then
                COMPREPLY=($(compgen -W "--output -o --exclude -x --example --recursive -r" -- "$cur"))
            else
                COMPREPLY=($(compgen -f -- "$cur"))
            fi
            ;;

        ms)
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "$(_rag_mc_files)" -- "$cur"))
                COMPREPLY+=($(compgen -f -X '!*.mc' -- "$cur"))
            elif [[ "$cur" == -* ]]; then
                COMPREPLY=($(compgen -W "-y -Y --yes --force" -- "$cur"))
            fi
            ;;

        mi)
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "$(_rag_mc_files)" -- "$cur"))
                COMPREPLY+=($(compgen -f -X '!*.mc' -- "$cur"))
            fi
            ;;

        # Help: complete with commands
        help|h)
            COMPREPLY=($(compgen -W "$_RAG_COMMANDS" -- "$cur"))
            ;;

        # Status/Init/Repl: no additional args
        status|s|init|repl|r|example|ex)
            ;;
    esac
}

# Register completion
complete -F _rag_complete rag
