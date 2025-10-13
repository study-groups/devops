#!/usr/bin/env bash

# vox_core.sh - Pipe-first TTS generation
# Reads stdin, generates audio, writes to stdout or file

# Generate TTS audio from stdin using OpenAI
vox_generate_tts() {
    local voice="${1:-alloy}"
    local output_file="${2:-}"
    local model="${3:-tts-1}"

    # Read stdin
    local text
    text=$(cat)

    if [[ -z "$text" ]]; then
        echo "Error: No input text provided" >&2
        return 1
    fi

    # Get API key
    local api_key="${OPENAI_API_KEY:-}"
    if [[ -z "$api_key" && -f "$HOME/.config/vox/openai_key" ]]; then
        api_key=$(cat "$HOME/.config/vox/openai_key")
    fi

    if [[ -z "$api_key" ]]; then
        echo "Error: OPENAI_API_KEY not set" >&2
        echo "Set it with: export OPENAI_API_KEY='sk-...'" >&2
        echo "Or save to: ~/.config/vox/openai_key" >&2
        return 1
    fi

    # OpenAI has 4096 char limit
    local max_chars=4096
    if [[ ${#text} -gt $max_chars ]]; then
        echo "Warning: Text truncated from ${#text} to $max_chars chars" >&2
        text="${text:0:$max_chars}"
    fi

    # Generate temp file if no output specified
    local temp_file=""
    if [[ -z "$output_file" ]]; then
        temp_file=$(mktemp /tmp/vox.XXXXXX.mp3)
        output_file="$temp_file"
    fi

    # Build JSON payload
    local payload
    payload=$(jq -nc \
        --arg model "$model" \
        --arg voice "$voice" \
        --arg input "$text" \
        '{model: $model, voice: $voice, input: $input}')

    # Call OpenAI TTS API
    local response
    response=$(curl -s -w "\n%{http_code}" \
        -X POST "https://api.openai.com/v1/audio/speech" \
        -H "Authorization: Bearer $api_key" \
        -H "Content-Type: application/json" \
        -d "$payload" \
        --output "$output_file")

    local http_code=$(echo "$response" | tail -n1)

    if [[ "$http_code" != "200" ]]; then
        echo "Error: OpenAI API returned HTTP $http_code" >&2
        cat "$output_file" >&2
        [[ -n "$temp_file" ]] && rm -f "$temp_file"
        return 1
    fi

    # If temp file, cat to stdout and cleanup
    if [[ -n "$temp_file" ]]; then
        cat "$temp_file"
        rm -f "$temp_file"
    fi

    return 0
}

# Play audio file or stdin
vox_play_audio() {
    local audio_file="${1:-}"

    # If no file specified, read from stdin to temp file
    if [[ -z "$audio_file" ]]; then
        audio_file=$(mktemp /tmp/vox.XXXXXX.mp3)
        cat > "$audio_file"
    fi

    if [[ ! -f "$audio_file" ]]; then
        echo "Error: Audio file not found: $audio_file" >&2
        return 1
    fi

    # Play with available player
    if command -v afplay &>/dev/null; then
        afplay "$audio_file"
    elif command -v mpg123 &>/dev/null; then
        mpg123 -q "$audio_file"
    elif command -v mpv &>/dev/null; then
        mpv --no-video "$audio_file" 2>/dev/null
    elif command -v ffplay &>/dev/null; then
        ffplay -nodisp -autoexit "$audio_file" 2>/dev/null
    else
        echo "Error: No audio player found (afplay, mpg123, mpv, ffplay)" >&2
        echo "Audio saved at: $audio_file" >&2
        return 1
    fi

    return 0
}

# Generate and play (pipe-first)
vox_play() {
    local voice="${1:-alloy}"
    local temp_audio=$(mktemp /tmp/vox.XXXXXX.mp3)

    if vox_generate_tts "$voice" "$temp_audio"; then
        vox_play_audio "$temp_audio"
        local result=$?
        rm -f "$temp_audio"
        return $result
    else
        rm -f "$temp_audio"
        return 1
    fi
}
