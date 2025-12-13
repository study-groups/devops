#!/usr/bin/env bash
#
# 1_record_phonemes.sh - Interactive phoneme recording
#
# Records your voice saying each phoneme for training

set -euo pipefail

RECORDINGS_DIR="recordings"
SPEAKER_NAME="${1:-my_voice}"
DURATION=1.0  # seconds per phoneme

mkdir -p "$RECORDINGS_DIR/$SPEAKER_NAME"

# Phoneme list (organized by type)
VOWELS=("a" "e" "i" "o" "u" "schwa")
CONSONANTS_VOICED=("m" "n" "l" "r" "w" "y")
CONSONANTS_UNVOICED=("p" "t" "k" "f" "s" "sh" "h")
CONSONANTS_VOICED_STOPS=("b" "d" "g" "v" "z" "zh")

ALL_PHONEMES=("${VOWELS[@]}" "${CONSONANTS_VOICED[@]}" "${CONSONANTS_UNVOICED[@]}" "${CONSONANTS_VOICED_STOPS[@]}")

cat << 'EOF'
╔════════════════════════════════════════════════════════════════╗
║              Voice Recording for CELP Training                 ║
╚════════════════════════════════════════════════════════════════╝

This script will guide you through recording all phonemes.
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
            schwa) echo "    Say: 'uhh' (as in 'about')" ;;
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
            sh) echo "    Say: 'shh' (silence sound)" ;;
            h) echo "    Say: 'hhh' (breathy)" ;;
            b) echo "    Say: 'buh' (voiced pop)" ;;
            d) echo "    Say: 'duh' (voiced tap)" ;;
            g) echo "    Say: 'guh' (voiced back)" ;;
            v) echo "    Say: 'vvv' (voiced f)" ;;
            z) echo "    Say: 'zzz' (voiced hiss)" ;;
            zh) echo "    Say: 'zhh' (as in 'vision')" ;;
        esac

        echo "    Press ENTER when ready, then speak..."
        read -r

        echo "    🔴 Recording..."

        # Record using Python (more reliable cross-platform)
        python3 << PYEOF
import sounddevice as sd
import soundfile as sf
import numpy as np

duration = $DURATION
sample_rate = 16000

print("    Recording for ${DURATION}s...")
recording = sd.rec(int(duration * sample_rate),
                   samplerate=sample_rate,
                   channels=1,
                   dtype='float32')
sd.wait()

# Save
filename = "$RECORDINGS_DIR/$SPEAKER_NAME/${PHONEME}_take${TAKE}.wav"
sf.write(filename, recording, sample_rate)
print("    ✓ Saved")
PYEOF

        echo ""
    done

    echo ""
done

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                    Recording Complete!                         ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Recorded: $TOTAL phonemes × 3 takes = $((TOTAL * 3)) files"
echo "Location: $RECORDINGS_DIR/$SPEAKER_NAME/"
echo ""
echo "Next step: python 2_extract_excitations.py --speaker $SPEAKER_NAME"
echo ""
