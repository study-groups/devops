#!/usr/bin/env bash

# vox_metadata.sh - Metadata file management for generated audio
# Tracks source, voice, duration, cost, and timing information

source "${VOX_SRC}/vox_paths.sh"

# Create metadata file for generated audio
vox_meta_create() {
    local audio_file="$1"
    local source_file="${2:-}"
    local voice="$3"
    local content_hash="$4"
    local char_count="${5:-0}"
    local cost="${6:-0}"

    local meta_file="${audio_file%.mp3}.meta"

    # Get audio file info
    local audio_size=$(stat -f%z "$audio_file" 2>/dev/null || stat -c%s "$audio_file" 2>/dev/null)
    local duration=$(vox_meta_get_duration "$audio_file")
    local timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)

    # Check for associated spans file
    local spans_file="${audio_file%.mp3}.spans"
    local has_spans="false"
    local span_count=0

    if [[ -f "$spans_file" ]]; then
        has_spans="true"
        span_count=$(jq '.spans | length' "$spans_file" 2>/dev/null || echo "0")
    fi

    # Generate metadata JSON
    cat > "$meta_file" <<EOF
{
  "source_file": "$source_file",
  "audio_file": "$(basename "$audio_file")",
  "spans_file": "$(basename "$spans_file")",
  "voice": "$voice",
  "model": "tts-1",
  "duration": $duration,
  "size": $audio_size,
  "content_hash": "$content_hash",
  "generated_at": "$timestamp",
  "cost": $cost,
  "char_count": $char_count,
  "has_spans": $has_spans,
  "span_count": $span_count
}
EOF

    echo "$meta_file"
}

# Read metadata from file
vox_meta_read() {
    local meta_file="$1"

    if [[ ! -f "$meta_file" ]]; then
        echo "Error: Metadata file not found: $meta_file" >&2
        return 1
    fi

    cat "$meta_file"
}

# Get specific metadata field
vox_meta_get() {
    local meta_file="$1"
    local field="$2"

    if [[ ! -f "$meta_file" ]]; then
        return 1
    fi

    jq -r ".$field // empty" "$meta_file" 2>/dev/null
}

# Update metadata field
vox_meta_update() {
    local meta_file="$1"
    local field="$2"
    local value="$3"

    if [[ ! -f "$meta_file" ]]; then
        echo "Error: Metadata file not found: $meta_file" >&2
        return 1
    fi

    local temp_file="${meta_file}.tmp"
    jq ".${field} = \"${value}\"" "$meta_file" > "$temp_file" && mv "$temp_file" "$meta_file"
}

# Display metadata in human-readable format
vox_meta_display() {
    local meta_file="$1"

    if [[ ! -f "$meta_file" ]]; then
        echo "No metadata file found"
        return 1
    fi

    echo "Audio Metadata:"
    echo "─────────────────────────────────────"

    local source=$(vox_meta_get "$meta_file" "source_file")
    local audio=$(vox_meta_get "$meta_file" "audio_file")
    local voice=$(vox_meta_get "$meta_file" "voice")
    local duration=$(vox_meta_get "$meta_file" "duration")
    local size=$(vox_meta_get "$meta_file" "size")
    local cost=$(vox_meta_get "$meta_file" "cost")
    local char_count=$(vox_meta_get "$meta_file" "char_count")
    local generated_at=$(vox_meta_get "$meta_file" "generated_at")
    local has_spans=$(vox_meta_get "$meta_file" "has_spans")
    local span_count=$(vox_meta_get "$meta_file" "span_count")

    echo "Source:     ${source:-unknown}"
    echo "Audio:      $audio"
    echo "Voice:      $voice"
    echo "Duration:   $(vox_meta_format_duration "$duration")"
    echo "Size:       $(vox_meta_format_size "$size")"
    echo "Cost:       \$$cost USD"
    echo "Characters: $char_count"
    echo "Generated:  $(vox_meta_format_timestamp "$generated_at")"

    if [[ "$has_spans" == "true" ]]; then
        echo "Spans:      Yes ($span_count spans)"
    else
        echo "Spans:      No"
    fi
}

