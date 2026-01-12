#!/usr/bin/env bash
# tdocs/lib/hash.sh - Content hashing for document tracking
#
# Uses first 12 chars of SHA256 hash for content-addressed tracking.
# This allows tags to survive file moves/renames.

# Get content hash of a file (12 char SHA256)
_tdocs_hash() {
    local file="${1:?file required}"

    [[ -f "$file" ]] || {
        echo "[hash] ERROR: File not found: $file" >&2
        return 1
    }

    if command -v sha256sum &>/dev/null; then
        sha256sum "$file" | cut -c1-12
    elif command -v shasum &>/dev/null; then
        shasum -a 256 "$file" | cut -c1-12
    else
        # Fallback: use md5
        md5 -q "$file" 2>/dev/null | cut -c1-12 || md5sum "$file" | cut -c1-12
    fi
}

# Get full hash (64 chars)
_tdocs_hash_full() {
    local file="${1:?file required}"

    [[ -f "$file" ]] || return 1

    if command -v sha256sum &>/dev/null; then
        sha256sum "$file" | cut -d' ' -f1
    elif command -v shasum &>/dev/null; then
        shasum -a 256 "$file" | cut -d' ' -f1
    else
        md5 -q "$file" 2>/dev/null || md5sum "$file" | cut -d' ' -f1
    fi
}
