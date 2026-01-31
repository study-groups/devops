#!/usr/bin/env bash

# vox_core.sh - Pipe-first TTS generation
# Reads stdin, generates audio, writes to stdout or file

# Generate TTS audio from stdin using OpenAI
vox_generate_tts() {
    local voice="${1:-alloy}"
    local output_file="${2:-}"
    local model="${3:-tts-1}"
    local source_file="${4:-}"  # Optional: source esto file

    # Read stdin
    local text
    text=$(cat)

    if [[ -z "$text" ]]; then
        echo "Error: No input text provided" >&2
        return 1
    fi

    # Calculate content hash before truncation
    local content_hash=$(echo "$text" | vox_hash_content)
    local original_char_count=${#text}

    # Get API key (use QA's config - shared across tetra)
    local api_key="${OPENAI_API_KEY:-}"
    if [[ -z "$api_key" ]]; then
        : "${OPENAI_API_FILE:=$QA_DIR/api_key}"
        [[ -f "$OPENAI_API_FILE" ]] && api_key=$(cat "$OPENAI_API_FILE")
    fi

    if [[ -z "$api_key" ]]; then
        echo "Error: OPENAI_API_KEY not set" >&2
        echo "Set it with: qa config apikey <key>" >&2
        echo "Or export OPENAI_API_KEY='sk-...'" >&2
        return 1
    fi

    # OpenAI has 4096 char limit
    local max_chars=4096
    local effective_char_count=$original_char_count
    if [[ ${#text} -gt $max_chars ]]; then
        echo "Warning: Text truncated from ${#text} to $max_chars chars" >&2
        text="${text:0:$max_chars}"
        effective_char_count=$max_chars
    fi

    # Calculate cost: $15 per 1M chars
    local cost=$(echo "scale=6; $effective_char_count * 15 / 1000000" | bc)

    # Generate temp file if no output specified
    local temp_file=""
    local is_temp=false
    if [[ -z "$output_file" ]]; then
        temp_file=$(mktemp /tmp/vox.XXXXXX.mp3)
        output_file="$temp_file"
        is_temp=true
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

    # Log to agent ledger (TTS: input=0, output=char_count)
    if declare -f _agent_log &>/dev/null; then
        _agent_log "vox" 0 "$effective_char_count" "" 2>/dev/null || true
    fi

    # Generate metadata file (if not a temp file)
    if [[ "$is_temp" == "false" ]] && [[ -f "$output_file" ]]; then
        # Source vox_metadata.sh if not already loaded
        if ! declare -f vox_meta_create &>/dev/null; then
            source "${VOX_SRC}/vox_metadata.sh" 2>/dev/null || true
        fi

        if declare -f vox_meta_create &>/dev/null; then
            vox_meta_create "$output_file" "$source_file" "$voice" "$content_hash" "$effective_char_count" "$cost" >/dev/null 2>&1
        fi
    fi

    # If temp file, cat to stdout and cleanup
    if [[ "$is_temp" == "true" ]]; then
        cat "$temp_file"
        rm -f "$temp_file"
    fi

    return 0
}

# Audio backend selection: auto, native, tau
: "${VOX_AUDIO_BACKEND:=auto}"

# Play audio using native system player (afplay/mpg123/mpv/ffplay)
_vox_play_native() {
    local audio_file="$1"

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
}

# Play audio using tau engine
_vox_play_tau() {
    local audio_file="$1"
    local wait="${2:-true}"

    if ! declare -f vox_tau_play_audio &>/dev/null; then
        echo "Error: tau backend not available (vox_tau.sh not loaded)" >&2
        return 1
    fi

    if [[ "$wait" == "true" ]]; then
        vox_tau_play_audio "$audio_file" --wait
    else
        vox_tau_play_audio "$audio_file"
    fi
}

# Play audio file or stdin
# Supports backend selection via VOX_AUDIO_BACKEND or --backend flag
vox_play_audio() {
    local audio_file=""
    local backend="$VOX_AUDIO_BACKEND"
    local wait="true"

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --backend|-b) backend="$2"; shift 2 ;;
            --no-wait) wait="false"; shift ;;
            *) audio_file="$1"; shift ;;
        esac
    done

    # If no file specified, read from stdin to temp file
    if [[ -z "$audio_file" ]]; then
        audio_file=$(mktemp /tmp/vox.XXXXXX.mp3)
        cat > "$audio_file"
    fi

    if [[ ! -f "$audio_file" ]]; then
        echo "Error: Audio file not found: $audio_file" >&2
        return 1
    fi

    # Route to backend
    case "$backend" in
        tau)
            _vox_play_tau "$audio_file" "$wait"
            ;;
        native)
            _vox_play_native "$audio_file"
            ;;
        auto)
            # Use tau if running, otherwise native
            if declare -f _vox_tau_is_running &>/dev/null && _vox_tau_is_running 2>/dev/null; then
                _vox_play_tau "$audio_file" "$wait"
            else
                _vox_play_native "$audio_file"
            fi
            ;;
        *)
            echo "Unknown audio backend: $backend (use: auto, native, tau)" >&2
            return 1
            ;;
    esac
}

