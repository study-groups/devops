#!/usr/bin/env bash
# vox_provider.sh - Unified TTS provider abstraction
#
# Providers:
#   openai   - Cloud API (alloy, echo, fable, nova, onyx, shimmer, ash, coral, sage)
#   coqui    - Local ML TTS (vits, tacotron, xtts)
#   formant  - Research mode (direct phoneme/formant control)
#
# Voice specification:
#   provider:voice  - Explicit: openai:shimmer, coqui:vits
#   voice           - Implicit: shimmer (defaults to openai)
#
# Usage:
#   echo "hello" | vox_provider_play shimmer
#   echo "hello" | vox_provider_play coqui:xtts
#   vox_provider_play openai:nova qa:0

[[ -n "$_VOX_PROVIDER_LOADED" ]] && return 0
_VOX_PROVIDER_LOADED=1

# Provider registry
declare -gA VOX_PROVIDERS=(
    [openai]="vox_openai"
    [coqui]="vox_coqui_provider"
    [formant]="vox_formant_provider"
)

# Voice lists per provider (names only, without prefix)
declare -gA VOX_PROVIDER_VOICES=(
    [openai]="alloy ash coral echo fable nova onyx sage shimmer"
    [coqui]="vits tacotron xtts"
    [formant]="ipa"
)

# Aliases for coqui models
declare -gA VOX_COQUI_ALIASES=(
    [fast]="vits"
    [classic]="tacotron"
    [best]="xtts"
)

# Default provider
VOX_DEFAULT_PROVIDER="${VOX_DEFAULT_PROVIDER:-openai}"

# =============================================================================
# VOICE PARSING
# =============================================================================

# Parse voice specification into provider and voice
# Input: "openai:shimmer" or "coqui:xtts" (prefix required)
# Legacy: "shimmer" still works (defaults to openai)
# Output: Sets VOX_PARSED_PROVIDER and VOX_PARSED_VOICE
vox_parse_voice() {
    local spec="$1"

    if [[ "$spec" == *:* ]]; then
        VOX_PARSED_PROVIDER="${spec%%:*}"
        VOX_PARSED_VOICE="${spec#*:}"

        # Resolve coqui aliases
        if [[ "$VOX_PARSED_PROVIDER" == "coqui" ]]; then
            local alias="${VOX_COQUI_ALIASES[$VOX_PARSED_VOICE]}"
            [[ -n "$alias" ]] && VOX_PARSED_VOICE="$alias"
        fi
    else
        # Legacy: bare voice name defaults to openai
        VOX_PARSED_PROVIDER="openai"
        VOX_PARSED_VOICE="$spec"
    fi

    # Validate provider exists
    if [[ -z "${VOX_PROVIDERS[$VOX_PARSED_PROVIDER]}" ]]; then
        echo "Unknown provider: $VOX_PARSED_PROVIDER" >&2
        echo "Available: ${!VOX_PROVIDERS[*]}" >&2
        return 1
    fi
}

# Get all available voices (always with provider prefix)
vox_get_all_voices() {
    for provider in openai coqui formant; do
        local voices="${VOX_PROVIDER_VOICES[$provider]}"
        for voice in $voices; do
            echo "${provider}:${voice}"
        done
    done
}

# Get voices for specific provider
vox_get_provider_voices() {
    local provider="$1"
    echo "${VOX_PROVIDER_VOICES[$provider]:-}"
}

# List all providers
vox_list_providers() {
    echo "${!VOX_PROVIDERS[@]}"
}

# =============================================================================
# OPENAI PROVIDER
# =============================================================================

vox_openai() {
    local cmd="$1"
    shift

    case "$cmd" in
        play)
            local voice="$1" source="$2"
            if [[ -n "$source" ]]; then
                vox_play_id "$voice" "$source"
            else
                vox_play "$voice"
            fi
            ;;
        generate)
            local voice="$1" output="$2"
            vox_generate_tts "$voice" "$output"
            ;;
        voices)
            echo "${VOX_PROVIDER_VOICES[openai]}"
            ;;
        info)
            cat <<'EOF'
