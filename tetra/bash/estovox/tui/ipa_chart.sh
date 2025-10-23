#!/usr/bin/env bash
# Estovox IPA Chart Display
# Colorized IPA chart organized by articulation

# Source TDS colors if available
source_if_exists() {
    [[ -f "$1" ]] && source "$1"
}

source_if_exists "$TETRA_SRC/bash/tds/core/semantic_colors.sh"
source_if_exists "$TETRA_SRC/bash/color/color_core.sh"

# Color definitions (fallback if TDS not available)
COLOR_VOWEL=${COLOR_CYAN:-'\033[36m'}
COLOR_PLOSIVE=${COLOR_RED:-'\033[31m'}
COLOR_FRICATIVE=${COLOR_YELLOW:-'\033[33m'}
COLOR_NASAL=${COLOR_GREEN:-'\033[32m'}
COLOR_APPROXIMANT=${COLOR_BLUE:-'\033[34m'}
COLOR_LATERAL=${COLOR_MAGENTA:-'\033[35m'}
COLOR_RESET=${COLOR_RESET:-'\033[0m'}

estovox_render_ipa_chart() {
    tput clear

    cat <<EOF
╔══════════════════════════════════════════════════════════════════════════╗
║                    IPA PHONEME CHART - Estovox                           ║
╚══════════════════════════════════════════════════════════════════════════╝

${COLOR_VOWEL}VOWELS${COLOR_RESET} - Oral cavity resonance with open vocal tract
┌────────────────────────────────────────────────────────────────┐
│                   FRONT      CENTRAL     BACK                  │
│  CLOSE            ${COLOR_VOWEL}i${COLOR_RESET} [beet]                ${COLOR_VOWEL}u${COLOR_RESET} [boot]            │
│  CLOSE-MID        ${COLOR_VOWEL}e${COLOR_RESET} [bay]                 ${COLOR_VOWEL}o${COLOR_RESET} [boat]            │
│  MID                         ${COLOR_VOWEL}ə${COLOR_RESET} [about]                       │
│  OPEN             ${COLOR_VOWEL}a${COLOR_RESET} [bat]                                    │
└────────────────────────────────────────────────────────────────┘

${COLOR_PLOSIVE}PLOSIVES${COLOR_RESET} - Complete oral closure, air released suddenly
┌────────────────────────────────────────────────────────────────┐
│  BILABIAL         ${COLOR_PLOSIVE}p${COLOR_RESET} [pop]   ${COLOR_PLOSIVE}b${COLOR_RESET} [bob]                          │
└────────────────────────────────────────────────────────────────┘

${COLOR_NASAL}NASALS${COLOR_RESET} - Air flows through nasal cavity (velum lowered)
┌────────────────────────────────────────────────────────────────┐
│  BILABIAL         ${COLOR_NASAL}m${COLOR_RESET} [mom]                                    │
└────────────────────────────────────────────────────────────────┘

${COLOR_FRICATIVE}FRICATIVES${COLOR_RESET} - Air forced through narrow channel
┌────────────────────────────────────────────────────────────────┐
│  LABIODENTAL      ${COLOR_FRICATIVE}f${COLOR_RESET} [fan]   ${COLOR_FRICATIVE}v${COLOR_RESET} [van]                          │
│  ALVEOLAR         ${COLOR_FRICATIVE}s${COLOR_RESET} [see]   ${COLOR_FRICATIVE}z${COLOR_RESET} [zoo]                          │
│  POSTALVEOLAR     ${COLOR_FRICATIVE}sh${COLOR_RESET} [she]  ${COLOR_FRICATIVE}zh${COLOR_RESET} [measure]                     │
│  GLOTTAL          ${COLOR_FRICATIVE}h${COLOR_RESET} [hat]                                    │
└────────────────────────────────────────────────────────────────┘

${COLOR_APPROXIMANT}APPROXIMANTS${COLOR_RESET} - Articulators approach but don't create turbulence
┌────────────────────────────────────────────────────────────────┐
│  LABIAL-VELAR     ${COLOR_APPROXIMANT}w${COLOR_RESET} [we]                                     │
│  PALATAL          ${COLOR_APPROXIMANT}j${COLOR_RESET}/${COLOR_APPROXIMANT}y${COLOR_RESET} [yes]                                 │
│  ALVEOLAR         ${COLOR_APPROXIMANT}r${COLOR_RESET} [red]                                    │
└────────────────────────────────────────────────────────────────┘

${COLOR_LATERAL}LATERAL${COLOR_RESET} - Air flows around sides of tongue
┌────────────────────────────────────────────────────────────────┐
│  ALVEOLAR         ${COLOR_LATERAL}l${COLOR_RESET} [let]                                    │
└────────────────────────────────────────────────────────────────┘

SPECIAL POSITIONS
┌────────────────────────────────────────────────────────────────┐
│  NEUTRAL/REST     rest, neutral                                │
│  MID VOWEL        schwa (same as ə)                            │
└────────────────────────────────────────────────────────────────┘

LEGEND:
  ${COLOR_VOWEL}■${COLOR_RESET} Vowels (tongue position, jaw height, lip rounding)
  ${COLOR_PLOSIVE}■${COLOR_RESET} Plosives (complete closure, sudden release)
  ${COLOR_NASAL}■${COLOR_RESET} Nasals (nasal airflow, velum lowered)
  ${COLOR_FRICATIVE}■${COLOR_RESET} Fricatives (turbulent airflow)
  ${COLOR_APPROXIMANT}■${COLOR_RESET} Approximants (smooth airflow)
  ${COLOR_LATERAL}■${COLOR_RESET} Lateral (air around tongue sides)

Press any key to return...
EOF

    read -n 1 -s
    tput clear
}

estovox_render_controls_help() {
    tput clear

    cat <<EOF
╔══════════════════════════════════════════════════════════════════════════╗
║                    INTERACTIVE CONTROLS - Estovox                        ║
╚══════════════════════════════════════════════════════════════════════════╝

KEYBOARD CONTROLS (Interactive Mode)

JAW CONTROL (WASD):
  W - Jaw UP (close mouth)          ▲
  S - Jaw DOWN (open mouth)       ◀ W ▶
  A - (reserved)                     S
  D - (reserved)                     ▼

LIP CONTROL (IJKL):
  I - Tongue UP                      ▲
  K - Tongue DOWN                  ◀ I ▶
  J - Tongue BACK                    K
  L - Tongue FORWARD                 ▼

ADDITIONAL CONTROLS:
  Q - Lip ROUND (pucker)
  E - Lip SPREAD (smile corners)
  R - Reset to neutral

MODE SWITCHING:
  : - Enter command mode (type commands)
  ESC - Return to interactive mode

SPECIAL COMMANDS (Command Mode):
  :ipa        - Show IPA chart
  :help       - Show this help
  :quit       - Exit Estovox
  :interactive - Return to interactive mode

  All regular commands work in command mode:
    ph <phoneme>     - Articulate phoneme
    expr <name>      - Show expression
    seq <p:ms> ...   - Play sequence
    etc.

TIPS:
  - Hold keys for continuous control
  - Combine keys for complex articulations
  - Use Q+W+L for rounded front vowels
  - Use E+S for open spread vowels

Press any key to return...
EOF

    read -n 1 -s
    tput clear
}
