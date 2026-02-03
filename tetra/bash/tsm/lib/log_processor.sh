#!/usr/bin/env bash
# TSM Log Processor - semantic log classification and indexing
# Requires: bash 5.2+

# === TIMESTAMP ===

# Compact ISO 8601 timestamp (matches terrain format)
# Format: YYYYMMDDTHHMMSS.mmmZ
_tsm_compact_ts() {
    tsm_timestamp  # Use existing function from time.sh
}


# === LINE CLASSIFICATION ===

# Classify a log line and emit to index.log
# Usage: _tsm_classify_line <proc_dir> <line> [line_num]
# Types: startup, http, keyword, error, noise, log
_tsm_classify_line() {
    local proc_dir="$1"
    local line="$2"
    local line_num="${3:-0}"

    local ts
    ts=$(_tsm_compact_ts)
    local type="log"
    local msg="$line"

    # Skip empty lines
    [[ -z "$line" ]] && return 0

    # Strip ANSI escape codes for classification
    local clean_line
    clean_line=$(printf '%s' "$line" | sed 's/\x1b\[[0-9;]*m//g')

    # === TYPE CLASSIFICATION (order matters: specific patterns first) ===

    # HTTP access log pattern: IP - - [date] "METHOD path HTTP/..." status
    # Check this first - it's a specific pattern that shouldn't be treated as startup
    if [[ "$clean_line" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+\ -\ -\ \[ ]]; then
        type="http"
        # Extract: METHOD /path → STATUS
        if [[ "$clean_line" =~ \"([A-Z]+)\ ([^\ \"]+)[^\"]*\"\ ([0-9]+) ]]; then
            local method="${BASH_REMATCH[1]}"
            local path="${BASH_REMATCH[2]}"
            local status="${BASH_REMATCH[3]}"
            # Truncate long paths (keep first 30 chars + ... if longer)
            if [[ ${#path} -gt 35 ]]; then
                path="${path:0:30}..."
            fi
            msg="$method $path → $status"
        fi

    # Error detection: ERROR, Exception, Traceback
    elif [[ "$clean_line" =~ (ERROR|Exception|Traceback|FATAL|CRITICAL) ]]; then
        type="error"
        msg="$clean_line"

    # Startup: First 10 lines after start (non-HTTP, non-error)
    elif [[ $line_num -le 10 ]]; then
        type="startup"
        msg="$clean_line"

    # Keyword match (check per-service keywords.txt)
    elif [[ -f "$proc_dir/keywords.txt" ]]; then
        # Check if line contains any keyword
        while IFS= read -r keyword || [[ -n "$keyword" ]]; do
            [[ -z "$keyword" || "$keyword" =~ ^# ]] && continue
            if [[ "$clean_line" == *"$keyword"* ]]; then
                type="keyword"
                break
            fi
        done < "$proc_dir/keywords.txt"
    fi

    # Write to index.log
    echo "$ts $type $msg" >> "$proc_dir/index.log"
}

# === NOISE DETECTION ===

# Track repeated patterns for noise detection
# Uses simple hash of pattern skeleton
declare -gA _TSM_PATTERN_COUNTS

# Get pattern skeleton (replace dynamic parts with placeholders)
_tsm_pattern_skeleton() {
    local line="$1"
    # Replace: UUIDs, hashes, timestamps, IPs, numbers
    printf '%s' "$line" | sed -E \
        -e 's/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/UUID/g' \
        -e 's/[0-9a-f]{12,}/HASH/g' \
        -e 's/[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+/IP/g' \
        -e 's/\[[0-9]{2}\/[A-Za-z]{3}\/[0-9]{4}[^]]*\]/[DATE]/g' \
        -e 's/[0-9]+/N/g'
}

# Process line with noise detection (used in batch processing)
_tsm_process_with_noise() {
    local proc_dir="$1"
    local line="$2"
    local line_num="$3"

    local skeleton
    skeleton=$(_tsm_pattern_skeleton "$line")
    local key="${skeleton:0:100}"  # Limit key length

    # Increment count
    local count="${_TSM_PATTERN_COUNTS[$key]:-0}"
    ((count++))
    _TSM_PATTERN_COUNTS[$key]="$count"

    # If pattern repeated 3+ times, mark as noise
    if [[ $count -ge 3 ]]; then
        local ts
        ts=$(_tsm_compact_ts)
        # Only emit aggregate on 3rd occurrence, then every 10th
        if [[ $count -eq 3 || $((count % 10)) -eq 0 ]]; then
            # Get a representative message (shortened)
            local short_msg="${line:0:50}..."
            echo "$ts noise $short_msg [${count}x]" >> "$proc_dir/index.log"
        fi
        return 0
    fi

    # Normal classification
    _tsm_classify_line "$proc_dir" "$line" "$line_num"
}

# === STREAM PROCESSING ===

# Process log stream in real-time
# Usage: _tsm_log_stream <proc_dir>
# Reads from stdin, writes raw to stdout, classifies to index.log
_tsm_log_stream() {
    local proc_dir="$1"
    local line_num=0

    # Initialize/clear pattern counts
    _TSM_PATTERN_COUNTS=()

    while IFS= read -r line || [[ -n "$line" ]]; do
        ((line_num++))

        # Echo raw line to stdout (for normal log file)
        printf '%s\n' "$line"

        # Classify and write to index.log
        _tsm_classify_line "$proc_dir" "$line" "$line_num"
    done
}

# === TIMEZONE CACHE ===

# Get cached timezone info, regenerate if stale (>24h) or missing
# Returns: "ABBREV|NAME|OFFSET|REGION"
# Example: "PST|America/Los_Angeles|-0800|California, US"
_tsm_get_tz_info() {
    # Cache in TSM runtime dir (computed at call time)
    local cache="${TSM_PROCESSES_DIR%/processes}/tz_cache"
    local now_day
    now_day=$(date +%Y%m%d)

    # Check cache validity (same day)
    if [[ -f "$cache" ]]; then
        local cache_day
        cache_day=$(head -1 "$cache" 2>/dev/null | cut -d'|' -f1)
        if [[ "$cache_day" == "$now_day" ]]; then
            tail -1 "$cache"
            return 0
        fi
    fi

    # Regenerate cache
    _tsm_refresh_tz_cache "$cache"
    tail -1 "$cache" 2>/dev/null
}

# Refresh the timezone cache
# Usage: _tsm_refresh_tz_cache [cache_path]
_tsm_refresh_tz_cache() {
    local cache="${1:-${TSM_PROCESSES_DIR%/processes}/tz_cache}"
    local now_day
    now_day=$(date +%Y%m%d)

    # Get timezone abbreviation (PST, EST, etc.)
    local tz_abbrev
    tz_abbrev=$(date +%Z 2>/dev/null || echo "UTC")

    # Get full timezone name
    local tz_name="${TZ:-}"
    if [[ -z "$tz_name" && -L /etc/localtime ]]; then
        tz_name=$(readlink /etc/localtime | sed 's|.*/zoneinfo/||')
    fi
    [[ -z "$tz_name" ]] && tz_name="UTC"

    # Get UTC offset (-0800, +0530, etc.)
    local tz_offset
    tz_offset=$(date +%z 2>/dev/null || echo "+0000")

    # Derive region from timezone name
    # America/Los_Angeles → California, US
    # Europe/London → London, UK
    # Asia/Tokyo → Tokyo, JP
    local region=""
    case "$tz_name" in
        America/Los_Angeles)  region="California, US" ;;
        America/New_York)     region="New York, US" ;;
        America/Chicago)      region="Chicago, US" ;;
        America/Denver)       region="Denver, US" ;;
        America/Phoenix)      region="Arizona, US" ;;
        America/Anchorage)    region="Alaska, US" ;;
        America/Honolulu)     region="Hawaii, US" ;;
        Europe/London)        region="London, UK" ;;
        Europe/Paris)         region="Paris, FR" ;;
        Europe/Berlin)        region="Berlin, DE" ;;
        Asia/Tokyo)           region="Tokyo, JP" ;;
        Asia/Shanghai)        region="Shanghai, CN" ;;
        Asia/Kolkata)         region="India" ;;
        Australia/Sydney)     region="Sydney, AU" ;;
        Pacific/Auckland)     region="Auckland, NZ" ;;
        UTC|Etc/UTC)          region="UTC" ;;
        *)
            # Extract city from path (America/Los_Angeles → Los Angeles)
            region=$(echo "$tz_name" | sed 's|.*/||; s/_/ /g')
            ;;
    esac

    # Ensure cache directory exists
    mkdir -p "$(dirname "$cache")"

    # Write cache: day marker on line 1, data on line 2
    {
        echo "$now_day|cache"
        echo "$tz_abbrev|$tz_name|$tz_offset|$region"
    } > "$cache"
}

