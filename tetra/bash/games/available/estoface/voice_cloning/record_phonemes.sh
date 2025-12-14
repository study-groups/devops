#!/usr/bin/env bash
#
# record_phonemes.sh - Native recording using formant engine
#
# Records your voice saying each phoneme for training using the formant
# engine's built-in PortAudio recording capability.
#

set -euo pipefail

RECORDINGS_DIR="recordings"
SPEAKER_NAME="${1:-my_voice}"
DURATION=1000  # milliseconds per phoneme
TAKES=3

# Phoneme list (organized by type)
VOWELS=("a" "e" "i" "o" "u")
CONSONANTS_VOICED=("m" "n" "l" "r" "w" "y")
CONSONANTS_UNVOICED=("p" "t" "k" "f" "s" "h")
CONSONANTS_VOICED_STOPS=("b" "d" "g" "v" "z")

ALL_PHONEMES=("${VOWELS[@]}" "${CONSONANTS_VOICED[@]}" "${CONSONANTS_UNVOICED[@]}" "${CONSONANTS_VOICED_STOPS[@]}")

# Create output directory
mkdir -p "$RECORDINGS_DIR/$SPEAKER_NAME"

cat << 'EOF'
╔════════════════════════════════════════════════════════════════╗
║        Voice Recording for CELP Training (Native)              ║
╚════════════════════════════════════════════════════════════════╝

This script will guide you through recording all phonemes using the
formant engine's built-in PortAudio recording.

For each phoneme, you'll record 3 variations.

TIPS:
  • Speak naturally in your normal voice
  • Hold vowels steady for the full duration
  • Speak clearly but don't exaggerate
  • Keep consistent distance from microphone

Recording will be saved to: recordings/{speaker_name}/

Ready? Press ENTER to start...
EOF

read -r

echo ""
echo "Recording $SPEAKER_NAME..."
echo ""

# Create FIFO for communication with formant engine
FIFO="/tmp/formant_record_$$"
mkfifo "$FIFO"

# Start formant engine in background
../bin/formant -i "$FIFO" -s 16000 > /dev/null 2>&1 &
FORMANT_PID=$!

# Give formant time to start
sleep 0.5

# Ensure cleanup on exit
cleanup() {
    echo "STOP" > "$FIFO" 2>/dev/null || true
    rm -f "$FIFO"
    wait $FORMANT_PID 2>/dev/null || true
}
trap cleanup EXIT

TOTAL=${#ALL_PHONEMES[@]}
COUNT=0

for PHONEME in "${ALL_PHONEMES[@]}"; do
    COUNT=$((COUNT + 1))

    echo "[$COUNT/$TOTAL] Phoneme: '$PHONEME'"
    echo ""

    for TAKE in 1 2 3; do
        echo "  Take $TAKE/3"

        # Show example word
        case "$PHONEME" in
            a) echo "    Say: 'ahhh' (as in 'father')" ;;
            e) echo "    Say: 'ehhh' (as in 'bed')" ;;
            i) echo "    Say: 'eeee' (as in 'beet')" ;;
            o) echo "    Say: 'ohhh' (as in 'go')" ;;
            u) echo "    Say: 'oooo' (as in 'food')" ;;
            m) echo "    Say: 'mmm' (hum with lips closed)" ;;
            n) echo "    Say: 'nnn' (tongue on roof of mouth)" ;;
            l) echo "    Say: 'lll' (as in 'long')" ;;
            r) echo "    Say: 'rrr' (as in 'red')" ;;
            w) echo "    Say: 'www' (as in 'wet')" ;;
            y) echo "    Say: 'yyy' (as in 'yes')" ;;
            p) echo "    Say: 'puh' (pop without voice)" ;;
            t) echo "    Say: 'tuh' (tongue click)" ;;
            k) echo "    Say: 'kuh' (back of throat)" ;;
            f) echo "    Say: 'fff' (blow through teeth)" ;;
            s) echo "    Say: 'sss' (snake hiss)" ;;
            h) echo "    Say: 'hhh' (breathy)" ;;
            b) echo "    Say: 'buh' (voiced pop)" ;;
            d) echo "    Say: 'duh' (voiced tap)" ;;
            g) echo "    Say: 'guh' (voiced back)" ;;
            v) echo "    Say: 'vvv' (voiced f)" ;;
            z) echo "    Say: 'zzz' (voiced hiss)" ;;
        esac

        echo "    Press ENTER when ready, then speak..."
        read -r

        # Send RECORD command to formant engine
        FILENAME="$RECORDINGS_DIR/$SPEAKER_NAME/${PHONEME}_take${TAKE}.wav"
        echo "RECORD $PHONEME $DURATION $FILENAME" > "$FIFO"

        # Wait for recording to complete (duration + buffer)
        sleep $(echo "scale=2; $DURATION / 1000 + 0.5" | bc)

        echo ""
    done

    echo ""
done

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                    Recording Complete!                         ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Recorded: $TOTAL phonemes × $TAKES takes = $((TOTAL * TAKES)) files"
echo "Location: $RECORDINGS_DIR/$SPEAKER_NAME/"
echo ""
echo "Next step: python 2_extract_excitations.py --speaker $SPEAKER_NAME"
echo ""
