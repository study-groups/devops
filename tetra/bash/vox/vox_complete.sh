#!/usr/bin/env bash
# vox_complete.sh - Multi-level dynamic tab completion
#
# Pattern: vox <cmd> <target> [options]
#
# Completion tree:
#   vox <TAB>           → commands
#   vox play <TAB>      → voices (all providers)
#   vox play voice <TAB> → sources (qa refs, files)
#   vox set <TAB>       → variables
#   vox set var <TAB>   → values for that variable

# =============================================================================
# STATIC DEFINITIONS
# =============================================================================

_VOX_COMMANDS="play karaoke generate formant esto set learn cc ls info cache dry-run log analyze tui coqui provider help"

# Voice names per provider (without prefix)
_VOX_VOICES_OPENAI_NAMES="alloy ash coral echo fable nova onyx sage shimmer"
_VOX_VOICES_COQUI_NAMES="vits tacotron xtts"
_VOX_VOICES_FORMANT_NAMES="ipa"

# Settable variables
_VOX_VARIABLES="voice provider volume speed pitch highlight theme source"

# =============================================================================
# DYNAMIC COMPLETIONS
# =============================================================================

# Get QA references dynamically
_vox_qa_refs() {
    local qa_dir="${QA_DIR:-$TETRA_DIR/qa}/db"
    [[ -d "$qa_dir" ]] || return

    # Relative indices
    echo "qa:0"
    echo "qa:1"
    echo "qa:2"
    echo "qa:latest"

    # Recent timestamps (last 10)
    for f in $(ls -t "$qa_dir"/*.answer 2>/dev/null | head -10); do
        local base=$(basename "$f" .answer)
        echo "qa:$base"
    done
}

# Get all voices (all providers with explicit prefix)
_vox_voices() {
    # OpenAI voices (cloud API)
    for v in $_VOX_VOICES_OPENAI_NAMES; do
        echo "openai:$v"
    done

    # Coqui voices (local ML)
    for v in $_VOX_VOICES_COQUI_NAMES; do
        echo "coqui:$v"
    done

    # Formant (research/local C engine)
    for v in $_VOX_VOICES_FORMANT_NAMES; do
        echo "formant:$v"
    done
}

# Get voices for specific provider (without prefix, for internal use)
_vox_provider_voices() {
    local provider="$1"
    case "$provider" in
        openai)  echo "$_VOX_VOICES_OPENAI_NAMES" ;;
        coqui)   echo "$_VOX_VOICES_COQUI_NAMES" ;;
        formant) echo "$_VOX_VOICES_FORMANT_NAMES" ;;
    esac
}

# Get MP3 files
_vox_mp3_files() {
    local f
    # Local directory
    for f in *.mp3; do
        [[ -f "$f" ]] && echo "$f"
    done

    # VOX db directory
    local vox_dir="${VOX_DIR:-${TETRA_DIR:-$HOME/tetra}/vox}/db"
    if [[ -d "$vox_dir" ]]; then
        for f in "$vox_dir"/*.mp3; do
            [[ -f "$f" ]] && basename "$f"
        done | head -20
    fi
}

# Get ESTO files
_vox_esto_files() {
    local f
    # Local directory
    for f in *.esto; do
        [[ -f "$f" ]] && echo "$f"
    done

    # VOX esto directory
    local esto_dir="${VOX_DIR:-${TETRA_DIR:-$HOME/tetra}/vox}/esto"
    if [[ -d "$esto_dir" ]]; then
        find "$esto_dir" -name "*.esto" -type f 2>/dev/null | head -20
    fi
}

# Get variable values for completion
_vox_var_values() {
    local var="$1"
    case "$var" in
        voice)     _vox_voices ;;
        provider)  echo "openai coqui formant" ;;
        volume)    echo "0 25 50 75 100 127" ;;
        speed)     echo "50 75 100 125 150 200" ;;
        pitch)     echo "50 75 100 125 150" ;;
        highlight) echo "word phoneme line off" ;;
        theme)     echo "default warm cool arctic electric neutral" ;;
        source)    echo "qa chat file stdin" ;;
    esac
}

# =============================================================================
# MAIN COMPLETION FUNCTION
# =============================================================================

_vox_complete() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"
    local cmd="${COMP_WORDS[1]:-}"
    local subcmd="${COMP_WORDS[2]:-}"

    COMPREPLY=()

    # Level 1: Commands
    if [[ $COMP_CWORD -eq 1 ]]; then
        COMPREPLY=($(compgen -W "$_VOX_COMMANDS" -- "$cur"))
        return
    fi

    # Level 2+: Context-sensitive
    case "$cmd" in
        # =====================================================================
        # PLAY / KARAOKE / GENERATE - voice then source
        # =====================================================================
        play|p|karaoke|k|generate|g)
            if [[ $COMP_CWORD -eq 2 ]]; then
                # Complete with voices
                COMPREPLY=($(compgen -W "$(_vox_voices)" -- "$cur"))
            elif [[ $COMP_CWORD -eq 3 ]]; then
                # Complete with sources or options
                if [[ "$cur" == -* ]]; then
                    COMPREPLY=($(compgen -W "--output -o --esto --sync" -- "$cur"))
                else
                    COMPREPLY=($(compgen -W "$(_vox_qa_refs)" -- "$cur"))
                fi
            elif [[ "$prev" == "--output" || "$prev" == "-o" ]]; then
                COMPREPLY=($(compgen -f -- "$cur"))
            fi
            ;;

        # =====================================================================
        # FORMANT - research mode subcommands
        # =====================================================================
        formant|fm)
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "speak ph phoneme fm formants emotion start stop status info" -- "$cur"))
            elif [[ $COMP_CWORD -eq 3 ]]; then
                case "$subcmd" in
                    speak)
                        # Text or file
                        COMPREPLY=($(compgen -f -- "$cur"))
                        ;;
                    ph|phoneme)
                        # IPA phonemes
                        COMPREPLY=($(compgen -W "a e i o u m n p b t d k g f v s z h l r w j" -- "$cur"))
                        ;;
                    emotion)
                        COMPREPLY=($(compgen -W "neutral happy sad angry surprised" -- "$cur"))
                        ;;
                esac
            fi
            ;;

        # =====================================================================
        # ESTO - timeline management
        # =====================================================================
        esto)
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "generate play list info sync" -- "$cur"))
            elif [[ $COMP_CWORD -eq 3 ]]; then
                case "$subcmd" in
                    generate)
                        # Source to generate ESTO from
                        COMPREPLY=($(compgen -W "$(_vox_qa_refs) $(_vox_mp3_files)" -- "$cur"))
                        ;;
                    play|info)
                        # ESTO files
                        COMPREPLY=($(compgen -W "$(_vox_esto_files)" -- "$cur"))
                        ;;
                esac
            fi
            ;;

        # =====================================================================
        # SET - variable assignment
        # =====================================================================
        set)
            if [[ $COMP_CWORD -eq 2 ]]; then
                # Complete with variable names
                COMPREPLY=($(compgen -W "$_VOX_VARIABLES" -- "$cur"))
            elif [[ $COMP_CWORD -eq 3 ]]; then
                # Complete with values for that variable
                COMPREPLY=($(compgen -W "$(_vox_var_values "$subcmd")" -- "$cur"))
            fi
            ;;

        # =====================================================================
        # LEARN - MIDI CC learning
        # =====================================================================
        learn)
            if [[ $COMP_CWORD -eq 2 ]]; then
                # Complete with learnable variables
                COMPREPLY=($(compgen -W "$_VOX_VARIABLES" -- "$cur"))
            fi
            ;;

        # =====================================================================
        # CC - MIDI CC management
        # =====================================================================
        cc)
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "list clear save load" -- "$cur"))
            fi
            ;;

        # =====================================================================
        # LS / LIST
        # =====================================================================
        ls|list)
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "mp3 audio esto recent project qa cache voices providers all" -- "$cur"))
            fi
            ;;

        # =====================================================================
        # INFO
        # =====================================================================
        info)
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "$(_vox_mp3_files) $(_vox_esto_files)" -- "$cur"))
                COMPREPLY+=($(compgen -f -X '!*.@(mp3|esto)' -- "$cur"))
            fi
            ;;

        # =====================================================================
        # CACHE
        # =====================================================================
        cache)
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "stats status info clean" -- "$cur"))
            fi
            ;;

        # =====================================================================
        # DRY-RUN
        # =====================================================================
        dry-run|dry)
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "qa file batch stdin help" -- "$cur"))
            elif [[ $COMP_CWORD -eq 3 ]]; then
                case "$subcmd" in
                    qa)
                        COMPREPLY=($(compgen -W "$(_vox_qa_refs)" -- "$cur"))
                        ;;
                    file)
                        COMPREPLY=($(compgen -f -- "$cur"))
                        ;;
                    batch|stdin)
                        COMPREPLY=($(compgen -W "$(_vox_voices)" -- "$cur"))
                        ;;
                esac
            elif [[ $COMP_CWORD -eq 4 ]]; then
                # Voice after qa ref or file
                COMPREPLY=($(compgen -W "$(_vox_voices)" -- "$cur"))
            fi
            ;;

        # =====================================================================
        # LOG
        # =====================================================================
        log)
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "retrofit stats query help" -- "$cur"))
            elif [[ $COMP_CWORD -ge 3 ]]; then
                case "$subcmd" in
                    retrofit)
                        if [[ "$cur" == -* ]]; then
                            COMPREPLY=($(compgen -W "--scan" -- "$cur"))
                        else
                            COMPREPLY=($(compgen -f -X '!*.mp3' -- "$cur"))
                        fi
                        ;;
                    query)
                        COMPREPLY=($(compgen -W "--limit --voice --provider --cache-hit --cache-miss --since" -- "$cur"))
                        if [[ "$prev" == "--voice" ]]; then
                            COMPREPLY=($(compgen -W "$(_vox_voices)" -- "$cur"))
                        elif [[ "$prev" == "--provider" ]]; then
                            COMPREPLY=($(compgen -W "openai coqui formant" -- "$cur"))
                        fi
                        ;;
                esac
            fi
            ;;

        # =====================================================================
        # ANALYZE
        # =====================================================================
        analyze|an)
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "file summary batch help" -- "$cur"))
            elif [[ $COMP_CWORD -eq 3 ]]; then
                COMPREPLY=($(compgen -f -X '!*.mp3' -- "$cur"))
                COMPREPLY+=($(compgen -W "$(_vox_mp3_files)" -- "$cur"))
            fi
            ;;

        # =====================================================================
        # TUI
        # =====================================================================
        tui)
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "$(_vox_mp3_files) $(_vox_qa_refs)" -- "$cur"))
            fi
            ;;

        # =====================================================================
        # COQUI
        # =====================================================================
        coqui|local)
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "install status models init generate play help" -- "$cur"))
            elif [[ $COMP_CWORD -eq 3 ]]; then
                case "$subcmd" in
                    play|p)
                        COMPREPLY=($(compgen -W "$_VOX_VOICES_COQUI_NAMES fast classic best" -- "$cur"))
                        ;;
                    generate|g)
                        COMPREPLY=($(compgen -f -- "$cur"))
                        ;;
                esac
            elif [[ $COMP_CWORD -eq 4 ]]; then
                if [[ "$subcmd" == "generate" || "$subcmd" == "g" ]]; then
                    COMPREPLY=($(compgen -W "$_VOX_VOICES_COQUI_NAMES" -- "$cur"))
                fi
            fi
            ;;

        # =====================================================================
        # PROVIDER
        # =====================================================================
        provider)
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "status info list openai coqui formant" -- "$cur"))
            fi
            ;;

        # =====================================================================
        # HELP
        # =====================================================================
        help|h)
            COMPREPLY=($(compgen -W "$_VOX_COMMANDS" -- "$cur"))
            ;;
    esac
}

# =============================================================================
# USAGE HINTS
# =============================================================================

_vox_show_usage() {
    local cmd="$1"
    local subcmd="$2"

    echo >&2
    case "$cmd" in
        play|p|karaoke|k)
            echo "Usage: vox $cmd <voice> [source]" >&2
            echo "  voice:  shimmer, coqui:xtts, formant:ipa" >&2
            echo "  source: qa:0, qa:latest, file.txt" >&2
            ;;
        formant|fm)
            echo "Usage: vox formant <speak|ph|fm|emotion|start|stop>" >&2
            echo "  speak \"text\"     - Speak through formant engine" >&2
            echo "  ph <ipa> [dur] [pitch] - Direct phoneme" >&2
            echo "  emotion <name> [intensity]" >&2
            ;;
        set)
            echo "Usage: vox set <variable> <value>" >&2
            echo "  Variables: voice provider volume speed pitch highlight theme" >&2
            ;;
        learn)
            echo "Usage: vox learn <variable>" >&2
            echo "  Move a MIDI CC to assign it to the variable" >&2
            ;;
        *)
            echo "Usage: vox <command> [options]" >&2
            echo "Commands: play karaoke generate formant esto set learn tui help" >&2
            ;;
    esac
}

# Register completion (only in interactive shells)
if [[ $- == *i* ]]; then
    complete -F _vox_complete vox
fi

# Also export for explicit registration
vox_register_completion() {
    complete -F _vox_complete vox
}
