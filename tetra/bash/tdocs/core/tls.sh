#!/usr/bin/env bash
# tdocs/core/tls.sh - Tetra List with slot memory
#
# Lists markdown files from mount points with numbered output.
# Results are stored in slots (ring buffer) for later reference.
#
# Slot system:
#   slot 0 = current/most recent list
#   slot 1 = previous list
#   slot 2 = 2nd previous, etc.
#
# Usage:
#   tdocs ls                    # list all docs → slot 0
#   tdocs ls --mount pja        # list from specific mount
#   tdocs ls --tag sdk          # filter by tag
#   tdocs ls --save mysearch    # save as named list

# Rotate slots: move 0→1, 1→2, etc. and clear slot 0
_tdocs_slots_rotate() {
    local i=$((TDOCS_SLOT_COUNT - 1))
    while ((i > 0)); do
        [[ -f "$TDOCS_SLOTS/$((i-1)).list" ]] && \
            mv "$TDOCS_SLOTS/$((i-1)).list" "$TDOCS_SLOTS/$i.list"
        ((i--))
    done
    : > "$TDOCS_SLOTS/0.list"
}

# Save current results to slot 0
# Args: file paths (one per line on stdin)
_tdocs_slots_save() {
    _tdocs_slots_rotate
    cat > "$TDOCS_SLOTS/0.list"
}

# Get path from slot by index
# Args: slot index
_tdocs_slots_get() {
    local slot="${1:-0}"
    local index="${2:?index required}"

    local file="$TDOCS_SLOTS/${slot}.list"
    [[ -f "$file" ]] || {
        echo "[tls] ERROR: Slot $slot not found" >&2
        return 1
    }

    sed -n "${index}p" "$file"
}

# Count items in slot
_tdocs_slots_count() {
    local slot="${1:-0}"
    local file="$TDOCS_SLOTS/${slot}.list"
    [[ -f "$file" ]] && wc -l < "$file" | tr -d ' ' || echo 0
}

# Find markdown files in mount paths
# Args: [--mount name] [--tag tag] [--save name]
_tdocs_ls() {
    local mount_filter=""
    local tag_filter=""
    local save_name=""

    # Parse args
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --mount|-m) mount_filter="$2"; shift 2 ;;
            --tag|-t)   tag_filter="$2"; shift 2 ;;
            --save|-s)  save_name="$2"; shift 2 ;;
            *) shift ;;
        esac
    done

    # Get mount paths
    local -a paths
    if [[ -n "$mount_filter" ]]; then
        # Single mount
        local mp
        mp=$(jq -r --arg n "$mount_filter" '.mounts[] | select(.name == $n and .enabled) | .path' "$TDOCS_MOUNTS")
        [[ -n "$mp" ]] && paths+=("$mp")
    else
        # All enabled mounts
        while IFS= read -r p; do
            [[ -n "$p" ]] && paths+=("$p")
        done < <(_tdocs_mount_paths)
    fi

    if [[ ${#paths[@]} -eq 0 ]]; then
        echo "[tls] No mount points. Add one with: tdocs mount add <path>"
        return 1
    fi

    # Find all markdown files
    local -a files
    for p in "${paths[@]}"; do
        while IFS= read -r f; do
            [[ -n "$f" ]] && files+=("$f")
        done < <(find "$p" -type f -name "*.md" 2>/dev/null | sort)
    done

    # Filter by tag if specified
    if [[ -n "$tag_filter" ]]; then
        local -a filtered
        for f in "${files[@]}"; do
            local hash=$(_tdocs_hash "$f")
            local tags
            tags=$(jq -r --arg h "$hash" '.[$h] // [] | join(" ")' "$TDOCS_TAGS" 2>/dev/null)
            [[ "$tags" == *"$tag_filter"* ]] && filtered+=("$f")
        done
        files=("${filtered[@]}")
    fi

    # Save to slot 0 (or named slot)
    if [[ -n "$save_name" ]]; then
        printf '%s\n' "${files[@]}" > "$TDOCS_SLOTS/${save_name}.list"
        echo "[tls] Saved ${#files[@]} items to: $save_name"
    else
        printf '%s\n' "${files[@]}" | _tdocs_slots_save
    fi

    # Display numbered list
    local i=1
    for f in "${files[@]}"; do
        # Show relative path from mount
        local display="$f"
        for p in "${paths[@]}"; do
            display="${display#$p/}"
        done
        printf "%3d. %s\n" "$i" "$display"
        ((i++))
    done

    echo ""
    echo "[${#files[@]} docs]"
}

# Show slot info
_tdocs_slots_info() {
    echo "Slots:"
    local i=0
    while ((i < TDOCS_SLOT_COUNT)); do
        local count=$(_tdocs_slots_count "$i")
        if ((count > 0)); then
            printf "  %d: %d items\n" "$i" "$count"
        fi
        ((i++))
    done

    # Named slots
    echo ""
    echo "Named lists:"
    for f in "$TDOCS_SLOTS"/*.list; do
        [[ -f "$f" ]] || continue
        local name=$(basename "$f" .list)
        [[ "$name" =~ ^[0-9]+$ ]] && continue  # Skip numeric slots
        local count=$(wc -l < "$f" | tr -d ' ')
        printf "  %s: %d items\n" "$name" "$count"
    done
}
