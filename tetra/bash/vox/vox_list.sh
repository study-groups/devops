#!/usr/bin/env bash

# vox_list.sh - Enhanced listing for audio files, esto sources, and projects
# Provides rich metadata views beyond simple cache stats

source "${VOX_SRC}/vox_paths.sh"
source "${VOX_SRC}/vox_cache.sh"

# List MP3 files with metadata (default view)
vox_list_mp3() {
    local limit="${1:-20}"  # Show last 20 by default
    local search_paths=()

    # Add VOX_DIR/db as primary location
    local vox_db_dir=$(vox_get_db_dir)
    if [[ -d "$vox_db_dir" ]]; then
        search_paths+=("$vox_db_dir")
    fi

    # Add QA_DIR/db for legacy qa-generated files
    if [[ -n "$QA_DIR" && -d "$QA_DIR/db" ]]; then
        search_paths+=("$QA_DIR/db")
    fi

    # Add current directory if not already in paths
    if [[ "$PWD" != "$vox_db_dir" ]]; then
        search_paths+=("$PWD")
    fi

    echo "Recent Audio Files:"
    echo "────────────────────────────────────────────────────────────"
    printf "%-30s %-8s %-8s %-10s %s\n" "FILE" "VOICE" "SIZE" "DURATION" "GENERATED"
    echo "────────────────────────────────────────────────────────────"

    local count=0
    local found_files=false
    local temp_list=$(mktemp)

    # Collect all MP3 files from all search paths
    for dir in "${search_paths[@]}"; do
        if [[ ! -d "$dir" ]]; then
            continue
        fi

        # Find MP3 files with their mtime
        find "$dir" -maxdepth 2 -name "*.mp3" -type f 2>/dev/null | \
            xargs -I {} stat -f "%m %N" {} 2>/dev/null >> "$temp_list"
    done

    # Sort all files by mtime (newest first) and display
    if [[ -s "$temp_list" ]]; then
        found_files=true

        while IFS= read -r line; do
            local file=$(echo "$line" | cut -d' ' -f2-)

            if [[ -f "$file" ]]; then
                local basename=$(basename "$file")
                local voice=$(vox_extract_voice_from_filename "$basename")
                local size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null)
                local size_human=$(vox_human_size "$size")
                local duration=$(vox_get_duration "$file")
                local age=$(vox_file_age "$file")

                printf "%-30s %-8s %-8s %-10s %s\n" \
                    "${basename:0:30}" \
                    "${voice:-?}" \
                    "$size_human" \
                    "${duration:-?}" \
                    "$age"

                ((count++))
                if [[ $count -ge $limit ]]; then
                    break
                fi
            fi
        done < <(sort -rn "$temp_list" | cut -d' ' -f2-)
    fi

    rm -f "$temp_list"

    if [[ "$found_files" == "false" ]]; then
        echo "No MP3 files found"
    fi

    echo ""
    echo "Showing $count of $(vox_count_mp3_files) total files"
}

# List esto files with generation status
vox_list_esto() {
    local search_paths=("$PWD")

    echo "esto Files & Generated Audio:"
    echo "────────────────────────────────────────────────────────────"
    printf "%-25s %-10s %-20s %-8s %s\n" "SOURCE" "STATUS" "VOICES" "SPANS" "DURATION"
    echo "────────────────────────────────────────────────────────────"

    local found_files=false

    for dir in "${search_paths[@]}"; do
        if [[ ! -d "$dir" ]]; then
            continue
        fi

        while IFS= read -r esto_file; do
            if [[ -f "$esto_file" ]]; then
                found_files=true
                local basename=$(basename "$esto_file")
                local base_name="${basename%.esto}"

                # Check for generated audio
                local voices=$(vox_find_voices_for_esto "$esto_file")
                local status="✗ Draft"
                local spans="No"
                local total_duration=""

                if [[ -n "$voices" ]]; then
                    status="✓ Ready"
                    # Check for spans
                    if ls "${base_name}".vox.*.spans >/dev/null 2>&1; then
                        spans="Yes"
                    fi
                    # Get duration from first voice
                    local first_voice=$(echo "$voices" | head -n1)
                    local mp3_file="${base_name}.vox.${first_voice}.mp3"
                    if [[ -f "$mp3_file" ]]; then
                        total_duration=$(vox_get_duration "$mp3_file")
                    fi
                fi

                printf "%-25s %-10s %-20s %-8s %s\n" \
                    "${basename:0:25}" \
                    "$status" \
                    "${voices:0:20}" \
                    "$spans" \
                    "${total_duration:-?}"
            fi
        done < <(find "$dir" -maxdepth 2 -name "*.esto" -type f 2>/dev/null)
    done

    if [[ "$found_files" == "false" ]]; then
        echo "No esto files found"
    fi
}

# List recent N generated files
vox_list_recent() {
    local count="${1:-10}"

    echo "Last $count Generated Files:"
    echo "────────────────────────────────────────────────────────────"

    local search_paths=()

    # Add VOX_DIR/db as primary location
    local vox_db_dir=$(vox_get_db_dir)
    if [[ -d "$vox_db_dir" ]]; then
        search_paths+=("$vox_db_dir")
    fi

    # Add QA_DIR/db for legacy files
    if [[ -n "$QA_DIR" && -d "$QA_DIR/db" ]]; then
        search_paths+=("$QA_DIR/db")
    fi

    local files_found=0

    for dir in "${search_paths[@]}"; do
        if [[ ! -d "$dir" ]]; then
            continue
        fi

        while IFS= read -r file; do
            if [[ -f "$file" ]]; then
                local basename=$(basename "$file")
                local size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null)
                local size_human=$(vox_human_size "$size")
                local age=$(vox_file_age "$file")

                echo "$basename ($size_human, $age)"

                ((files_found++))
                if [[ $files_found -ge $count ]]; then
                    break 2
                fi
            fi
        done < <(find "$dir" -maxdepth 2 -name "*.mp3" -type f 2>/dev/null | \
                 xargs -I {} stat -f "%m %N" {} 2>/dev/null | \
                 sort -rn | cut -d' ' -f2-)
    done

    if [[ $files_found -eq 0 ]]; then
        echo "No MP3 files found"
    fi
}

