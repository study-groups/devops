#!/usr/bin/env bash
#
# demo_celp_compare.sh - Compare formant vs CELP vs hybrid synthesis
#
# This demo demonstrates the three synthesis modes:
# 1. Pure formant synthesis (traditional)
# 2. Pure CELP synthesis (code-excited)
# 3. Hybrid mode (blend of both)

set -euo pipefail

FORMANT_BIN="./bin/formant"

if [ ! -x "$FORMANT_BIN" ]; then
    echo "Error: formant binary not found. Run 'make' first."
    exit 1
fi

cat << 'EOF'
╔════════════════════════════════════════════════════════════════╗
║           Formant vs CELP vs Hybrid Comparison                 ║
╚════════════════════════════════════════════════════════════════╝

This demo compares three synthesis methods:

  1. FORMANT MODE  - Traditional formant synthesis
                     Uses mathematical glottal pulses and formant filters
                     Sounds clean but mathematical

  2. CELP MODE     - Code-Excited Linear Prediction
                     Uses real excitation textures from codebook
                     Sounds more natural with character

  3. HYBRID MODE   - Blends both approaches
                     Combines formant clarity with CELP texture
                     Best of both worlds!

We'll say "Hello! My name is Formant" in each mode.
Listen for the differences in voice quality and naturalness.

EOF

read -p "Press ENTER to start demo..."

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo " MODE 1: FORMANT SYNTHESIS (Traditional)"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "  This is the original formant synthesis you've been using."
echo "  Notice: Clean, precise, but somewhat mathematical."
echo ""
sleep 2

(
cat << 'COMMANDS'
MODE FORMANT
PH h 70 120 0.8 0.3
PH e 160 125 0.8 0.3
PH l 90 123 0.7 0.3
PH o 240 120 0.8 0.3
PH rest 100 120 0.0 0.3
PH m 90 118 0.7 0.3
PH a 150 120 0.8 0.3
PH i 180 125 0.8 0.3
PH rest 80 120 0.0 0.3
PH n 100 120 0.7 0.3
PH e 140 123 0.8 0.3
PH i 180 125 0.8 0.3
PH m 90 122 0.7 0.3
PH rest 70 120 0.0 0.3
PH i 150 118 0.8 0.3
PH z 120 120 0.7 0.3
PH rest 80 120 0.0 0.3
PH f 100 118 0.7 0.3
PH o 180 120 0.8 0.3
PH r 100 122 0.7 0.3
PH m 90 120 0.7 0.3
PH a 150 118 0.8 0.3
PH n 100 120 0.7 0.3
PH t 80 120 0.6 0.3
COMMANDS
sleep 4
) | "$FORMANT_BIN" -s 48000 -b 512

echo ""
echo "✓ Formant mode complete"
echo ""
sleep 1

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo " MODE 2: CELP SYNTHESIS (Code-Excited)"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "  This uses CELP with real excitation textures."
echo "  Notice: More natural, has 'character' and texture."
echo ""
sleep 2

(
cat << 'COMMANDS'
MODE CELP
PH h 70 120 0.8 0.3
PH e 160 125 0.8 0.3
PH l 90 123 0.7 0.3
PH o 240 120 0.8 0.3
PH rest 100 120 0.0 0.3
PH m 90 118 0.7 0.3
PH a 150 120 0.8 0.3
PH i 180 125 0.8 0.3
PH rest 80 120 0.0 0.3
PH n 100 120 0.7 0.3
PH e 140 123 0.8 0.3
PH i 180 125 0.8 0.3
PH m 90 122 0.7 0.3
PH rest 70 120 0.0 0.3
PH i 150 118 0.8 0.3
PH z 120 120 0.7 0.3
PH rest 80 120 0.0 0.3
PH f 100 118 0.7 0.3
PH o 180 120 0.8 0.3
PH r 100 122 0.7 0.3
PH m 90 120 0.7 0.3
PH a 150 118 0.8 0.3
PH n 100 120 0.7 0.3
PH t 80 120 0.6 0.3
COMMANDS
sleep 4
) | "$FORMANT_BIN" -s 48000 -b 512

echo ""
echo "✓ CELP mode complete"
echo ""
sleep 1

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo " MODE 3: HYBRID SYNTHESIS (50/50 Blend)"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "  This blends formant and CELP synthesis."
echo "  Notice: Balanced - combines clarity with naturalness."
echo ""
sleep 2

(
cat << 'COMMANDS'
MODE HYBRID 0.5
PH h 70 120 0.8 0.3
PH e 160 125 0.8 0.3
PH l 90 123 0.7 0.3
PH o 240 120 0.8 0.3
PH rest 100 120 0.0 0.3
PH m 90 118 0.7 0.3
PH a 150 120 0.8 0.3
PH i 180 125 0.8 0.3
PH rest 80 120 0.0 0.3
PH n 100 120 0.7 0.3
PH e 140 123 0.8 0.3
PH i 180 125 0.8 0.3
PH m 90 122 0.7 0.3
PH rest 70 120 0.0 0.3
PH i 150 118 0.8 0.3
PH z 120 120 0.7 0.3
PH rest 80 120 0.0 0.3
PH f 100 118 0.7 0.3
PH o 180 120 0.8 0.3
PH r 100 122 0.7 0.3
PH m 90 120 0.7 0.3
PH a 150 118 0.8 0.3
PH n 100 120 0.7 0.3
PH t 80 120 0.6 0.3
COMMANDS
sleep 4
) | "$FORMANT_BIN" -s 48000 -b 512

echo ""
echo "✓ Hybrid mode complete"
echo ""

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo " Summary"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "  FORMANT:  Mathematical precision, clean sound"
echo "  CELP:     Natural texture, organic character"
echo "  HYBRID:   Best of both - clarity + naturalness"
echo ""
echo "You can adjust the hybrid mix (0.0 = pure CELP, 1.0 = pure formant):"
echo "  MODE HYBRID 0.0   # 100% CELP"
echo "  MODE HYBRID 0.3   # 70% CELP, 30% formant"
echo "  MODE HYBRID 0.5   # 50/50 blend (default)"
echo "  MODE HYBRID 0.7   # 30% CELP, 70% formant"
echo "  MODE HYBRID 1.0   # 100% formant"
echo ""
echo "✨ CELP integration complete! ✨"
echo ""
