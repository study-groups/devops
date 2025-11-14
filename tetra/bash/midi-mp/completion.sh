#!/usr/bin/env bash

# MIDI-MP Tab Completion
# Follows Tetra completion pattern

_midi_mp_completion() {
    local cur prev words cword
    _init_completion || return

    # Top-level commands
    local commands="start stop restart status logs config build init help cymatica broadcast vj collab"

    # Get the command (first non-option word after midi-mp)
    local cmd=""
    for ((i=1; i < cword; i++)); do
        if [[ ${words[i]} != -* ]]; then
            cmd="${words[i]}"
            break
        fi
    done

    case "$prev" in
        midi-mp)
            COMPREPLY=($(compgen -W "$commands" -- "$cur"))
            return 0
            ;;
        start)
            # Suggest example configs or custom files
            local examples="broadcast cymatica vj-split collaborative-daw"
            local files=$(compgen -f -X '!*.json' -- "$cur")
            COMPREPLY=($(compgen -W "$examples $files" -- "$cur"))
            return 0
            ;;
        config)
            local config_actions="show edit"
            COMPREPLY=($(compgen -W "$config_actions" -- "$cur"))
            return 0
            ;;
        edit)
            # When editing configs, suggest available examples
            if [[ "$cmd" == "config" ]]; then
                local examples="broadcast cymatica vj-split collaborative-daw"
                COMPREPLY=($(compgen -W "$examples" -- "$cur"))
            fi
            return 0
            ;;
        stop|logs)
            # Suggest running midi-mp processes
            local processes=$(tsm list 2>/dev/null | grep "midi-mp" | awk '{print $2}' | tr '\n' ' ')
            COMPREPLY=($(compgen -W "$processes" -- "$cur"))
            return 0
            ;;
    esac

    # Default to command completion
    COMPREPLY=($(compgen -W "$commands" -- "$cur"))
}

# Register completion
complete -F _midi_mp_completion midi-mp
