#!/usr/bin/env bash
# EstoVox Phoneme Presets
# IPA-based articulator configurations

# === PHONEME DEFINITIONS ===

estovox_get_phoneme_preset() {
    local phoneme=$1

    case $phoneme in
        # Close front unrounded vowel
        i|i:|ɪ)
            echo "ESTOVOX_JAW_OPENNESS:0.2"
            echo "ESTOVOX_LIP_ROUNDING:0.0"
            echo "ESTOVOX_LIP_CORNER_HEIGHT:0.7"
            echo "ESTOVOX_TONGUE_HEIGHT:0.9"
            echo "ESTOVOX_TONGUE_FRONTNESS:1.0"
            ;;

        # Open front unrounded vowel
        a|a:|æ)
            echo "ESTOVOX_JAW_OPENNESS:0.9"
            echo "ESTOVOX_LIP_ROUNDING:0.0"
            echo "ESTOVOX_LIP_CORNER_HEIGHT:0.5"
            echo "ESTOVOX_TONGUE_HEIGHT:0.1"
            echo "ESTOVOX_TONGUE_FRONTNESS:0.7"
            ;;

        # Close back rounded vowel
        u|u:|ʊ)
            echo "ESTOVOX_JAW_OPENNESS:0.3"
            echo "ESTOVOX_LIP_ROUNDING:1.0"
            echo "ESTOVOX_LIP_PROTRUSION:0.8"
            echo "ESTOVOX_LIP_CORNER_HEIGHT:0.5"
            echo "ESTOVOX_TONGUE_HEIGHT:0.9"
            echo "ESTOVOX_TONGUE_FRONTNESS:0.0"
            ;;

        # Close-mid back rounded vowel
        o|o:|ɔ)
            echo "ESTOVOX_JAW_OPENNESS:0.6"
            echo "ESTOVOX_LIP_ROUNDING:0.7"
            echo "ESTOVOX_LIP_PROTRUSION:0.3"
            echo "ESTOVOX_TONGUE_HEIGHT:0.3"
            echo "ESTOVOX_TONGUE_FRONTNESS:0.2"
            ;;

        # Close-mid front unrounded vowel
        e|e:|ɛ)
            echo "ESTOVOX_JAW_OPENNESS:0.4"
            echo "ESTOVOX_LIP_ROUNDING:0.0"
            echo "ESTOVOX_LIP_CORNER_HEIGHT:0.6"
            echo "ESTOVOX_TONGUE_HEIGHT:0.7"
            echo "ESTOVOX_TONGUE_FRONTNESS:0.9"
            ;;

        # Mid central vowel (schwa)
        ə|schwa)
            echo "ESTOVOX_JAW_OPENNESS:0.4"
            echo "ESTOVOX_LIP_ROUNDING:0.3"
            echo "ESTOVOX_LIP_CORNER_HEIGHT:0.5"
            echo "ESTOVOX_TONGUE_HEIGHT:0.5"
            echo "ESTOVOX_TONGUE_FRONTNESS:0.5"
            ;;

        # Bilabial nasal
        m)
            echo "ESTOVOX_JAW_OPENNESS:0.0"
            echo "ESTOVOX_LIP_COMPRESSION:0.8"
            echo "ESTOVOX_VELUM_LOWERED:1.0"
            ;;

        # Voiceless bilabial plosive
        p)
            echo "ESTOVOX_JAW_OPENNESS:0.0"
            echo "ESTOVOX_LIP_COMPRESSION:1.0"
            echo "ESTOVOX_VELUM_LOWERED:0.0"
            ;;

        # Voiced bilabial plosive
        b)
            echo "ESTOVOX_JAW_OPENNESS:0.0"
            echo "ESTOVOX_LIP_COMPRESSION:0.9"
            echo "ESTOVOX_VELUM_LOWERED:0.0"
            ;;

        # Voiceless labiodental fricative
        f)
            echo "ESTOVOX_JAW_OPENNESS:0.2"
            echo "ESTOVOX_LIP_COMPRESSION:0.6"
            echo "ESTOVOX_TONGUE_HEIGHT:0.4"
            ;;

        # Voiced labiodental fricative
        v)
            echo "ESTOVOX_JAW_OPENNESS:0.2"
            echo "ESTOVOX_LIP_COMPRESSION:0.5"
            echo "ESTOVOX_TONGUE_HEIGHT:0.4"
            ;;

        # Voiceless alveolar fricative
        s)
            echo "ESTOVOX_JAW_OPENNESS:0.1"
            echo "ESTOVOX_LIP_CORNER_HEIGHT:0.6"
            echo "ESTOVOX_TONGUE_GROOVED:1.0"
            echo "ESTOVOX_TONGUE_HEIGHT:0.7"
            echo "ESTOVOX_TONGUE_FRONTNESS:0.8"
            ;;

        # Voiced alveolar fricative
        z)
            echo "ESTOVOX_JAW_OPENNESS:0.1"
            echo "ESTOVOX_LIP_CORNER_HEIGHT:0.6"
            echo "ESTOVOX_TONGUE_GROOVED:1.0"
            echo "ESTOVOX_TONGUE_HEIGHT:0.7"
            echo "ESTOVOX_TONGUE_FRONTNESS:0.8"
            ;;

        # Voiceless postalveolar fricative
        ʃ|sh)
            echo "ESTOVOX_JAW_OPENNESS:0.15"
            echo "ESTOVOX_LIP_ROUNDING:0.4"
            echo "ESTOVOX_LIP_PROTRUSION:0.3"
            echo "ESTOVOX_TONGUE_GROOVED:0.8"
            echo "ESTOVOX_TONGUE_HEIGHT:0.6"
            echo "ESTOVOX_TONGUE_FRONTNESS:0.6"
            ;;

        # Voiced postalveolar fricative
        ʒ|zh)
            echo "ESTOVOX_JAW_OPENNESS:0.15"
            echo "ESTOVOX_LIP_ROUNDING:0.4"
            echo "ESTOVOX_LIP_PROTRUSION:0.3"
            echo "ESTOVOX_TONGUE_GROOVED:0.8"
            echo "ESTOVOX_TONGUE_HEIGHT:0.6"
            echo "ESTOVOX_TONGUE_FRONTNESS:0.6"
            ;;

        # Voiced labial-velar approximant
        w)
            echo "ESTOVOX_JAW_OPENNESS:0.2"
            echo "ESTOVOX_LIP_ROUNDING:1.0"
            echo "ESTOVOX_LIP_PROTRUSION:0.9"
            echo "ESTOVOX_TONGUE_HEIGHT:0.8"
            echo "ESTOVOX_TONGUE_FRONTNESS:0.0"
            ;;

        # Voiced alveolar approximant
        l)
            echo "ESTOVOX_JAW_OPENNESS:0.3"
            echo "ESTOVOX_TONGUE_HEIGHT:0.7"
            echo "ESTOVOX_TONGUE_FRONTNESS:0.7"
            ;;

        # Voiced alveolar trill
        r)
            echo "ESTOVOX_JAW_OPENNESS:0.3"
            echo "ESTOVOX_TONGUE_HEIGHT:0.6"
            echo "ESTOVOX_TONGUE_FRONTNESS:0.7"
            ;;

        # Voiceless glottal fricative
        h)
            echo "ESTOVOX_JAW_OPENNESS:0.4"
            echo "ESTOVOX_LIP_ROUNDING:0.0"
            ;;

        # Voiced palatal approximant
        j|y)
            echo "ESTOVOX_JAW_OPENNESS:0.2"
            echo "ESTOVOX_TONGUE_HEIGHT:0.8"
            echo "ESTOVOX_TONGUE_FRONTNESS:0.9"
            ;;

        # Rest/neutral position
        rest|neutral)
            echo "ESTOVOX_JAW_OPENNESS:0.0"
            echo "ESTOVOX_LIP_ROUNDING:0.2"
            echo "ESTOVOX_LIP_COMPRESSION:0.0"
            echo "ESTOVOX_LIP_CORNER_HEIGHT:0.5"
            echo "ESTOVOX_TONGUE_HEIGHT:0.4"
            echo "ESTOVOX_TONGUE_FRONTNESS:0.5"
            echo "ESTOVOX_VELUM_LOWERED:0.0"
            ;;

        *)
            return 1
            ;;
    esac
}

# List all available phonemes
estovox_list_phonemes() {
    cat <<'EOF'
Vowels:
  i, e, a, o, u    - Basic vowels
  ə (schwa)        - Mid central vowel

Consonants:
  m                - Bilabial nasal
  p, b             - Bilabial plosives
  f, v             - Labiodental fricatives
  s, z             - Alveolar fricatives
  sh, zh           - Postalveolar fricatives
  w                - Labial-velar approximant
  l                - Alveolar lateral
  r                - Alveolar trill
  h                - Glottal fricative
  j, y             - Palatal approximant

Special:
  rest, neutral    - Neutral face position
EOF
}
