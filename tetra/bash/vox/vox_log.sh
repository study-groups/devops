#!/usr/bin/env bash

# vox_log.sh - Transaction logging system for vox
# Tracks all audio generations with full metadata

source "${VOX_SRC}/vox_paths.sh"

# Get transaction log path
vox_log_get_path() {
    echo "$VOX_DIR/transactions.jsonl"
}

# Log a transaction
vox_log_transaction() {
    local type="$1"              # generate, play
    local command="$2"           # Command executed
    local source_type="$3"       # qa, esto, stdin
    local source_id="$4"         # ID or path
    local output_file="$5"       # Audio file path
    local voice="$6"             # Voice used
    local cost="${7:-0}"         # API cost
    local cache_hit="${8:-false}" # Was it cached?

    local log_file=$(vox_log_get_path)
    local timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)

    # Ensure log directory exists
    mkdir -p "$(dirname "$log_file")"

    # Get output file metadata
    local audio_size=0
    local duration=0
    local meta_file=""

    if [[ -f "$output_file" ]]; then
        audio_size=$(stat -f%z "$output_file" 2>/dev/null || stat -c%s "$output_file" 2>/dev/null)

        # Try to get duration from metadata
        meta_file="${output_file%.mp3}.meta"
        if [[ -f "$meta_file" ]]; then
            duration=$(jq -r '.duration // 0' "$meta_file" 2>/dev/null)
        fi
    fi

    # Build JSON entry
    local entry=$(jq -nc \
        --arg timestamp "$timestamp" \
        --arg type "$type" \
        --arg command "$command" \
        --arg source_type "$source_type" \
        --arg source_id "$source_id" \
        --arg output_file "$output_file" \
        --arg meta_file "$meta_file" \
        --argjson audio_size "$audio_size" \
        --argjson duration "$duration" \
        --arg voice "$voice" \
        --argjson cost "$cost" \
        --argjson cache_hit "$cache_hit" \
        '{
            timestamp: $timestamp,
            type: $type,
            command: $command,
            source: {
                type: $source_type,
                id: $source_id
            },
            output: {
                audio: $output_file,
                meta: $meta_file,
                size: $audio_size,
                duration: $duration
            },
            voice: $voice,
            cost: $cost,
            cache_hit: $cache_hit
        }')

    # Append to log
    echo "$entry" >> "$log_file"
}

# Retrofit existing file into log
vox_log_retrofit() {
    local audio_file="$1"

    if [[ ! -f "$audio_file" ]]; then
        echo "Error: File not found: $audio_file" >&2
        return 1
    fi

    local log_file=$(vox_log_get_path)
    local basename=$(basename "$audio_file")

    # Extract info from filename
    local voice=$(echo "$basename" | sed 's/.*\.vox\.\(.*\)\.mp3/\1/')
    local source_id=$(echo "$basename" | sed 's/\(.*\)\.vox\..*/\1/')

    # Determine source type
    local source_type="unknown"
    local source_path=$(dirname "$audio_file")

    if [[ "$source_path" == *"/qa/db" ]]; then
        source_type="qa"
    elif [[ -f "${source_id}.esto" ]]; then
        source_type="esto"
    fi

    # Get file metadata
    local audio_size=$(stat -f%z "$audio_file" 2>/dev/null || stat -c%s "$audio_file" 2>/dev/null)
    local file_mtime=$(stat -f%m "$audio_file" 2>/dev/null || stat -c%Y "$audio_file" 2>/dev/null)
    local timestamp=$(date -u -r "$file_mtime" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d "@$file_mtime" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null)
    local retrofit_timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)

    # Try to get metadata from .meta file
    local meta_file="${audio_file%.mp3}.meta"
    local duration=0
    local cost=0
    local char_count=0

    if [[ -f "$meta_file" ]]; then
        duration=$(jq -r '.duration // 0' "$meta_file" 2>/dev/null)
        cost=$(jq -r '.cost // 0' "$meta_file" 2>/dev/null)
        char_count=$(jq -r '.char_count // 0' "$meta_file" 2>/dev/null)
    else
        # Estimate cost from file size (rough)
        local estimated_chars=$((audio_size * 3))  # Very rough estimate
        cost=$(echo "scale=6; $estimated_chars * 15 / 1000000" | bc)
    fi

    mkdir -p "$(dirname "$log_file")"

    # Build retrofit entry
    local entry=$(jq -nc \
        --arg timestamp "$timestamp" \
        --arg type "generate" \
        --arg source_type "$source_type" \
        --arg source_id "$source_id" \
        --arg output_file "$audio_file" \
        --arg meta_file "$meta_file" \
        --argjson audio_size "$audio_size" \
        --argjson duration "$duration" \
        --arg voice "$voice" \
        --argjson cost "$cost" \
        --argjson cache_hit false \
        --argjson retrofitted true \
        --arg retrofit_timestamp "$retrofit_timestamp" \
        '{
            timestamp: $timestamp,
            type: $type,
            command: null,
            source: {
                type: $source_type,
                id: $source_id
            },
            output: {
                audio: $output_file,
                meta: $meta_file,
                size: $audio_size,
                duration: $duration
            },
            voice: $voice,
            cost: $cost,
            cache_hit: $cache_hit,
            retrofitted: $retrofitted,
            retrofit_timestamp: $retrofit_timestamp
        }')

    echo "$entry" >> "$log_file"
    echo "Retrofitted: $audio_file"
}

