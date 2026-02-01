#!/usr/bin/env bash

# voxlab_complete.sh - Tab completion for voxlab command

_VOXLAB_COMMANDS="run ls status logs compare summarize notebook prune pipeline golden trigger sweep help"
_VOXLAB_PIPELINE_CMDS="define list show"
_VOXLAB_GOLDEN_CMDS="create list compare"
_VOXLAB_TRIGGER_CMDS="add list rm"

_voxlab_complete_experiments() {
    local exp_dir="$VOXLAB_DIR/experiments"
    [[ -d "$exp_dir" ]] || return
    for d in "$exp_dir"/*/; do
        [[ -d "$d" ]] && basename "$d"
    done
}

_voxlab_complete_pipelines() {
    local pipe_dir="$VOXLAB_DIR/pipelines"
    [[ -d "$pipe_dir" ]] || return
    for f in "$pipe_dir"/*.json; do
        [[ -f "$f" ]] && basename "$f" .json
    done
}

_voxlab_complete_golden() {
    local golden_dir="$VOXLAB_DIR/golden"
    [[ -d "$golden_dir" ]] || return
    for d in "$golden_dir"/*/; do
        [[ -d "$d" ]] && echo "golden:$(basename "$d")"
    done
    echo "golden:latest"
}

_voxlab_complete_stages() {
    echo "${!VOXLAB_STAGES[*]}" | tr ' ' '\n'
}

_voxlab_completion() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"
    local cmd="${COMP_WORDS[1]:-}"

    COMPREPLY=()

    if [[ $COMP_CWORD -eq 1 ]]; then
        COMPREPLY=($(compgen -W "$_VOXLAB_COMMANDS" -- "$cur"))
        return
    fi

    case "$cmd" in
        run)
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "$(_voxlab_complete_pipelines)" -- "$cur"))
            elif [[ $COMP_CWORD -eq 3 ]]; then
                COMPREPLY=($(compgen -W "$(_voxlab_complete_golden)" -- "$cur"))
            fi
            ;;
        status|logs|summarize|notebook|nb)
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "$(_voxlab_complete_experiments)" -- "$cur"))
            fi
            ;;
        compare)
            if [[ $COMP_CWORD -eq 2 || $COMP_CWORD -eq 3 ]]; then
                COMPREPLY=($(compgen -W "$(_voxlab_complete_experiments)" -- "$cur"))
            fi
            ;;
        pipeline|pipe)
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "$_VOXLAB_PIPELINE_CMDS" -- "$cur"))
            elif [[ $COMP_CWORD -eq 3 ]]; then
                case "${COMP_WORDS[2]}" in
                    show) COMPREPLY=($(compgen -W "$(_voxlab_complete_pipelines)" -- "$cur")) ;;
                    define) ;; # free-form name
                esac
            elif [[ "${COMP_WORDS[2]}" == "define" && $COMP_CWORD -ge 4 ]]; then
                COMPREPLY=($(compgen -W "$(_voxlab_complete_stages)" -- "$cur"))
            fi
            ;;
        golden|gold)
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "$_VOXLAB_GOLDEN_CMDS" -- "$cur"))
            elif [[ $COMP_CWORD -eq 3 && "${COMP_WORDS[2]}" == "compare" ]]; then
                COMPREPLY=($(compgen -W "$(_voxlab_complete_golden)" -- "$cur"))
            fi
            ;;
        trigger|trig)
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "$_VOXLAB_TRIGGER_CMDS" -- "$cur"))
            fi
            ;;
        sweep)
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "$(_voxlab_complete_pipelines)" -- "$cur"))
            elif [[ $COMP_CWORD -eq 3 ]]; then
                COMPREPLY=($(compgen -W "$(_voxlab_complete_golden)" -- "$cur"))
            fi
            ;;
        prune)
            if [[ "$cur" == --* ]]; then
                COMPREPLY=($(compgen -W "--keep-best= --older-than=" -- "$cur"))
            fi
            ;;
    esac
}

complete -F _voxlab_completion voxlab

export -f _voxlab_completion
