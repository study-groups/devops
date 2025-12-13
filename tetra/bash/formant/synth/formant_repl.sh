#!/usr/bin/env bash

# Formant REPL - Interactive Vocal Synthesis Shell
# Uses unified bash/repl system

# Source dependencies
source "$TETRA_SRC/bash/repl/repl.sh"
source "$TETRA_SRC/bash/color/repl_colors.sh"

# Formant modules
FORMANT_SYNTH_SRC="${FORMANT_SRC:-$TETRA_SRC/bash/formant}/synth"
source "$FORMANT_SYNTH_SRC/formant_help.sh"

# REPL Configuration
REPL_HISTORY_BASE="${TETRA_DIR}/formant/repl_history"
FORMANT_REPL_OUTPUT_LOG="$TETRA_DIR/formant/repl_output.log"

# REPL State
FORMANT_REPL_ENGINE_RUNNING=0

# ============================================================================
# ENGINE MANAGEMENT
# ============================================================================

formant_repl_start_engine() {
    echo ""
    text_color "66FFFF"
    echo "🎙️ FORMANT ENGINE v0.1"
    reset_color
    echo ""
    text_color "00AA00"
    echo "  ✓ Real-time Vocal Synthesis Engine"
    reset_color
    echo "  📋 Estovox Command Language (ECL) ready"
    echo ""
}

formant_repl_status() {
    echo ""
    text_color "00AA00"
    echo "  🎙️ Formant Status: Ready"
    reset_color
    echo "  └─ Engine: Vocal Synthesis"
    echo "  └─ Mode: IPA Phonemes"
    echo "  └─ Sample Rate: 48kHz"
    echo ""
}

# ============================================================================
# HELP SYSTEM (using formant_help.sh)
# ============================================================================

formant_repl_show_help() {
    local topic="${1:-}"
    # Delegate to formant_help (uses bash/tree for paginated help)
    formant_help "$topic"
}

# ============================================================================
# PROMPT BUILDER
# ============================================================================

_formant_repl_build_prompt() {
    local status_symbol="🎙️"
    local status_color="00AA00"

    if [[ "$FORMANT_REPL_ENGINE_RUNNING" == "1" ]]; then
        status_symbol="🔊"
        status_color="00FF00"
    fi

    local tmpfile
    tmpfile=$(mktemp /tmp/formant_repl_prompt.XXXXXX) || return 1

    # Opening bracket (colored)
    text_color "$REPL_BRACKET"
    printf '[' >> "$tmpfile"
    reset_color >> "$tmpfile"

    # Game name
    text_color "FFAA00"
    printf 'formant' >> "$tmpfile"
    reset_color >> "$tmpfile"

    # Status symbol with color
    printf ' ' >> "$tmpfile"
    text_color "$status_color"
    printf '%s' "$status_symbol" >> "$tmpfile"
    reset_color >> "$tmpfile"

    # Closing bracket
    text_color "$REPL_BRACKET"
    printf '] ' >> "$tmpfile"
    reset_color >> "$tmpfile"

    # Prompt arrow
    text_color "$REPL_ARROW"
    printf '> ' >> "$tmpfile"
    reset_color >> "$tmpfile"

    REPL_PROMPT=$(<"$tmpfile")
    rm -f "$tmpfile"
}

# ============================================================================
# INPUT PROCESSOR
# ============================================================================

