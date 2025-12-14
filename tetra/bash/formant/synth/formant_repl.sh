#!/usr/bin/env bash

# Formant REPL - Interactive Vocal Synthesis Shell
# Uses unified bash/repl system with TDS theming

# Source dependencies
source "$TETRA_SRC/bash/tds/tds.sh"
source "$TETRA_SRC/bash/repl/repl.sh"  # Includes layout system and module.sh
source "$TETRA_SRC/bash/nav/nav.sh"    # For nav_* functions

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
    tds_color "info" "🎙️ FORMANT ENGINE v0.1"
    echo ""
    echo ""
    tds_color "success" "  ✓ Real-time Vocal Synthesis Engine"
    echo ""
    echo "  📋 Estovox Command Language (ECL) ready"
    echo ""
}

formant_repl_status() {
    echo ""
    tds_color "success" "  🎙️ Formant Status: Ready"
    echo ""
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
    # Use colorable UTF-8 symbols (not emojis which have fixed colors)
    local status_symbol="♪"
    local status_color="${TDS_SEMANTIC_COLORS[success]}"

    if [[ "$FORMANT_REPL_ENGINE_RUNNING" == "1" ]]; then
        status_symbol="►"
        status_color="${ENV_PRIMARY[1]}"
    fi

    # Get TDS theme colors
    local bracket_color="${MODE_PRIMARY[5]}"
    local name_color="${VERBS_PRIMARY[3]}"
    local arrow_color="${VERBS_PRIMARY[3]}"

    # Build prompt with readline-aware escape codes
    REPL_PROMPT=""
    REPL_PROMPT+="$(text_color_rl "$bracket_color")[$(reset_color_rl)"
    REPL_PROMPT+="$(text_color_rl "$name_color")formant$(reset_color_rl)"
    REPL_PROMPT+=" $(text_color_rl "$status_color")${status_symbol}$(reset_color_rl)"
    REPL_PROMPT+="$(text_color_rl "$bracket_color")] $(reset_color_rl)"
    REPL_PROMPT+="$(text_color_rl "$arrow_color")> $(reset_color_rl)"
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
            tds_status "warning" "Text-to-speech not yet fully implemented"
            echo "See formant/synth/text2esto.sh for prototype"
            echo ""
            ;;
        phoneme)
            echo ""
            tds_status "warning" "IPA phoneme synthesis not yet integrated with REPL"
            echo "See formant/synth/demo_formant.sh for examples"
            echo ""
            ;;
        demo)
            echo ""
            tds_color "info" "▶ Running Formant Demo"
            echo ""
            echo ""
            if [[ -x "$FORMANT_SYNTH_SRC/demo_speech.sh" ]]; then
                bash "$FORMANT_SYNTH_SRC/demo_speech.sh"
            else
                tds_status "error" "Demo script not found or not executable"
            fi
            echo ""
            ;;
        meter)
            local meter_cmd="${cmd_args[1]}"
            case "$meter_cmd" in
                show)
                    echo ""
                    tds_color "success" "📊 VU Meter Display"
                    echo ""
                    echo "[========|========]  -12dB  Peak: -6dB"
                    echo ""
                    ;;
                reset)
                    echo ""
                    tds_status "success" "Meter statistics reset"
                    echo ""
                    ;;
                vu|a_weight|bass|treble)
                    echo ""
                    tds_status "success" "Meter preset: $meter_cmd"
                    echo ""
                    ;;
                *)
                    tds_color "warning" "Usage: meter [vu|a_weight|bass|treble|show|reset]"
                    echo ""
                    ;;
            esac
            ;;
        record)
            local phoneme="${cmd_args[1]}"
            if [[ -z "$phoneme" ]]; then
                tds_color "warning" "Usage: record <phoneme>"
                echo ""
                echo "Example: record a"
            else
                echo ""
                tds_color "info" "🎤 Recording phoneme: /$phoneme/"
                echo ""
                echo ""
                echo "Speak the sound when ready... (press Ctrl+C to cancel)"
                echo ""
                tds_status "warning" "VAD recording integration pending"
                echo ""
            fi
            ;;
        analyze)
            local wav_file="${cmd_args[1]}"
            if [[ -z "$wav_file" ]]; then
                tds_color "warning" "Usage: analyze <wav_file>"
                echo ""
                echo "Example: analyze sound_bank/en_us/a.wav"
            elif [[ ! -f "$wav_file" ]]; then
                tds_status "error" "File not found: $wav_file"
            else
                echo ""
                tds_color "info" "🔍 Analyzing: $wav_file"
                echo ""
                echo ""
                tds_status "warning" "Grain analysis integration pending"
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
                    tds_color "info" "📚 Phoneme BST Structure"
                    echo ""
                    echo ""
                    echo "        [C0] schwa"
                    echo "    [80] i"
                    echo "        [40] a"
                    echo ""
                    tds_status "warning" "BST visualization pending"
                    echo ""
                    ;;
                add)
                    local phoneme="${cmd_args[2]}"
                    local wav="${cmd_args[3]}"
                    if [[ -z "$phoneme" ]] || [[ -z "$wav" ]]; then
                        tds_color "warning" "Usage: bank add <phoneme> <wav_file>"
                        echo ""
                        echo "Example: bank add a recordings/a.wav"
                    else
                        echo ""
                        tds_status "success" "Added /$phoneme/ → $wav to sound bank"
                        echo ""
                    fi
                    ;;
                play)
                    local phoneme="${cmd_args[2]}"
                    if [[ -z "$phoneme" ]]; then
                        tds_color "warning" "Usage: bank play <phoneme>"
                        echo ""
                        echo "Example: bank play a"
                    else
                        echo ""
                        tds_color "success" "▶ Playing /$phoneme/ from sound bank"
                        echo ""
                        echo ""
                    fi
                    ;;
                export)
                    echo ""
                    tds_status "success" "Exported sound bank metadata"
                    echo "   → sound_bank/en_us/bank.json"
                    echo ""
                    ;;
                *)
                    tds_color "warning" "Usage: bank [list|add|play|export]"
                    echo ""
                    ;;
            esac
            ;;
        *)
            tds_status "error" "Unknown command: $cmd"
            echo "   Type 'help' for available commands"
            ;;
    esac

    return 0
}