# === INDEX HEADER ===

# Write index.log header with timezone and metadata
# Usage: _tsm_write_index_header <index_log_path> [proc_name]
_tsm_write_index_header() {
    local index_log="$1"
    local proc_name="${2:-}"
    local ts
    ts=$(_tsm_compact_ts)

    # Get cached timezone info
    local tz_info
    tz_info=$(_tsm_get_tz_info)

    local tz_abbrev tz_name tz_offset region
    IFS='|' read -r tz_abbrev tz_name tz_offset region <<< "$tz_info"

    echo "# TSM Smart Log Index" > "$index_log"
    echo "# TZ: $tz_abbrev ($tz_name) $tz_offset — $region" >> "$index_log"
    echo "# Timestamps: UTC (Z suffix)" >> "$index_log"
    echo "# Created: $ts" >> "$index_log"
    [[ -n "$proc_name" ]] && echo "# Process: $proc_name" >> "$index_log"
    echo "#" >> "$index_log"
}

# === BATCH PROCESSING ===

# Process existing log files to generate index.log
# Usage: _tsm_index_logs <proc_dir>
_tsm_index_logs() {
    local proc_dir="$1"
    local log_out="$proc_dir/current.out"
    local log_err="$proc_dir/current.err"
    local index_log="$proc_dir/index.log"
    local proc_name
    proc_name=$(basename "$proc_dir")

    # Write header
    _tsm_write_index_header "$index_log" "$proc_name"

    # Reset pattern counts
    _TSM_PATTERN_COUNTS=()

    local line_num=0

    # Process stdout
    if [[ -f "$log_out" && -s "$log_out" ]]; then
        while IFS= read -r line || [[ -n "$line" ]]; do
            ((line_num++))
            _tsm_process_with_noise "$proc_dir" "$line" "$line_num"
        done < "$log_out"
    fi

    # Process stderr
    if [[ -f "$log_err" && -s "$log_err" ]]; then
        while IFS= read -r line || [[ -n "$line" ]]; do
            ((line_num++))
            _tsm_process_with_noise "$proc_dir" "$line" "$line_num"
        done < "$log_err"
    fi
}

# === SMART LOG DISPLAY ===

# Display smart logs from index.log
# Usage: _tsm_show_smart_logs <proc_dir> [lines]
_tsm_show_smart_logs() {
    local proc_dir="$1"
    local lines="${2:-50}"
    local index_log="$proc_dir/index.log"

    if [[ ! -f "$index_log" ]]; then
        # Generate index on demand
        _tsm_index_logs "$proc_dir"
    fi

    if [[ ! -f "$index_log" || ! -s "$index_log" ]]; then
        echo "(no indexed log entries)"
        return 0
    fi

    tail -"$lines" "$index_log"
}
