#!/usr/bin/env bash

# vox_g2p.sh - Grapheme-to-Phoneme conversion using espeak
#
# Converts text to IPA phonemes with timing estimates and formant mappings
#
# Usage:
#   echo "Hello world" | vox_g2p
#   vox_g2p_word "hello"
#   vox_g2p_file document.txt
#
# Requires: espeak-ng (or espeak)

#==============================================================================
# CONFIGURATION
#==============================================================================

: "${VOX_SRC:=$TETRA_SRC/bash/vox}"
: "${CHROMA_SRC:=$TETRA_SRC/bash/chroma}"
: "${VOX_G2P_LANG:=en-us}"
: "${VOX_G2P_RATE:=175}"  # Words per minute for duration estimates

# Phoneme duration estimates (ms) - based on typical English speech
declare -gA VOX_PHONEME_DURATIONS=(
    # Short vowels
    [ɪ]=80  [ɛ]=90  [æ]=100 [ʌ]=80  [ʊ]=80  [ə]=60  [ɐ]=70
    # Long vowels
    [iː]=140 [ɑː]=150 [ɔː]=140 [uː]=140 [ɜː]=140
    # Diphthongs
    [eɪ]=160 [aɪ]=170 [ɔɪ]=170 [aʊ]=170 [oʊ]=160 [ɪə]=150 [eə]=150 [ʊə]=150
    # Plosives
    [p]=80  [b]=70  [t]=70  [d]=60  [k]=80  [ɡ]=70  [ʔ]=30
    # Fricatives
    [f]=100 [v]=80  [θ]=100 [ð]=70  [s]=110 [z]=90  [ʃ]=110 [ʒ]=90  [h]=70
    # Affricates
    [tʃ]=130 [dʒ]=120
    # Nasals
    [m]=70  [n]=60  [ŋ]=70
    # Approximants
    [l]=60  [ɹ]=70  [w]=60  [j]=50
    # Flap
    [ɾ]=40
    # Default
    [_default]=70
)

# Stress markers from espeak
declare -gA VOX_STRESS_MAP=(
    [ˈ]="primary"
    [ˌ]="secondary"
    [ˑ]="half-long"
    [ː]="long"
)

#==============================================================================
# ESPEAK DETECTION
#==============================================================================

_vox_g2p_find_espeak() {
    local cmd
    for cmd in espeak-ng espeak; do
        if command -v "$cmd" &>/dev/null; then
            echo "$cmd"
            return 0
        fi
    done
    return 1
}

_vox_g2p_check_deps() {
    local espeak_cmd
    espeak_cmd=$(_vox_g2p_find_espeak)
    if [[ -z "$espeak_cmd" ]]; then
        echo "Error: espeak or espeak-ng not found" >&2
        echo "Install with: brew install espeak (macOS) or apt install espeak-ng (Linux)" >&2
        return 1
    fi
    echo "$espeak_cmd"
}

#==============================================================================
# CORE G2P FUNCTIONS
#==============================================================================

# Convert a single word to IPA
# Args: word [lang]
# Output: IPA string
vox_g2p_word() {
    local word="$1"
    local lang="${2:-$VOX_G2P_LANG}"
    local espeak_cmd

    espeak_cmd=$(_vox_g2p_check_deps) || return 1

    # espeak-ng outputs IPA with -q --ipa
    # Remove brackets and extra whitespace
    "$espeak_cmd" -q --ipa -v "$lang" "$word" 2>/dev/null | \
        tr -d '[]' | \
        sed 's/^[[:space:]]*//; s/[[:space:]]*$//' | \
        tr -d '\n'
}

# Convert text to IPA with word boundaries
# Args: [lang]
# Input: stdin
# Output: space-separated IPA for each word
vox_g2p_text() {
    local lang="${1:-$VOX_G2P_LANG}"
    local espeak_cmd

    espeak_cmd=$(_vox_g2p_check_deps) || return 1

    # Read all input
    local text
    text=$(cat)

    # espeak with --ipa outputs each word's pronunciation
    echo "$text" | "$espeak_cmd" -q --ipa -v "$lang" 2>/dev/null | \
        tr -d '[]' | \
        sed 's/^[[:space:]]*//; s/[[:space:]]*$//'
}

