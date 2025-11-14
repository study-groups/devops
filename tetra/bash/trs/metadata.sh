#!/usr/bin/env bash
# TRS Metadata Library
# Standard metadata format for cross-module correlation

# Source dependencies
if [[ -f "$TETRA_SRC/bash/trs/trs.sh" ]]; then
    source "$TETRA_SRC/bash/trs/trs.sh"
fi

# Create metadata for a TRS record
# Usage: trs_metadata_create timestamp module type kind [options...]
# Options: --tags "tag1,tag2" --parent-id ID --flow-id ID --related-ids "id1,id2"
# Returns: Path to metadata file
trs_metadata_create() {
    local timestamp="$1"
    local module="$2"
    local type="$3"
    local kind="$4"
    shift 4

    if [[ -z "$timestamp" || -z "$module" || -z "$type" || -z "$kind" ]]; then
        echo "Error: trs_metadata_create requires timestamp, module, type, kind" >&2
        return 1
    fi

    # Parse options
    local tags=""
    local parent_id=""
    local flow_id=""
    local related_ids=""
    local custom_fields=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --tags)
                tags="$2"
                shift 2
                ;;
            --parent-id)
                parent_id="$2"
                shift 2
                ;;
            --flow-id)
                flow_id="$2"
                shift 2
                ;;
            --related-ids)
                related_ids="$2"
                shift 2
                ;;
            --custom)
                custom_fields="$2"
                shift 2
                ;;
            *)
                echo "Unknown option: $1" >&2
                shift
                ;;
        esac
    done

    # Build tags array
    local tags_json="[]"
    if [[ -n "$tags" ]]; then
        IFS=',' read -ra tag_array <<< "$tags"
        tags_json="[$(printf '"%s",' "${tag_array[@]}" | sed 's/,$//')]"
    fi

    # Build related IDs array
    local related_json="[]"
    if [[ -n "$related_ids" ]]; then
        IFS=',' read -ra related_array <<< "$related_ids"
        related_json="[$(printf '"%s",' "${related_array[@]}" | sed 's/,$//')]"
    fi

    # Build metadata JSON
    local iso_timestamp=$(date -u -r "$timestamp" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u +%Y-%m-%dT%H:%M:%SZ)

    local metadata=$(cat <<EOF
{
    "timestamp": $timestamp,
    "created": "$iso_timestamp",
    "module": "$module",
    "type": "$type",
    "kind": "$kind",
    "tags": $tags_json,
    "relationships": {
        "parent_id": ${parent_id:+\"$parent_id\"}${parent_id:-null},
        "flow_id": ${flow_id:+\"$flow_id\"}${flow_id:-null},
        "related_ids": $related_json
    },
    "user": "$USER",
    "hostname": "$(hostname)"$([ -n "$custom_fields" ] && echo ",$custom_fields" || echo "")
}
EOF
)

    # Write metadata file using TRS
    local filepath=$(trs_write_at "$timestamp" "$module" "$type" "$kind" "meta.json" "$metadata")

    echo "$filepath"
}

# Read metadata from a TRS record
# Usage: trs_metadata_read filepath
# Returns: JSON metadata
trs_metadata_read() {
    local filepath="$1"

    if [[ -z "$filepath" ]]; then
        echo "Error: trs_metadata_read requires filepath" >&2
        return 1
    fi

    # Check if it's a metadata file
    if [[ "$filepath" == *.meta.json ]]; then
        cat "$filepath"
        return 0
    fi

    # Try to find corresponding metadata file
    local dir=$(dirname "$filepath")
    local filename=$(basename "$filepath")
    local timestamp="${filename%%.*}"

    # Look for metadata file with same timestamp
    local metadata_file=$(find "$dir" -name "${timestamp}.*.meta.json" | head -1)

    if [[ -f "$metadata_file" ]]; then
        cat "$metadata_file"
    else
        echo "{}" # Empty metadata
    fi
}

# Add tags to existing metadata
# Usage: trs_metadata_add_tags filepath tags...
trs_metadata_add_tags() {
    local filepath="$1"
    shift
    local new_tags=("$@")

    if [[ -z "$filepath" || ${#new_tags[@]} -eq 0 ]]; then
        echo "Error: trs_metadata_add_tags requires filepath and tags" >&2
        return 1
    fi

    if [[ ! -f "$filepath" ]]; then
        echo "Error: Metadata file not found: $filepath" >&2
        return 1
    fi

    # Read existing metadata
    local existing=$(cat "$filepath")

    # Extract existing tags
    local existing_tags=$(echo "$existing" | jq -r '.tags[]' 2>/dev/null || echo "")

    # Combine and deduplicate
    local all_tags=($existing_tags "${new_tags[@]}")
    local unique_tags=($(printf '%s\n' "${all_tags[@]}" | sort -u))

    # Build new tags JSON
    local tags_json="[$(printf '"%s",' "${unique_tags[@]}" | sed 's/,$//')]"

    # Update metadata
    if type jq &>/dev/null; then
        echo "$existing" | jq ".tags = $tags_json" > "$filepath"
    else
        # Fallback: manual JSON update
        echo "Warning: jq not available, tags not updated" >&2
    fi
}

# Set relationship in metadata
# Usage: trs_metadata_set_relationship filepath relationship_type relationship_id
trs_metadata_set_relationship() {
    local filepath="$1"
    local rel_type="$2"
    local rel_id="$3"

    if [[ -z "$filepath" || -z "$rel_type" || -z "$rel_id" ]]; then
        echo "Error: trs_metadata_set_relationship requires filepath, relationship_type, and relationship_id" >&2
        return 1
    fi

    if [[ ! -f "$filepath" ]]; then
        echo "Error: Metadata file not found: $filepath" >&2
        return 1
    fi

    # Update metadata
    if type jq &>/dev/null; then
        local tmp=$(mktemp)
        jq ".relationships.${rel_type} = \"$rel_id\"" "$filepath" > "$tmp"
        mv "$tmp" "$filepath"
    else
        echo "Warning: jq not available, relationship not set" >&2
    fi
}

# Query TRS records by tag
# Usage: trs_query_by_tag tag [module]
# Returns: List of metadata files with matching tag
trs_query_by_tag() {
    local tag="$1"
    local module="${2:-*}"

    if [[ -z "$tag" ]]; then
        echo "Error: trs_query_by_tag requires tag" >&2
        return 1
    fi

    # Search all metadata files for tag
    find "$TETRA_DIR/$module/db/" -name "*.meta.json" -exec grep -l "\"$tag\"" {} \; 2>/dev/null
}

# Query TRS records by relationship
# Usage: trs_query_by_relationship relationship_type relationship_id [module]
# Returns: List of metadata files with matching relationship
trs_query_by_relationship() {
    local rel_type="$1"
    local rel_id="$2"
    local module="${3:-*}"

    if [[ -z "$rel_type" || -z "$rel_id" ]]; then
        echo "Error: trs_query_by_relationship requires relationship_type and relationship_id" >&2
        return 1
    fi

    # Search metadata files for relationship
    find "$TETRA_DIR/$module/db/" -name "*.meta.json" -exec grep -l "\"${rel_type}\": \"$rel_id\"" {} \; 2>/dev/null
}

# Get all records related to a given record
# Usage: trs_correlate_record filepath
# Returns: List of related record paths
trs_correlate_record() {
    local filepath="$1"

    if [[ -z "$filepath" || ! -f "$filepath" ]]; then
        echo "Error: trs_correlate_record requires valid filepath" >&2
        return 1
    fi

    # Read metadata
    local metadata=$(trs_metadata_read "$filepath")

    if [[ -z "$metadata" || "$metadata" == "{}" ]]; then
        return 0
    fi

    # Extract timestamp
    local filename=$(basename "$filepath")
    local timestamp="${filename%%.*}"

    echo "# Correlation for: $filepath" >&2
    echo "" >&2

    # Find all records with same timestamp
    echo "## Same timestamp ($timestamp):" >&2
    trs_query_timestamp "$timestamp" | while read -r match; do
        [[ "$match" != "$filepath" ]] && echo "$match"
    done

    echo "" >&2

    # Find by parent_id
    local parent_id=$(echo "$metadata" | jq -r '.relationships.parent_id // empty' 2>/dev/null)
    if [[ -n "$parent_id" && "$parent_id" != "null" ]]; then
        echo "## Parent ($parent_id):" >&2
        trs_query_by_relationship "parent_id" "$parent_id"
        echo "" >&2
    fi

    # Find by flow_id
    local flow_id=$(echo "$metadata" | jq -r '.relationships.flow_id // empty' 2>/dev/null)
    if [[ -n "$flow_id" && "$flow_id" != "null" ]]; then
        echo "## Same flow ($flow_id):" >&2
        trs_query_by_relationship "flow_id" "$flow_id"
        echo "" >&2
    fi

    # Find by related_ids
    local related_ids=$(echo "$metadata" | jq -r '.relationships.related_ids[]? // empty' 2>/dev/null)
    if [[ -n "$related_ids" ]]; then
        echo "## Related IDs:" >&2
        echo "$related_ids" | while read -r rel_id; do
            trs_query_by_relationship "related_id" "$rel_id"
        done
        echo "" >&2
    fi
}

# Create a timeline view of related records
# Usage: trs_timeline flow_id
# Returns: Chronological list of all records in flow
trs_timeline() {
    local flow_id="$1"

    if [[ -z "$flow_id" ]]; then
        echo "Error: trs_timeline requires flow_id" >&2
        return 1
    fi

    echo "Timeline for flow: $flow_id" >&2
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
    echo "" >&2

    # Find all records with this flow_id
    local records=$(trs_query_by_relationship "flow_id" "$flow_id")

    if [[ -z "$records" ]]; then
        echo "No records found for flow: $flow_id" >&2
        return 0
    fi

    # Sort by timestamp and display
    echo "$records" | while read -r record; do
        local filename=$(basename "$record")
        local timestamp="${filename%%.*}"
        local iso_ts=$(date -u -r "$timestamp" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo "unknown")

        # Get module from path
        local module=$(get_module_from_file "$record")

        echo "[$iso_ts] $module: $filename"
    done | sort

    echo "" >&2
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
}

# Export functions
export -f trs_metadata_create
export -f trs_metadata_read
export -f trs_metadata_add_tags
export -f trs_metadata_set_relationship
export -f trs_query_by_tag
export -f trs_query_by_relationship
export -f trs_correlate_record
export -f trs_timeline
