#!/usr/bin/env bash

# TDOC Database System
# TCS 3.0-compliant timestamp-based database for document metadata

# Generate timestamp (TCS 3.0 pattern)
tdoc_generate_timestamp() {
    date +%s
}

# Get database directory
tdoc_get_db_dir() {
    echo "$TDOCS_DB_DIR"
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
    local category="$2"              # Deprecated: keep for compatibility
    local type="$3"
    local tags="$4"                  # Comma-separated or array
    local module="${5:-}"
    local status="${6:-draft}"
    local level="${7:-}"             # Optional: L0-L4 for quick assessment
    local implements="${8:-}"        # Comma-separated standards
    local integrates="${9:-}"        # Comma-separated modules
    local authority="${10:-working}" # canonical|stable|working|draft|stale|archived
    local doc_type="${11:-guide}"    # specification|guide|reference|plan|investigation|scratch
    local grade="${12:-}"            # A|B|C|X for triage
    local grounded_in="${13:-}"      # Comma-separated code file paths
    local related_docs="${14:-}"     # Comma-separated related doc paths
    local supersedes="${15:-}"       # Path to superseded document

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

    # Convert implements to JSON array
    local implements_json="[]"
    if [[ -n "$implements" ]]; then
        implements_json="["
        IFS=',' read -ra impl_array <<< "$implements"
        local first=true
        for impl in "${impl_array[@]}"; do
            impl=$(echo "$impl" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
            [[ "$first" == false ]] && implements_json+=", "
            first=false
            implements_json+="\"$impl\""
        done
        implements_json+="]"
    fi

    # Convert integrates to JSON array
    local integrates_json="[]"
    if [[ -n "$integrates" ]]; then
        integrates_json="["
        IFS=',' read -ra integ_array <<< "$integrates"
        local first=true
        for integ in "${integ_array[@]}"; do
            integ=$(echo "$integ" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
            [[ "$first" == false ]] && integrates_json+=", "
            first=false
            integrates_json+="\"$integ\""
        done
        integrates_json+="]"
    fi

    # Convert grounded_in to JSON array
    local grounded_in_json="[]"
    if [[ -n "$grounded_in" ]]; then
        grounded_in_json="["
        IFS=',' read -ra ground_array <<< "$grounded_in"
        local first=true
        for ground in "${ground_array[@]}"; do
            ground=$(echo "$ground" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
            [[ "$first" == false ]] && grounded_in_json+=", "
            first=false
            grounded_in_json+="\"$ground\""
        done
        grounded_in_json+="]"
    fi

    # Convert related_docs to JSON array
    local related_docs_json="[]"
    if [[ -n "$related_docs" ]]; then
        related_docs_json="["
        IFS=',' read -ra related_array <<< "$related_docs"
        local first=true
        for related in "${related_array[@]}"; do
            related=$(echo "$related" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
            [[ "$first" == false ]] && related_docs_json+=", "
            first=false
            related_docs_json+="\"$related\""
        done
        related_docs_json+="]"
    fi

    # Calculate staleness metrics
    local code_last_changed=""
    local staleness_score="0"
    if [[ -n "$grounded_in" ]]; then
        # Find newest file in grounded_in list
        local newest_code=0
        IFS=',' read -ra ground_array <<< "$grounded_in"
        for ground_file in "${ground_array[@]}"; do
            ground_file=$(echo "$ground_file" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
            if [[ -f "$ground_file" ]]; then
                local file_mtime=$(stat -f %m "$ground_file" 2>/dev/null || stat -c %Y "$ground_file" 2>/dev/null || echo "0")
                [[ $file_mtime -gt $newest_code ]] && newest_code=$file_mtime
            fi
        done
        if [[ $newest_code -gt 0 ]]; then
            code_last_changed=$(date -r $newest_code +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -d "@$newest_code" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo "")
            # Calculate staleness: if code newer than doc creation, potentially stale
            local doc_time=$timestamp
            if [[ $newest_code -gt $doc_time ]]; then
                local age_diff=$((newest_code - doc_time))
                local days_stale=$((age_diff / 86400))
                # Score: 0=fresh, 0.5=moderately stale (30d), 1.0=very stale (90d+)
                if command -v awk >/dev/null 2>&1; then
                    staleness_score=$(awk "BEGIN {s = $days_stale / 90.0; print (s > 1.0) ? 1.0 : s}")
                else
                    [[ $days_stale -ge 90 ]] && staleness_score="1.0" || staleness_score="0.$(($days_stale * 11 / 100))"
                fi
            fi
        fi
    fi

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
  \"hash\": \"$hash\",
  \"level\": \"$level\",
  \"completeness_level\": \"$level\",
  \"implements\": $implements_json,
  \"integrates\": $integrates_json,
  \"authority\": \"$authority\",
  \"doc_type\": \"$doc_type\",
  \"grade\": \"$grade\",
  \"grounded_in\": $grounded_in_json,
  \"related_docs\": $related_docs_json,
  \"supersedes\": \"$supersedes\",
  \"code_last_changed\": \"$code_last_changed\",
  \"staleness_score\": \"$staleness_score\"
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
    for meta_file in "$TDOCS_DB_DIR"/*.meta; do
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

    for mf in "$TDOCS_DB_DIR"/*.meta; do
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
    for meta_file in "$TDOCS_DB_DIR"/*.meta; do
        [[ ! -f "$meta_file" ]] && continue

        local meta=$(cat "$meta_file")

        # Check if the actual document file exists
        local doc_path=$(echo "$meta" | grep -o '"doc_path": "[^"]*"' | cut -d'"' -f4)
        if [[ -n "$doc_path" ]] && [[ ! -f "$doc_path" ]]; then
            # Skip stale entries for non-existent files
            continue
        fi

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
    for meta_file in "$TDOCS_DB_DIR"/*.meta; do
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
