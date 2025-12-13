#!/usr/bin/env bash
# demo_speech.sh - Most Convincing Speech Demo
#
# Demonstrates the best speech quality the formant engine can currently produce
# Focus on words/phrases that showcase different phoneme types

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/formant.sh"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

print_header() {
    echo -e "\n${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}  ${GREEN}$1${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}\n"
}

print_info() {
    echo -e "${YELLOW}→${NC} $1"
}

print_phoneme() {
    echo -e "${BLUE}  [$1]${NC} $2"
}

say_word() {
    local word=$1
    shift
    echo -e "\n${GREEN}Speaking:${NC} \"${CYAN}$word${NC}\""
    formant_sequence "$@"
    sleep 0.3
}

main() {
    print_header "Formant Speech Synthesis - Best Quality Demo"

    if [[ ! -x "$FORMANT_BIN" ]]; then
        echo -e "${RED}ERROR: Formant binary not found. Run 'make' first.${NC}" >&2
        exit 1
    fi

    print_info "Starting formant engine (48kHz, 512 samples, ~11ms latency)..."
    formant_start 48000 512
    sleep 0.5
    echo -e "${GREEN}✓${NC} Engine started\n"

    # ===================================================================
    # Demo 1: Simple Greetings (clear vowels + common consonants)
    # ===================================================================
    print_header "Demo 1: Greetings"

    print_info "These use simple phoneme combinations with good formant transitions"
    sleep 1

    # "hello"
    say_word "hello" \
        "h:70:120" \
        "e:160:125" \
        "l:90:123" \
        "o:240:120"

    # "hi"
    say_word "hi" \
        "h:60:125" \
        "a:180:130" \
        "i:200:135"

    sleep 1

    # ===================================================================
    # Demo 2: Mama/Papa (nasal + vowel combinations)
    # ===================================================================
    print_header "Demo 2: Family Words (Nasals)"

    print_info "Nasal consonants (m, n) with vowels showcase formant filtering"
    sleep 1

    # "mama"
    say_word "mama" \
        "m:110:115" \
        "a:190:118" \
        "m:110:116" \
        "a:190:118"

    # "papa"
    say_word "papa" \
        "p:70:115" \
        "a:190:118" \
        "p:70:116" \
        "a:190:118"

    sleep 1

    # ===================================================================
    # Demo 3: Fricatives (showcasing noise sources)
    # ===================================================================
    print_header "Demo 3: Fricatives (Noise Sources)"

    print_info "Fricatives (s, f, sh) use frication noise with formant coloring"
    sleep 1

    # "see"
    say_word "see" \
        "s:130:125" \
        "i:220:130"

    # "she"
    say_word "she" \
        "sh:140:125" \
        "i:220:130"

    # "fee"
    say_word "fee" \
        "f:110:125" \
        "i:220:130"

    sleep 1

    # ===================================================================
    # Demo 4: Plosives (showcasing burst sources)
    # ===================================================================
    print_header "Demo 4: Plosives (Burst Transients)"

    print_info "Plosives (p, b, t, d) use burst noise for realistic stops"
    sleep 1

    # "pop"
    say_word "pop" \
        "p:70:118" \
        "o:200:120" \
        "p:80:118"

    # "baby"
    say_word "baby" \
        "b:80:120" \
        "e:180:123" \
        "b:80:121" \
        "i:180:125"

    sleep 1

    # ===================================================================
    # Demo 5: Full Sentences (best overall demonstration)
    # ===================================================================
    print_header "Demo 5: Full Sentences"

    print_info "Complete sentences with pitch variation and natural timing"
    sleep 1

    # "hello world" - iconic phrase with good phoneme variety
    echo -e "\n${GREEN}Speaking:${NC} \"${CYAN}hello world${NC}\""
    print_phoneme "h" "glottal aspiration"
    print_phoneme "e" "mid-front vowel (F1=400, F2=2000)"
    print_phoneme "l" "alveolar lateral"
    print_phoneme "o" "mid-back rounded (F1=500, F2=900)"
    print_phoneme "pause" "word boundary"
    print_phoneme "w" "labial-velar approximant"
    print_phoneme "ə" "schwa (F1=500, F2=1500)"
    print_phoneme "r" "rhotic (F3 lowered to 1600)"
    print_phoneme "l" "lateral"
    print_phoneme "d" "voiced alveolar plosive"
    echo ""

    formant_sequence \
        "h:70:120" \
        "e:160:125" \
        "l:90:123" \
        "o:240:120" \
        "rest:150:0" \
        "w:90:118" \
        "ə:80:120" \
        "r:80:120" \
        "l:90:120" \
        "d:100:118"

    sleep 1.5

    # "yes" - good demonstration of approximant + fricative
    say_word "yes" \
        "y:90:125" \
        "e:180:128" \
        "s:140:125"

    sleep 0.5

    # "no" - simple but demonstrates nasal + vowel
    say_word "no" \
        "n:110:112" \
        "o:240:110"

    sleep 1.5

    # ===================================================================
    # Demo 6: Prosody Demonstration (pitch variation)
    # ===================================================================
    print_header "Demo 6: Prosody & Intonation"

    print_info "Same word with different pitch patterns"
    sleep 1

    # "hello" - statement (falling pitch)
    echo -e "\n${GREEN}Speaking:${NC} \"${CYAN}hello${NC}\" (statement - falling pitch)"
    formant_sequence \
        "h:70:135" \
        "e:160:133" \
        "l:90:128" \
        "o:240:120"
    sleep 0.8

    # "hello?" - question (rising pitch)
    echo -e "\n${GREEN}Speaking:${NC} \"${CYAN}hello?${NC}\" (question - rising pitch)"
    formant_sequence \
        "h:70:120" \
        "e:160:128" \
        "l:90:133" \
        "o:240:140"
    sleep 1.5

    # ===================================================================
    # Demo 7: Vowel Showcase (formant triangle)
    # ===================================================================
    print_header "Demo 7: Vowel Space (IPA Triangle)"

    print_info "Demonstrating the vowel formant space"
    sleep 1

    echo -e "\n${CYAN}High Front:${NC}"
    say_word "ee [i]" "i:300:130"

    echo -e "\n${CYAN}Mid Front:${NC}"
    say_word "ay [e]" "e:300:130"

    echo -e "\n${CYAN}Low Central:${NC}"
    say_word "ah [a]" "a:300:125"

    echo -e "\n${CYAN}Mid Back:${NC}"
    say_word "oh [o]" "o:300:125"

    echo -e "\n${CYAN}High Back:${NC}"
    say_word "oo [u]" "u:300:120"

    sleep 1.5

    # ===================================================================
    # Demo 8: Best Sentence (showcase everything)
    # ===================================================================
    print_header "Demo 8: Best Overall Sentence"

    print_info "A sentence designed to showcase all phoneme types:"
    echo -e "${CYAN}\"Hello! My name is Formant.\"${NC}"
    echo ""
    print_info "This includes:"
    echo -e "  - Vowels: ${BLUE}e, o, a, i${NC}"
    echo -e "  - Nasals: ${BLUE}m, n${NC}"
    echo -e "  - Fricatives: ${BLUE}h, s, f${NC}"
    echo -e "  - Approximants: ${BLUE}l, w, y${NC}"
    echo -e "  - Plosives: ${BLUE}p, b, t${NC}"
    echo -e "  - Pitch variation for natural prosody"
    echo ""
    sleep 2

    # "Hello!"
    formant_sequence \
        "h:70:135" \
        "e:160:138" \
        "l:90:136" \
        "o:240:130"

    sleep 0.2

    # "My"
    formant_sequence \
        "m:100:128" \
        "a:180:130" \
        "i:200:132"

    sleep 0.15

    # "name"
    formant_sequence \
        "n:90:130" \
        "e:180:132" \
        "m:110:128"

    sleep 0.15

    # "is"
    formant_sequence \
        "i:140:125" \
        "z:100:123"

    sleep 0.15

    # "Formant"
    formant_sequence \
        "f:100:125" \
        "o:160:128" \
        "r:80:127" \
        "m:100:125" \
        "a:180:123" \
        "n:90:120" \
        "t:80:118"

    sleep 2

    # ===================================================================
    # Conclusion
    # ===================================================================
    print_header "Demo Complete!"

    print_info "Stopping formant engine..."
    formant_stop
    sleep 0.3

    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}Key Features Demonstrated:${NC}"
    echo ""
    echo -e "  ${BLUE}✓${NC} Formant synthesis (F1-F3) for vowel quality"
    echo -e "  ${BLUE}✓${NC} Glottal pulse source (LF model) for voice"
    echo -e "  ${BLUE}✓${NC} Frication noise for fricatives (s, f, sh)"
    echo -e "  ${BLUE}✓${NC} Aspiration noise for /h/ and breathiness"
    echo -e "  ${BLUE}✓${NC} Plosive bursts for stops (p, b, t, d)"
    echo -e "  ${BLUE}✓${NC} Nasal formant damping for m, n"
    echo -e "  ${BLUE}✓${NC} Pitch control for prosody"
    echo -e "  ${BLUE}✓${NC} Smooth formant transitions"
    echo ""
    echo -e "${YELLOW}Next Steps:${NC}"
    echo -e "  - Integrate with estovox for facial control"
    echo -e "  - Add coarticulation modeling"
    echo -e "  - Train neural network for articulatory → acoustic mapping"
    echo -e "  - Add vocal fry and breathiness modulation"
    echo ""
    echo -e "${CYAN}Try it yourself:${NC}"
    echo -e "  source formant.sh"
    echo -e "  formant_start 48000 512"
    echo -e "  formant_sequence \"h:70:120\" \"e:160:125\" \"l:90:123\" \"o:240:120\""
    echo ""
}

main "$@"
