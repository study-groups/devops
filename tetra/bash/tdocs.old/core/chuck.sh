#!/usr/bin/env bash

# TDOC Chuck System
# Captures LLM responses as lower-grade technical documentation
# Storage: $TETRA_DIR/tdoc/chuck/
# Filename: {id}.{kind}.md (id = Linux epoch timestamp in seconds)

# Get chuck directory
tdocs_chuck_get_dir() {
    echo "$TDOCS_DIR/chuck"
}

# Get path to chuck file by id
tdocs_chuck_get_path() {
    local id="$1"
    local kind="$2"
    echo "$(tdocs_chuck_get_dir)/${id}.${kind}.md"
}

# Save LLM response as chuck document
# Usage: tdocs_chuck_save <kind> [content_source]
tdocs_chuck_save() {
    local kind="$1"
    local content_source="${2:-stdin}"

    if [[ -z "$kind" ]]; then
        echo "Error: kind is required" >&2
        echo "Usage: tdoc chuck save <kind>" >&2
        return 1
    fi

    # Validate kind (alphanumeric, dash, underscore)
    if [[ ! "$kind" =~ ^[a-zA-Z0-9_-]+$ ]]; then
        echo "Error: kind must be alphanumeric (with - or _)" >&2
        return 1
    fi

    # Generate ID (Linux epoch timestamp in seconds)
    local id=$(date +%s)

    # Ensure chuck directory exists
    local chuck_dir=$(tdocs_chuck_get_dir)
    mkdir -p "$chuck_dir"

    # Get file path
    local chuck_file=$(tdocs_chuck_get_path "$id" "$kind")

    # Read content
    local content=""
    if [[ "$content_source" == "stdin" ]]; then
        content=$(cat)
    elif [[ -f "$content_source" ]]; then
        content=$(cat "$content_source")
    else
        echo "Error: Invalid content source" >&2
        return 1
    fi

    # Create frontmatter
    local created=$(date +%Y-%m-%dT%H:%M:%SZ)
    local frontmatter="---
id: $id
kind: $kind
created: $created
source: llm
status: raw
grade: low
---
"

    # Write file
    echo "$frontmatter" > "$chuck_file"
    echo "$content" >> "$chuck_file"

    echo "Chucked: $chuck_file"
    echo "ID: $id"
    echo "Kind: $kind"

    # Return id for further operations
    return 0
}

# List chuck documents
# Usage: tdocs_chuck_list [--kind KIND] [--recent N] [--json]
tdocs_chuck_list() {
    local filter_kind=""
    local limit=""
    local json_output=false

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --kind)
                filter_kind="$2"
                shift 2
                ;;
            --recent)
                limit="$2"
                shift 2
                ;;
            --json)
                json_output=true
                shift
                ;;
            *)
                shift
                ;;
        esac
    done

    local chuck_dir=$(tdocs_chuck_get_dir)

    if [[ ! -d "$chuck_dir" ]]; then
        echo "No chuck documents found"
        return 0
    fi

    # Find chuck files, sort by epoch (newest first)
    local files=()
    while IFS= read -r file; do
        local basename=$(basename "$file")

        # Parse filename: {epoch}.{kind}.md
        if [[ "$basename" =~ ^([0-9]+)\.([^.]+)\.md$ ]]; then
            local epoch="${BASH_REMATCH[1]}"
            local kind="${BASH_REMATCH[2]}"

            # Apply kind filter
            if [[ -n "$filter_kind" && "$kind" != "$filter_kind" ]]; then
                continue
            fi

            files+=("$file")
        fi
    done < <(find "$chuck_dir" -name "*.md" -type f | sort -t. -k1 -rn)

    # Apply limit
    local count=0
    for file in "${files[@]}"; do
        if [[ -n "$limit" && $count -ge $limit ]]; then
            break
        fi

        local basename=$(basename "$file")
        if [[ "$basename" =~ ^([0-9]+)\.([^.]+)\.md$ ]]; then
            local epoch="${BASH_REMATCH[1]}"
            local kind="${BASH_REMATCH[2]}"
            local date=$(date -r "$epoch" +"%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "N/A")

            # Extract first line of content (skip frontmatter)
            local preview=$(sed -n '/^---$/,/^---$/d; /^#/p; /^[^#]/p' "$file" | head -1 | sed 's/^# //')

            if [[ "$json_output" == true ]]; then
                echo "{\"epoch\":$epoch,\"kind\":\"$kind\",\"date\":\"$date\",\"file\":\"$file\"}"
            else
                printf "%-12s %-15s %-20s %s\n" "$epoch" "$kind" "$date" "${preview:0:50}"
            fi
        fi

        ((count++))
    done

    if [[ $count -eq 0 ]]; then
        echo "No chuck documents found"
    fi
}