# Generate and play (pipe-first - no caching)
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

# Play from source ID (with caching)
vox_play_id() {
    local voice="$1"
    local source_id="$2"

    # Get source content and extract timestamp
    local source_path
    local content
    local timestamp
    local source_type

    case "$source_id" in
        qa:*)
            # QA reference
            source_type="qa"
            source_path=$(vox_qa_get_path "$source_id")
            if [[ $? -ne 0 ]]; then
                return 1
            fi
            content=$(cat "$source_path")

            # Extract timestamp from source_id (qa:1760229927 -> 1760229927)
            timestamp="${source_id#qa:}"
            ;;
        *)
            echo "Error: Unknown source type: $source_id" >&2
            return 1
            ;;
    esac

    # Calculate content hash
    local content_hash=$(echo "$content" | vox_hash_content)

    # Check cache (openai provider)
    local cached_audio=$(vox_cache_get "$content_hash" "$voice" "openai")
    local cache_hit=false

    # Determine output path in VOX_DIR/db
    vox_ensure_db_dir
    local db_audio_path=$(vox_get_db_audio_path "$timestamp" "$voice")

    if [[ -n "$cached_audio" ]]; then
        echo "Playing cached audio ($source_id, $voice)" >&2
        cache_hit=true

        # Copy from cache to db if not already there
        if [[ ! -f "$db_audio_path" ]]; then
            cp "$cached_audio" "$db_audio_path"
        fi

        # Log cache hit
        if declare -f vox_log_transaction &>/dev/null; then
            vox_log_transaction "play" "vox play $voice $source_id" "$source_type" "$source_id" "$db_audio_path" "$voice" 0 true >/dev/null 2>&1
        fi

        vox_play_audio "$cached_audio"
        return $?
    fi

    # Generate new audio directly to db
    echo "Generating audio ($source_id, $voice)" >&2

    # Calculate cost
    local char_count=${#content}
    local max_chars=4096
    local effective_chars=$char_count
    if [[ $char_count -gt $max_chars ]]; then
        effective_chars=$max_chars
    fi
    local cost=$(echo "scale=6; $effective_chars * 15 / 1000000" | bc)

    echo "$content" | vox_generate_tts "$voice" "$db_audio_path"

    if [[ $? -ne 0 ]]; then
        return 1
    fi

    # Store in cache
    vox_cache_store "$content_hash" "$voice" "$db_audio_path" "openai"

    # Log generation
    if declare -f vox_log_transaction &>/dev/null; then
        vox_log_transaction "generate" "vox play $voice $source_id" "$source_type" "$source_id" "$db_audio_path" "$voice" "$cost" false >/dev/null 2>&1
    fi

    # Play
    vox_play_audio "$db_audio_path"
    return $?
}

# Generate from source ID (with caching)
vox_generate_id() {
    local voice="$1"
    local source_id="$2"
    local output_file="$3"

    # Get source content and extract timestamp
    local source_path
    local content
    local timestamp
    local source_type

    case "$source_id" in
        qa:*)
            # QA reference
            source_type="qa"
            source_path=$(vox_qa_get_path "$source_id")
            if [[ $? -ne 0 ]]; then
                return 1
            fi
            content=$(cat "$source_path")

            # Extract timestamp from source_id
            timestamp="${source_id#qa:}"
            ;;
        *)
            echo "Error: Unknown source type: $source_id" >&2
            return 1
            ;;
    esac

    # If no output file specified, use VOX_DIR/db path
    if [[ -z "$output_file" ]]; then
        vox_ensure_db_dir
        output_file=$(vox_get_db_audio_path "$timestamp" "$voice")
    fi

    # Calculate content hash
    local content_hash=$(echo "$content" | vox_hash_content)

    # Check cache
    local cached_audio=$(vox_cache_get "$content_hash" "$voice" "openai")

    if [[ -n "$cached_audio" ]]; then
        echo "Using cached audio ($source_id, $voice)" >&2
        cp "$cached_audio" "$output_file"
        return 0
    fi

    # Generate new audio
    echo "Generating audio ($source_id, $voice)" >&2
    echo "$content" | vox_generate_tts "$voice" "$output_file"

    if [[ $? -ne 0 ]]; then
        return 1
    fi

    # Store in cache
    vox_cache_store "$content_hash" "$voice" "$output_file" "openai"

    return 0
}
