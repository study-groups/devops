#!/usr/bin/env bash

# MIDI Tab Completion

_midi_completion() {
    local cur prev opts
    COMPREPLY=()
    cur="${COMP_WORDS[COMP_CWORD]}"
    prev="${COMP_WORDS[COMP_CWORD-1]}"

    # Main commands
    local commands="
        repl start stop status init
        learn learn-all wizard unlearn clear
        list mode save load
        device devices
        config build help learn-help
    "

    # Subcommands for specific commands
    case "${prev}" in
        midi)
            COMPREPLY=( $(compgen -W "${commands}" -- ${cur}) )
            return 0
            ;;
        learn-all)
            COMPREPLY=( $(compgen -W "pots sliders buttons transport" -- ${cur}) )
            return 0
            ;;
        mode)
            COMPREPLY=( $(compgen -W "raw syntax semantic all" -- ${cur}) )
            return 0
            ;;
        config)
            COMPREPLY=( $(compgen -W "show edit templates" -- ${cur}) )
            return 0
            ;;
        edit)
            if [[ "${COMP_WORDS[COMP_CWORD-2]}" == "config" ]]; then
                COMPREPLY=( $(compgen -W "hardware semantic colors" -- ${cur}) )
            fi
            return 0
            ;;
        save|load)
            # Complete with session names from $MIDI_DIR/sessions/
            if [[ -d "${MIDI_DIR:-$TETRA_DIR/midi}/sessions" ]]; then
                local sessions=$(ls -1 "${MIDI_DIR:-$TETRA_DIR/midi}/sessions" 2>/dev/null)
                COMPREPLY=( $(compgen -W "${sessions}" -- ${cur}) )
            fi
            return 0
            ;;
        device)
            # Complete with device names from $MIDI_DIR/devices/
            if [[ -d "${MIDI_DIR:-$TETRA_DIR/midi}/devices" ]]; then
                local devices=$(ls -1 "${MIDI_DIR:-$TETRA_DIR/midi}/devices" 2>/dev/null)
                COMPREPLY=( $(compgen -W "${devices}" -- ${cur}) )
            fi
            return 0
            ;;
    esac

    return 0
}

# Register completion
complete -F _midi_completion midi

# Export
export -f _midi_completion
