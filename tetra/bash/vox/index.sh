#!/usr/bin/env bash

# VOX Module Index - Defines metadata and completions for VOX
# Follows TSM completion pattern

# Register VOX module metadata (if registry available)
if declare -f tetra_register_module_meta >/dev/null 2>&1; then
    tetra_register_module_meta "vox" \
        "Voice synthesis, G2P, phoneme annotation and audio pipeline" \
        "vox" \
        "vox:g2p|word|ipa|annotate|ann|create|list|ls|read|pipeline|pipe|process|render|synth|stats|tui|edit|palette|version|info|help" \
        "core" "stable"
fi

#==============================================================================
# COMPLETION HELPERS
#==============================================================================

# Get available voices/languages
_vox_get_voices() {
    echo "en-us en-gb de fr es it alloy ash coral echo fable nova onyx sage shimmer"
}

# Get document IDs from annotation database
_vox_get_doc_ids() {
    local db_dir="${TETRA_DIR:-$HOME/tetra}/vox/db"
    [[ -d "$db_dir" ]] || return
    find "$db_dir" -name "*.vox.source.*" -type f 2>/dev/null | \
        sed -E 's|.*/([0-9]+)\.vox\..*|\1|' | sort -u | head -20
}

#==============================================================================
# MAIN COMPLETION FUNCTION
#==============================================================================

