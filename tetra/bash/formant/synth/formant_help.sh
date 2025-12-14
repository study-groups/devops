#!/usr/bin/env bash
# Formant REPL Help System
# Using bash/nav builders for standardized help

# Source dependencies
if [[ -n "$TETRA_SRC" ]]; then
    source "$TETRA_SRC/bash/nav/nav_builders.sh"
    source "$TETRA_SRC/bash/nav/nav_help.sh"
fi

# Completion helper - meter presets
_formant_complete_meter_presets() {
    echo "vu"
    echo "a_weight"
    echo "bass"
    echo "treble"
}

# Completion helper - IPA phonemes (basic vowels)
_formant_complete_phonemes() {
    # Basic IPA vowels
    echo "i"
    echo "e"
    echo "a"
    echo "o"
    echo "u"
    echo "ɪ"
    echo "ɛ"
    echo "æ"
    echo "ʌ"
    echo "ɔ"
    echo "ʊ"
}

# Build formant help tree
_formant_build_help_tree() {
    # Main help
    tree_build_category "help.game.formant" \
        "🎙️ FORMANT" \
        "Vocal Synthesis Shell - Real-time vocal synthesis with IPA phoneme support"

    # Engine commands
    tree_build_category "help.game.formant.engine" \
        "Engine Commands" \
        "Start and manage the formant synthesis engine"

    tree_build_command "help.game.formant.engine.start" \
        "Start Engine" \
        "Start the formant synthesis engine" \
        "start" \
        "start" \
        "formant_repl_start_engine"

    tree_build_command "help.game.formant.engine.status" \
        "Engine Status" \
        "Show engine status and configuration" \
        "status" \
        "status" \
        "formant_repl_status"

    tree_build_command "help.game.formant.engine.demo" \
        "Demo Speech" \
        "Run formant synthesis demo" \
        "demo" \
        "demo"

    # Metering commands
    tree_build_category "help.game.formant.meter" \
        "Metering Commands" \
        "Audio level metering and analysis"

    tree_build_command "help.game.formant.meter.preset" \
        "Select Meter" \
        "Select meter preset for recording (vu, a_weight, bass, treble)" \
        "meter <preset>" \
        "meter a_weight" \
        "" \
        "_formant_complete_meter_presets"

    tree_build_command "help.game.formant.meter.show" \
        "Show Meter" \
        "Display current meter reading" \
        "meter show" \
        "meter show"

    tree_build_command "help.game.formant.meter.reset" \
        "Reset Meter" \
        "Reset meter statistics" \
        "meter reset" \
        "meter reset"

    # Recording commands
    tree_build_category "help.game.formant.record" \
        "Recording Commands" \
        "Record and analyze phoneme samples"

    tree_build_command "help.game.formant.record.phoneme" \
        "Record Phoneme" \
        "Record phoneme with VAD and live metering" \
        "record <phoneme>" \
        "record a" \
        "" \
        "_formant_complete_phonemes"

    tree_build_command "help.game.formant.record.analyze" \
        "Analyze WAV" \
        "Analyze WAV file for loop points and grain data" \
        "analyze <wav_file>" \
        "analyze a.wav"

    # Sound bank commands
    tree_build_category "help.game.formant.bank" \
        "Sound Bank Commands" \
        "Manage phoneme sound bank (BST structure)"

    tree_build_command "help.game.formant.bank.list" \
        "List Bank" \
        "Show phoneme BST structure" \
        "bank list" \
        "bank list"

    tree_build_command "help.game.formant.bank.add" \
        "Add to Bank" \
        "Add grain to sound bank" \
        "bank add <phoneme> <wav>" \
        "bank add a a.wav" \
        "" \
        "_formant_complete_phonemes"

    tree_build_command "help.game.formant.bank.play" \
        "Play from Bank" \
        "Play grain from sound bank" \
        "bank play <phoneme>" \
        "bank play a" \
        "" \
        "_formant_complete_phonemes"

    tree_build_command "help.game.formant.bank.export" \
        "Export Bank" \
        "Export bank metadata" \
        "bank export" \
        "bank export"

    # Synthesis commands
    tree_build_category "help.game.formant.synthesis" \
        "Synthesis Commands" \
        "Real-time formant synthesis"

    tree_build_command "help.game.formant.synthesis.phoneme" \
        "Synthesize Phoneme" \
        "Real-time IPA phoneme synthesis" \
        "phoneme <ipa>" \
        "phoneme a" \
        "" \
        "_formant_complete_phonemes"

    tree_build_command "help.game.formant.synthesis.speak" \
        "Speak Text" \
        "Text-to-speech synthesis (prototype)" \
        "speak <text>" \
        "speak hello world"
}

# Main help entry point
formant_help() {
    local topic="${1:-help.game.formant}"

    # Normalize topic path - add namespace if not present
    if [[ "$topic" != help.game.formant* ]]; then
        # If user provides "formant.engine.start", convert to "help.game.formant.engine.start"
        if [[ "$topic" == formant* ]]; then
            topic="help.game.${topic}"
        else
            # Otherwise, assume it's a sub-path like "engine.start"
            topic="help.game.formant.${topic}"
        fi
    fi

    # Build tree on first use
    if ! nav_exists "help.game.formant" 2>/dev/null; then
        _formant_build_help_tree
    fi

    # Show help using nav system (18-line paginated)
    nav_help "$topic"
}

# Export
export -f formant_help
export -f _formant_build_help_tree
export -f _formant_complete_meter_presets
export -f _formant_complete_phonemes