# Find metadata file for audio file
vox_meta_find() {
    local audio_file="$1"

    # Try exact match
    local meta_file="${audio_file%.mp3}.meta"
    if [[ -f "$meta_file" ]]; then
        echo "$meta_file"
        return 0
    fi

    # Try in same directory
    local dir=$(dirname "$audio_file")
    local basename=$(basename "$audio_file" .mp3)
    meta_file="${dir}/${basename}.meta"

    if [[ -f "$meta_file" ]]; then
        echo "$meta_file"
        return 0
    fi

    return 1
}

# Correlate esto file with generated audio
vox_meta_correlate() {
    local esto_file="$1"
    local base_name=$(basename "${esto_file%.esto}")
    local dir=$(dirname "$esto_file")

    echo "Correlation for: $esto_file"
    echo "─────────────────────────────────────"

    local found_any=false

    # Find all audio files for this esto source
    while IFS= read -r audio_file; do
        if [[ -f "$audio_file" ]]; then
            found_any=true
            local voice=$(basename "$audio_file" | sed 's/.*\.vox\.\(.*\)\.mp3/\1/')
            local meta_file=$(vox_meta_find "$audio_file")

            echo ""
            echo "Voice: $voice"

            if [[ -n "$meta_file" ]]; then
                local duration=$(vox_meta_get "$meta_file" "duration")
                local size=$(vox_meta_get "$meta_file" "size")
                local has_spans=$(vox_meta_get "$meta_file" "has_spans")

                echo "  Audio:    $(basename "$audio_file")"
                echo "  Duration: $(vox_meta_format_duration "$duration")"
                echo "  Size:     $(vox_meta_format_size "$size")"
                echo "  Spans:    ${has_spans}"
            else
                echo "  Audio:    $(basename "$audio_file")"
                echo "  Metadata: Not found"
            fi
        fi
    done < <(find "$dir" -maxdepth 1 -name "${base_name}.vox.*.mp3" 2>/dev/null)

    if [[ "$found_any" == "false" ]]; then
        echo "No audio files generated yet"
    fi
}

# Get audio duration using ffprobe (with fallback)
vox_meta_get_duration() {
    local audio_file="$1"

    # Try with ffprobe
    if command -v ffprobe &>/dev/null; then
        local duration=$(ffprobe -v error -show_entries format=duration \
                        -of default=noprint_wrappers=1:nokey=1 "$audio_file" 2>/dev/null)
        if [[ -n "$duration" ]]; then
            echo "$duration"
            return
        fi
    fi

    # Fallback: estimate from file size (rough: ~16KB/sec for typical MP3)
    local size=$(stat -f%z "$audio_file" 2>/dev/null || stat -c%s "$audio_file" 2>/dev/null)
    local estimated_seconds=$(echo "scale=2; $size / 16000" | bc)
    echo "$estimated_seconds"
}

# Format duration (seconds) to human-readable
vox_meta_format_duration() {
    local seconds="${1%.*}"  # Remove decimals
    if [[ -z "$seconds" || "$seconds" == "null" ]]; then
        echo "unknown"
        return
    fi

    local minutes=$((seconds / 60))
    local secs=$((seconds % 60))
    printf "%d:%02d" "$minutes" "$secs"
}

# Format size (bytes) to human-readable
vox_meta_format_size() {
    local bytes="$1"
    if [[ -z "$bytes" || "$bytes" == "null" ]]; then
        echo "unknown"
        return
    fi

    if [[ $bytes -lt 1024 ]]; then
        echo "${bytes}B"
    elif [[ $bytes -lt 1048576 ]]; then
        echo "$(echo "scale=1; $bytes / 1024" | bc)KB"
    else
        echo "$(echo "scale=1; $bytes / 1048576" | bc)MB"
    fi
}

# Format timestamp to human-readable
vox_meta_format_timestamp() {
    local timestamp="$1"
    if [[ -z "$timestamp" || "$timestamp" == "null" ]]; then
        echo "unknown"
        return
    fi

    # Try to use date command
    if date -d "$timestamp" "+%Y-%m-%d %H:%M" 2>/dev/null; then
        return
    elif date -j -f "%Y-%m-%dT%H:%M:%SZ" "$timestamp" "+%Y-%m-%d %H:%M" 2>/dev/null; then
        return
    else
        echo "$timestamp"
    fi
}

# Export functions
export -f vox_meta_create
export -f vox_meta_read
export -f vox_meta_get
export -f vox_meta_update
export -f vox_meta_display
export -f vox_meta_find
export -f vox_meta_correlate
