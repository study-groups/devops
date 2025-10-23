#!/usr/bin/env bash
# Estovox IPA Chart Display
# Colorized IPA chart organized by articulation

# Source color system
if [[ -f "$TETRA_SRC/bash/color/color_core.sh" ]]; then
    source "$TETRA_SRC/bash/color/color_core.sh"
    ESTOVOX_HAS_COLORS=1
else
    ESTOVOX_HAS_COLORS=0
fi

# Define color hex values for IPA categories
IPA_COLOR_VOWEL="#00FFFF"      # Cyan
IPA_COLOR_PLOSIVE="#FF0000"    # Red
IPA_COLOR_FRICATIVE="#FFFF00"  # Yellow
IPA_COLOR_NASAL="#00FF00"      # Green
IPA_COLOR_APPROXIMANT="#0080FF" # Blue
IPA_COLOR_LATERAL="#FF00FF"    # Magenta

# Color helper functions
ipa_color() {
    local hex=$1
    local text=$2
    if (( ESTOVOX_HAS_COLORS )); then
        printf "%b%s%b" "$(text_color "$hex")" "$text" "$(reset_color)"
    else
        printf "%s" "$text"
    fi
}

estovox_render_ipa_chart() {
    tput clear

    cat <<EOF
╔══════════════════════════════════════════════════════════════════════════╗
║                    IPA PHONEME CHART - Estovox                           ║
╚══════════════════════════════════════════════════════════════════════════╝

$(ipa_color "$IPA_COLOR_VOWEL" "VOWELS") - Oral cavity resonance with open vocal tract
┌────────────────────────────────────────────────────────────────┐
│                   FRONT      CENTRAL     BACK                  │
│  CLOSE            $(ipa_color "$IPA_COLOR_VOWEL" "i") [beet]                $(ipa_color "$IPA_COLOR_VOWEL" "u") [boot]            │
│  CLOSE-MID        $(ipa_color "$IPA_COLOR_VOWEL" "e") [bay]                 $(ipa_color "$IPA_COLOR_VOWEL" "o") [boat]            │
│  MID                         $(ipa_color "$IPA_COLOR_VOWEL" "ə") [about]                       │
│  OPEN             $(ipa_color "$IPA_COLOR_VOWEL" "a") [bat]                                    │
└────────────────────────────────────────────────────────────────┘

$(ipa_color "$IPA_COLOR_PLOSIVE" "PLOSIVES") - Complete oral closure, air released suddenly
┌────────────────────────────────────────────────────────────────┐
│  BILABIAL         $(ipa_color "$IPA_COLOR_PLOSIVE" "p") [pop]   $(ipa_color "$IPA_COLOR_PLOSIVE" "b") [bob]                          │
└────────────────────────────────────────────────────────────────┘

$(ipa_color "$IPA_COLOR_NASAL" "NASALS") - Air flows through nasal cavity (velum lowered)
┌────────────────────────────────────────────────────────────────┐
│  BILABIAL         $(ipa_color "$IPA_COLOR_NASAL" "m") [mom]                                    │
└────────────────────────────────────────────────────────────────┘

$(ipa_color "$IPA_COLOR_FRICATIVE" "FRICATIVES") - Air forced through narrow channel
┌────────────────────────────────────────────────────────────────┐
│  LABIODENTAL      $(ipa_color "$IPA_COLOR_FRICATIVE" "f") [fan]   $(ipa_color "$IPA_COLOR_FRICATIVE" "v") [van]                          │
│  ALVEOLAR         $(ipa_color "$IPA_COLOR_FRICATIVE" "s") [see]   $(ipa_color "$IPA_COLOR_FRICATIVE" "z") [zoo]                          │
│  POSTALVEOLAR     $(ipa_color "$IPA_COLOR_FRICATIVE" "sh") [she]  $(ipa_color "$IPA_COLOR_FRICATIVE" "zh") [measure]                     │
│  GLOTTAL          $(ipa_color "$IPA_COLOR_FRICATIVE" "h") [hat]                                    │
└────────────────────────────────────────────────────────────────┘

$(ipa_color "$IPA_COLOR_APPROXIMANT" "APPROXIMANTS") - Articulators approach but don't create turbulence
┌────────────────────────────────────────────────────────────────┐
│  LABIAL-VELAR     $(ipa_color "$IPA_COLOR_APPROXIMANT" "w") [we]                                     │
│  PALATAL          $(ipa_color "$IPA_COLOR_APPROXIMANT" "j")/$(ipa_color "$IPA_COLOR_APPROXIMANT" "y") [yes]                                 │
│  ALVEOLAR         $(ipa_color "$IPA_COLOR_APPROXIMANT" "r") [red]                                    │
└────────────────────────────────────────────────────────────────┘

$(ipa_color "$IPA_COLOR_LATERAL" "LATERAL") - Air flows around sides of tongue
┌────────────────────────────────────────────────────────────────┐
│  ALVEOLAR         $(ipa_color "$IPA_COLOR_LATERAL" "l") [let]                                    │
└────────────────────────────────────────────────────────────────┘

SPECIAL POSITIONS
┌────────────────────────────────────────────────────────────────┐
│  NEUTRAL/REST     rest, neutral                                │
│  MID VOWEL        schwa (same as ə)                            │
└────────────────────────────────────────────────────────────────┘

LEGEND:
  $(ipa_color "$IPA_COLOR_VOWEL" "■") Vowels (tongue position, jaw height, lip rounding)
  $(ipa_color "$IPA_COLOR_PLOSIVE" "■") Plosives (complete closure, sudden release)
  $(ipa_color "$IPA_COLOR_NASAL" "■") Nasals (nasal airflow, velum lowered)
  $(ipa_color "$IPA_COLOR_FRICATIVE" "■") Fricatives (turbulent airflow)
  $(ipa_color "$IPA_COLOR_APPROXIMANT" "■") Approximants (smooth airflow)
  $(ipa_color "$IPA_COLOR_LATERAL" "■") Lateral (air around tongue sides)

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
