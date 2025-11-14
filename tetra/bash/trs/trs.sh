#!/usr/bin/env bash
# TRS - Tetra Record Specification Implementation
# Core library for TRS-compliant record management

# Ensure TETRA_DIR is set
if [[ -z "$TETRA_DIR" ]]; then
    echo "Error: TETRA_DIR must be set" >&2
    return 1
fi

# Write data to canonical location with implicit module naming
# Usage: trs_write module type kind format data
# Returns: Full path to created file
trs_write() {
    local module="$1"
    local type="$2"
    local kind="$3"
    local format="$4"
    local data="$5"

    if [[ -z "$module" || -z "$type" || -z "$kind" || -z "$format" ]]; then
        echo "Error: trs_write requires module, type, kind, format" >&2
        return 1
    fi

    local timestamp=$(date +%s)
    local db_dir="$TETRA_DIR/$module/db"
    local filepath="$db_dir/$timestamp.$type.$kind.$format"

    # Create directory if it doesn't exist
    mkdir -p "$db_dir"

    # Write data
    if [[ -n "$data" ]]; then
        echo "$data" > "$filepath"
    else
        # Read from stdin if no data provided
        cat > "$filepath"
    fi

    echo "$filepath"
}

# Write data with custom timestamp (for migrations or testing)
# Usage: trs_write_at timestamp module type kind format data
# Returns: Full path to created file
trs_write_at() {
    local timestamp="$1"
    local module="$2"
    local type="$3"
    local kind="$4"
    local format="$5"
    local data="$6"

    if [[ -z "$timestamp" || -z "$module" || -z "$type" || -z "$kind" || -z "$format" ]]; then
        echo "Error: trs_write_at requires timestamp, module, type, kind, format" >&2
        return 1
    fi

    local db_dir="$TETRA_DIR/$module/db"
    local filepath="$db_dir/$timestamp.$type.$kind.$format"

    mkdir -p "$db_dir"

    if [[ -n "$data" ]]; then
        echo "$data" > "$filepath"
    else
        cat > "$filepath"
    fi

    echo "$filepath"
}

# Export data from canonical to non-canonical location with explicit module naming
# Usage: trs_export source_path dest_dir
# Returns: Full path to exported file
trs_export() {
    local source_path="$1"
    local dest_dir="$2"

    if [[ -z "$source_path" || -z "$dest_dir" ]]; then
        echo "Error: trs_export requires source_path and dest_dir" >&2
        return 1
    fi

    if [[ ! -f "$source_path" ]]; then
        echo "Error: Source file not found: $source_path" >&2
        return 1
    fi

    # Get module from source path
    local module=$(get_module_from_file "$source_path")
    if [[ -z "$module" ]]; then
        echo "Error: Could not determine module from: $source_path" >&2
        return 1
    fi

    local filename=$(basename "$source_path")
    local timestamp="${filename%%.*}"
    local rest="${filename#*.}"

    # Check if module already explicit in filename
    if [[ "$source_path" =~ $TETRA_DIR/([^/]+)/db/ ]]; then
        # In canonical location - make module explicit
        local export_name="$timestamp.$module.$rest"
    else
        # Already in non-canonical location - keep as is
        local export_name="$filename"
    fi

    mkdir -p "$dest_dir"
    cp "$source_path" "$dest_dir/$export_name"
    echo "$dest_dir/$export_name"
}

# Move (not copy) data to non-canonical location with explicit module naming
# Usage: trs_move source_path dest_dir
# Returns: Full path to moved file
trs_move() {
    local source_path="$1"
    local dest_dir="$2"

    if [[ -z "$source_path" || -z "$dest_dir" ]]; then
        echo "Error: trs_move requires source_path and dest_dir" >&2
        return 1
    fi

    if [[ ! -f "$source_path" ]]; then
        echo "Error: Source file not found: $source_path" >&2
        return 1
    fi

    local module=$(get_module_from_file "$source_path")
    if [[ -z "$module" ]]; then
        echo "Error: Could not determine module from: $source_path" >&2
        return 1
    fi

    local filename=$(basename "$source_path")
    local timestamp="${filename%%.*}"
    local rest="${filename#*.}"

    # Make module explicit if moving from canonical location
    if [[ "$source_path" =~ $TETRA_DIR/([^/]+)/db/ ]]; then
        local export_name="$timestamp.$module.$rest"
    else
        local export_name="$filename"
    fi

    mkdir -p "$dest_dir"
    mv "$source_path" "$dest_dir/$export_name"
    echo "$dest_dir/$export_name"
}

