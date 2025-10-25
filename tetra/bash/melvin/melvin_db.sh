#!/usr/bin/env bash

# MELVIN DB - Granular Database for Module Check Results
# Stores timestamped records organized by module and checktype
# Format: $TETRA_DIR/melvin/db/timestamp.module.checktype.jsonl

# Strong globals
: "${MELVIN_SRC:=$TETRA_SRC/bash/melvin}"
: "${MELVIN_DIR:=$TETRA_DIR/melvin}"

MELVIN_DB_DIR="$MELVIN_DIR/db"

# Save a database record
# Usage: melvin_db_save <module> <checktype> <data>
melvin_db_save() {
    local module="$1"
    local checktype="$2"
    local data="$3"

    if [[ -z "$module" ]] || [[ -z "$checktype" ]] || [[ -z "$data" ]]; then
        echo "Usage: db save <module> <checktype> <data>"
        return 1
    fi

    # Create db directory if needed
    mkdir -p "$MELVIN_DB_DIR"

    # Generate filename: timestamp.module.checktype.jsonl
    local timestamp=$(date +%s)
    local filename="${timestamp}.${module}.${checktype}.jsonl"
    local filepath="$MELVIN_DB_DIR/$filename"

    # Save as JSONL
    local iso_timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local session_id=$$

    # Create JSON record with escaped data
    local escaped_data=$(echo "$data" | sed 's/"/\\"/g' | sed 's/\\/\\\\/g')

    printf '{"timestamp":"%s","session_id":"%s","module":"%s","checktype":"%s","data":"%s"}\n' \
        "$iso_timestamp" "$session_id" "$module" "$checktype" "$escaped_data" >> "$filepath"

    echo "Saved: $filename"
}