# Parse IPA string into phoneme array
# Args: ipa_string
# Output: JSON array of phonemes
_vox_g2p_parse_ipa() {
    local ipa="$1"
    local phonemes=""
    local i=0
    local len=${#ipa}
    local stress="none"

    while (( i < len )); do
        local char="${ipa:i:1}"
        local next="${ipa:i+1:1}"
        local phoneme=""
        local consumed=1

        # Check for stress markers
        case "$char" in
            ˈ) stress="primary"; ((i++)); continue ;;
            ˌ) stress="secondary"; ((i++)); continue ;;
            ː) # Length marker - modify previous phoneme
                ((i++)); continue ;;
        esac

        # Multi-character phonemes (diphthongs, affricates)
        case "$char$next" in
            eɪ|aɪ|ɔɪ|aʊ|oʊ|ɪə|eə|ʊə|iː|ɑː|ɔː|uː|ɜː)
                phoneme="$char$next"
                consumed=2
                ;;
            tʃ|dʒ)
                phoneme="$char$next"
                consumed=2
                ;;
            *)
                # Single character phoneme
                phoneme="$char"
                ;;
        esac

        # Skip whitespace and unknown
        if [[ -n "$phoneme" && ! "$phoneme" =~ ^[[:space:]]$ ]]; then
            # Get duration estimate
            local duration="${VOX_PHONEME_DURATIONS[$phoneme]:-${VOX_PHONEME_DURATIONS[_default]}}"

            # Build JSON
            [[ -n "$phonemes" ]] && phonemes+=","
            phonemes+="{\"ipa\":\"$phoneme\",\"stress\":\"$stress\",\"duration_ms\":$duration}"

            # Reset stress after applying to vowel
            if [[ "$phoneme" =~ [ɪɛæʌʊəɐiɑɔuɜeaɔoɪʊ] ]]; then
                stress="none"
            fi
        fi

        ((i += consumed))
    done

    echo "[$phonemes]"
}

#==============================================================================
# STRUCTURED OUTPUT
#==============================================================================

# Convert word to full phoneme structure
# Args: word [lang]
# Output: JSON object with IPA and phoneme breakdown
vox_g2p_word_json() {
    local word="$1"
    local lang="${2:-$VOX_G2P_LANG}"

    local ipa
    ipa=$(vox_g2p_word "$word" "$lang")

    if [[ -z "$ipa" ]]; then
        echo "{\"word\":\"$word\",\"ipa\":null,\"error\":\"g2p_failed\"}"
        return 1
    fi

    local phonemes
    phonemes=$(_vox_g2p_parse_ipa "$ipa")

    # Calculate total duration
    local total_duration
    total_duration=$(echo "$phonemes" | jq '[.[].duration_ms] | add // 0')

    cat <<EOF
{
  "word": "$word",
  "ipa": "$ipa",
  "duration_ms": $total_duration,
  "phonemes": $phonemes
}
EOF
}