# Determine module from file path (implicit or explicit)
# Usage: get_module_from_file filepath
# Returns: Module name
get_module_from_file() {
    local filepath="$1"

    if [[ -z "$filepath" ]]; then
        echo "Error: get_module_from_file requires filepath" >&2
        return 1
    fi

    # Check if in canonical location
    if [[ "$filepath" =~ $TETRA_DIR/([^/]+)/db/ ]]; then
        # Module from path (implicit)
        echo "${BASH_REMATCH[1]}"
    else
        # Extract from filename (explicit - first segment after timestamp)
        local filename=$(basename "$filepath")

        # Remove timestamp (first segment)
        local rest="${filename#*.}"

        # Get module (next segment)
        echo "${rest%%.*}"
    fi
}

# Find all records for a given timestamp across all modules
# Usage: trs_query_timestamp timestamp [module]
# Returns: List of file paths
trs_query_timestamp() {
    local timestamp="$1"
    local module="${2:-*}"  # Optional module filter

    if [[ -z "$timestamp" ]]; then
        echo "Error: trs_query_timestamp requires timestamp" >&2
        return 1
    fi

    # Search in canonical locations
    find "$TETRA_DIR/$module/db/" -name "${timestamp}.*" -type f 2>/dev/null
}

# Query records by attribute (type, kind, etc.)
# Usage: trs_query_attribute attribute_value [module]
# Returns: List of file paths
trs_query_attribute() {
    local attribute_value="$1"
    local module="${2:-*}"  # Optional module filter

    if [[ -z "$attribute_value" ]]; then
        echo "Error: trs_query_attribute requires attribute_value" >&2
        return 1
    fi

    # Search for files containing the attribute value in filename
    find "$TETRA_DIR/$module/db/" -name "*.$attribute_value.*" -type f 2>/dev/null
}

# Get all records for a specific module
# Usage: trs_query_module module [limit]
# Returns: List of file paths
trs_query_module() {
    local module="$1"
    local limit="${2:-}"  # Optional limit

    if [[ -z "$module" ]]; then
        echo "Error: trs_query_module requires module" >&2
        return 1
    fi

    if [[ ! -d "$TETRA_DIR/$module/db" ]]; then
        echo "Error: Module database not found: $TETRA_DIR/$module/db" >&2
        return 1
    fi

    if [[ -n "$limit" ]]; then
        find "$TETRA_DIR/$module/db/" -type f 2>/dev/null | sort -r | head -n "$limit"
    else
        find "$TETRA_DIR/$module/db/" -type f 2>/dev/null | sort -r
    fi
}

# Get records in a time range
# Usage: trs_query_range start_timestamp end_timestamp [module]
# Returns: List of file paths
trs_query_range() {
    local start_ts="$1"
    local end_ts="$2"
    local module="${3:-*}"

    if [[ -z "$start_ts" || -z "$end_ts" ]]; then
        echo "Error: trs_query_range requires start_timestamp and end_timestamp" >&2
        return 1
    fi

    find "$TETRA_DIR/$module/db/" -type f 2>/dev/null | while read -r file; do
        local filename=$(basename "$file")
        local ts="${filename%%.*}"

        # Check if timestamp is numeric and in range
        if [[ "$ts" =~ ^[0-9]+$ ]] && [[ "$ts" -ge "$start_ts" ]] && [[ "$ts" -le "$end_ts" ]]; then
            echo "$file"
        fi
    done
}

# Get the latest N records for a module
# Usage: trs_latest module [count]
# Returns: List of file paths (most recent first)
trs_latest() {
    local module="$1"
    local count="${2:-10}"  # Default to 10

    if [[ -z "$module" ]]; then
        echo "Error: trs_latest requires module" >&2
        return 1
    fi

    find "$TETRA_DIR/$module/db/" -type f 2>/dev/null | \
        sort -t. -k1 -nr | \
        head -n "$count"
}

