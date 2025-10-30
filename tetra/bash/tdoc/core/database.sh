#!/usr/bin/env bash

# TDOC Database System
# TCS 3.0-compliant timestamp-based database for document metadata

# Generate timestamp (TCS 3.0 pattern)
tdoc_generate_timestamp() {
    date +%s
}

# Get database directory
tdoc_get_db_dir() {
    echo "$TDOC_DB_DIR"
}

# Get path to metadata file for timestamp
tdoc_get_db_path() {
    local timestamp="$1"
    echo "$(tdoc_get_db_dir)/${timestamp}.meta"
}

# Get path to tags file for timestamp
tdoc_get_tags_path() {
    local timestamp="$1"
    echo "$(tdoc_get_db_dir)/${timestamp}.tags"
}

# Create database entry for a document
# Returns: timestamp
tdoc_db_create() {
    local doc_path="$1"
    local category="$2"
    local type="$3"
    local tags="$4"  # Comma-separated or array
    local module="${5:-}"
    local status="${6:-draft}"

    # Generate timestamp
    local timestamp=$(tdoc_generate_timestamp)

    # Get absolute path
    local abs_path=$(realpath "$doc_path" 2>/dev/null || echo "$doc_path")

    # Determine evidence weight
    local evidence_weight="secondary"
    [[ "$category" == "core" ]] && evidence_weight="primary"

    # Get file hash for change detection
    local hash=""
    if [[ -f "$doc_path" ]]; then
        hash=$(shasum -a 256 "$doc_path" 2>/dev/null | awk '{print $1}')
    fi

    # Get dates
    local created=$(date +%Y-%m-%dT%H:%M:%SZ)
    local updated="$created"

    # Convert tags to JSON array
    local tags_json="["
    if [[ "$tags" =~ , ]]; then
        # Comma-separated
        IFS=',' read -ra tag_array <<< "$tags"
        local first=true
        for tag in "${tag_array[@]}"; do
            tag=$(echo "$tag" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
            [[ "$first" == false ]] && tags_json+=", "
            first=false
            tags_json+="\"$tag\""
        done
    else
        # Single tag or empty
        [[ -n "$tags" ]] && tags_json+="\"$tags\""
    fi
    tags_json+="]"

    # Create JSON metadata
    local meta_json="{
  \"timestamp\": $timestamp,
  \"doc_path\": \"$abs_path\",
  \"category\": \"$category\",
  \"type\": \"$type\",
  \"tags\": $tags_json,
  \"module\": \"$module\",
  \"evidence_weight\": \"$evidence_weight\",
  \"created\": \"$created\",
  \"updated\": \"$updated\",
  \"status\": \"$status\",
  \"hash\": \"$hash\"
}"

    # Write metadata file
    echo "$meta_json" > "$(tdoc_get_db_path "$timestamp")"

    # Write tags file for quick grep
    if [[ "$tags" =~ , ]]; then
        echo "$tags" | tr ',' '\n' > "$(tdoc_get_tags_path "$timestamp")"
    else
        echo "$tags" > "$(tdoc_get_tags_path "$timestamp")"
    fi

    echo "$timestamp"
}

# Get metadata by timestamp
tdoc_db_get() {
    local timestamp="$1"
    local meta_file="$(tdoc_get_db_path "$timestamp")"

    if [[ -f "$meta_file" ]]; then
        cat "$meta_file"
    else
        echo "{}"
        return 1
    fi
}