# Process full text to structured JSON
# Input: stdin (plain text)
# Output: JSON with all words tokenized and phonemized
vox_g2p_full() {
    local lang="${1:-$VOX_G2P_LANG}"
    local espeak_cmd

    espeak_cmd=$(_vox_g2p_check_deps) || return 1

    local text
    text=$(cat)

    # Tokenize into words, preserving positions
    local tokens=""
    local offset=0
    local word=""
    local word_start=0
    local i=0
    local len=${#text}

    while (( i <= len )); do
        local char="${text:i:1}"

        # Word boundary detection
        if [[ -z "$char" || "$char" =~ [[:space:][:punct:]] ]]; then
            # Emit word if we have one
            if [[ -n "$word" ]]; then
                local ipa
                ipa=$(vox_g2p_word "$word" "$lang")
                local phonemes
                phonemes=$(_vox_g2p_parse_ipa "$ipa")
                local total_duration
                total_duration=$(echo "$phonemes" | jq '[.[].duration_ms] | add // 0')

                [[ -n "$tokens" ]] && tokens+=","
                tokens+=$(cat <<EOF
{
    "type": "word",
    "text": "$word",
    "pos": {"offset": $word_start, "len": ${#word}},
    "ipa": "$ipa",
    "duration_ms": $total_duration,
    "phonemes": $phonemes
}
EOF
)
                word=""
            fi

            # Emit whitespace/punctuation
            if [[ -n "$char" ]]; then
                local token_type="whitespace"
                local break_type="none"
                local pause_ms=0

                case "$char" in
                    " ")  break_type="none"; pause_ms=0 ;;
                    $'\t') break_type="micro"; pause_ms=50 ;;
                    $'\n') break_type="breath"; pause_ms=100 ;;
                    ".")  token_type="punctuation"; break_type="sentence"; pause_ms=200 ;;
                    ",")  token_type="punctuation"; break_type="clause"; pause_ms=150 ;;
                    ";")  token_type="punctuation"; break_type="semiclause"; pause_ms=180 ;;
                    ":")  token_type="punctuation"; break_type="lead-in"; pause_ms=200 ;;
                    "!")  token_type="punctuation"; break_type="exclamation"; pause_ms=250 ;;
                    "?")  token_type="punctuation"; break_type="question"; pause_ms=250 ;;
                    "-")  token_type="punctuation"; break_type="hyphen"; pause_ms=50 ;;
                    *)    token_type="punctuation"; break_type="none"; pause_ms=0 ;;
                esac

                # Check for paragraph break (double newline)
                if [[ "$char" == $'\n' && "${text:i+1:1}" == $'\n' ]]; then
                    break_type="paragraph"
                    pause_ms=400
                fi

                [[ -n "$tokens" ]] && tokens+=","
                local escaped_char
                escaped_char=$(printf '%s' "$char" | jq -Rs '.')
                tokens+="{\"type\":\"$token_type\",\"text\":$escaped_char,\"pos\":{\"offset\":$i,\"len\":1},\"break\":\"$break_type\",\"pause_ms\":$pause_ms}"
            fi
        else
            # Accumulate word characters
            if [[ -z "$word" ]]; then
                word_start=$i
            fi
            word+="$char"
        fi

        ((i++))
    done

    # Calculate total duration
    local total_duration
    total_duration=$(echo "[$tokens]" | jq '[.[] | (.duration_ms // 0) + (.pause_ms // 0)] | add // 0')

    cat <<EOF
{
  "version": "1.0",
  "lang": "$lang",
  "total_duration_ms": $total_duration,
  "token_count": $(echo "[$tokens]" | jq 'length'),
  "tokens": [$tokens]
}
EOF
}

#==============================================================================
# SYLLABLE DETECTION
#==============================================================================