OpenAI TTS Provider
  Model: tts-1, tts-1-hd
  Voices: alloy ash coral echo fable nova onyx sage shimmer
  Cost: $15 per 1M characters
  Limit: 4096 characters per request
  Quality: High (cloud)
  Latency: ~1-2s
EOF
            ;;
    esac
}

# =============================================================================
# COQUI PROVIDER
# =============================================================================

vox_coqui_provider() {
    local cmd="$1"
    shift

    # Ensure coqui module is loaded
    if ! declare -f vox_coqui_play &>/dev/null; then
        if [[ -f "$VOX_SRC/vox_coqui.sh" ]]; then
            source "$VOX_SRC/vox_coqui.sh"
        else
            echo "Error: Coqui module not available" >&2
            return 1
        fi
    fi

    case "$cmd" in
        play)
            # Delegate to vox_coqui_play - handles alias resolution
            vox_coqui_play "$1"
            ;;
        generate)
            # Delegate to vox_coqui_generate - handles alias resolution
            # Args: output_file, model
            vox_coqui_generate "$2" "$1"
            ;;
        voices)
            echo "${VOX_PROVIDER_VOICES[coqui]}"
            ;;
        status)
            vox_coqui_status
            ;;
        install)
            vox_coqui_install
            ;;
        models)
            vox_coqui_models
            ;;
        info)
            cat <<'EOF'
Coqui TTS Provider (Local)
  Models: vits (fast), tacotron (classic), xtts (best)
  Cost: Free (local)
  Quality: Good to High
  Latency: ~2-10s depending on model
  Requires: pip install TTS
EOF
            ;;
    esac
}

# =============================================================================
# FORMANT PROVIDER (Research Mode)
# =============================================================================

vox_formant_provider() {
    local cmd="$1"
    shift

    # Ensure formant is loaded
    if ! declare -f formant &>/dev/null; then
        if [[ -f "$TETRA_SRC/bash/formant/formant.sh" ]]; then
            source "$TETRA_SRC/bash/formant/formant.sh"
        else
            echo "Error: formant module not available" >&2
            return 1
        fi
    fi

    case "$cmd" in
        play)
            # Formant play uses ESTO format
            local esto_file="$1"
            if [[ -f "$esto_file" ]]; then
                source "$TETRA_SRC/bash/formant/synth/esto_speak.sh"
                parse_and_speak_esto "$esto_file"
            else
                # Convert text to ESTO and play
                local text
                text=$(cat)
                local temp_esto=$(mktemp /tmp/vox_esto.XXXXXX.esto)
                echo "$text" | "$TETRA_SRC/bash/formant/synth/text2esto.sh" > "$temp_esto"
                formant_synth_load
                formant_start
                parse_and_speak_esto "$temp_esto"
                formant_stop
                rm -f "$temp_esto"
            fi
            ;;
        speak)
            # Direct text to formant
            local text="$*"
            [[ -z "$text" ]] && text=$(cat)
            local temp_esto=$(mktemp /tmp/vox_esto.XXXXXX.esto)
            echo "$text" | "$TETRA_SRC/bash/formant/synth/text2esto.sh" > "$temp_esto"
            formant_synth_load
            formant_start
            sleep 0.3
            parse_and_speak_esto "$temp_esto"
            sleep 0.3
            formant_stop
            rm -f "$temp_esto"
            ;;
        phoneme|ph)
            # Direct phoneme: vox formant ph i 200 140
            local ipa="$1" duration="${2:-100}" pitch="${3:-120}"
            formant_synth_load
            formant_phoneme "$ipa" "$duration" "$pitch"
            ;;
        formants|fm)
            # Direct formant values: vox formant fm F1 F2 F3 BW1 BW2 BW3 duration
            formant_synth_load
            formant_formant "$@"
            ;;
        emotion)
            # Set emotion: vox formant emotion happy 0.8
            local emotion="$1" intensity="${2:-0.7}"
            formant_synth_load
            formant_emotion "$emotion" "$intensity"
            ;;
        start)
            formant_synth_load
            formant_start "$@"
            ;;
        stop)
            formant_stop
            ;;
        voices)
            echo "${VOX_PROVIDER_VOICES[formant]}"
            ;;
        info)
            cat <<'EOF'