# Get metadata by document path
tdoc_db_get_by_path() {
    local doc_path="$1"
    local abs_path=$(realpath "$doc_path" 2>/dev/null || echo "$doc_path")

    # Search for metadata file with this path
    for meta_file in "$TDOC_DB_DIR"/*.meta; do
        [[ ! -f "$meta_file" ]] && continue

        if grep -q "\"doc_path\": \"$abs_path\"" "$meta_file" 2>/dev/null; then
            cat "$meta_file"
            return 0
        fi
    done

    echo "{}"
    return 1
}

# Update metadata for a document
tdoc_db_update() {
    local doc_path="$1"
    shift
    local updates=("$@")  # key=value pairs

    # Find existing metadata
    local abs_path=$(realpath "$doc_path" 2>/dev/null || echo "$doc_path")
    local timestamp=""
    local meta_file=""

    for mf in "$TDOC_DB_DIR"/*.meta; do
        [[ ! -f "$mf" ]] && continue

        if grep -q "\"doc_path\": \"$abs_path\"" "$mf" 2>/dev/null; then
            meta_file="$mf"
            timestamp=$(basename "$mf" .meta)
            break
        fi
    done

    if [[ -z "$meta_file" ]]; then
        echo "Error: No metadata found for $doc_path" >&2
        return 1
    fi

    # Read current metadata
    local current=$(cat "$meta_file")

    # Apply updates (simple sed-based for now)
    local updated="$current"
    local updated_date=$(date +%Y-%m-%dT%H:%M:%SZ)

    for update in "${updates[@]}"; do
        if [[ "$update" =~ ^([^=]+)=(.+)$ ]]; then
            local key="${BASH_REMATCH[1]}"
            local value="${BASH_REMATCH[2]}"

            # Update JSON field
            updated=$(echo "$updated" | sed "s/\"$key\": \"[^\"]*\"/\"$key\": \"$value\"/")
        fi
    done

    # Update the "updated" timestamp
    updated=$(echo "$updated" | sed "s/\"updated\": \"[^\"]*\"/\"updated\": \"$updated_date\"/")

    # Write back
    echo "$updated" > "$meta_file"
}

# List all documents in database
# Options: --category=core|other, --module=name, --tags=tag1,tag2
tdoc_db_list() {
    local category=""
    local module=""
    local tags=""

    # Parse options
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --category=*)
                category="${1#*=}"
                shift
                ;;
            --module=*)
                module="${1#*=}"
                shift
                ;;
            --tags=*)
                tags="${1#*=}"
                shift
                ;;
            *)
                shift
                ;;
        esac
    done

    # Iterate through metadata files
    for meta_file in "$TDOC_DB_DIR"/*.meta; do
        [[ ! -f "$meta_file" ]] && continue

        local meta=$(cat "$meta_file")

        # Apply filters
        if [[ -n "$category" ]]; then
            echo "$meta" | grep -q "\"category\": \"$category\"" || continue
        fi

        if [[ -n "$module" ]]; then
            echo "$meta" | grep -q "\"module\": \"$module\"" || continue
        fi

        if [[ -n "$tags" ]]; then
            local found=false
            IFS=',' read -ra tag_array <<< "$tags"
            for tag in "${tag_array[@]}"; do
                tag=$(echo "$tag" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
                if echo "$meta" | grep -q "\"$tag\""; then
                    found=true
                    break
                fi
            done
            [[ "$found" == false ]] && continue
        fi

        # Output metadata as single-line JSON for easy parsing
        echo "$meta" | tr '\n' ' ' | sed 's/  */ /g'
        echo ""
    done
}

# Delete metadata for a document
tdoc_db_delete() {
    local doc_path="$1"
    local abs_path=$(realpath "$doc_path" 2>/dev/null || echo "$doc_path")

    # Find and delete metadata files
    for meta_file in "$TDOC_DB_DIR"/*.meta; do
        [[ ! -f "$meta_file" ]] && continue

        if grep -q "\"doc_path\": \"$abs_path\"" "$meta_file" 2>/dev/null; then
            local timestamp=$(basename "$meta_file" .meta)
            rm -f "$meta_file"
            rm -f "$(tdoc_get_tags_path "$timestamp")"
            echo "Deleted metadata for $doc_path (timestamp: $timestamp)"
            return 0
        fi
    done

    echo "No metadata found for $doc_path" >&2
    return 1
}

# Cross-module correlation: find all resources with same timestamp
tdoc_db_correlate() {
    local timestamp="$1"

    echo "Resources correlated with timestamp $timestamp:"
    echo ""

    # Check tdoc database
    local meta_file="$(tdoc_get_db_path "$timestamp")"
    if [[ -f "$meta_file" ]]; then
        echo "TDOC:"
        cat "$meta_file" | grep "doc_path" | sed 's/.*": "\(.*\)".*/  \1/'
    fi

    # Check other module databases
    find "$TETRA_DIR" -name "${timestamp}.*" 2>/dev/null | while read -r file; do
        local module=$(basename $(dirname $(dirname "$file")))
        echo "$module: $file"
    done
}