# Split IPA into syllables based on sonority
# Args: ipa_string
# Output: JSON array of syllables
_vox_g2p_syllabify() {
    local ipa="$1"

    # Simplified syllabification: split on stress markers and vowel clusters
    local syllables=""
    local current=""
    local i=0
    local len=${#ipa}

    while (( i < len )); do
        local char="${ipa:i:1}"

        # Stress marker starts new syllable (except at beginning)
        if [[ "$char" == "ˈ" || "$char" == "ˌ" ]] && [[ -n "$current" ]]; then
            [[ -n "$syllables" ]] && syllables+=","
            syllables+="\"$current\""
            current="$char"
        else
            current+="$char"
        fi

        ((i++))
    done

    # Add final syllable
    if [[ -n "$current" ]]; then
        [[ -n "$syllables" ]] && syllables+=","
        syllables+="\"$current\""
    fi

    echo "[$syllables]"
}

# Enhanced word analysis with syllables
vox_g2p_word_full() {
    local word="$1"
    local lang="${2:-$VOX_G2P_LANG}"

    local ipa
    ipa=$(vox_g2p_word "$word" "$lang")

    if [[ -z "$ipa" ]]; then
        echo "{\"word\":\"$word\",\"error\":\"g2p_failed\"}"
        return 1
    fi

    local phonemes
    phonemes=$(_vox_g2p_parse_ipa "$ipa")

    local syllables
    syllables=$(_vox_g2p_syllabify "$ipa")

    local total_duration
    total_duration=$(echo "$phonemes" | jq '[.[].duration_ms] | add // 0')

    local syllable_count
    syllable_count=$(echo "$syllables" | jq 'length')

    cat <<EOF
{
  "word": "$word",
  "ipa": "$ipa",
  "syllable_count": $syllable_count,
  "syllables": $syllables,
  "duration_ms": $total_duration,
  "phonemes": $phonemes
}
EOF
}

#==============================================================================
# FORMANT MAPPING
#==============================================================================

# Map IPA phoneme to formant preset
vox_g2p_to_formant() {
    local ipa_phoneme="$1"

    # Map IPA to formant preset names
    local formant_name
    case "$ipa_phoneme" in
        # Vowels
        i|iː|ɪ) formant_name="i" ;;
        e|eɪ|ɛ) formant_name="e" ;;
        æ|a|ɑ|ɑː|ʌ|ɐ) formant_name="a" ;;
        o|oʊ|ɔ|ɔː) formant_name="o" ;;
        u|uː|ʊ) formant_name="u" ;;
        ə|ɜ|ɜː) formant_name="ə" ;;

        # Consonants
        p) formant_name="p" ;;
        b) formant_name="b" ;;
        m) formant_name="m" ;;
        f) formant_name="f" ;;
        v) formant_name="v" ;;
        θ|ð) formant_name="f" ;;  # Approximate
        s) formant_name="s" ;;
        z) formant_name="z" ;;
        ʃ) formant_name="sh" ;;
        ʒ) formant_name="zh" ;;
        h) formant_name="h" ;;
        l) formant_name="l" ;;
        ɹ|r) formant_name="r" ;;
        w) formant_name="w" ;;
        j) formant_name="j" ;;

        # Default
        *) formant_name="neutral" ;;
    esac

    # If formant_get_phoneme_preset is available, use it
    if declare -F formant_get_phoneme_preset &>/dev/null; then
        formant_get_phoneme_preset "$formant_name"
    else
        echo "formant_name:$formant_name"
    fi
}

# Add formant data to phoneme array
vox_g2p_with_formants() {
    local word="$1"
    local lang="${2:-$VOX_G2P_LANG}"

    local base_json
    base_json=$(vox_g2p_word_json "$word" "$lang")

    # Add formant mapping to each phoneme
    echo "$base_json" | jq '
        .phonemes |= map(
            . + {
                formant_preset: (
                    if .ipa | test("^[iɪ]") then "i"
                    elif .ipa | test("^[eɛ]") then "e"
                    elif .ipa | test("^[aæɑʌɐ]") then "a"
                    elif .ipa | test("^[oɔ]") then "o"
                    elif .ipa | test("^[uʊ]") then "u"
                    elif .ipa | test("^[ə]") then "schwa"
                    elif .ipa | test("^[pbm]") then .ipa
                    elif .ipa | test("^[fv]") then .ipa
                    elif .ipa | test("^[sz]") then .ipa
                    elif .ipa | test("^[ʃʒ]") then "sh"
                    elif .ipa | test("^[lr]") then .ipa
                    elif .ipa | test("^[wj]") then .ipa
                    else "neutral"
                    end
                )
            }
        )
    '
}

#==============================================================================
# BATCH PROCESSING
#==============================================================================