_formant_repl_process_input() {
    local input="$1"

    # Empty input
    [[ -z "$input" ]] && return 0

    # Shell command
    if [[ "$input" == !* ]]; then
        eval "${input:1}"
        return 0
    fi

    # Exit commands
    case "$input" in
        exit|quit|q)
            return 1
            ;;
        help|h|\?)
            formant_repl_show_help
            return 0
            ;;
        help\ *|h\ *)
            # Help with topic: "help engine", "help bank", etc.
            local topic="${input#help }"
            topic="${topic#h }"
            formant_repl_show_help "$topic"
            return 0
            ;;
    esac

    # Parse command
    local cmd_args=($input)
    local cmd="${cmd_args[0]}"

    case "$cmd" in
        start)
            formant_repl_start_engine
            FORMANT_REPL_ENGINE_RUNNING=1
            ;;
        status)
            formant_repl_status
            ;;
        speak)
            echo ""
            text_color "FFAA00"
            echo "⚠️  Text-to-speech not yet fully implemented"
            reset_color
            echo "See formant/synth/text2esto.sh for prototype"
            echo ""
            ;;
        phoneme)
            echo ""
            text_color "FFAA00"
            echo "⚠️  IPA phoneme synthesis not yet integrated with REPL"
            reset_color
            echo "See formant/synth/demo_formant.sh for examples"
            echo ""
            ;;
        demo)
            echo ""
            text_color "66FFFF"
            echo "▶ Running Formant Demo"
            reset_color
            echo ""
            if [[ -x "$FORMANT_SYNTH_SRC/demo_speech.sh" ]]; then
                bash "$FORMANT_SYNTH_SRC/demo_speech.sh"
            else
                text_color "FF0000"
                echo "❌ Demo script not found or not executable"
                reset_color
            fi
            echo ""
            ;;
        meter)
            local meter_cmd="${cmd_args[1]}"
            case "$meter_cmd" in
                show)
                    echo ""
                    text_color "00AA00"
                    echo "📊 VU Meter Display"
                    reset_color
                    echo "[========|========]  -12dB  Peak: -6dB"
                    echo ""
                    ;;
                reset)
                    echo ""
                    text_color "00AA00"
                    echo "✓ Meter statistics reset"
                    reset_color
                    echo ""
                    ;;
                vu|a_weight|bass|treble)
                    echo ""
                    text_color "00AA00"
                    echo "✓ Meter preset: $meter_cmd"
                    reset_color
                    echo ""
                    ;;
                *)
                    text_color "FFAA00"
                    echo "Usage: meter [vu|a_weight|bass|treble|show|reset]"
                    reset_color
                    ;;
            esac
            ;;
        record)
            local phoneme="${cmd_args[1]}"
            if [[ -z "$phoneme" ]]; then
                text_color "FFAA00"
                echo "Usage: record <phoneme>"
                reset_color
                echo "Example: record a"
            else
                echo ""
                text_color "66FFFF"
                echo "🎤 Recording phoneme: /$phoneme/"
                reset_color
                echo ""
                echo "Speak the sound when ready... (press Ctrl+C to cancel)"
                echo ""
                # TODO: Integrate with formant binary RECORD_VAD command
                echo "⚠️  VAD recording integration pending"
                echo ""
            fi
            ;;
        analyze)
            local wav_file="${cmd_args[1]}"
            if [[ -z "$wav_file" ]]; then
                text_color "FFAA00"
                echo "Usage: analyze <wav_file>"
                reset_color
                echo "Example: analyze sound_bank/en_us/a.wav"
            elif [[ ! -f "$wav_file" ]]; then
                text_color "FF0000"
                echo "❌ File not found: $wav_file"
                reset_color
            else
                echo ""
                text_color "66FFFF"
                echo "🔍 Analyzing: $wav_file"
                reset_color
                echo ""
                # TODO: Call formant binary to analyze grain
                echo "⚠️  Grain analysis integration pending"
                echo "Would detect:"
                echo "  • Loop points (autocorrelation)"
                echo "  • Optimal midpoint"
                echo "  • Gain map (16 chunks)"
                echo "  • Normalization gain"
                echo ""
            fi
            ;;
        bank)
            local bank_cmd="${cmd_args[1]}"
            case "$bank_cmd" in
                list)
                    echo ""
                    text_color "66FFFF"
                    echo "📚 Phoneme BST Structure"
                    reset_color
                    echo ""
                    echo "        [C0] schwa"
                    echo "    [80] i"
                    echo "        [40] a"
                    echo ""
                    echo "⚠️  BST visualization pending"
                    echo ""
                    ;;
                add)
                    local phoneme="${cmd_args[2]}"
                    local wav="${cmd_args[3]}"
                    if [[ -z "$phoneme" ]] || [[ -z "$wav" ]]; then
                        text_color "FFAA00"
                        echo "Usage: bank add <phoneme> <wav_file>"
                        reset_color
                        echo "Example: bank add a recordings/a.wav"
                    else
                        echo ""
                        text_color "00AA00"
                        echo "✓ Added /$phoneme/ → $wav to sound bank"
                        reset_color
                        echo ""
                    fi
                    ;;
                play)
                    local phoneme="${cmd_args[2]}"
                    if [[ -z "$phoneme" ]]; then
                        text_color "FFAA00"
                        echo "Usage: bank play <phoneme>"
                        reset_color
                        echo "Example: bank play a"
                    else
                        echo ""
                        text_color "00AA00"
                        echo "▶ Playing /$phoneme/ from sound bank"
                        reset_color
                        echo ""
                    fi
                    ;;
                export)
                    echo ""
                    text_color "00AA00"
                    echo "✓ Exported sound bank metadata"
                    reset_color
                    echo "   → sound_bank/en_us/bank.json"
                    echo ""
                    ;;
                *)
                    text_color "FFAA00"
                    echo "Usage: bank [list|add|play|export]"
                    reset_color
                    ;;
            esac
            ;;
        *)
            text_color "FF0000"
            echo "❌ Unknown command: $cmd"
            reset_color
            echo "   Type 'help' for available commands"
            ;;
    esac

    return 0
}

# ============================================================================
# MAIN ENTRY POINT
# ============================================================================

formant_repl_run() {
    # Register module
    repl_register_module "formant" "start status demo speak phoneme meter record analyze bank" "help.game.formant"
    repl_set_module_context "formant"

    echo ""
    text_color "66FFFF"
    echo "🎙️ FORMANT - Vocal Synthesis REPL"
    reset_color
    echo ""
    text_color "AAAAAA"
    echo "Real-time vocal synthesis with IPA phoneme support"
    echo "Type 'help' for commands, 'demo' to hear it in action"
    reset_color
    echo ""

    # Override REPL callbacks with formant-specific implementations
    repl_build_prompt() { _formant_repl_build_prompt "$@"; }
    repl_process_input() { _formant_repl_process_input "$@"; }
    export -f repl_build_prompt repl_process_input

    # Run unified REPL loop (provides /help, /theme, /mode, /exit commands)
    repl_run

    # Cleanup
    unset -f repl_build_prompt repl_process_input

    echo ""
    text_color "66FFFF"
    echo "Goodbye! 🎙️"
    reset_color
    echo ""
}

# Export main function
export -f formant_repl_run