# Project overview
vox_list_project() {
    echo "Project Overview:"
    echo "────────────────────────────────────────────────────────────"

    # Count esto files
    local esto_count=$(find "$PWD" -maxdepth 2 -name "*.esto" -type f 2>/dev/null | wc -l | tr -d ' ')

    # Count generated mp3s
    local mp3_count=$(find "$PWD" -maxdepth 2 -name "*.vox.*.mp3" -type f 2>/dev/null | wc -l | tr -d ' ')

    # Count with spans
    local spans_count=$(find "$PWD" -maxdepth 2 -name "*.vox.*.spans" -type f 2>/dev/null | wc -l | tr -d ' ')

    # Unique voices
    local voices=$(find "$PWD" -maxdepth 2 -name "*.vox.*.mp3" -type f 2>/dev/null | \
                   sed 's/.*\.vox\.\(.*\)\.mp3/\1/' | sort -u | tr '\n' ', ' | sed 's/,$//')

    # Total size
    local total_size=$(find "$PWD" -maxdepth 2 -name "*.vox.*.mp3" -type f -exec stat -f%z {} \; 2>/dev/null | awk '{s+=$1} END {print s}')
    total_size=${total_size:-0}
    local size_human=$(vox_human_size "$total_size")

    echo "Location:       $PWD"
    echo "esto files:     $esto_count"
    echo "Generated:      $mp3_count"
    echo "With spans:     $spans_count"
    echo "Voices:         ${voices:-none}"
    echo "Total size:     $size_human"
    echo ""

    # Cache stats
    vox_cache_stats
}

# Helper: Extract voice from filename (e.g., "file.vox.sally.mp3" → "sally")
vox_extract_voice_from_filename() {
    local filename="$1"
    if [[ "$filename" =~ \.vox\.([a-z]+)\.mp3$ ]]; then
        echo "${BASH_REMATCH[1]}"
    fi
}

# Helper: Get audio duration (placeholder - would use ffprobe/mediainfo in reality)
vox_get_duration() {
    local file="$1"

    # Try with ffprobe if available
    if command -v ffprobe &>/dev/null; then
        local duration=$(ffprobe -v error -show_entries format=duration \
                        -of default=noprint_wrappers=1:nokey=1 "$file" 2>/dev/null)
        if [[ -n "$duration" ]]; then
            vox_format_duration "$duration"
            return
        fi
    fi

    # Fallback: estimate from file size (rough: ~16KB/sec for typical MP3)
    local size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null)
    local estimated_seconds=$(echo "$size / 16000" | bc)
    vox_format_duration "$estimated_seconds"
}

# Helper: Format duration in seconds to MM:SS
vox_format_duration() {
    local seconds="${1%.*}"  # Remove decimals
    local minutes=$((seconds / 60))
    local secs=$((seconds % 60))
    printf "%d:%02d" "$minutes" "$secs"
}

# Helper: Get file age as human-readable string
vox_file_age() {
    local file="$1"
    local now=$(date +%s)
    local mtime=$(stat -f%m "$file" 2>/dev/null || stat -c%Y "$file" 2>/dev/null)
    local age=$((now - mtime))

    if [[ $age -lt 60 ]]; then
        echo "${age}s ago"
    elif [[ $age -lt 3600 ]]; then
        echo "$((age / 60))m ago"
    elif [[ $age -lt 86400 ]]; then
        echo "$((age / 3600))h ago"
    else
        echo "$((age / 86400))d ago"
    fi
}

# Helper: Convert bytes to human-readable size
vox_human_size() {
    local bytes="$1"
    if [[ $bytes -lt 1024 ]]; then
        echo "${bytes}B"
    elif [[ $bytes -lt 1048576 ]]; then
        echo "$(echo "scale=1; $bytes / 1024" | bc)K"
    else
        echo "$(echo "scale=1; $bytes / 1048576" | bc)M"
    fi
}

# Helper: Count total MP3 files
vox_count_mp3_files() {
    local count=0
    local vox_db_dir=$(vox_get_db_dir)
    local search_dirs=()

    [[ -d "$vox_db_dir" ]] && search_dirs+=("$vox_db_dir")
    [[ -n "$QA_DIR" && -d "$QA_DIR/db" ]] && search_dirs+=("$QA_DIR/db")

    if [[ ${#search_dirs[@]} -gt 0 ]]; then
        count=$(find "${search_dirs[@]}" -maxdepth 1 -name "*.vox.*.mp3" -type f 2>/dev/null | wc -l | tr -d ' ')
    fi

    echo "$count"
}

# Helper: Find voices that have been generated for an esto file
vox_find_voices_for_esto() {
    local esto_file="$1"
    local base_name=$(basename "${esto_file%.esto}")
    local dir=$(dirname "$esto_file")

    find "$dir" -maxdepth 1 -name "${base_name}.vox.*.mp3" -type f 2>/dev/null | \
        sed 's/.*\.vox\.\(.*\)\.mp3/\1/' | tr '\n' ' ' | sed 's/ $//'
}

# Export functions
export -f vox_list_mp3
export -f vox_list_esto
export -f vox_list_recent
export -f vox_list_project
