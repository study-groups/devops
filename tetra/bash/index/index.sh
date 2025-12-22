#!/usr/bin/env bash
# Tetra Universal Indexing Module
# Optional cache for fast cross-module queries

# Source dependencies
if [[ -f "$TETRA_SRC/bash/trs/trs.sh" ]]; then
    source "$TETRA_SRC/bash/trs/trs.sh"
fi

if [[ -f "$TETRA_SRC/bash/trs/metadata.sh" ]]; then
    source "$TETRA_SRC/bash/trs/metadata.sh"
fi

# Index configuration
INDEX_DIR="${TETRA_DIR}/index"
INDEX_BY_TIMESTAMP="${INDEX_DIR}/by_timestamp.ndjson"
INDEX_BY_TAG="${INDEX_DIR}/by_tag.ndjson"
INDEX_BY_MODULE="${INDEX_DIR}/by_module.ndjson"
INDEX_ENABLED="${INDEX_ENABLED:-false}"  # Lazy by default

# Initialize index
# Usage: index_init
index_init() {
    mkdir -p "$INDEX_DIR"

    if [[ ! -f "$INDEX_BY_TIMESTAMP" ]]; then
        touch "$INDEX_BY_TIMESTAMP"
    fi

    if [[ ! -f "$INDEX_BY_TAG" ]]; then
        touch "$INDEX_BY_TAG"
    fi

    if [[ ! -f "$INDEX_BY_MODULE" ]]; then
        touch "$INDEX_BY_MODULE"
    fi
}

# Check if index exists and is valid
# Usage: index_exists
# Returns: 0 if exists, 1 if not
index_exists() {
    [[ -f "$INDEX_BY_TIMESTAMP" ]] && [[ -s "$INDEX_BY_TIMESTAMP" ]]
}

# Build complete index from scratch
# Usage: index_rebuild [modules...]
# Returns: Number of records indexed
index_rebuild() {
    local modules=("$@")

    if [[ ${#modules[@]} -eq 0 ]]; then
        # Index all modules
        readarray -t modules < <(find "$TETRA_DIR" -mindepth 2 -maxdepth 2 -type d -name "db" | sed "s|$TETRA_DIR/||" | sed 's|/db||')
    fi

    echo "Rebuilding index for modules: ${modules[*]}" >&2

    index_init

    # Clear existing indexes
    > "$INDEX_BY_TIMESTAMP"
    > "$INDEX_BY_TAG"
    > "$INDEX_BY_MODULE"

    local total_indexed=0

    for module in "${modules[@]}"; do
        local db_dir="$TETRA_DIR/$module/db"

        if [[ ! -d "$db_dir" ]]; then
            continue
        fi

        echo "Indexing module: $module..." >&2

        # Find all TRS records
        find "$db_dir" -type f ! -name "*.meta.json" | while read -r filepath; do
            index_add_entity "$filepath"
            ((total_indexed++))

            # Progress indicator
            if (( total_indexed % 100 == 0 )); then
                echo "  Indexed $total_indexed records..." >&2
            fi
        done
    done

    echo "Index rebuilt: $total_indexed records" >&2
    echo "$total_indexed"
}

# Add a single entity to the index
# Usage: index_add_entity filepath
index_add_entity() {
    local filepath="$1"

    if [[ ! -f "$filepath" ]]; then
        return 1
    fi

    if [[ ! "$INDEX_ENABLED" == "true" ]]; then
        return 0  # Skip if indexing disabled
    fi

    # Ensure index initialized
    index_init

    # Parse filename
    local filename=$(basename "$filepath")
    local timestamp="${filename%%.*}"
    local module=$(get_module_from_file "$filepath")

    # Parse TRS attributes
    local parsed=$(trs_parse_filename "$filename")
    local attributes=$(echo "$parsed" | jq -r '.attributes | join(",")' 2>/dev/null)

    # Build index entry
    local index_entry=$(cat <<EOF
{"timestamp":$timestamp,"module":"$module","filepath":"$filepath","attributes":"$attributes"}
EOF
)

    # Add to timestamp index
    echo "$index_entry" >> "$INDEX_BY_TIMESTAMP"

    # Add to module index
    echo "$index_entry" >> "$INDEX_BY_MODULE"

    # Check if metadata exists and index tags
    local metadata=$(trs_metadata_read "$filepath" 2>/dev/null)
    if [[ -n "$metadata" && "$metadata" != "{}" ]]; then
        local tags=$(echo "$metadata" | jq -r '.tags[]?' 2>/dev/null)
        if [[ -n "$tags" ]]; then
            echo "$tags" | while read -r tag; do
                local tag_entry=$(cat <<EOF
{"tag":"$tag","timestamp":$timestamp,"module":"$module","filepath":"$filepath"}
EOF
)
                echo "$tag_entry" >> "$INDEX_BY_TAG"
            done
        fi
    fi
}

# Query index by timestamp
# Usage: index_query_timestamp timestamp
# Returns: All indexed records for timestamp
index_query_timestamp() {
    local timestamp="$1"

    if ! index_exists; then
        echo "Warning: Index not built, falling back to file search" >&2
        trs_query_timestamp "$timestamp"
        return $?
    fi

    grep "\"timestamp\":$timestamp" "$INDEX_BY_TIMESTAMP" | jq -r '.filepath'
}

# Query index by module
# Usage: index_query_module module [limit]
# Returns: Indexed records for module
index_query_module() {
    local module="$1"
    local limit="${2:-}"

    if ! index_exists; then
        echo "Warning: Index not built, falling back to file search" >&2
        trs_query_module "$module" "$limit"
        return $?
    fi

    if [[ -n "$limit" ]]; then
        grep "\"module\":\"$module\"" "$INDEX_BY_MODULE" | head -n "$limit" | jq -r '.filepath'
    else
        grep "\"module\":\"$module\"" "$INDEX_BY_MODULE" | jq -r '.filepath'
    fi
}

# Query index by tag
# Usage: index_query_tag tag
# Returns: All indexed records with tag
index_query_tag() {
    local tag="$1"

    if ! index_exists; then
        echo "Warning: Index not built, falling back to file search" >&2
        trs_query_by_tag "$tag"
        return $?
    fi

    grep "\"tag\":\"$tag\"" "$INDEX_BY_TAG" | jq -r '.filepath'
}

# Query index with multiple criteria
# Usage: index_query --timestamp TS --module MOD --tag TAG --limit N
# Returns: Matching records
index_query() {
    local timestamp=""
    local module=""
    local tag=""
    local limit=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --timestamp)
                timestamp="$2"
                shift 2
                ;;
            --module)
                module="$2"
                shift 2
                ;;
            --tag)
                tag="$2"
                shift 2
                ;;
            --limit)
                limit="$2"
                shift 2
                ;;
            *)
                echo "Unknown option: $1" >&2
                shift
                ;;
        esac
    done

    if ! index_exists; then
        echo "Warning: Index does not exist. Run 'index_rebuild' first." >&2
        return 1
    fi

    # Start with all records
    local results="$INDEX_BY_TIMESTAMP"

    # Apply filters
    if [[ -n "$timestamp" ]]; then
        results=$(grep "\"timestamp\":$timestamp" "$results")
    fi

    if [[ -n "$module" ]]; then
        results=$(echo "$results" | grep "\"module\":\"$module\"")
    fi

    if [[ -n "$tag" ]]; then
        # Join with tag index
        local tag_filepaths=$(grep "\"tag\":\"$tag\"" "$INDEX_BY_TAG" | jq -r '.filepath')
        results=$(echo "$results" | jq -r '.filepath' | grep -F -f <(echo "$tag_filepaths"))
    else
        results=$(echo "$results" | jq -r '.filepath')
    fi

    # Apply limit
    if [[ -n "$limit" ]]; then
        echo "$results" | head -n "$limit"
    else
        echo "$results"
    fi
}