Formant Provider (Research Mode)
  Control: Direct phoneme/formant synthesis
  Format: ESTO (phoneme:duration:pitch)
  Cost: Free (local C engine)
  Quality: Research-grade
  Latency: Real-time
  Features:
    - IPA phoneme presets
    - Direct formant control (F1, F2, F3)
    - Emotion/prosody control
    - ESTO timeline playback
EOF
            ;;
    esac
}

# =============================================================================
# UNIFIED INTERFACE
# =============================================================================

# Play with automatic provider detection
# Usage: echo "text" | vox_provider_play shimmer
#        echo "text" | vox_provider_play coqui:xtts
#        vox_provider_play openai:nova qa:0
vox_provider_play() {
    local voice_spec="$1"
    local source="$2"

    vox_parse_voice "$voice_spec"
    local provider="$VOX_PARSED_PROVIDER"
    local voice="$VOX_PARSED_VOICE"

    local handler="${VOX_PROVIDERS[$provider]}"
    if [[ -z "$handler" ]]; then
        echo "Error: Unknown provider: $provider" >&2
        echo "Available: ${!VOX_PROVIDERS[*]}" >&2
        return 1
    fi

    "$handler" play "$voice" "$source"
}

# Generate with automatic provider detection
vox_provider_generate() {
    local voice_spec="$1"
    local output="$2"

    vox_parse_voice "$voice_spec"
    local provider="$VOX_PARSED_PROVIDER"
    local voice="$VOX_PARSED_VOICE"

    local handler="${VOX_PROVIDERS[$provider]}"
    if [[ -z "$handler" ]]; then
        echo "Error: Unknown provider: $provider" >&2
        return 1
    fi

    "$handler" generate "$voice" "$output"
}

# Get provider info
vox_provider_info() {
    local provider="${1:-all}"

    if [[ "$provider" == "all" ]]; then
        for p in "${!VOX_PROVIDERS[@]}"; do
            echo "=== $p ==="
            "${VOX_PROVIDERS[$p]}" info
            echo ""
        done
    else
        local handler="${VOX_PROVIDERS[$provider]}"
        if [[ -n "$handler" ]]; then
            "$handler" info
        else
            echo "Unknown provider: $provider" >&2
            return 1
        fi
    fi
}

# Check provider status
vox_provider_status() {
    echo "VOX Provider Status"
    echo "==================="
    echo ""

    # OpenAI
    printf "%-12s " "openai:"
    if [[ -n "${OPENAI_API_KEY:-}" ]] || [[ -f "${QA_DIR:-$TETRA_DIR/qa}/api_key" ]]; then
        echo "ready (API key configured)"
    else
        echo "needs API key"
    fi

    # Coqui
    printf "%-12s " "coqui:"
    if declare -f vox_coqui_check &>/dev/null && vox_coqui_check 2>/dev/null; then
        local ver=$(vox_coqui_version 2>/dev/null || echo "?")
        echo "ready (v$ver)"
    else
        echo "not installed (vox coqui install)"
    fi

    # Formant
    printf "%-12s " "formant:"
    if [[ -f "$TETRA_SRC/bash/formant/synth/bin/formant" ]]; then
        echo "ready"
    elif [[ -f "$TETRA_SRC/bash/formant/formant.sh" ]]; then
        echo "available (needs build)"
    else
        echo "not available"
    fi

    echo ""
    echo "Default provider: $VOX_DEFAULT_PROVIDER"
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f vox_parse_voice vox_get_all_voices vox_get_provider_voices vox_list_providers
export -f vox_openai vox_coqui_provider vox_formant_provider
export -f vox_provider_play vox_provider_generate vox_provider_info vox_provider_status
