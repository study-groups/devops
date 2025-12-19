#!/usr/bin/env bash
# TDOCS Content-Addressed Index System
# Tracks files by content hash for robust move/rename detection

# Strong globals
: "${TDOCS_SRC:=$TETRA_SRC/bash/tdocs}"
: "${TDOCS_DIR:=$TETRA_DIR/tdocs}"

# Hash length (first N chars of SHA256)
TDOC_HASH_LENGTH=12

# ============================================================================
# HASH FUNCTIONS
# ============================================================================

# Calculate short hash for file (12 chars)
# Wrapper around _tdocs_file_hash for backward compatibility
tdoc_hash_file() {
    local file="$1"

    if [[ ! -f "$file" ]]; then
        echo "error: file not found: $file" >&2
        return 1
    fi

    _tdocs_file_hash "$file" 12
}

# Calculate hash for frontmatter only (if present)
tdoc_hash_frontmatter() {
    local file="$1"

    if [[ ! -f "$file" ]]; then
        echo ""
        return 0
    fi

    # Extract YAML frontmatter (between --- markers)
    local fm=$(awk '/^---$/{flag=!flag; next} flag' "$file" 2>/dev/null)

    if [[ -z "$fm" ]]; then
        echo ""
        return 0
    fi

    # Hash the frontmatter
    if command -v shasum >/dev/null 2>&1; then
        echo "$fm" | shasum -a 256 | awk '{print substr($1, 1, 12)}'
    elif command -v sha256sum >/dev/null 2>&1; then
        echo "$fm" | sha256sum | awk '{print substr($1, 1, 12)}'
    else
        echo ""
    fi
}

# ============================================================================
# INDEX MANAGEMENT
# ============================================================================

# Get index file path for current context
tdoc_index_file() {
    local context="${TDOCS_REPL_CONTEXT:-global}"

    if [[ "$context" == "local" ]]; then
        echo ".tdocs/index.json"
    else
        echo "$TDOCS_DIR/index.json"
    fi
}

# Initialize empty index
tdoc_index_init() {
    local index_file=$(tdoc_index_file)
    local index_dir=$(dirname "$index_file")

    mkdir -p "$index_dir"

    cat > "$index_file" <<'EOF'
{
  "version": "1.0",
  "last_scan": null,
  "scan_roots": ["."],
  "exclude": ["node_modules", ".git", "vendor", ".tdocs"],
  "by_hash": {},
  "by_path": {}
}
EOF

    echo "Initialized index at $index_file"
}

# Check if index exists
tdoc_index_exists() {
    local index_file=$(tdoc_index_file)
    [[ -f "$index_file" ]]
}

# Get path for hash from index (using jq if available)
tdoc_index_get_path() {
    local hash="$1"
    local index_file=$(tdoc_index_file)

    if [[ ! -f "$index_file" ]]; then
        return 1
    fi

    if command -v jq >/dev/null 2>&1; then
        jq -r ".by_hash[\"$hash\"].path // empty" "$index_file" 2>/dev/null
    else
        # Fallback: grep-based
        grep -A 3 "\"$hash\"" "$index_file" | grep "\"path\"" | cut -d'"' -f4
    fi
}

# Get hash for path from index
tdoc_index_get_hash() {
    local path="$1"
    local index_file=$(tdoc_index_file)

    if [[ ! -f "$index_file" ]]; then
        return 1
    fi

    if command -v jq >/dev/null 2>&1; then
        jq -r ".by_path[\"$path\"] // empty" "$index_file" 2>/dev/null
    else
        # Fallback: grep-based
        grep "\"$path\"" "$index_file" | head -1 | cut -d'"' -f4
    fi
}

# Update index with new file entry
tdoc_index_update() {
    local hash="$1"
    local path="$2"
    local size="${3:-0}"
    local index_file=$(tdoc_index_file)

    if [[ ! -f "$index_file" ]]; then
        tdoc_index_init
    fi

    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    if command -v jq >/dev/null 2>&1; then
        # Use jq for proper JSON manipulation
        local tmp=$(mktemp)
        jq --arg h "$hash" \
           --arg p "$path" \
           --arg s "$size" \
           --arg t "$timestamp" \
           '.by_hash[$h] = {path: $p, updated: $t, size: ($s | tonumber)} |
            .by_path[$p] = $h |
            .last_scan = $t' \
           "$index_file" > "$tmp" 2>/dev/null
        mv "$tmp" "$index_file"
    else
        echo "Warning: jq not available, index update skipped" >&2
    fi
}

# Remove path from index
tdoc_index_remove_path() {
    local path="$1"
    local index_file=$(tdoc_index_file)

    if [[ ! -f "$index_file" ]]; then
        return 0
    fi

    if command -v jq >/dev/null 2>&1; then
        local tmp=$(mktemp)
        jq --arg p "$path" \
           'del(.by_path[$p])' \
           "$index_file" > "$tmp" 2>/dev/null
        mv "$tmp" "$index_file"
    fi
}

# List all entries in index
tdoc_index_list() {
    local index_file=$(tdoc_index_file)

    if [[ ! -f "$index_file" ]]; then
        return 0
    fi

    if command -v jq >/dev/null 2>&1; then
        jq -r '.by_hash | to_entries[] | "\(.key) \(.value.path) \(.value.size)"' "$index_file" 2>/dev/null
    else
        grep "\"path\"" "$index_file" | cut -d'"' -f4
    fi
}

# ============================================================================
# METADATA MANAGEMENT
# ============================================================================