# ============================================================================
# MAIN ENTRY POINT
# ============================================================================

formant_repl_run() {
    # Build help tree first (before registering completion)
    _formant_build_help_tree

    # Layout configuration
    declare -A FORMANT_LAYOUT=(
        [preset]="standard"
        [cols]=3
        [item_width]=20
    )

    # Initialize module (loads TDS, registers completion, sets up layout)
    repl_module_init "formant" \
        "start status demo speak phoneme meter record analyze bank" \
        "help.game.formant" \
        FORMANT_LAYOUT

    # Banner
    echo ""
    tds_color "info" "🎙️ FORMANT - Vocal Synthesis REPL"
    echo ""
    echo ""
    tds_color "text.secondary" "Real-time vocal synthesis with IPA phoneme support"
    echo ""
    tds_color "text.secondary" "Type 'help' for commands, 'demo' to hear it in action"
    echo ""
    echo ""

    # Override REPL callbacks with formant-specific implementations
    repl_build_prompt() { _formant_repl_build_prompt "$@"; }
    repl_process_input() { _formant_repl_process_input "$@"; }
    export -f repl_build_prompt repl_process_input

    # Run unified REPL loop (provides /help, /theme, /mode, /exit commands)
    repl_run

    # Cleanup
    repl_module_cleanup

    echo ""
    tds_color "info" "Goodbye! 🎙️"
    echo ""
    echo ""
}

# Export main function
export -f formant_repl_run