_vox_completion() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"
    local cmd="${COMP_WORDS[1]}"

    case "$COMP_CWORD" in
        1)
            # Top-level commands - matches vox() CLI in vox_includes.sh
            COMPREPLY=($(compgen -W "g2p word ipa annotate ann create list ls read pipeline pipe process render synth audio stats tui edit palette colors version info help" -- "$cur"))
            ;;
        *)
            case "$cmd" in
                #--------------------------------------------------------------
                # G2P Commands
                #--------------------------------------------------------------
                g2p)
                    case "$COMP_CWORD" in
                        2)
                            COMPREPLY=($(compgen -W "word json full text formants cst langs test help" -- "$cur"))
                            ;;
                        4)
                            # Language after word
                            COMPREPLY=($(compgen -W "en-us en-gb de fr es it" -- "$cur"))
                            ;;
                    esac
                    ;;

                word|ipa)
                    # vox word <word> [lang]
                    if [[ "$COMP_CWORD" -eq 3 ]]; then
                        COMPREPLY=($(compgen -W "en-us en-gb de fr es it" -- "$cur"))
                    fi
                    ;;

                #--------------------------------------------------------------
                # Annotation Commands
                #--------------------------------------------------------------
                annotate|ann)
                    case "$COMP_CWORD" in
                        2)
                            COMPREPLY=($(compgen -W "create create-from-file read read-pretty get-phoneme find-word update update-phoneme update-duration update-ipa add-prosody delete delete-doc clean-backups create-voice list-voices export import export-ssml export-esto validate list list-doc query help" -- "$cur"))
                            ;;
                        3)
                            case "$prev" in
                                read|read-pretty|validate|list-doc|delete-doc|export|export-ssml|export-esto|stats)
                                    COMPREPLY=($(compgen -W "$(_vox_get_doc_ids)" -- "$cur"))
                                    ;;
                                create-from-file)
                                    compopt -o filenames 2>/dev/null
                                    COMPREPLY=($(compgen -f -- "$cur"))
                                    ;;
                                import)
                                    compopt -o filenames 2>/dev/null
                                    COMPREPLY=($(compgen -f -X '!*.tar.gz' -- "$cur"))
                                    ;;
                                query)
                                    COMPREPLY=($(compgen -W "--word --ipa --voice" -- "$cur"))
                                    ;;
                            esac
                            ;;
                        4)
                            case "${COMP_WORDS[2]}" in
                                read|read-pretty)
                                    COMPREPLY=($(compgen -W "source cst tokens phonemes prosody voice audio spans" -- "$cur"))
                                    ;;
                                delete)
                                    COMPREPLY=($(compgen -W "source cst tokens phonemes prosody" -- "$cur"))
                                    ;;
                                delete-doc)
                                    COMPREPLY=($(compgen -W "--force" -- "$cur"))
                                    ;;
                            esac
                            ;;
                    esac
                    ;;

                create)
                    # No completions needed - reads from stdin
                    ;;

                read)
                    # vox read <id> <kind>
                    case "$COMP_CWORD" in
                        2)
                            COMPREPLY=($(compgen -W "$(_vox_get_doc_ids)" -- "$cur"))
                            ;;
                        3)
                            COMPREPLY=($(compgen -W "source cst tokens phonemes prosody" -- "$cur"))
                            ;;
                    esac
                    ;;

                #--------------------------------------------------------------
                # Pipeline Commands
                #--------------------------------------------------------------
                pipeline|pipe)
                    case "$COMP_CWORD" in
                        2)
                            COMPREPLY=($(compgen -W "process process-file batch parse tokenize phonemize render render-annotated script synth regen stats word-freq duration help" -- "$cur"))
                            ;;
                        3)
                            case "$prev" in
                                process-file)
                                    compopt -o filenames 2>/dev/null
                                    COMPREPLY=($(compgen -f -- "$cur"))
                                    ;;
                                render|render-annotated|stats|word-freq|duration|regen|script|synth)
                                    COMPREPLY=($(compgen -W "$(_vox_get_doc_ids)" -- "$cur"))
                                    ;;
                                process|phonemize)
                                    COMPREPLY=($(compgen -W "en-us en-gb de fr es" -- "$cur"))
                                    ;;
                            esac
                            ;;
                        4)
                            case "${COMP_WORDS[2]}" in
                                render)
                                    COMPREPLY=($(compgen -W "0 1" -- "$cur"))
                                    ;;
                                script|synth)
                                    COMPREPLY=($(compgen -W "$(_vox_get_voices)" -- "$cur"))
                                    ;;
                            esac
                            ;;
                        5)
                            if [[ "${COMP_WORDS[2]}" == "script" ]]; then
                                COMPREPLY=($(compgen -W "ssml esto json" -- "$cur"))
                            fi
                            ;;
                    esac
                    ;;

                process)
                    # vox process [lang]
                    if [[ "$COMP_CWORD" -eq 2 ]]; then
                        COMPREPLY=($(compgen -W "en-us en-gb de fr es" -- "$cur"))
                    fi
                    ;;

                render|stats)
                    # vox render/stats <id>
                    if [[ "$COMP_CWORD" -eq 2 ]]; then
                        COMPREPLY=($(compgen -W "$(_vox_get_doc_ids)" -- "$cur"))
                    fi
                    ;;

                synth|audio)
                    # vox synth <id> [voice]
                    case "$COMP_CWORD" in
                        2)
                            COMPREPLY=($(compgen -W "$(_vox_get_doc_ids)" -- "$cur"))
                            ;;
                        3)
                            COMPREPLY=($(compgen -W "$(_vox_get_voices)" -- "$cur"))
                            ;;
                    esac
                    ;;

                #--------------------------------------------------------------
                # TUI Commands
                #--------------------------------------------------------------
                tui|edit)
                    case "$COMP_CWORD" in
                        2)
                            local doc_ids=$(_vox_get_doc_ids)
                            COMPREPLY=($(compgen -W "$doc_ids list edit-word palette help" -- "$cur"))
                            ;;
                        3)
                            if [[ "$prev" == "list" || "$prev" == "edit-word" ]]; then
                                COMPREPLY=($(compgen -W "$(_vox_get_doc_ids)" -- "$cur"))
                            fi
                            ;;
                    esac
                    ;;

                #--------------------------------------------------------------
                # Help
                #--------------------------------------------------------------
                help)
                    COMPREPLY=($(compgen -W "g2p annotate pipeline tui" -- "$cur"))
                    ;;
            esac
            ;;
    esac
}

# Register VOX completion
complete -F _vox_completion vox

# Also register for subcommand functions
complete -F _vox_completion vox_g2p 2>/dev/null
complete -F _vox_completion vox_annotate 2>/dev/null
complete -F _vox_completion vox_pipeline 2>/dev/null
complete -F _vox_completion vox_tui 2>/dev/null