# Query by module - find all records for a module
# Usage: melvin_db_query_module <module> [checktype]
melvin_db_query_module() {
    local module="$1"
    local checktype="$2"

    if [[ -z "$module" ]]; then
        echo "Usage: db query module <module> [checktype]"
        return 1
    fi

    if [[ ! -d "$MELVIN_DB_DIR" ]]; then
        echo "No database found"
        return 0
    fi

    echo "Query: module=$module${checktype:+ checktype=$checktype}"
    echo "=========================================="
    echo ""

    local count=0
    for file in "$MELVIN_DB_DIR"/*.jsonl; do
        [[ ! -f "$file" ]] && continue

        local filename=$(basename "$file")
        local mod=$(echo "$filename" | cut -d. -f2)

        # Filter by module
        [[ "$mod" != "$module" ]] && continue

        # Filter by checktype if specified
        if [[ -n "$checktype" ]]; then
            local check=$(echo "$filename" | cut -d. -f3)
            [[ "$check" != "$checktype" ]] && continue
        fi

        local timestamp=$(echo "$filename" | cut -d. -f1)
        local check=$(echo "$filename" | cut -d. -f3)

        local date_str=$(date -r "$timestamp" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "$timestamp")

        echo "[$date_str] $mod/$check"
        echo "  File: $filename"
        echo ""

        ((count++))
    done

    echo "Found: $count records"
}

# Query by checktype - find all records for a checktype across modules
# Usage: melvin_db_query_checktype <checktype> [module]
melvin_db_query_checktype() {
    local checktype="$1"
    local module="$2"

    if [[ -z "$checktype" ]]; then
        echo "Usage: db query checktype <checktype> [module]"
        return 1
    fi

    if [[ ! -d "$MELVIN_DB_DIR" ]]; then
        echo "No database found"
        return 0
    fi

    echo "Query: checktype=$checktype${module:+ module=$module}"
    echo "=========================================="
    echo ""

    local count=0
    for file in "$MELVIN_DB_DIR"/*.${checktype}.jsonl; do
        [[ ! -f "$file" ]] && continue

        local filename=$(basename "$file")

        # Filter by module if specified
        if [[ -n "$module" ]]; then
            local mod=$(echo "$filename" | cut -d. -f2)
            [[ "$mod" != "$module" ]] && continue
        fi

        local timestamp=$(echo "$filename" | cut -d. -f1)
        local mod=$(echo "$filename" | cut -d. -f2)

        local date_str=$(date -r "$timestamp" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "$timestamp")

        echo "[$date_str] $mod/$checktype"
        echo "  File: $filename"
        echo ""

        ((count++))
    done

    echo "Found: $count records"
}

# Query by time range - find records within a time window
# Usage: melvin_db_query_time <start_timestamp> [end_timestamp]
melvin_db_query_time() {
    local start_ts="$1"
    local end_ts="${2:-$(date +%s)}"

    if [[ -z "$start_ts" ]]; then
        echo "Usage: db query time <start_timestamp> [end_timestamp]"
        echo "Examples:"
        echo "  db query time 1761397000            # From timestamp to now"
        echo "  db query time 1761397000 1761398000 # Range"
        echo "  db query time -3600                 # Last hour (negative = relative)"
        return 1
    fi

    # Handle relative timestamps (negative means "seconds ago")
    if [[ $start_ts -lt 0 ]]; then
        start_ts=$(( $(date +%s) + start_ts ))
    fi

    if [[ ! -d "$MELVIN_DB_DIR" ]]; then
        echo "No database found"
        return 0
    fi

    local start_date=$(date -r "$start_ts" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "$start_ts")
    local end_date=$(date -r "$end_ts" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "$end_ts")

    echo "Query: time range"
    echo "  From: $start_date"
    echo "    To: $end_date"
    echo "=========================================="
    echo ""

    local count=0
    for file in "$MELVIN_DB_DIR"/*.jsonl; do
        [[ ! -f "$file" ]] && continue

        local filename=$(basename "$file")
        local timestamp=$(echo "$filename" | cut -d. -f1)

        # Check if in range
        if [[ $timestamp -ge $start_ts ]] && [[ $timestamp -le $end_ts ]]; then
            local mod=$(echo "$filename" | cut -d. -f2)
            local check=$(echo "$filename" | cut -d. -f3)
            local date_str=$(date -r "$timestamp" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "$timestamp")

            echo "[$date_str] $mod/$check"
            echo "  File: $filename"
            echo ""

            ((count++))
        fi
    done

    echo "Found: $count records"
}

# Show a specific database record
# Usage: melvin_db_show <timestamp|filename>
melvin_db_show() {
    local query="$1"

    if [[ -z "$query" ]]; then
        echo "Usage: db show <timestamp|filename>"
        return 1
    fi

    # Find the file
    local file=""
    if [[ -f "$MELVIN_DB_DIR/$query" ]]; then
        file="$MELVIN_DB_DIR/$query"
    else
        # Try to find by timestamp prefix
        file=$(find "$MELVIN_DB_DIR" -name "${query}*.jsonl" -type f 2>/dev/null | head -n1)
    fi

    if [[ -z "$file" ]] || [[ ! -f "$file" ]]; then
        echo "Record not found: $query"
        return 1
    fi

    local filename=$(basename "$file")
    local timestamp=$(echo "$filename" | cut -d. -f1)
    local module=$(echo "$filename" | cut -d. -f2)
    local checktype=$(echo "$filename" | cut -d. -f3)
    local date_str=$(date -r "$timestamp" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "$timestamp")

    echo "Database Record"
    echo "==============="
    echo "Date: $date_str"
    echo "Module: $module"
    echo "Checktype: $checktype"
    echo "File: $filename"
    echo ""

    # Parse JSON
    if command -v jq >/dev/null 2>&1; then
        jq '.' "$file"
    else
        cat "$file"
    fi
}

# Search database by content (semantic search using ripgrep)
# Usage: melvin_db_search <query>
melvin_db_search() {
    local query="$1"

    if [[ -z "$query" ]]; then
        echo "Usage: db search <query>"
        return 1
    fi

    if [[ ! -d "$MELVIN_DB_DIR" ]]; then
        echo "No database found"
        return 0
    fi

    echo "Searching for: $query"
    echo "===================="
    echo ""

    local count=0
    for file in "$MELVIN_DB_DIR"/*.jsonl; do
        [[ ! -f "$file" ]] && continue

        if grep -q "$query" "$file" 2>/dev/null; then
            local filename=$(basename "$file")
            local timestamp=$(echo "$filename" | cut -d. -f1)
            local module=$(echo "$filename" | cut -d. -f2)
            local checktype=$(echo "$filename" | cut -d. -f3)
            local date_str=$(date -r "$timestamp" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "$timestamp")

            echo "[$date_str] $module/$checktype"
            echo "  File: $filename"
            ((count++))
        fi
    done

    echo ""
    echo "Found: $count records"
}

# Clean old database records
# Usage: melvin_db_clean [days]
melvin_db_clean() {
    local days="${1:-30}"

    if [[ ! -d "$MELVIN_DB_DIR" ]]; then
        echo "No database found"
        return 0
    fi

    echo "Cleaning records older than $days days..."

    local cutoff=$(date -v-${days}d +%s 2>/dev/null || date -d "$days days ago" +%s)
    local count=0

    for file in "$MELVIN_DB_DIR"/*.jsonl; do
        [[ ! -f "$file" ]] && continue

        local filename=$(basename "$file")
        local timestamp=$(echo "$filename" | cut -d. -f1)

        if [[ $timestamp -lt $cutoff ]]; then
            rm "$file"
            echo "  Removed: $filename"
            ((count++))
        fi
    done

    echo "Cleaned: $count records"
}

# Get database statistics with dimensional breakdown
# Usage: melvin_db_stats
melvin_db_stats() {
    if [[ ! -d "$MELVIN_DB_DIR" ]]; then
        echo "No database found"
        return 0
    fi

    echo "Database Statistics"
    echo "==================="
    echo ""

    local total=$(find "$MELVIN_DB_DIR" -name "*.jsonl" -type f 2>/dev/null | wc -l | tr -d ' ')
    echo "Total records: $total"

    if [[ $total -eq 0 ]]; then
        return 0
    fi

    # Count by module (dimension 1)
    echo ""
    echo "By Module:"
    for file in "$MELVIN_DB_DIR"/*.jsonl; do
        [[ ! -f "$file" ]] && continue
        local filename=$(basename "$file")
        echo "$filename" | cut -d. -f2
    done | sort | uniq -c | awk '{printf "  %-20s %d\n", $2, $1}'

    # Count by checktype (dimension 2)
    echo ""
    echo "By Checktype:"
    for file in "$MELVIN_DB_DIR"/*.jsonl; do
        [[ ! -f "$file" ]] && continue
        local filename=$(basename "$file")
        echo "$filename" | cut -d. -f3
    done | sort | uniq -c | awk '{printf "  %-20s %d\n", $2, $1}'

    # Time range (dimension 3)
    echo ""
    echo "Time Range:"
    local files=($(find "$MELVIN_DB_DIR" -name "*.jsonl" -type f 2>/dev/null | sort))
    if [[ ${#files[@]} -gt 0 ]]; then
        local oldest_ts=$(basename "${files[0]}" | cut -d. -f1)
        local newest_ts=$(basename "${files[-1]}" | cut -d. -f1)
        local oldest_date=$(date -r "$oldest_ts" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "unknown")
        local newest_date=$(date -r "$newest_ts" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "unknown")
        echo "  Oldest: $oldest_date"
        echo "  Newest: $newest_date"
    fi

    # Disk usage
    echo ""
    local size=$(du -sh "$MELVIN_DB_DIR" 2>/dev/null | cut -f1)
    echo "Disk usage: $size"
}

# List all records (simple listing)
# Usage: melvin_db_list [limit]
melvin_db_list() {
    local limit="${1:-20}"

    if [[ ! -d "$MELVIN_DB_DIR" ]]; then
        echo "No database found"
        return 0
    fi

    echo "Recent Records (limit: $limit)"
    echo "=============================="
    echo ""

    local count=0
    local files=($(find "$MELVIN_DB_DIR" -name "*.jsonl" -type f 2>/dev/null | sort -r))

    for file in "${files[@]}"; do
        [[ $count -ge $limit ]] && break

        local filename=$(basename "$file")
        local timestamp=$(echo "$filename" | cut -d. -f1)
        local module=$(echo "$filename" | cut -d. -f2)
        local checktype=$(echo "$filename" | cut -d. -f3)
        local date_str=$(date -r "$timestamp" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "$timestamp")

        echo "[$date_str] $module/$checktype"
        ((count++))
    done

    echo ""
    echo "Showing: $count of ${#files[@]} total records"
}

# Export functions
export -f melvin_db_save
export -f melvin_db_query_module
export -f melvin_db_query_checktype
export -f melvin_db_query_time
export -f melvin_db_show
export -f melvin_db_search
export -f melvin_db_clean
export -f melvin_db_stats
export -f melvin_db_list
