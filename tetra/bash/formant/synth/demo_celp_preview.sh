#!/usr/bin/env bash
# demo_celp_preview.sh - Preview CELP Excitation Codebook
#
# Shows what the CELP excitations look like and explains the concept
# (Full CELP integration coming soon!)

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

print_header() {
    echo -e "\n${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}  ${GREEN}$1${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}\n"
}

print_info() {
    echo -e "${YELLOW}→${NC} $1"
}

print_concept() {
    echo -e "${BLUE}  $1${NC}"
}

main() {
    print_header "CELP Excitation Codebook Preview"

    print_info "What is CELP?"
    echo ""
    print_concept "CELP = Code Excited Linear Prediction"
    print_concept ""
    print_concept "Instead of using boring math (sin waves + noise)..."
    print_concept "...we use REAL AUDIO TEXTURES!"
    echo ""

    print_info "Current Formant Synthesis:"
    echo ""
    print_concept "  Glottal Pulse = sin(2πft) with exponential decay"
    print_concept "  Noise = random numbers filtered"
    print_concept "  Result: Mathematical, but kinda robotic"
    echo ""

    print_info "CELP Synthesis (What we'll add):"
    echo ""
    print_concept "  Excitation = Real audio snippet from codebook!"
    print_concept "  Filter = LPC all-pole resonator"
    print_concept "  Result: More natural, has CHARACTER"
    echo ""

    print_header "Your Codebook Contents"

    if [[ ! -f "src/excitation_codebook.h" ]]; then
        echo -e "${RED}Error: Codebook not found. Run: ./generate_celp_codebook.sh${NC}" >&2
        exit 1
    fi

    ./list_codebook.sh

    echo ""
    print_header "The Magic: Texture = Character!"

    echo ""
    print_info "Each excitation vector is 10ms of real audio texture:"
    echo ""

    echo -e "${MAGENTA}Voiced Excitations:${NC}"
    print_concept "  voice_soft     - Gentle breathing quality"
    print_concept "  voice_bright   - Sharp, energetic"
    print_concept "  voice_creaky   - Vocal fry (like morning voice!)"
    print_concept "  voice_breathy  - Whisper-like"
    print_concept "  voice_tense    - Strained, emotional"
    echo ""

    echo -e "${MAGENTA}Noise Excitations:${NC}"
    print_concept "  noise_hiss     - /s/ sound character"
    print_concept "  noise_shush    - /sh/ sound character"
    print_concept "  noise_puff     - /p/ burst character"
    echo ""

    echo -e "${MAGENTA}Mixed Excitations (The Secret Sauce!):${NC}"
    print_concept "  pulse_asp      - Voice + breath (natural!)"
    print_concept "  burst_ring     - /p/ with formant resonance"
    print_concept "  nasal_hum      - /m/ /n/ character"
    echo ""

    print_header "Why This Makes It Sound Better"

    echo ""
    print_info "Mathematical sources (current):"
    echo -e "  ${RED}●${NC} Every /a/ sounds exactly the same"
    echo -e "  ${RED}●${NC} No variation = robotic"
    echo -e "  ${RED}●${NC} No personality"
    echo ""

    print_info "CELP with codebook:"
    echo -e "  ${GREEN}●${NC} Can pick 'soft' vs 'bright' /a/ based on emotion"
    echo -e "  ${GREEN}●${NC} Real audio texture = natural variation"
    echo -e "  ${GREEN}●${NC} Character and personality!"
    echo ""

    print_header "Example: How CELP Would Work"

    echo ""
    print_info "Say 'hello' with different emotions:"
    echo ""

    echo -e "${CYAN}Normal:${NC}"
    print_concept "  h → noise_white   @ normal LPC"
    print_concept "  e → voice_soft    @ /e/ LPC"
    print_concept "  l → voice_soft    @ /l/ LPC"
    print_concept "  o → voice_soft    @ /o/ LPC"
    echo ""

    echo -e "${CYAN}Happy/Excited:${NC}"
    print_concept "  h → noise_hiss    @ bright LPC"
    print_concept "  e → voice_bright  @ /e/ LPC (sharper)"
    print_concept "  l → voice_bright  @ /l/ LPC"
    print_concept "  o → voice_bright  @ /o/ LPC"
    echo ""

    echo -e "${CYAN}Tired/Sad:${NC}"
    print_concept "  h → noise_buzz    @ dark LPC"
    print_concept "  e → voice_creaky  @ /e/ LPC (vocal fry)"
    print_concept "  l → voice_soft    @ /l/ LPC"
    print_concept "  o → voice_creaky  @ /o/ LPC"
    echo ""

    print_header "What's Next?"

    echo ""
    print_info "To hear CELP in action, we need to:"
    echo ""
    echo "  1. ${YELLOW}Add CELP mode to formant engine${NC}"
    echo "     - Implement LPC filtering"
    echo "     - Add excitation playback"
    echo "     - Wire up codebook selection"
    echo ""
    echo "  2. ${YELLOW}Create hybrid mode${NC}"
    echo "     - Blend formant + CELP"
    echo "     - Best of both worlds!"
    echo ""
    echo "  3. ${YELLOW}A/B comparison${NC}"
    echo "     - Formant vs CELP vs Hybrid"
    echo "     - Hear the difference!"
    echo ""

    print_info "Want to help integrate CELP?"
    echo ""
    echo "  The codebook is ready (37 vectors, 79KB)"
    echo "  The design is documented (CELP_DESIGN.md)"
    echo "  Just need to wire it into the synthesis loop!"
    echo ""

    print_header "Current Status"

    echo ""
    echo -e "${GREEN}✓${NC} Codebook generated (ready!)"
    echo -e "${GREEN}✓${NC} Design documented"
    echo -e "${GREEN}✓${NC} Excitation vectors hand-crafted"
    echo -e "${YELLOW}⏳${NC} LPC filtering (need to add)"
    echo -e "${YELLOW}⏳${NC} Excitation playback (need to add)"
    echo -e "${YELLOW}⏳${NC} Hybrid mode (need to add)"
    echo ""

    echo -e "${CYAN}For now, enjoy the formant demos:${NC}"
    echo "  ./demo_speech.sh  (current best quality)"
    echo ""
    echo -e "${CYAN}When CELP is integrated:${NC}"
    echo "  ./demo_celp.sh    (CELP synthesis)"
    echo "  ./demo_comparison.sh  (side-by-side)"
    echo ""
}

main "$@"
