#!/usr/bin/env bash
# tdocs/core/mount.sh - Mount point management
#
# Mounts are directories where tdocs looks for markdown files.
# Stored in $TDOCS_MOUNTS as JSON.
#
# Usage:
#   tdocs mount add <path> [name]   # add mount point
#   tdocs mount rm <name|path>      # remove mount point
#   tdocs mount ls                  # list all mounts
#   tdocs mount enable <name>       # enable mount
#   tdocs mount disable <name>      # disable mount (skip in scans)

# Add a mount point
# Args: path [name]
_tdocs_mount_add() {
    local path="${1:?path required}"
    local name="${2:-}"

    # Expand and validate path
    path=$(realpath "$path" 2>/dev/null) || {
        echo "[mount] ERROR: Path not found: $1" >&2
        return 1
    }

    [[ -d "$path" ]] || {
        echo "[mount] ERROR: Not a directory: $path" >&2
        return 1
    }

    # Generate name from path if not provided
    [[ -z "$name" ]] && name=$(basename "$path")

    # Check for duplicate
    local existing
    existing=$(jq -r --arg p "$path" '.mounts[] | select(.path == $p) | .name' "$TDOCS_MOUNTS" 2>/dev/null)
    if [[ -n "$existing" ]]; then
        echo "[mount] Already mounted as: $existing"
        return 0
    fi

    # Add mount
    local tmp=$(mktemp)
    jq --arg p "$path" --arg n "$name" \
        '.mounts += [{"path": $p, "name": $n, "enabled": true}]' \
        "$TDOCS_MOUNTS" > "$tmp" && mv "$tmp" "$TDOCS_MOUNTS"

    echo "[mount] Added: $name → $path"
}

# Remove a mount point
# Args: name|path
_tdocs_mount_rm() {
    local id="${1:?name or path required}"

    local tmp=$(mktemp)
    jq --arg id "$id" \
        '.mounts = [.mounts[] | select(.name != $id and .path != $id)]' \
        "$TDOCS_MOUNTS" > "$tmp" && mv "$tmp" "$TDOCS_MOUNTS"

    echo "[mount] Removed: $id"
}

# List all mounts
_tdocs_mount_ls() {
    echo "Mount points:"
    echo ""
    jq -r '.mounts[] |
        if .enabled then "  \(.name)\t\(.path)"
        else "  \(.name)\t\(.path) [disabled]"
        end' "$TDOCS_MOUNTS" | column -t -s $'\t'
    echo ""
}

# Enable/disable a mount
# Args: name action(enable|disable)
_tdocs_mount_toggle() {
    local name="${1:?name required}"
    local enabled="${2:-true}"

    local tmp=$(mktemp)
    jq --arg n "$name" --argjson e "$enabled" \
        '.mounts = [.mounts[] | if .name == $n then .enabled = $e else . end]' \
        "$TDOCS_MOUNTS" > "$tmp" && mv "$tmp" "$TDOCS_MOUNTS"

    if [[ "$enabled" == "true" ]]; then
        echo "[mount] Enabled: $name"
    else
        echo "[mount] Disabled: $name"
    fi
}

# Get all enabled mount paths
_tdocs_mount_paths() {
    jq -r '.mounts[] | select(.enabled == true) | .path' "$TDOCS_MOUNTS" 2>/dev/null
}

# Mount dispatcher
_tdocs_mount() {
    local cmd="${1:-ls}"
    shift 2>/dev/null || true

    case "$cmd" in
        add)     _tdocs_mount_add "$@" ;;
        rm|remove) _tdocs_mount_rm "$@" ;;
        ls|list) _tdocs_mount_ls ;;
        enable)  _tdocs_mount_toggle "$1" true ;;
        disable) _tdocs_mount_toggle "$1" false ;;
        paths)   _tdocs_mount_paths ;;
        *)
            echo "Usage: tdocs mount <add|rm|ls|enable|disable> [args]" >&2
            return 1
            ;;
    esac
}
