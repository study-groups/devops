#!/usr/bin/env bash
# tdocs/core/view.sh - View documents by slot:index reference
#
# Reference formats:
#   4       → slot 0, index 4 (4th item of current list)
#   1:3     → slot 1, index 3 (3rd item of previous list)
#   sdk:2   → named list "sdk", index 2
#   4 --meta → show metadata for item 4
#
# Usage:
#   tdocs view 4              # view 4th doc
#   tdocs view 1:3            # view 3rd from previous list
#   tdocs view sdk:2          # view 2nd from "sdk" list
#   tdocs view 4 --meta       # show metadata only
#   tdocs view 4 --path       # show full path only

# Parse reference into slot and index
# Args: reference (e.g., "4", "1:3", "sdk:2")
# Returns: slot index (space-separated)
_tdocs_parse_ref() {
    local ref="${1:?reference required}"

    if [[ "$ref" =~ ^([0-9]+)$ ]]; then
        # Simple index: slot 0
        echo "0 ${BASH_REMATCH[1]}"
    elif [[ "$ref" =~ ^([0-9]+):([0-9]+)$ ]]; then
        # Numeric slot:index
        echo "${BASH_REMATCH[1]} ${BASH_REMATCH[2]}"
    elif [[ "$ref" =~ ^([a-zA-Z][a-zA-Z0-9_-]*):([0-9]+)$ ]]; then
        # Named slot:index
        echo "${BASH_REMATCH[1]} ${BASH_REMATCH[2]}"
    else
        echo "[view] ERROR: Invalid reference: $ref" >&2
        echo "[view] Formats: N, SLOT:N, NAME:N" >&2
        return 1
    fi
}

# Get file path from reference
_tdocs_ref_to_path() {
    local ref="${1:?reference required}"
    local parsed slot index

    parsed=$(_tdocs_parse_ref "$ref") || return 1
    read -r slot index <<< "$parsed"

    local file="$TDOCS_SLOTS/${slot}.list"
    [[ -f "$file" ]] || {
        echo "[view] ERROR: Slot not found: $slot" >&2
        return 1
    }

    local path
    path=$(sed -n "${index}p" "$file")
    [[ -n "$path" ]] || {
        echo "[view] ERROR: Index $index out of range (slot $slot has $(_tdocs_slots_count "$slot") items)" >&2
        return 1
    }

    echo "$path"
}

# Show document metadata
_tdocs_view_meta() {
    local path="${1:?path required}"

    [[ -f "$path" ]] || {
        echo "[view] ERROR: File not found: $path" >&2
        return 1
    }

    local hash=$(_tdocs_hash "$path")
    local size=$(wc -c < "$path" | tr -d ' ')
    local lines=$(wc -l < "$path" | tr -d ' ')
    local modified=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$path" 2>/dev/null || stat -c "%y" "$path" 2>/dev/null | cut -d. -f1)

    # Get tags
    local tags
    tags=$(jq -r --arg h "$hash" '.[$h] // [] | join(", ")' "$TDOCS_TAGS" 2>/dev/null)
    [[ "$tags" == "null" || -z "$tags" ]] && tags="(none)"

    # Extract title from first heading
    local title
    title=$(grep -m1 '^#' "$path" | sed 's/^#* *//')
    [[ -z "$title" ]] && title=$(basename "$path" .md)

    echo "File:     $path"
    echo "Title:    $title"
    echo "Hash:     $hash"
    echo "Size:     $size bytes, $lines lines"
    echo "Modified: $modified"
    echo "Tags:     $tags"
}

# View document content
_tdocs_view_content() {
    local path="${1:?path required}"

    [[ -f "$path" ]] || {
        echo "[view] ERROR: File not found: $path" >&2
        return 1
    }

    # Use bat if available, else cat
    if command -v bat &>/dev/null; then
        bat --style=plain --paging=never "$path"
    elif command -v glow &>/dev/null; then
        glow "$path"
    else
        cat "$path"
    fi
}

# Main view command
# Args: reference [--meta|--path|--edit]
_tdocs_view() {
    local ref="${1:?reference required}"
    shift

    local mode="content"
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --meta|-m) mode="meta"; shift ;;
            --path|-p) mode="path"; shift ;;
            --edit|-e) mode="edit"; shift ;;
            *) shift ;;
        esac
    done

    local path
    path=$(_tdocs_ref_to_path "$ref") || return 1

    case "$mode" in
        meta)    _tdocs_view_meta "$path" ;;
        path)    echo "$path" ;;
        edit)    ${EDITOR:-vim} "$path" ;;
        content) _tdocs_view_content "$path" ;;
    esac
}