# Get index statistics
# Usage: index_stats
# Returns: JSON with index statistics
index_stats() {
    if ! index_exists; then
        cat <<EOF
{
    "exists": false,
    "message": "Index not built. Run 'index_rebuild' to create it."
}
EOF
        return 0
    fi

    local total_records=$(wc -l < "$INDEX_BY_TIMESTAMP" | xargs)
    local total_tags=$(wc -l < "$INDEX_BY_TAG" | xargs)
    local unique_modules=$(jq -r '.module' "$INDEX_BY_MODULE" | sort -u | wc -l | xargs)

    local index_size=$(du -sh "$INDEX_DIR" 2>/dev/null | cut -f1)

    cat <<EOF
{
    "exists": true,
    "total_records": $total_records,
    "total_tags": $total_tags,
    "unique_modules": $unique_modules,
    "index_size": "$index_size",
    "index_path": "$INDEX_DIR"
}
EOF
}

# Enable auto-indexing
# Usage: index_enable
index_enable() {
    export INDEX_ENABLED=true
    echo "Index auto-update enabled" >&2
}

# Disable auto-indexing
# Usage: index_disable
index_disable() {
    export INDEX_ENABLED=false
    echo "Index auto-update disabled" >&2
}

# Clear index
# Usage: index_clear
index_clear() {
    if [[ -d "$INDEX_DIR" ]]; then
        rm -rf "$INDEX_DIR"
        echo "Index cleared" >&2
    fi
}

# Optimize index (deduplicate, sort, compress)
# Usage: index_optimize
index_optimize() {
    if ! index_exists; then
        echo "No index to optimize" >&2
        return 1
    fi

    echo "Optimizing index..." >&2

    # Sort and deduplicate timestamp index
    sort -u "$INDEX_BY_TIMESTAMP" > "${INDEX_BY_TIMESTAMP}.tmp"
    mv "${INDEX_BY_TIMESTAMP}.tmp" "$INDEX_BY_TIMESTAMP"

    # Sort and deduplicate tag index
    sort -u "$INDEX_BY_TAG" > "${INDEX_BY_TAG}.tmp"
    mv "${INDEX_BY_TAG}.tmp" "$INDEX_BY_TAG"

    # Sort and deduplicate module index
    sort -u "$INDEX_BY_MODULE" > "${INDEX_BY_MODULE}.tmp"
    mv "${INDEX_BY_MODULE}.tmp" "$INDEX_BY_MODULE"

    echo "Index optimized" >&2
}

# Export functions
export -f index_init
export -f index_exists
export -f index_rebuild
export -f index_add_entity
export -f index_query_timestamp
export -f index_query_module
export -f index_query_tag
export -f index_query
export -f index_stats
export -f index_enable
export -f index_disable
export -f index_clear
export -f index_optimize