# Get metadata directory for current context
tdoc_meta_dir() {
    local context="${TDOCS_REPL_CONTEXT:-global}"

    if [[ "$context" == "local" ]]; then
        echo ".tdocs/db"
    else
        echo "$TDOCS_DB_DIR"
    fi
}

# Get metadata file path for hash
tdoc_meta_file() {
    local hash="$1"
    local meta_dir=$(tdoc_meta_dir)
    echo "$meta_dir/${hash}.meta"
}

# Get notes file path for hash
tdoc_notes_file() {
    local hash="$1"
    local meta_dir=$(tdoc_meta_dir)
    echo "$meta_dir/${hash}.notes"
}

# Create metadata file for hash
tdoc_meta_create() {
    local hash="$1"
    local path="$2"
    local type="${3:-scratch}"
    local lifecycle="${4:-W}"

    local meta_file=$(tdoc_meta_file "$hash")
    local meta_dir=$(dirname "$meta_file")

    mkdir -p "$meta_dir"

    local full_hash=$(shasum -a 256 "$path" 2>/dev/null | awk '{print $1}')
    local fm_hash=$(tdoc_hash_frontmatter "$path")
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local size=$(wc -c < "$path" 2>/dev/null | tr -d ' ')
    local lines=$(wc -l < "$path" 2>/dev/null | tr -d ' ')

    cat > "$meta_file" <<EOF
hash: $hash
content_hash: $full_hash
fm_hash: $fm_hash
current_path: $path
type: $type
lifecycle: $lifecycle
tags:
created: $timestamp
updated: $timestamp
first_seen: $timestamp
size: $size
lines: $lines
paths:
  - path: $path
    seen: $timestamp
EOF

    echo "Created metadata: $meta_file"
}

# Update path in existing metadata
tdoc_meta_update_path() {
    local hash="$1"
    local new_path="$2"

    local meta_file=$(tdoc_meta_file "$hash")

    if [[ ! -f "$meta_file" ]]; then
        echo "Warning: metadata not found for hash $hash" >&2
        return 1
    fi

    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    # Update current_path
    sed -i.bak "s|^current_path:.*|current_path: $new_path|" "$meta_file"

    # Update updated timestamp
    sed -i.bak "s|^updated:.*|updated: $timestamp|" "$meta_file"

    # Add to paths history
    echo "  - path: $new_path" >> "$meta_file"
    echo "    seen: $timestamp" >> "$meta_file"

    rm -f "$meta_file.bak"

    echo "Updated path in $meta_file"
}

# ============================================================================
# SCAN OPERATIONS
# ============================================================================

# Scan directory for markdown files and update index
tdoc_scan_dir() {
    local scan_root="${1:-.}"
    local context="${TDOCS_REPL_CONTEXT:-global}"

    echo "Scanning $scan_root for markdown files (context: $context)..."

    # Ensure index exists
    if ! tdoc_index_exists; then
        tdoc_index_init
    fi

    local found=0
    local new=0
    local moved=0
    local changed=0

    # Find all .md files
    while IFS= read -r file; do
        ((found++))

        # Calculate hash
        local hash=$(tdoc_hash_file "$file")
        if [[ -z "$hash" ]]; then
            echo "Warning: Failed to hash $file" >&2
            continue
        fi

        # Get current index state
        local indexed_path=$(tdoc_index_get_path "$hash")
        local indexed_hash=$(tdoc_index_get_hash "$file")

        if [[ -n "$indexed_path" ]] && [[ "$indexed_path" != "$file" ]]; then
            # FILE MOVED: Same hash, different path
            echo "  MOVED: $indexed_path → $file"
            tdoc_index_update "$hash" "$file" "$(wc -c < "$file" | tr -d ' ')"
            tdoc_meta_update_path "$hash" "$file"
            ((moved++))

        elif [[ -n "$indexed_hash" ]] && [[ "$indexed_hash" != "$hash" ]]; then
            # CONTENT CHANGED: Same path, different hash
            echo "  CHANGED: $file (hash: $indexed_hash → $hash)"
            tdoc_index_remove_path "$file"
            tdoc_index_update "$hash" "$file" "$(wc -c < "$file" | tr -d ' ')"
            tdoc_meta_create "$hash" "$file"
            ((changed++))

        elif [[ -z "$indexed_path" ]]; then
            # NEW FILE
            echo "  NEW: $file"
            tdoc_index_update "$hash" "$file" "$(wc -c < "$file" | tr -d ' ')"
            tdoc_meta_create "$hash" "$file"
            ((new++))

        else
            # NO CHANGE
            : # Skip
        fi

    done < <(find "$scan_root" -name "*.md" -type f ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/.tdocs/*" 2>/dev/null)

    echo ""
    echo "Scan complete:"
    echo "  Found: $found files"
    echo "  New: $new"
    echo "  Moved: $moved"
    echo "  Changed: $changed"
}

# Export functions
export -f tdoc_hash_file
export -f tdoc_hash_frontmatter
export -f tdoc_index_file
export -f tdoc_index_init
export -f tdoc_index_exists
export -f tdoc_index_get_path
export -f tdoc_index_get_hash
export -f tdoc_index_update
export -f tdoc_index_remove_path
export -f tdoc_index_list
export -f tdoc_meta_dir
export -f tdoc_meta_file
export -f tdoc_notes_file
export -f tdoc_meta_create
export -f tdoc_meta_update_path
export -f tdoc_scan_dir
