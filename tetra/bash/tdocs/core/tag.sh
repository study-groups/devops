#!/usr/bin/env bash
# tdocs/core/tag.sh - Free-form document tagging
#
# Tags are stored by content hash, so they survive file moves/renames.
# Tags are just strings - no taxonomy, no hierarchy, no enforcement.
#
# Usage:
#   tdocs tag 4 sdk api       # add tags to doc 4
#   tdocs tag 4               # show tags for doc 4
#   tdocs untag 4 api         # remove tag from doc 4
#   tdocs tags                # list all known tags
#   tdocs tagged sdk          # list docs with tag "sdk"

# Add tags to a document
# Args: reference tag1 [tag2 ...]
_tdocs_tag_add() {
    local ref="${1:?reference required}"
    shift

    [[ $# -eq 0 ]] && {
        # No tags provided - show current tags
        _tdocs_tag_show "$ref"
        return
    }

    local path
    path=$(_tdocs_ref_to_path "$ref") || return 1

    local hash=$(_tdocs_hash "$path")
    local -a tags=("$@")

    # Add tags (merge with existing)
    local tmp=$(mktemp)
    local tag_json
    printf -v tag_json '%s\n' "${tags[@]}"
    tag_json=$(echo "$tag_json" | jq -Rs 'split("\n") | map(select(length > 0))')

    jq --arg h "$hash" --argjson t "$tag_json" \
        '.[$h] = ((.[$h] // []) + $t | unique)' \
        "$TDOCS_TAGS" > "$tmp" && mv "$tmp" "$TDOCS_TAGS"

    echo "[tag] Added to $(basename "$path"): ${tags[*]}"
}

# Show tags for a document
_tdocs_tag_show() {
    local ref="${1:?reference required}"

    local path
    path=$(_tdocs_ref_to_path "$ref") || return 1

    local hash=$(_tdocs_hash "$path")
    local tags
    tags=$(jq -r --arg h "$hash" '.[$h] // [] | join(" ")' "$TDOCS_TAGS" 2>/dev/null)

    if [[ -n "$tags" && "$tags" != "null" ]]; then
        echo "$(basename "$path"): $tags"
    else
        echo "$(basename "$path"): (no tags)"
    fi
}

# Remove tags from a document
# Args: reference tag1 [tag2 ...]
_tdocs_untag() {
    local ref="${1:?reference required}"
    shift

    [[ $# -eq 0 ]] && {
        echo "Usage: tdocs untag <ref> <tag> [tag ...]" >&2
        return 1
    }

    local path
    path=$(_tdocs_ref_to_path "$ref") || return 1

    local hash=$(_tdocs_hash "$path")
    local -a tags=("$@")

    # Remove tags
    local tmp=$(mktemp)
    local tag_json
    printf -v tag_json '%s\n' "${tags[@]}"
    tag_json=$(echo "$tag_json" | jq -Rs 'split("\n") | map(select(length > 0))')

    jq --arg h "$hash" --argjson t "$tag_json" \
        '.[$h] = ((.[$h] // []) - $t)' \
        "$TDOCS_TAGS" > "$tmp" && mv "$tmp" "$TDOCS_TAGS"

    echo "[untag] Removed from $(basename "$path"): ${tags[*]}"
}

# List all known tags with counts
_tdocs_tags_list() {
    echo "Tags:"
    jq -r 'to_entries | map(.value[]) | group_by(.) | map({tag: .[0], count: length}) | sort_by(-.count) | .[] | "  \(.tag) (\(.count))"' "$TDOCS_TAGS" 2>/dev/null
}

# List documents with a specific tag
_tdocs_tagged() {
    local tag="${1:?tag required}"

    # Get all hashes with this tag
    local -a hashes
    while IFS= read -r h; do
        [[ -n "$h" ]] && hashes+=("$h")
    done < <(jq -r --arg t "$tag" 'to_entries | map(select(.value | contains([$t]))) | .[].key' "$TDOCS_TAGS" 2>/dev/null)

    if [[ ${#hashes[@]} -eq 0 ]]; then
        echo "[tagged] No documents with tag: $tag"
        return 0
    fi

    # Find files matching these hashes from current slot
    local slot_file="$TDOCS_SLOTS/0.list"
    [[ -f "$slot_file" ]] || {
        echo "[tagged] Run 'tdocs ls' first to populate the list"
        return 1
    }

    echo "Documents tagged '$tag':"
    local i=1
    while IFS= read -r path; do
        local hash=$(_tdocs_hash "$path")
        for h in "${hashes[@]}"; do
            if [[ "$hash" == "$h" ]]; then
                printf "%3d. %s\n" "$i" "$(basename "$path")"
                break
            fi
        done
        ((i++))
    done < "$slot_file"
}