# Scan and retrofit all MP3 files
vox_log_retrofit_scan() {
    local search_paths=()

    # Add VOX_DIR/db if exists (primary location)
    local vox_db_dir=$(vox_get_db_dir)
    if [[ -d "$vox_db_dir" ]]; then
        search_paths+=("$vox_db_dir")
    fi

    # Add QA_DIR/db if exists (legacy location for qa-generated files)
    if [[ -n "$QA_DIR" && -d "$QA_DIR/db" ]]; then
        search_paths+=("$QA_DIR/db")
    fi

    # Add current directory if it has vox files
    if ls *.vox.*.mp3 >/dev/null 2>&1; then
        search_paths+=("$PWD")
    fi

    echo "Scanning for MP3 files to retrofit..."
    local count=0

    for dir in "${search_paths[@]}"; do
        if [[ ! -d "$dir" ]]; then
            continue
        fi

        while IFS= read -r file; do
            if [[ -f "$file" ]] && [[ "$file" =~ \.vox\..*\.mp3$ ]]; then
                vox_log_retrofit "$file"
                ((count++))
            fi
        done < <(find "$dir" -maxdepth 2 -name "*.vox.*.mp3" -type f 2>/dev/null)
    done

    echo ""
    echo "Retrofitted $count files"
}

# Query transaction log
vox_log_query() {
    local log_file=$(vox_log_get_path)

    if [[ ! -f "$log_file" ]]; then
        echo "No transaction log found"
        return 1
    fi

    local limit=20
    local voice_filter=""
    local source_type_filter=""
    local cache_hit_filter=""
    local since=""

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --limit)
                limit="$2"
                shift 2
                ;;
            --voice)
                voice_filter="$2"
                shift 2
                ;;
            --source-type)
                source_type_filter="$2"
                shift 2
                ;;
            --cache-hit)
                cache_hit_filter="true"
                shift
                ;;
            --cache-miss)
                cache_hit_filter="false"
                shift
                ;;
            --since)
                since="$2"
                shift 2
                ;;
            *)
                shift
                ;;
        esac
    done

    # Build jq filter
    local jq_filter='.'

    if [[ -n "$voice_filter" ]]; then
        jq_filter="$jq_filter | select(.voice == \"$voice_filter\")"
    fi

    if [[ -n "$source_type_filter" ]]; then
        jq_filter="$jq_filter | select(.source.type == \"$source_type_filter\")"
    fi

    if [[ -n "$cache_hit_filter" ]]; then
        jq_filter="$jq_filter | select(.cache_hit == $cache_hit_filter)"
    fi

    # Apply filters and get results
    cat "$log_file" | jq -c "$jq_filter" | tail -n "$limit"
}

# Format transaction for display
vox_log_format_entry() {
    local entry="$1"

    local timestamp=$(echo "$entry" | jq -r '.timestamp')
    local audio=$(echo "$entry" | jq -r '.output.audio | split("/") | .[-1]')
    local voice=$(echo "$entry" | jq -r '.voice')
    local cost=$(echo "$entry" | jq -r '.cost')
    local cache_hit=$(echo "$entry" | jq -r '.cache_hit')

    # Format timestamp
    local ts_display=$(echo "$timestamp" | cut -dT -f1,2 | tr T ' ')

    # Format cache status
    local cache_display="MISS"
    if [[ "$cache_hit" == "true" ]]; then
        cache_display="HIT "
    fi

    # Format cost
    local cost_display=$(printf "\$%.3f" "$cost")

    printf "%-19s %-30s %-8s %-8s %s\n" \
        "$ts_display" \
        "${audio:0:30}" \
        "$voice" \
        "$cost_display" \
        "$cache_display"
}

# Show transaction log statistics
vox_log_stats() {
    local log_file=$(vox_log_get_path)

    if [[ ! -f "$log_file" ]]; then
        echo "No transaction log found"
        return 1
    fi

    echo "Transaction Log Statistics:"
    echo "────────────────────────────────────"

    local total=$(wc -l < "$log_file" | tr -d ' ')
    local cache_hits=$(grep -c '"cache_hit":true' "$log_file" 2>/dev/null || true)
    cache_hits=${cache_hits:-0}
    local cache_misses=$((total - cache_hits))
    local total_cost=$(jq -s 'map(.cost) | add' "$log_file" 2>/dev/null || echo "0")

    echo "Total generations:  $total"

    # Avoid division by zero
    if [[ $total -gt 0 ]]; then
        echo "Cache hits:         $cache_hits ($(echo "scale=1; $cache_hits * 100 / $total" | bc)%)"
        echo "Cache misses:       $cache_misses ($(echo "scale=1; $cache_misses * 100 / $total" | bc)%)"
    else
        echo "Cache hits:         $cache_hits"
        echo "Cache misses:       $cache_misses"
    fi

    echo "Total cost:         \$$total_cost USD"
    echo ""

    # By voice
    echo "By voice:"
    jq -s 'group_by(.voice) | map({voice: .[0].voice, count: length, cost: map(.cost) | add}) | .[]' "$log_file" 2>/dev/null | \
        jq -r '"\(.voice): \(.count) files, $\(.cost)"' | \
        awk '{printf "  %-10s %s\n", $1, $2, $3, $4}'

    echo ""

    # By source type
    echo "By source:"
    jq -s 'group_by(.source.type) | map({type: .[0].source.type, count: length}) | .[]' "$log_file" 2>/dev/null | \
        jq -r '"\(.type): \(.count) files"' | \
        awk '{printf "  %-10s %s\n", $1, $2, $3}'
}

# Export functions
export -f vox_log_transaction
export -f vox_log_retrofit
export -f vox_log_retrofit_scan
export -f vox_log_query
export -f vox_log_format_entry
export -f vox_log_stats
