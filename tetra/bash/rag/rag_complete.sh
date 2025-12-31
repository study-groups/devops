#!/usr/bin/env bash
# RAG Tab Completion - Multilevel data-driven completions
# Uses shared command definitions from core/commands.sh

# Source shared command definitions
_RAG_COMPLETE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$_RAG_COMPLETE_DIR/core/commands.sh" ]]; then
    source "$_RAG_COMPLETE_DIR/core/commands.sh"
fi
if [[ -f "$_RAG_COMPLETE_DIR/core/stages.sh" ]]; then
    source "$_RAG_COMPLETE_DIR/core/stages.sh"
fi

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

# Get evidence ranks in active flow
_rag_evidence_ranks() {
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

    # First arg: complete commands from registry
    if [[ $COMP_CWORD -eq 1 ]]; then
        local commands
        if command -v rag_get_commands >/dev/null 2>&1; then
            commands=$(rag_get_commands)
        else
            # Fallback if commands.sh not loaded
            commands="quick q bundle compare diff session flow evidence select assemble plan submit repl r mc ms mi example ex status s help h init"
        fi
        COMPREPLY=($(compgen -W "$commands" -- "$cur"))
        return
    fi

    # Get subcommands and options from registry
    local subcmds=""
    local opts=""
    if command -v rag_get_subcommands >/dev/null 2>&1; then
        subcmds=$(rag_get_subcommands "$cmd")
        opts=$(rag_get_options "$cmd" "$subcmd")
    fi

    # Second+ arg: context-sensitive completion
    case "$cmd" in
        # Quick mode: rag quick "<query>" <files...>
        quick|q)
            if [[ $COMP_CWORD -ge 3 ]]; then
                if [[ "$cur" == -* ]]; then
                    COMPREPLY=($(compgen -W "$(rag_get_options quick)" -- "$cur"))
                else
                    COMPREPLY=($(compgen -f -- "$cur"))
                fi
            fi
            ;;

        # Bundle: rag bundle <files...> [--output <file>]
        bundle)
            if [[ "$prev" == "--output" || "$prev" == "-o" ]]; then
                COMPREPLY=($(compgen -f -- "$cur"))
            elif [[ "$cur" == -* ]]; then
                COMPREPLY=($(compgen -W "$opts" -- "$cur"))
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
                COMPREPLY=($(compgen -W "$opts" -- "$cur"))
            fi
            ;;

        # Session subcommands
        session)
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "$subcmds" -- "$cur"))
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
                COMPREPLY=($(compgen -W "$subcmds" -- "$cur"))
            elif [[ $COMP_CWORD -eq 3 ]]; then
                case "$subcmd" in
                    resume)
                        COMPREPLY=($(compgen -W "$(_rag_flow_ids)" -- "$cur"))
                        ;;
                    complete)
                        local sub_opts=$(rag_get_options flow complete 2>/dev/null)
                        if [[ "$cur" == -* ]]; then
                            COMPREPLY=($(compgen -W "$sub_opts" -- "$cur"))
                        else
                            local outcomes
                            if command -v rag_get_outcomes >/dev/null 2>&1; then
                                outcomes=$(rag_get_outcomes)
                            else
                                outcomes="success partial abandoned failed"
                            fi
                            COMPREPLY=($(compgen -W "$outcomes" -- "$cur"))
                        fi
                        ;;
                    list)
                        COMPREPLY=($(compgen -W "--global" -- "$cur"))
                        ;;
                esac
            elif [[ $COMP_CWORD -ge 4 ]]; then
                case "$subcmd" in
                    complete)
                        if [[ "$prev" == "--outcome" || "$prev" == "-o" ]]; then
                            local outcomes
                            if command -v rag_get_option_values >/dev/null 2>&1; then
                                outcomes=$(rag_get_option_values --outcome)
                            else
                                outcomes="success partial abandoned failed"
                            fi
                            COMPREPLY=($(compgen -W "$outcomes" -- "$cur"))
                        elif [[ "$cur" == -* ]]; then
                            local sub_opts=$(rag_get_options flow complete 2>/dev/null)
                            COMPREPLY=($(compgen -W "$sub_opts" -- "$cur"))
                        fi
                        ;;
                esac
            fi
            ;;

        # Evidence subcommands
        evidence)
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "$subcmds" -- "$cur"))
            elif [[ $COMP_CWORD -eq 3 ]]; then
                case "$subcmd" in
                    add)
                        COMPREPLY=($(compgen -f -- "$cur"))
                        ;;
                    toggle|remove)
                        COMPREPLY=($(compgen -W "$(_rag_evidence_ranks)" -- "$cur"))
                        ;;
                esac
            elif [[ $COMP_CWORD -eq 4 ]]; then
                case "$subcmd" in
                    toggle)
                        COMPREPLY=($(compgen -W "on off" -- "$cur"))
                        ;;
                esac
            fi
            ;;

        # Select: no args (expects query string)
        select)
            ;;

        # Assemble/Plan: no args needed
        assemble|plan)
            ;;

        # Submit: complete with targets
        submit)
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "$subcmds" -- "$cur"))
            fi
            ;;

        # MULTICAT tools
        mc)
            if [[ "$prev" == "--output" || "$prev" == "-o" ]]; then
                COMPREPLY=($(compgen -f -- "$cur"))
            elif [[ "$cur" == -* ]]; then
                COMPREPLY=($(compgen -W "$opts" -- "$cur"))
            else
                COMPREPLY=($(compgen -f -- "$cur"))
            fi
            ;;

        ms)
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "$(_rag_mc_files)" -- "$cur"))
                COMPREPLY+=($(compgen -f -X '!*.mc' -- "$cur"))
            elif [[ "$cur" == -* ]]; then
                COMPREPLY=($(compgen -W "$opts" -- "$cur"))
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
            local commands
            if command -v rag_get_commands >/dev/null 2>&1; then
                commands=$(rag_get_commands)
            else
                commands="quick q bundle compare diff session flow evidence select assemble plan submit repl r mc ms mi example ex status s help h init"
            fi
            COMPREPLY=($(compgen -W "$commands" -- "$cur"))
            ;;

        # Status/Init/Repl: no additional args
        status|s|init|repl|r|example|ex)
            ;;
    esac
}

# Register completion
complete -F _rag_complete rag
