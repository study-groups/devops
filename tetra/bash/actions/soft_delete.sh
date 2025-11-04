#!/usr/bin/env bash
# TAS Soft Delete Implementation
# Never actually deletes - moves to trash for manual restoration

# Source dependencies
if [[ -f "$TETRA_SRC/bash/trs/trs.sh" ]]; then
    source "$TETRA_SRC/bash/trs/trs.sh"
fi

# Soft delete a file or directory
# Usage: soft_delete target [reason]
# Returns: Path to trash directory
soft_delete() {
    local target="$1"
    local reason="${2:-user_request}"

    if [[ -z "$target" ]]; then
        echo "Error: soft_delete requires target path" >&2
        return 1
    fi

    if [[ ! -e "$target" ]]; then
        echo "Error: Target not found: $target" >&2
        return 1
    fi

    # Get absolute path
    target=$(cd "$(dirname "$target")" && pwd)/$(basename "$target")

    # Create timestamp-based trash directory
    local timestamp=$(date +%s)
    local trash_dir="/tmp/tetra/removed/${timestamp}"
    mkdir -p "$trash_dir"

    # Determine if it's a TRS record or regular file/directory
    local is_trs_record=false
    if [[ -f "$target" ]]; then
        trs_validate_filename "$(basename "$target")" &>/dev/null && is_trs_record=true
    fi

    # Move target to trash
    local basename=$(basename "$target")
    local trash_path="$trash_dir/$basename"

    # If it's a TRS record in canonical location, make module explicit
    if $is_trs_record && [[ "$target" =~ $TETRA_DIR/([^/]+)/db/ ]]; then
        # Use trs_move to handle module naming
        trash_path=$(trs_move "$target" "$trash_dir" 2>&1)
        local move_status=$?
    else
        # Regular move
        mv "$target" "$trash_path"
        local move_status=$?
    fi

    if [[ $move_status -ne 0 ]]; then
        echo "Error: Failed to move target to trash" >&2
        return 1
    fi

    # Create REMOVED.json manifest
    create_removed_manifest "$trash_dir" "$target" "$trash_path" "$reason"

    echo "$trash_dir"
}

# Create REMOVED.json manifest
create_removed_manifest() {
    local trash_dir="$1"
    local original_path="$2"
    local trash_path="$3"
    local reason="$4"

    local timestamp=$(date +%s)
    local basename=$(basename "$trash_path")

    # Get file type
    local file_type="file"
    if [[ -d "$trash_path" ]]; then
        file_type="directory"
    elif [[ -L "$trash_path" ]]; then
        file_type="symlink"
    fi

    # Get size
    local size_bytes=0
    if [[ -f "$trash_path" ]]; then
        size_bytes=$(stat -f%z "$trash_path" 2>/dev/null || stat -c%s "$trash_path" 2>/dev/null || echo 0)
    fi

    cat > "$trash_dir/REMOVED.json" <<EOF
{
    "original_path": "$original_path",
    "trash_path": "$trash_path",
    "basename": "$basename",
    "file_type": "$file_type",
    "size_bytes": $size_bytes,
    "removed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "removed_at_timestamp": $timestamp,
    "removed_by": "$USER",
    "reason": "$reason",
    "can_restore": true,
    "restore_instructions": "To restore: mv $trash_path $original_path"
}
EOF

    echo "Created removal manifest: $trash_dir/REMOVED.json" >&2
}

# List items in trash
# Usage: trash_list [limit]
# Returns: List of trash directories with summaries
trash_list() {
    local limit="${1:-20}"
    local trash_root="/tmp/tetra/removed"

    if [[ ! -d "$trash_root" ]]; then
        echo "Trash is empty (no trash directory exists)" >&2
        return 0
    fi

    local count=0
    find "$trash_root" -mindepth 1 -maxdepth 1 -type d | sort -r | while read -r trash_dir; do
        if [[ $count -ge $limit ]]; then
            break
        fi

        local manifest="$trash_dir/REMOVED.json"
        if [[ -f "$manifest" ]]; then
            local removed_at=$(jq -r '.removed_at // "unknown"' "$manifest" 2>/dev/null)
            local original=$(jq -r '.original_path // "unknown"' "$manifest" 2>/dev/null)
            local basename=$(jq -r '.basename // "unknown"' "$manifest" 2>/dev/null)

            echo "[$removed_at] $basename (from: $original)"
            echo "  Trash: $trash_dir"
        fi

        ((count++))
    done
}

# Show details for a specific trash item
# Usage: trash_info trash_timestamp
trash_info() {
    local timestamp="$1"

    if [[ -z "$timestamp" ]]; then
        echo "Error: trash_info requires timestamp" >&2
        return 1
    fi

    local trash_dir="/tmp/tetra/removed/${timestamp}"

    if [[ ! -d "$trash_dir" ]]; then
        echo "Error: Trash item not found: $timestamp" >&2
        return 1
    fi

    local manifest="$trash_dir/REMOVED.json"
    if [[ ! -f "$manifest" ]]; then
        echo "Error: Manifest not found: $manifest" >&2
        return 1
    fi

    # Pretty-print the manifest
    if type jq &>/dev/null; then
        jq '.' "$manifest"
    else
        cat "$manifest"
    fi
}