# View a chuck document
# Usage: tdocs_chuck_view <id> [kind]
# Or: tdocs_chuck_view --kind <kind> (shows most recent)
tdocs_chuck_view() {
    local id=""
    local kind=""
    local show_latest=false

    if [[ "$1" == "--kind" ]]; then
        kind="$2"
        show_latest=true
    else
        id="$1"
        kind="$2"
    fi

    local chuck_dir=$(tdocs_chuck_get_dir)

    if [[ "$show_latest" == true ]]; then
        # Find most recent for kind
        local latest_file=$(find "$chuck_dir" -name "*.${kind}.md" -type f | sort -t. -k1 -rn | head -1)

        if [[ -z "$latest_file" ]]; then
            echo "No chuck documents found for kind: $kind" >&2
            return 1
        fi

        cat "$latest_file"
        return 0
    fi

    # Find by id (and optionally kind)
    if [[ -z "$kind" ]]; then
        # Find any file with this id
        local found_file=$(find "$chuck_dir" -name "${id}.*.md" -type f | head -1)

        if [[ -z "$found_file" ]]; then
            echo "No chuck document found for id: $id" >&2
            return 1
        fi

        cat "$found_file"
    else
        # Specific id and kind
        local chuck_file=$(tdocs_chuck_get_path "$id" "$kind")

        if [[ ! -f "$chuck_file" ]]; then
            echo "Chuck document not found: $chuck_file" >&2
            return 1
        fi

        cat "$chuck_file"
    fi
}

# Delete a chuck document
# Usage: tdocs_chuck_delete <id> [kind]
tdocs_chuck_delete() {
    local id="$1"
    local kind="$2"

    if [[ -z "$id" ]]; then
        echo "Error: id is required" >&2
        return 1
    fi

    local chuck_dir=$(tdocs_chuck_get_dir)

    if [[ -z "$kind" ]]; then
        # Find and delete any file with this id
        local files=$(find "$chuck_dir" -name "${id}.*.md" -type f)

        if [[ -z "$files" ]]; then
            echo "No chuck documents found for id: $id" >&2
            return 1
        fi

        echo "$files" | while read -r file; do
            rm -f "$file"
            echo "Deleted: $file"
        done
    else
        # Specific id and kind
        local chuck_file=$(tdocs_chuck_get_path "$id" "$kind")

        if [[ ! -f "$chuck_file" ]]; then
            echo "Chuck document not found: $chuck_file" >&2
            return 1
        fi

        rm -f "$chuck_file"
        echo "Deleted: $chuck_file"
    fi
}

# Promote chuck document to reference directory
# Usage: tdocs_chuck_promote <id> <dest_path>
tdocs_chuck_promote() {
    local id="$1"
    local dest_path="$2"

    if [[ -z "$id" || -z "$dest_path" ]]; then
        echo "Error: id and destination path are required" >&2
        echo "Usage: tdoc chuck promote <id> <dest_path>" >&2
        return 1
    fi

    local chuck_dir=$(tdocs_chuck_get_dir)

    # Find chuck file
    local chuck_file=$(find "$chuck_dir" -name "${id}.*.md" -type f | head -1)

    if [[ -z "$chuck_file" || ! -f "$chuck_file" ]]; then
        echo "Chuck document not found for id: $id" >&2
        return 1
    fi

    # Ensure destination directory exists
    local dest_dir=$(dirname "$dest_path")
    mkdir -p "$dest_dir"

    # Strip frontmatter from content before copying
    sed -n '/^---$/,/^---$/!p' "$chuck_file" | sed '1{/^$/d}' > "$dest_path"

    echo "Promoted: $chuck_file"
    echo "      -> $dest_path"
    echo ""
    echo "Original chuck document preserved."
    echo "To delete: tdoc chuck delete $id"
}

# Search chuck documents
# Usage: tdocs_chuck_search <query>
tdocs_chuck_search() {
    local query="$1"

    if [[ -z "$query" ]]; then
        echo "Error: search query is required" >&2
        return 1
    fi

    local chuck_dir=$(tdocs_chuck_get_dir)

    if [[ ! -d "$chuck_dir" ]]; then
        echo "No chuck documents found"
        return 0
    fi

    echo "Searching chuck documents for: $query"
    echo ""

    # Search with grep, show filename and matching lines
    grep -r -i -n "$query" "$chuck_dir"/*.md 2>/dev/null | while IFS=: read -r file line content; do
        local basename=$(basename "$file")

        if [[ "$basename" =~ ^([0-9]+)\.([^.]+)\.md$ ]]; then
            local id="${BASH_REMATCH[1]}"
            local kind="${BASH_REMATCH[2]}"

            echo "[$id.$kind:$line] $content"
        fi
    done
}

# Export functions
export -f tdocs_chuck_get_dir
export -f tdocs_chuck_get_path
export -f tdocs_chuck_save
export -f tdocs_chuck_list
export -f tdocs_chuck_view
export -f tdocs_chuck_delete
export -f tdocs_chuck_promote
export -f tdocs_chuck_search
