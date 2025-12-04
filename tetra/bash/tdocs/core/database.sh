#!/usr/bin/env bash

# TDOC Database System
# TCS 3.0-compliant timestamp-based database for document metadata

# Load utilities
source "${TDOCS_SRC}/core/utils.sh"

# Generate timestamp (TCS 3.0 pattern with collision avoidance)
tdoc_generate_timestamp() {
    local timestamp=$(date +%s)
    local offset=0

    # If file exists, work backwards in time until we find a free slot
    while [[ -f "$(tdoc_get_db_dir)/$((timestamp - offset)).meta" ]]; do
        ((offset++))
        # Safety check: don't go back more than 1000 seconds
        if [[ $offset -gt 1000 ]]; then
            echo "Error: Cannot generate unique timestamp after 1000 attempts" >&2
            echo "Database may be full or corrupted. Try again in a few seconds." >&2
            return 1
        fi
    done

    echo $((timestamp - offset))
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
    local type="$2"                  # spec|guide|investigation|reference|plan|summary|scratch
    local intent="$3"                # define|instruct|analyze|document|propose|track
    local lifecycle="${4:-$TDOC_DEFAULT_LIFECYCLE}"  # D|W|S|C|X (default: W=working)
    local tags="$5"                  # Comma-separated or array
    local module="${6:-}"
    local level="${7:-}"             # Optional: L0-L4 for quick assessment
    local implements="${8:-}"        # Comma-separated standards
    local integrates="${9:-}"        # Comma-separated modules
    local grounded_in="${10:-}"      # Comma-separated code file paths
    local related_docs="${11:-}"     # Comma-separated related doc paths
    local supersedes="${12:-}"       # Path to superseded document

    # Generate timestamp
    local timestamp=$(tdoc_generate_timestamp)

    # Get absolute path
    local abs_path=$(realpath "$doc_path" 2>/dev/null || echo "$doc_path")

    # Auto-detect intent from type if not specified
    if [[ -z "$intent" ]]; then
        case "$type" in
            spec|specification|standard|reference)
                intent="define"
                ;;
            guide|example)
                intent="instruct"
                ;;
            investigation)
                intent="analyze"
                ;;
            summary|scratch)
                intent="document"
                ;;
            plan)
                intent="propose"
                ;;
            *)
                intent="document"  # Default
                ;;
        esac
    fi

    # Resolve and validate type (with warning on invalid)
    type=$(tdoc_resolve_type "$type" "true")

    # Validate lifecycle
    if ! tdoc_valid_lifecycle "$lifecycle"; then
        echo "Warning: Invalid lifecycle '$lifecycle', defaulting to $TDOC_DEFAULT_LIFECYCLE" >&2
        lifecycle="$TDOC_DEFAULT_LIFECYCLE"
    fi

    # Determine evidence weight from lifecycle using constants
    local evidence_weight=$(tdoc_lifecycle_evidence "$lifecycle")

    # Get file hash for change detection
    local hash=""
    if [[ -f "$doc_path" ]]; then
        hash=$(_tdoc_file_hash "$doc_path")
    fi

    # Calculate frontmatter hash (for sync validation)
    local frontmatter_hash=""
    if tdoc_has_frontmatter "$doc_path"; then
        local fm=$(tdoc_parse_frontmatter "$doc_path")
        if command -v shasum >/dev/null 2>&1; then
            frontmatter_hash=$(echo "$fm" | shasum -a 256 | awk '{print $1}')
        elif command -v sha256sum >/dev/null 2>&1; then
            frontmatter_hash=$(echo "$fm" | sha256sum | awk '{print $1}')
        fi
    fi

    # Get dates from file modification time
    local created updated
    if [[ -f "$doc_path" ]]; then
        local mtime=$(_tdoc_file_mtime "$doc_path")
        if [[ -n "$mtime" ]]; then
            created=$(_tdoc_timestamp_to_iso "$mtime")
            updated="$created"
        else
            # Fallback to current time
            created=$(date +%Y-%m-%dT%H:%M:%SZ)
            updated="$created"
        fi
    else
        # File doesn't exist, use current time
        created=$(date +%Y-%m-%dT%H:%M:%SZ)
        updated="$created"
    fi

    # Convert CSV fields to JSON arrays using helper
    local tags_json=$(_tdoc_csv_to_json_array "$tags")
    local implements_json=$(_tdoc_csv_to_json_array "$implements")
    local integrates_json=$(_tdoc_csv_to_json_array "$integrates")
    local grounded_in_json=$(_tdoc_csv_to_json_array "$grounded_in")
    local related_docs_json=$(_tdoc_csv_to_json_array "$related_docs")

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
                local file_mtime=$(_tdoc_file_mtime "$ground_file" || echo "0")
                [[ $file_mtime -gt $newest_code ]] && newest_code=$file_mtime
            fi
        done
        if [[ $newest_code -gt 0 ]]; then
            code_last_changed=$(_tdoc_timestamp_to_iso "$newest_code")
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
  \"type\": \"$type\",
  \"intent\": \"$intent\",
  \"lifecycle\": \"$lifecycle\",
  \"tags\": $tags_json,
  \"module\": \"$module\",
  \"evidence_weight\": \"$evidence_weight\",
  \"created\": \"$created\",
  \"updated\": \"$updated\",
  \"hash\": \"$hash\",
  \"frontmatter_hash\": \"$frontmatter_hash\",
  \"needs_resync\": false,
  \"level\": \"$level\",
  \"completeness_level\": \"$level\",
  \"implements\": $implements_json,
  \"integrates\": $integrates_json,
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