# Manually restore item from trash (not a TAS action, utility function)
# Usage: trash_restore trash_timestamp [custom_destination]
trash_restore() {
    local timestamp="$1"
    local custom_dest="$2"

    if [[ -z "$timestamp" ]]; then
        echo "Error: trash_restore requires timestamp" >&2
        return 1
    fi

    local trash_dir="/tmp/tetra/removed/${timestamp}"

    if [[ ! -d "$trash_dir" ]]; then
        echo "Error: Trash item not found: $timestamp" >&2
        return 1
    fi

    local manifest="$trash_dir/REMOVED.json"
    if [[ ! -f "$manifest" ]]; then
        echo "Error: Manifest not found: $manifest" >&2
        return 1
    fi

    # Get original path and trash path
    local original_path=$(jq -r '.original_path' "$manifest" 2>/dev/null)
    local trash_path=$(jq -r '.trash_path' "$manifest" 2>/dev/null)

    if [[ -z "$original_path" || "$original_path" == "null" ]]; then
        echo "Error: Could not determine original path from manifest" >&2
        return 1
    fi

    # Determine destination
    local dest_path="$original_path"
    if [[ -n "$custom_dest" ]]; then
        dest_path="$custom_dest"
    fi

    # Check if destination already exists
    if [[ -e "$dest_path" ]]; then
        echo "Error: Destination already exists: $dest_path" >&2
        echo "Use a custom destination: trash_restore $timestamp /path/to/new/location" >&2
        return 1
    fi

    # Create parent directory if needed
    mkdir -p "$(dirname "$dest_path")"

    # Find the actual file/directory in trash (may have module prefix if TRS record)
    local item_to_restore=""
    for item in "$trash_dir"/*; do
        if [[ "$item" != "$manifest" ]]; then
            item_to_restore="$item"
            break
        fi
    done

    if [[ -z "$item_to_restore" || ! -e "$item_to_restore" ]]; then
        echo "Error: Could not find item in trash directory" >&2
        return 1
    fi

    # Move back
    mv "$item_to_restore" "$dest_path"

    if [[ $? -eq 0 ]]; then
        echo "Restored: $dest_path"

        # Remove trash directory if now empty
        if [[ $(find "$trash_dir" -mindepth 1 | wc -l) -eq 1 ]]; then
            rm -rf "$trash_dir"
            echo "Removed empty trash directory: $trash_dir"
        fi
    else
        echo "Error: Failed to restore item" >&2
        return 1
    fi
}

# Clean old trash items (manual cleanup only, no auto-expiry)
# Usage: trash_clean_older_than days
trash_clean_older_than() {
    local days="$1"

    if [[ -z "$days" ]]; then
        echo "Error: trash_clean_older_than requires days parameter" >&2
        return 1
    fi

    local trash_root="/tmp/tetra/removed"

    if [[ ! -d "$trash_root" ]]; then
        echo "Trash is empty (no trash directory exists)" >&2
        return 0
    fi

    local cutoff_timestamp=$(($(date +%s) - (days * 86400)))
    local removed_count=0

    find "$trash_root" -mindepth 1 -maxdepth 1 -type d | while read -r trash_dir; do
        local trash_timestamp=$(basename "$trash_dir")

        # Check if timestamp is older than cutoff
        if [[ "$trash_timestamp" =~ ^[0-9]+$ ]] && [[ "$trash_timestamp" -lt "$cutoff_timestamp" ]]; then
            echo "Removing trash item from $(date -r "$trash_timestamp" 2>/dev/null): $trash_dir"
            rm -rf "$trash_dir"
            ((removed_count++))
        fi
    done

    echo "Removed $removed_count trash items older than $days days" >&2
}

# Get trash statistics
# Usage: trash_stats
trash_stats() {
    local trash_root="/tmp/tetra/removed"

    if [[ ! -d "$trash_root" ]]; then
        cat <<EOF
{
    "total_items": 0,
    "total_size": "0B",
    "oldest": null,
    "newest": null,
    "trash_path": "$trash_root"
}
EOF
        return 0
    fi

    local total_items=$(find "$trash_root" -mindepth 1 -maxdepth 1 -type d | wc -l)
    local total_size=$(du -sh "$trash_root" 2>/dev/null | cut -f1)
    local oldest=$(find "$trash_root" -mindepth 1 -maxdepth 1 -type d | sort | head -1 | xargs basename)
    local newest=$(find "$trash_root" -mindepth 1 -maxdepth 1 -type d | sort | tail -1 | xargs basename)

    cat <<EOF
{
    "total_items": $total_items,
    "total_size": "$total_size",
    "oldest_timestamp": "${oldest:-null}",
    "newest_timestamp": "${newest:-null}",
    "trash_path": "$trash_root"
}
EOF
}

# TAS action: /delete:target
# Usage: action_delete target
action_delete() {
    local target="$1"

    if [[ -z "$target" ]]; then
        echo "Error: /delete requires target path" >&2
        return 1
    fi

    # Perform soft delete
    local trash_dir=$(soft_delete "$target" "tas_delete_action")

    if [[ $? -eq 0 ]]; then
        echo "Moved to trash: $trash_dir"
        echo "To restore: use trash_restore $(basename "$trash_dir")"
        return 0
    else
        return 1
    fi
}

# TAS action: /rm:target (alias for delete)
# Usage: action_rm target
action_rm() {
    action_delete "$@"
}

# Export functions
export -f soft_delete
export -f create_removed_manifest
export -f trash_list
export -f trash_info
export -f trash_restore
export -f trash_clean_older_than
export -f trash_stats
export -f action_delete
export -f action_rm