# Process CST JSON and add phoneme annotations
# Input: CST JSON from chroma_cst_parse
# Output: CST JSON with vox annotations
vox_g2p_annotate_cst() {
    local lang="${1:-$VOX_G2P_LANG}"
    local cst
    cst=$(cat)

    # Process each text node
    echo "$cst" | jq --arg lang "$lang" '
        # Helper to check if string is a word
        def is_word: test("^[a-zA-Z]+$");

        # Recursively process nodes
        def annotate:
            if .type == "text" then
                .raw as $raw |
                if ($raw | is_word) then
                    . + {vox: {needs_g2p: true, text: $raw}}
                else
                    .
                end
            elif .children then
                .children |= map(annotate)
            else
                .
            end;

        annotate
    '
}

#==============================================================================
# CLI INTERFACE
#==============================================================================

vox_g2p() {
    local cmd="${1:-help}"
    shift || true

    case "$cmd" in
        word|w)
            local word="$1"
            local lang="${2:-$VOX_G2P_LANG}"
            if [[ -z "$word" ]]; then
                echo "Usage: vox_g2p word <word> [lang]" >&2
                return 1
            fi
            vox_g2p_word "$word" "$lang"
            echo  # newline
            ;;

        json|j)
            local word="$1"
            local lang="${2:-$VOX_G2P_LANG}"
            if [[ -z "$word" ]]; then
                echo "Usage: vox_g2p json <word> [lang]" >&2
                return 1
            fi
            vox_g2p_word_json "$word" "$lang" | jq .
            ;;

        full|f)
            local word="$1"
            local lang="${2:-$VOX_G2P_LANG}"
            if [[ -z "$word" ]]; then
                echo "Usage: vox_g2p full <word> [lang]" >&2
                return 1
            fi
            vox_g2p_word_full "$word" "$lang" | jq .
            ;;

        text|t)
            local lang="${1:-$VOX_G2P_LANG}"
            vox_g2p_full "$lang" | jq .
            ;;

        formants)
            local word="$1"
            local lang="${2:-$VOX_G2P_LANG}"
            if [[ -z "$word" ]]; then
                echo "Usage: vox_g2p formants <word> [lang]" >&2
                return 1
            fi
            vox_g2p_with_formants "$word" "$lang" | jq .
            ;;

        cst)
            local lang="${1:-$VOX_G2P_LANG}"
            vox_g2p_annotate_cst "$lang" | jq .
            ;;

        langs|languages)
            local espeak_cmd
            espeak_cmd=$(_vox_g2p_check_deps) || return 1
            "$espeak_cmd" --voices | head -20
            echo "..."
            echo "Use: $espeak_cmd --voices for full list"
            ;;

        test)
            echo "=== G2P Test ==="
            echo ""
            echo "Word: hello"
            vox_g2p_word "hello"
            echo ""
            echo ""
            echo "Word JSON: hello"
            vox_g2p_word_json "hello" | jq .
            echo ""
            echo "Full text:"
            echo "Hello, world!" | vox_g2p_full | jq .
            ;;

        help|--help|-h|*)
            cat <<'EOF'
vox_g2p - Grapheme-to-Phoneme conversion using espeak

Usage: vox_g2p <command> [options]

Commands:
  word <word> [lang]      Get IPA for a single word
  json <word> [lang]      Get structured JSON for word
  full <word> [lang]      Get full analysis with syllables
  text [lang]             Process text from stdin to JSON
  formants <word> [lang]  Get phonemes with formant mappings
  cst [lang]              Annotate CST JSON from stdin
  langs                   List available languages
  test                    Run test examples

Examples:
  vox_g2p word hello
  vox_g2p json hello
  echo "Hello, world!" | vox_g2p text

Languages:
  Default: en-us
  Set VOX_G2P_LANG or pass as argument

Requires:
  espeak-ng (preferred) or espeak
EOF
            ;;
    esac
}

#==============================================================================
# EXPORTS
#==============================================================================

export -f vox_g2p vox_g2p_word vox_g2p_text vox_g2p_word_json
export -f vox_g2p_full vox_g2p_word_full vox_g2p_with_formants
export -f vox_g2p_annotate_cst vox_g2p_to_formant
export -f _vox_g2p_parse_ipa _vox_g2p_syllabify
export -f _vox_g2p_find_espeak _vox_g2p_check_deps
