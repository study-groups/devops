#!/usr/bin/env bash
# Formant Synthesis Engine Demo
#
# Demonstrates formant synthesis capabilities with various examples

set -e

# Source the formant module
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/formant.sh"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_header() {
    echo -e "\n${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}  ${GREEN}$1${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}\n"
}

print_info() {
    echo -e "${YELLOW}→${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_command() {
    echo -e "${BLUE}  \$${NC} $1"
}

# Main demo
main() {
    print_header "Formant Synthesis Engine - Demo"

    # Check if binary exists
    if [[ ! -x "$FORMANT_BIN" ]]; then
        echo -e "${RED}ERROR: Formant binary not found. Run 'make' first.${NC}" >&2
        exit 1
    fi

    print_info "Starting formant engine (48kHz, 512 samples)..."
    formant_start 48000 512
    sleep 0.5
    print_success "Engine started (PID: $FORMANT_PID)"

    # Demo 1: Vowel sequence
    print_header "Demo 1: Vowel Progression (i-e-a-o-u)"
    print_info "Synthesizing vowel sequence..."
    print_command "formant_sequence \"i:300:140\" \"e:300:135\" \"a:300:130\" \"o:300:125\" \"u:300:120\""
    formant_sequence "i:300:140" "e:300:135" "a:300:130" "o:300:125" "u:300:120"
    print_success "Vowel sequence complete"
    sleep 1

    # Demo 2: Simple words
    print_header "Demo 2: Simple Words"

    print_info "Saying 'mama'..."
    print_command "formant_sequence \"m:120:110\" \"a:200:120\" \"m:120:110\" \"a:200:120\""
    formant_sequence "m:120:110" "a:200:120" "m:120:110" "a:200:120"
    sleep 0.5

    print_info "Saying 'hello'..."
    print_command "formant_sequence \"h:80:120\" \"e:180:130\" \"l:100:125\" \"o:250:120\""
    formant_sequence "h:80:120" "e:180:130" "l:100:125" "o:250:120"
    sleep 0.5

    print_success "Words complete"
    sleep 1

    # Demo 3: Prosody control
    print_header "Demo 3: Prosody Control"

    print_info "High pitch (160Hz)..."
    print_command "formant_prosody PITCH 160"
    formant_prosody "PITCH" 160
    formant_sequence "a:300:160"
    sleep 0.5

    print_info "Low pitch (90Hz)..."
    print_command "formant_prosody PITCH 90"
    formant_prosody "PITCH" 90
    formant_sequence "a:300:90"
    sleep 0.5

    print_info "Normal pitch (120Hz)..."
    formant_prosody "PITCH" 120
    formant_sequence "a:300:120"
    sleep 0.5

    print_success "Prosody demo complete"
    sleep 1

    # Demo 4: Direct formant control
    print_header "Demo 4: Direct Formant Control (Vowel Morphing)"

    print_info "Morphing from 'i' to 'a'..."
    print_command "formant_formant 300 2300 3000 50 100 150 150"
    formant_formant 300 2300 3000 50 100 150 150
    sleep 0.15

    print_command "formant_formant 550 1750 2700 55 110 165 150"
    formant_formant 550 1750 2700 55 110 165 150
    sleep 0.15

    print_command "formant_formant 800 1200 2500 60 120 180 150"
    formant_formant 800 1200 2500 60 120 180 150
    sleep 0.15

    print_success "Formant morphing complete"
    sleep 1

    # Demo 5: Reset
    print_header "Demo 5: Reset to Neutral"
    print_info "Resetting engine state..."
    print_command "formant_reset"
    formant_reset
    sleep 0.3
    print_success "Engine reset"

    # Demo 6: Consonant articulation
    print_header "Demo 6: Consonant Articulation"

    print_info "Fricatives: s-sh-f-v..."
    formant_sequence "s:150:120" "sh:150:120" "f:150:120" "v:150:120"
    sleep 0.5

    print_info "Nasals: m-n..."
    formant_sequence "m:200:110" "n:200:110"
    sleep 0.5

    print_success "Consonant demo complete"
    sleep 1

    # Demo complete
    print_header "Demo Complete!"
    print_info "Stopping formant engine..."
    formant_stop
    sleep 0.3
    print_success "Engine stopped"

    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}Demo completed successfully!${NC}"
    echo ""
    echo "Try these commands yourself:"
    echo "  1. source formant.sh"
    echo "  2. formant_start 48000 512"
    echo "  3. formant_phoneme \"a\" 200 120 0.8 0.3"
    echo "  4. formant_sequence \"h:80:120\" \"i:200:140\""
    echo "  5. formant_stop"
    echo ""
    echo "Or send ECL commands directly:"
    echo "  echo 'PH a 200 120 0.8 0.3' | ./bin/formant"
    echo ""
    echo -e "See ${BLUE}README.md${NC} and ${BLUE}ESTOVOX_LANGUAGE.md${NC} for more info."
    echo ""
}

# Run main demo
main "$@"
