#!/usr/bin/env bash
# Estovox Demo - Comprehensive demonstration of features

# Source the module
SCRIPT_DIR="${BASH_SOURCE[0]%/*}"
source "$SCRIPT_DIR/estovox.sh"

demo_banner() {
    cat <<'EOF'
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║                    E S T O V O X                         ║
║                                                          ║
║         Facial Animation & Articulation System           ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
EOF
}

demo_section() {
    local title=$1
    echo ""
    echo "┌─ $title"
    sleep 1
}

demo_wait() {
    local duration=${1:-2}
    sleep "$duration"
}

demo_phonemes() {
    demo_section "IPA Vowels Demonstration"

    local -a vowels=(
        "i:300" "e:300" "a:300" "o:300" "u:300" "rest:200"
    )

    echo "  Articulating: i e a o u"
    estovox_play_sequence "${vowels[@]}"
    demo_wait 1
}

demo_consonants() {
    demo_section "Consonants Demonstration"

    local -a consonants=(
        "m:200" "rest:100"
        "p:150" "rest:100"
        "s:200" "rest:100"
        "sh:200" "rest:100"
        "w:200" "rest:100"
    )

    echo "  Articulating: m p s sh w"
    estovox_play_sequence "${consonants[@]}"
    demo_wait 1
}

demo_expressions() {
    demo_section "Facial Expressions"

    local -a expressions=(
        "neutral:800"
        "happy:1000"
        "neutral:500"
        "sad:1000"
        "neutral:500"
        "surprised:1000"
        "neutral:500"
        "angry:1000"
        "neutral:800"
    )

    echo "  Showing: neutral → happy → sad → surprised → angry → neutral"
    estovox_play_sequence "${expressions[@]}"
    demo_wait 1
}

demo_word() {
    demo_section "Simple Word: 'HELLO'"

    local -a hello=(
        "h:100"
        "e:200"
        "l:150"
        "o:250"
        "rest:300"
    )

    echo "  Articulating: h-e-l-o"
    estovox_play_sequence "${hello[@]}"
    demo_wait 1
}

demo_eyebrows() {
    demo_section "Eyebrow Control"

    echo "  Raising eyebrows..."
    estovox_apply_preset "raised" 0.3
    demo_wait 1.5

    echo "  Furrowing brow..."
    estovox_apply_preset "furrowed" 0.3
    demo_wait 1.5

    echo "  Skeptical look..."
    estovox_apply_preset "skeptical" 0.3
    demo_wait 1.5

    echo "  Back to neutral..."
    estovox_apply_preset "neutral" 0.3
    demo_wait 1
}

demo_eyes() {
    demo_section "Eye Animation"

    echo "  Blinking..."
    estovox_set_target "ESTOVOX_EYE_OPENNESS" 0.0 0.8
    demo_wait 0.3
    estovox_set_target "ESTOVOX_EYE_OPENNESS" 1.0 0.8
    demo_wait 0.5

    echo "  Winking left..."
    estovox_apply_preset "wink_left" 0.5
    demo_wait 1

    echo "  Winking right..."
    estovox_apply_preset "wink_right" 0.5
    demo_wait 1

    echo "  Both eyes open..."
    estovox_set_target "ESTOVOX_EYE_L_OPENNESS" 1.0 0.5
    estovox_set_target "ESTOVOX_EYE_R_OPENNESS" 1.0 0.5
    demo_wait 1
}

demo_gaze() {
    demo_section "Gaze Control"

    echo "  Looking left..."
    estovox_set_target "ESTOVOX_GAZE_H" 0.2 0.3
    demo_wait 1

    echo "  Looking right..."
    estovox_set_target "ESTOVOX_GAZE_H" 0.8 0.3
    demo_wait 1

    echo "  Looking up..."
    estovox_set_target "ESTOVOX_GAZE_H" 0.5 0.3
    estovox_set_target "ESTOVOX_GAZE_V" 0.2 0.3
    demo_wait 1

    echo "  Looking down..."
    estovox_set_target "ESTOVOX_GAZE_V" 0.8 0.3
    demo_wait 1

    echo "  Center gaze..."
    estovox_set_target "ESTOVOX_GAZE_H" 0.5 0.3
    estovox_set_target "ESTOVOX_GAZE_V" 0.5 0.3
    demo_wait 1
}

demo_combination() {
    demo_section "Combined Animation"

    echo "  Happy greeting..."
    estovox_apply_preset "happy" 0.3
    estovox_play_sequence "h:100" "e:150" "l:100" "o:200" "rest:100"
    demo_wait 0.5

    echo "  Surprised reaction..."
    estovox_apply_preset "surprised" 0.4
    demo_wait 1.5

    echo "  Thinking..."
    estovox_apply_preset "thinking" 0.3
    demo_wait 1.5

    echo "  Final smile..."
    estovox_apply_preset "happy" 0.3
    demo_wait 1.5

    echo "  Reset to neutral..."
    estovox_apply_preset "neutral" 0.3
    demo_wait 1
}

main() {
    # Initialize
    estovox_module_init || {
        echo "Failed to initialize Estovox" >&2
        return 1
    }

    # Setup screen
    estovox_init_screen
    trap 'estovox_stop_animation; estovox_restore_screen' EXIT

    # Show banner
    demo_banner
    sleep 2
    clear

    # Start animation loop
    estovox_start_animation
    sleep 0.5

    # Run demos
    demo_phonemes
    demo_consonants
    demo_word
    demo_expressions
    demo_eyebrows
    demo_eyes
    demo_gaze
    demo_combination

    # Final message
    demo_section "Demo Complete!"
    echo ""
    echo "  Try the interactive REPL: estovox"
    echo "  Type 'help' for commands"
    echo ""
    demo_wait 3

    # Cleanup
    estovox_stop_animation
    sleep 0.5
}

main "$@"
