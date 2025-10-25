#!/usr/bin/env bash
# list_codebook.sh - Show CELP excitation codebook contents
#
# Displays all available excitation vectors in the codebook

set -e

CODEBOOK="src/excitation_codebook.h"

if [[ ! -f "$CODEBOOK" ]]; then
    echo "Error: Codebook not found. Run: ./generate_celp_codebook.sh" >&2
    exit 1
fi

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║${NC}  ${GREEN}CELP Excitation Codebook${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}\n"

# Extract metadata
VECTOR_LEN=$(grep "EXCITATION_VECTOR_LENGTH" "$CODEBOOK" | awk '{print $3}')
CODEBOOK_SIZE=$(grep "EXCITATION_CODEBOOK_SIZE" "$CODEBOOK" | awk '{print $3}')
SAMPLE_RATE=$(grep "EXCITATION_SAMPLE_RATE" "$CODEBOOK" | awk '{print $3}')

echo -e "${YELLOW}Codebook Statistics:${NC}"
echo "  Vector length: $VECTOR_LEN samples"
echo "  Duration: $(echo "scale=1; $VECTOR_LEN / $SAMPLE_RATE * 1000" | bc) ms"
echo "  Sample rate: $SAMPLE_RATE Hz"
echo "  Total vectors: $CODEBOOK_SIZE"
echo ""

echo -e "${YELLOW}Available Excitation Vectors:${NC}"
echo ""

# Extract vector names and energies
echo -e "${BLUE}Type          Name                    Energy${NC}"
echo "─────────────────────────────────────────────────────"

grep "\.name =" "$CODEBOOK" | while read -r line; do
    name=$(echo "$line" | sed 's/.*"\(.*\)".*/\1/')

    # Categorize by prefix
    if [[ "$name" =~ ^voice ]]; then
        type="Voiced  "
    elif [[ "$name" =~ ^noise ]]; then
        type="Noise   "
    elif [[ "$name" =~ ^pulse || "$name" =~ ^nasal || "$name" =~ ^burst ]]; then
        type="Mixed   "
    elif [[ "$name" =~ ^random ]]; then
        type="Random  "
    else
        type="Other   "
    fi

    # Get next line for energy
    energy=$(grep -A 1 "\"$name\"" "$CODEBOOK" | tail -1 | grep energy | awk '{print $3}' | tr -d 'f')

    printf "%-10s %-24s %s\n" "$type" "$name" "$energy"
done

echo ""
echo -e "${YELLOW}Vector Categories:${NC}"
echo "  Voiced   - Periodic glottal pulses (voice_soft, voice_bright, etc.)"
echo "  Noise    - Unvoiced noise sources (noise_hiss, noise_puff, etc.)"
echo "  Mixed    - Combination sources (pulse_asp, burst_ring, nasal_hum)"
echo "  Random   - Random variations for diversity"
echo ""

echo -e "${GREEN}Usage:${NC}"
echo "  These excitation vectors will be used by CELP synthesis mode"
echo "  to create more natural-sounding speech than pure mathematical"
echo "  formant synthesis."
echo ""
echo "  Once CELP mode is implemented, you can:"
echo "    ./bin/formant --mode celp --say 'hello'"
echo "    ./bin/formant --mode hybrid --say 'hello'  # Best of both!"
echo ""
