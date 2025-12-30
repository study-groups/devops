#!/usr/bin/env bash

# vox_cache.sh - Provider-aware content-addressed caching system
# Cache key format: {hash}.{provider}.{voice}.mp3
# Deduplicates audio by content hash per provider

source "${VOX_SRC}/vox_paths.sh"

# Check if audio exists in cache for hash+provider+voice
vox_cache_exists() {
    local content_hash="$1"
    local voice="$2"
    local provider="${3:-openai}"

    local cached_audio=$(vox_get_cached_audio_path "$content_hash" "$voice" "$provider")
    if [[ -f "$cached_audio" ]]; then
        return 0
    fi

    # Check legacy format (pre-provider) for migration
    local legacy_audio=$(vox_get_legacy_cached_audio_path "$content_hash" "$voice")
    if [[ -f "$legacy_audio" ]]; then
        # Migrate legacy cache to new format (assume openai)
        if [[ "$provider" == "openai" ]]; then
            vox_ensure_cache_dir
            mv "$legacy_audio" "$cached_audio" 2>/dev/null
            return 0
        fi
    fi

    return 1
}

# Get cached audio path (if exists)
vox_cache_get() {
    local content_hash="$1"
    local voice="$2"
    local provider="${3:-openai}"

    if vox_cache_exists "$content_hash" "$voice" "$provider"; then
        vox_get_cached_audio_path "$content_hash" "$voice" "$provider"
    else
        return 1
    fi
}

# Store audio in cache
vox_cache_store() {
    local content_hash="$1"
    local voice="$2"
    local audio_file="$3"
    local provider="${4:-openai}"

    vox_ensure_cache_dir

    local cached_audio=$(vox_get_cached_audio_path "$content_hash" "$voice" "$provider")

    cp "$audio_file" "$cached_audio"

    # Update index
    vox_cache_index_add "$content_hash" "$voice" "$cached_audio" "$provider"
}

# Add entry to cache index
vox_cache_index_add() {
    local content_hash="$1"
    local voice="$2"
    local audio_path="$3"
    local provider="${4:-openai}"

    local index_file=$(vox_get_cache_index_path)
    local audio_size=$(stat -f%z "$audio_path" 2>/dev/null || stat -c%s "$audio_path" 2>/dev/null)
    local timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)

    # Create index if doesn't exist
    if [[ ! -f "$index_file" ]]; then
        echo '{}' > "$index_file"
    fi

    # Update index with provider field
    local entry=$(cat <<EOF
{
  "hash": "$content_hash",
  "provider": "$provider",
  "voice": "$voice",
  "audio": "$audio_path",
  "size": $audio_size,
  "created": "$timestamp"
}
EOF
)

    # Append to index (JSONL format for simplicity)
    echo "$entry" >> "${index_file%.json}.jsonl"
}

# Show cache statistics
vox_cache_stats() {
    local cache_dir=$(vox_get_cache_dir)

    if [[ ! -d "$cache_dir" ]]; then
        echo "Cache is empty"
        return 0
    fi

    local total_files=$(find "$cache_dir" -name "*.mp3" 2>/dev/null | wc -l | tr -d ' ')
    local total_size=$(find "$cache_dir" -name "*.mp3" -exec stat -f%z {} \; 2>/dev/null | awk '{s+=$1} END {print s}')
    total_size=${total_size:-0}
    local size_mb=$(echo "scale=2; $total_size / 1048576" | bc)

    echo "Cache Statistics:"
    echo "  Location: $cache_dir"
    echo "  Files:    $total_files"
    echo "  Size:     ${size_mb} MB"

    # Count by provider
    echo ""
    echo "By provider:"
    find "$cache_dir" -name "*.mp3" 2>/dev/null | while read -r f; do
        basename "$f"
    done | awk -F'.' '{print $(NF-2)}' | sort | uniq -c | \
        awk '{printf "  %-10s %d files\n", $2, $1}'

    # Count by provider:voice
    echo ""
    echo "By provider:voice:"
    find "$cache_dir" -name "*.mp3" 2>/dev/null | while read -r f; do
        basename "$f"
    done | awk -F'.' '{print $(NF-2) ":" $(NF-1)}' | sort | uniq -c | \
        awk '{printf "  %-20s %d files\n", $2, $1}'
}

# Clean orphaned cache entries
vox_cache_clean() {
    local cache_dir=$(vox_get_cache_dir)
    local dry_run="${1:-false}"

    if [[ ! -d "$cache_dir" ]]; then
        echo "Cache is empty"
        return 0
    fi

    echo "Checking for orphaned cache files..."

    # For now, just report files (full cleanup logic later)
    local count=$(find "$cache_dir" -name "*.mp3" 2>/dev/null | wc -l)
    echo "Found $count cached audio files"

    if [[ "$dry_run" == "true" ]]; then
        echo "(Dry run - no files deleted)"
    fi
}

# Get cache info for specific content hash
vox_cache_info() {
    local content_hash="$1"

    local cache_dir=$(vox_get_cache_dir)
    local files=$(find "$cache_dir" -name "${content_hash}*.mp3" 2>/dev/null)

    if [[ -z "$files" ]]; then
        echo "No cached audio found for hash: $content_hash"
        return 1
    fi

    echo "Cached audio for content hash: ${content_hash:0:8}..."
    echo ""

    echo "$files" | while read -r file; do
        local voice=$(basename "$file" | sed "s/^${content_hash}\.\(.*\)\.mp3$/\1/")
        local size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null)
        local size_kb=$(echo "scale=1; $size / 1024" | bc)
        echo "  $voice: ${size_kb} KB"
    done
}
