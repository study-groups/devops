#!/usr/bin/env bash
# TDOCS Annotation System
# Add notes to existing .meta files using stanza format

: "${TDOCS_SRC:=$TETRA_SRC/bash/tdocs}"
: "${TDOCS_DIR:=$TETRA_DIR/tdocs}"

# Add or update a note span in metadata file
# Format: header on one line, content until blank line
tdoc_note_add() {
    local file_or_hash="$1"
    local note_key="$2"
    shift 2
    local note_text="$*"

    # Resolve to hash
    local hash=""
    if [[ -f "$file_or_hash" ]]; then
        hash=$(tdoc_hash_file "$file_or_hash")
    else
        hash="$file_or_hash"
    fi

    if [[ -z "$hash" ]]; then
        echo "Error: Could not resolve hash" >&2
        return 1
    fi

    local meta_file=$(tdoc_meta_file "$hash")
    if [[ ! -f "$meta_file" ]]; then
        echo "Error: Metadata not found for hash: $hash" >&2
        return 1
    fi

    # Check if note section exists
    if grep -q "^$note_key:" "$meta_file"; then
        # Update existing note
        local tmp=$(mktemp)
        awk -v key="$note_key" -v text="$note_text" '
            BEGIN { in_span=0; skip=0 }
            /^[a-z_]+:/ {
                if ($0 ~ "^" key ":") {
                    print key ": " text
                    skip=1
                    next
                }
                skip=0
            }
            /^$/ { skip=0 }
            !skip { print }
        ' "$meta_file" > "$tmp"
        mv "$tmp" "$meta_file"
    else
        # Append new note span
        echo "" >> "$meta_file"
        echo "$note_key: $note_text" >> "$meta_file"
    fi

    echo "✓ Note added to $hash"
}

# Get note from metadata
tdoc_note_get() {
    local file_or_hash="$1"
    local note_key="$2"

    local hash=""
    if [[ -f "$file_or_hash" ]]; then
        hash=$(tdoc_hash_file "$file_or_hash")
    else
        hash="$file_or_hash"
    fi

    local meta_file=$(tdoc_meta_file "$hash")
    if [[ ! -f "$meta_file" ]]; then
        return 1
    fi

    # Extract note span (header + content until blank line)
    awk -v key="$note_key" '
        BEGIN { in_span=0 }
        $0 ~ "^" key ":" { in_span=1; print; next }
        in_span && /^$/ { exit }
        in_span && /^[a-z_]+:/ { exit }
        in_span { print }
    ' "$meta_file"
}

# Interactive annotate - open editor on notes section
tdoc_annotate() {
    local file_or_hash="$1"

    local hash=""
    local display_name=""
    if [[ -f "$file_or_hash" ]]; then
        hash=$(tdoc_hash_file "$file_or_hash")
        display_name="$file_or_hash"
    else
        hash="$file_or_hash"
        display_name="hash:$hash"
    fi

    if [[ -z "$hash" ]]; then
        echo "Usage: annotate <file|hash>" >&2
        return 1
    fi

    local meta_file=$(tdoc_meta_file "$hash")
    if [[ ! -f "$meta_file" ]]; then
        echo "Error: Metadata not found" >&2
        return 1
    fi

    # Create temp file with just notes sections or template
    local tmp=$(mktemp)

    # Extract existing note spans
    if grep -q "^note:" "$meta_file" || grep -q "^summary:" "$meta_file" || grep -q "^todo:" "$meta_file"; then
        awk '
            /^(note|summary|todo|links):/ { in_notes=1 }
            in_notes && /^[a-z_]+:/ && !/^(note|summary|todo|links):/ { in_notes=0 }
            in_notes { print }
        ' "$meta_file" > "$tmp"
    else
        # Create template
        cat > "$tmp" <<EOF
summary:

note:

todo:

links:
EOF
    fi

    # Get editor
    local editor="${VISUAL:-${EDITOR:-vim}}"

    echo "Editing annotations for: $display_name"
    echo "Hash: $hash"
    echo ""

    $editor "$tmp"

    # Merge back into meta file
    # Remove old note spans
    local tmp2=$(mktemp)
    awk '
        /^(note|summary|todo|links):/ { skip=1; next }
        skip && /^$/ { skip=0; next }
        skip && /^[a-z_]+:/ { skip=0 }
        !skip { print }
    ' "$meta_file" > "$tmp2"

    # Append new notes
    cat "$tmp2" "$tmp" > "$meta_file"

    rm -f "$tmp" "$tmp2"

    echo "✓ Annotations saved"
}

# List files with notes
tdoc_list_notes() {
    local meta_dir=$(tdoc_meta_dir)

    echo "Documents with annotations:"
    echo ""

    local count=0
    for meta_file in "$meta_dir"/*.meta; do
        [[ ! -f "$meta_file" ]] && continue

        if grep -q "^summary:\|^note:\|^todo:" "$meta_file"; then
            ((count++))
            local hash=$(basename "$meta_file" .meta)
            local path=$(grep "^current_path:" "$meta_file" | cut -d' ' -f2-)
            local summary=$(grep "^summary:" "$meta_file" | cut -d' ' -f2-)

            printf "%2d. %s\n" "$count" "$path"
            [[ -n "$summary" ]] && printf "    %s\n" "$summary"
            printf "    hash:%s\n" "$hash"
            echo ""
        fi
    done

    if [[ $count -eq 0 ]]; then
        echo "  (none)"
    fi
}

export -f tdoc_note_add
export -f tdoc_note_get
export -f tdoc_annotate
export -f tdoc_list_notes
