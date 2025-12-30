#!/usr/bin/env bash

# vox_paths.sh - Centralized path construction
# All paths built programmatically from directory + basename

# Global vox base directory
vox_get_base_dir() {
    echo "${VOX_DIR:-$TETRA_DIR/vox}"
}

# Global cache directory
vox_get_cache_dir() {
    echo "$(vox_get_base_dir)/cache"
}

# Database directory (timestamp-keyed files like QA_DIR/db)
vox_get_db_dir() {
    echo "$(vox_get_base_dir)/db"
}

# Get cache path for content hash + provider + voice
# New format: {hash}.{provider}.{voice}.mp3
# Legacy format (for migration): {hash}.{voice}.mp3
vox_get_cached_audio_path() {
    local content_hash="$1"
    local voice="$2"
    local provider="${3:-openai}"
    local cache_dir=$(vox_get_cache_dir)
    echo "${cache_dir}/${content_hash}.${provider}.${voice}.mp3"
}

vox_get_cached_spans_path() {
    local content_hash="$1"
    local voice="$2"
    local provider="${3:-openai}"
    local cache_dir=$(vox_get_cache_dir)
    echo "${cache_dir}/${content_hash}.${provider}.${voice}.spans"
}

vox_get_cached_meta_path() {
    local content_hash="$1"
    local voice="$2"
    local provider="${3:-openai}"
    local cache_dir=$(vox_get_cache_dir)
    echo "${cache_dir}/${content_hash}.${provider}.${voice}.meta"
}

# Legacy path lookup (for cache migration)
vox_get_legacy_cached_audio_path() {
    local content_hash="$1"
    local voice="$2"
    local cache_dir=$(vox_get_cache_dir)
    echo "${cache_dir}/${content_hash}.${voice}.mp3"
}

# Get cache index file
vox_get_cache_index_path() {
    local cache_dir=$(vox_get_cache_dir)
    echo "${cache_dir}/index.json"
}

# Calculate content hash for file
vox_get_content_hash() {
    local filepath="$1"

    if [[ -f "$filepath" ]]; then
        shasum -a 256 "$filepath" | awk '{print $1}'
    else
        echo "Error: File not found: $filepath" >&2
        return 1
    fi
}

# Calculate content hash from stdin
vox_hash_content() {
    shasum -a 256 | awk '{print $1}'
}

# Extract basename without extension
vox_get_basename() {
    local filepath="$1"
    local filename=$(basename "$filepath")
    echo "${filename%.*}"
}

# Ensure cache directory exists
vox_ensure_cache_dir() {
    local cache_dir=$(vox_get_cache_dir)
    mkdir -p "$cache_dir"
}

# Ensure db directory exists
vox_ensure_db_dir() {
    local db_dir=$(vox_get_db_dir)
    mkdir -p "$db_dir"
}

# Generate timestamp-based paths for db files
vox_get_db_audio_path() {
    local timestamp="$1"
    local voice="$2"
    local db_dir=$(vox_get_db_dir)
    echo "${db_dir}/${timestamp}.vox.${voice}.mp3"
}

vox_get_db_meta_path() {
    local timestamp="$1"
    local voice="$2"
    local db_dir=$(vox_get_db_dir)
    echo "${db_dir}/${timestamp}.vox.${voice}.meta"
}

vox_get_db_spans_path() {
    local timestamp="$1"
    local voice="$2"
    local db_dir=$(vox_get_db_dir)
    echo "${db_dir}/${timestamp}.vox.${voice}.spans"
}

vox_get_db_esto_path() {
    local timestamp="$1"
    local db_dir=$(vox_get_db_dir)
    echo "${db_dir}/${timestamp}.esto"
}

# Generate timestamp (Unix epoch seconds)
vox_generate_timestamp() {
    date +%s
}