# Check if frontmatter is in sync with cached metadata
# Returns: 0 if in sync, 1 if needs resync
tdoc_check_sync() {
    local doc_path="$1"
    local abs_path=$(realpath "$doc_path" 2>/dev/null || echo "$doc_path")

    # Find metadata file
    local meta_file=""
    for mf in "$TDOCS_DB_DIR"/*.meta; do
        [[ ! -f "$mf" ]] && continue
        if grep -q "\"doc_path\": \"$abs_path\"" "$mf" 2>/dev/null; then
            meta_file="$mf"
            break
        fi
    done

    [[ -z "$meta_file" ]] && return 1

    # Get stored hash
    local stored_hash=$(jq -r '.frontmatter_hash // ""' "$meta_file" 2>/dev/null)

    # Calculate current hash
    local current_hash=""
    if tdoc_has_frontmatter "$doc_path"; then
        local fm=$(tdoc_parse_frontmatter "$doc_path")
        if command -v shasum >/dev/null 2>&1; then
            current_hash=$(echo "$fm" | shasum -a 256 | awk '{print $1}')
        elif command -v sha256sum >/dev/null 2>&1; then
            current_hash=$(echo "$fm" | sha256sum | awk '{print $1}')
        fi
    fi

    # Compare
    if [[ "$stored_hash" != "$current_hash" ]]; then
        # Mark for resync
        if command -v jq >/dev/null 2>&1; then
            jq '.needs_resync = true' "$meta_file" > "$meta_file.tmp" 2>/dev/null
            mv "$meta_file.tmp" "$meta_file" 2>/dev/null
        fi
        return 1
    fi

    return 0
}

# Resync metadata from frontmatter (frontmatter is source of truth)
tdoc_resync_from_frontmatter() {
    local doc_path="$1"
    local abs_path=$(realpath "$doc_path" 2>/dev/null || echo "$doc_path")

    # Find existing metadata file
    local meta_file=""
    local timestamp=""
    for mf in "$TDOCS_DB_DIR"/*.meta; do
        [[ ! -f "$mf" ]] && continue
        if grep -q "\"doc_path\": \"$abs_path\"" "$mf" 2>/dev/null; then
            meta_file="$mf"
            timestamp=$(basename "$mf" .meta)
            break
        fi
    done

    [[ -z "$meta_file" ]] && return 1

    # Parse frontmatter
    local fm=$(tdoc_parse_frontmatter "$doc_path")

    # Extract fields from frontmatter using jq if available
    if command -v jq >/dev/null 2>&1; then
        local fm_type=$(echo "$fm" | jq -r '.type // ""' 2>/dev/null)
        local fm_lifecycle=$(echo "$fm" | jq -r '.lifecycle // ""' 2>/dev/null)
        local fm_tags=$(echo "$fm" | jq -r '.tags // []' 2>/dev/null)

        # Update metadata with frontmatter values (frontmatter is truth)
        if [[ -n "$fm_type" ]]; then
            jq ".type = \"$fm_type\"" "$meta_file" > "$meta_file.tmp"
            mv "$meta_file.tmp" "$meta_file"
        fi

        if [[ -n "$fm_lifecycle" ]]; then
            jq ".lifecycle = \"$fm_lifecycle\"" "$meta_file" > "$meta_file.tmp"
            mv "$meta_file.tmp" "$meta_file"
        fi

        # Recalculate hash and mark as synced
        local new_hash=""
        if command -v shasum >/dev/null 2>&1; then
            new_hash=$(echo "$fm" | shasum -a 256 | awk '{print $1}')
        elif command -v sha256sum >/dev/null 2>&1; then
            new_hash=$(echo "$fm" | sha256sum | awk '{print $1}')
        fi

        jq ".frontmatter_hash = \"$new_hash\" | .needs_resync = false" "$meta_file" > "$meta_file.tmp"
        mv "$meta_file.tmp" "$meta_file"
    fi
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

# Get metadata by document path (with auto-sync check)
tdoc_db_get_by_path() {
    local doc_path="$1"
    local abs_path=$(realpath "$doc_path" 2>/dev/null || echo "$doc_path")

    # Check if needs resync (frontmatter is source of truth)
    if ! tdoc_check_sync "$doc_path" 2>/dev/null; then
        # Re-import from frontmatter
        tdoc_resync_from_frontmatter "$doc_path" 2>/dev/null
    fi

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

# Ensure metadata has rank calculated and cached
# Updates the .meta file with rank and rank_factors
tdoc_db_ensure_rank() {
    local doc_path="$1"
    local abs_path=$(realpath "$doc_path" 2>/dev/null || echo "$doc_path")

    # Find metadata file
    local meta_file=""
    for mf in "$TDOCS_DB_DIR"/*.meta; do
        [[ ! -f "$mf" ]] && continue
        if grep -q "\"doc_path\": \"$abs_path\"" "$mf" 2>/dev/null; then
            meta_file="$mf"
            break
        fi
    done

    [[ -z "$meta_file" ]] && return 1

    # Check if rank already exists
    if grep -q '"rank":' "$meta_file" 2>/dev/null; then
        # Already has rank
        return 0
    fi

    # Get metadata fields needed for ranking
    local meta=$(cat "$meta_file")
    local doc_type=$(echo "$meta" | grep -o '"type": "[^"]*"' | cut -d'"' -f4)
    local timeless=$(echo "$meta" | grep -o '"timeless": [^,}]*' | awk '{print $2}' | tr -d ',' | tr -d '"')
    local module=$(echo "$meta" | grep -o '"module": "[^"]*"' | cut -d'"' -f4)
    local tags=$(echo "$meta" | grep -o '"tags": \[[^\]]*\]')
    local created=$(echo "$meta" | grep -o '"created": "[^"]*"' | cut -d'"' -f4)

    # Calculate rank if we have ranking.sh loaded
    if ! command -v tdoc_calculate_rank >/dev/null 2>&1; then
        return 1
    fi

    local rank_json=$(tdoc_calculate_rank "$doc_path" "$doc_type" "$timeless" "$module" "$tags" "$created")

    # Extract rank and factors
    local rank=$(echo "$rank_json" | grep -o '"rank": [0-9.]*' | head -1 | cut -d' ' -f2)
    local base_rank=$(echo "$rank_json" | grep -o '"type_base": [0-9.]*' | cut -d' ' -f2)
    local length_bonus=$(echo "$rank_json" | grep -o '"length_bonus": [0-9.]*' | cut -d' ' -f2)
    local metadata_bonus=$(echo "$rank_json" | grep -o '"metadata_bonus": [0-9.]*' | cut -d' ' -f2)
    local recency_boost=$(echo "$rank_json" | grep -o '"recency_boost": [0-9.]*' | cut -d' ' -f2)

    # Insert rank fields before the closing brace
    # Remove trailing } and add rank fields
    local updated_meta=$(echo "$meta" | sed 's/}$//')
    updated_meta="${updated_meta},
  \"rank\": $rank,
  \"rank_factors\": {
    \"base_rank\": $base_rank,
    \"length_bonus\": $length_bonus,
    \"metadata_bonus\": $metadata_bonus,
    \"recency_boost\": $recency_boost
  }
}"

    # Write back to file
    echo "$updated_meta" > "$meta_file"
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

    # PERFORMANCE: Batch process all .meta files at once with cat + jq
    # This reduces process spawns from ~273 to just 1-2
    if command -v jq >/dev/null 2>&1 && [[ -z "$category" ]] && [[ -z "$module" ]] && [[ -z "$tags" ]]; then
        # Fast path: no filters, batch process everything with one jq call
        # Use jq slurp mode to read all files at once and filter/compact
        cat "$TDOCS_DB_DIR"/*.meta 2>/dev/null | \
            jq -c 'select(.doc_path != null)' 2>/dev/null || true
    else
        # Slow path: filters require per-file processing
        for meta_file in "$TDOCS_DB_DIR"/*.meta; do
            [[ ! -f "$meta_file" ]] && continue

            local meta=$(cat "$meta_file")

            # PERFORMANCE: Use jq for faster doc_path extraction
            if command -v jq >/dev/null 2>&1; then
                local doc_path=$(echo "$meta" | jq -r '.doc_path // ""' 2>/dev/null)
            else
                local doc_path=$(echo "$meta" | grep -o '"doc_path": "[^"]*"' | cut -d'"' -f4)
            fi

            # Check if the actual document file exists
            if [[ -n "$doc_path" ]] && [[ ! -f "$doc_path" ]]; then
                # Skip stale entries for non-existent files
                continue
            fi

            # Apply filters - use jq if available (much faster)
            if command -v jq >/dev/null 2>&1; then
                if [[ -n "$category" ]]; then
                    local meta_category=$(echo "$meta" | jq -r '.category // ""' 2>/dev/null)
                    [[ "$meta_category" != "$category" ]] && continue
                fi

                if [[ -n "$module" ]]; then
                    local meta_module=$(echo "$meta" | jq -r '.module // ""' 2>/dev/null)
                    [[ "$meta_module" != "$module" ]] && continue
                fi

                if [[ -n "$tags" ]]; then
                    local found=false
                    IFS=',' read -ra tag_array <<< "$tags"
                    for tag in "${tag_array[@]}"; do
                        tag="${tag// /}"  # Trim whitespace without sed
                        local has_tag=$(echo "$meta" | jq --arg t "$tag" '.tags | index($t) != null' 2>/dev/null)
                        if [[ "$has_tag" == "true" ]]; then
                            found=true
                            break
                        fi
                    done
                    [[ "$found" == false ]] && continue
                fi
            else
                # Fallback to grep (slower)
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
            fi

            # PERFORMANCE: Output as single line - avoid tr/sed pipeline
            echo "$meta" | tr -d '\n'
            echo ""
        done
    fi
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

# Migrate category field to lifecycle (automatic migration)
# Runs on tdocs init to migrate old metadata
tdoc_migrate_category_to_lifecycle() {
    local migrated_count=0
    local skipped_count=0

    for meta_file in "$TDOCS_DB_DIR"/*.meta; do
        [[ ! -f "$meta_file" ]] && continue

        # Check if already has lifecycle
        local has_lifecycle=$(jq -r '.lifecycle // ""' "$meta_file" 2>/dev/null)
        if [[ -n "$has_lifecycle" ]]; then
            ((skipped_count++))
            continue
        fi

        # Read category
        local category=$(jq -r '.category // "other"' "$meta_file" 2>/dev/null)

        # Map category to lifecycle
        local lifecycle="W"  # Default: Working
        case "$category" in
            core) lifecycle="C" ;;  # Canonical
            *) lifecycle="W" ;;     # Working
        esac

        # Update meta file
        if command -v jq >/dev/null 2>&1; then
            jq ".lifecycle = \"$lifecycle\"" "$meta_file" > "$meta_file.tmp" 2>/dev/null
            mv "$meta_file.tmp" "$meta_file" 2>/dev/null
            ((migrated_count++))
        fi
    done

    if [[ $migrated_count -gt 0 ]]; then
        echo "Migrated $migrated_count documents from category→lifecycle" >&2
    fi
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