# Parse TRS filename into components
# Usage: trs_parse_filename filename
# Returns: JSON with timestamp, module (if explicit), attributes, format
trs_parse_filename() {
    local filename="$1"

    if [[ -z "$filename" ]]; then
        echo "Error: trs_parse_filename requires filename" >&2
        return 1
    fi

    # Remove path if present
    filename=$(basename "$filename")

    # Split on dots
    IFS='.' read -ra parts <<< "$filename"

    local timestamp="${parts[0]}"
    local format="${parts[-1]}"

    # Middle parts are attributes
    local -a attributes=()
    for ((i=1; i<${#parts[@]}-1; i++)); do
        attributes+=("${parts[i]}")
    done

    # Output as JSON
    cat <<EOF
{
    "timestamp": "$timestamp",
    "attributes": [$(printf '"%s",' "${attributes[@]}" | sed 's/,$//')],
    "format": "$format"
}
EOF
}

# Check if a file follows TRS naming convention
# Usage: trs_validate_filename filename
# Returns: 0 if valid, 1 if invalid
trs_validate_filename() {
    local filename="$1"

    if [[ -z "$filename" ]]; then
        echo "Error: trs_validate_filename requires filename" >&2
        return 1
    fi

    filename=$(basename "$filename")

    # Must start with timestamp (digits)
    if [[ ! "$filename" =~ ^[0-9]+\. ]]; then
        echo "Error: Filename must start with timestamp: $filename" >&2
        return 1
    fi

    # Must have at least 3 segments: timestamp.attribute.format
    local segment_count=$(echo "$filename" | tr -cd '.' | wc -c)
    if [[ "$segment_count" -lt 2 ]]; then
        echo "Error: Filename must have at least 3 segments: $filename" >&2
        return 1
    fi

    return 0
}

# Ensure module database directory exists
# Usage: trs_init_module module
# Returns: 0 on success
trs_init_module() {
    local module="$1"

    if [[ -z "$module" ]]; then
        echo "Error: trs_init_module requires module" >&2
        return 1
    fi

    local db_dir="$TETRA_DIR/$module/db"

    if [[ ! -d "$db_dir" ]]; then
        mkdir -p "$db_dir"
        echo "Initialized TRS database for module: $module at $db_dir"
    fi

    return 0
}

# Get statistics for a module's database
# Usage: trs_stats module
# Returns: JSON with statistics
trs_stats() {
    local module="$1"

    if [[ -z "$module" ]]; then
        echo "Error: trs_stats requires module" >&2
        return 1
    fi

    local db_dir="$TETRA_DIR/$module/db"

    if [[ ! -d "$db_dir" ]]; then
        echo '{"error": "Module database not found"}'
        return 1
    fi

    local total_records=$(find "$db_dir" -type f 2>/dev/null | wc -l)
    local total_size=$(du -sh "$db_dir" 2>/dev/null | cut -f1)
    local oldest=$(find "$db_dir" -type f 2>/dev/null | sort -t. -k1 -n | head -1 | xargs -I{} basename {} | cut -d. -f1)
    local newest=$(find "$db_dir" -type f 2>/dev/null | sort -t. -k1 -n | tail -1 | xargs -I{} basename {} | cut -d. -f1)

    cat <<EOF
{
    "module": "$module",
    "total_records": $total_records,
    "total_size": "$total_size",
    "oldest_timestamp": "${oldest:-null}",
    "newest_timestamp": "${newest:-null}",
    "database_path": "$db_dir"
}
EOF
}

# Export functions for use in other scripts
export -f trs_write
export -f trs_write_at
export -f trs_export
export -f trs_move
export -f get_module_from_file
export -f trs_query_timestamp
export -f trs_query_attribute
export -f trs_query_module
export -f trs_query_range
export -f trs_latest
export -f trs_parse_filename
export -f trs_validate_filename
export -f trs_init_module
export -f trs_stats
