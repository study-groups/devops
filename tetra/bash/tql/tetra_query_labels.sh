#!/usr/bin/env bash
# tetra_query_labels.sh - Extract labels from files for TQL filtering
# Provides label extraction from filenames and metadata files

# Source the parser
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/tetra_query_parser.sh"

# Extract all labels from a file
# Returns key=value pairs for filtering
extract_labels() {
    local file="$1"

    if [[ ! -e "$file" ]]; then
        echo "ERROR:File not found: $file" >&2
        return 1
    fi

    # Built-in labels from filename
    local ts=$(extract_timestamp "$file")
    local module=$(extract_module "$file")
    local variant=$(extract_variant "$file")
    local ext=$(extract_extension "$file")

    echo "ts=$ts"
    echo "module=$module"
    echo "variant=$variant"
    echo "ext=$ext"

    # File system labels
    if [[ -f "$file" ]]; then
        local size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo 0)
        local mtime=$(stat -f%m "$file" 2>/dev/null || stat -c%Y "$file" 2>/dev/null || echo 0)

        echo "size=$size"
        echo "mtime=$mtime"
    fi

    # Metadata labels from .meta file
    extract_metadata_labels "$file"
}

# Extract labels from .meta JSON file
extract_metadata_labels() {
    local file="$1"
    local base="${file%.*}"  # Remove extension
    local meta_file=""

    # Try to find .meta file with various patterns
    if [[ -f "${base}.meta" ]]; then
        meta_file="${base}.meta"
    elif [[ -f "${file%.mp3}.meta" ]]; then
        meta_file="${file%.mp3}.meta"
    elif [[ -f "${file%.answer}.meta" ]]; then
        meta_file="${file%.answer}.meta"
    fi

    if [[ -z "$meta_file" ]] || [[ ! -f "$meta_file" ]]; then
        return 0  # No metadata file, not an error
    fi

    # Extract metadata using jq if available
    if command -v jq >/dev/null 2>&1; then
        # Common metadata fields
        local duration=$(jq -r '.duration_ms // empty' "$meta_file" 2>/dev/null)
        local voice=$(jq -r '.voice // empty' "$meta_file" 2>/dev/null)
        local model=$(jq -r '.model // empty' "$meta_file" 2>/dev/null)
        local hash=$(jq -r '.hash // empty' "$meta_file" 2>/dev/null)
        local created=$(jq -r '.created_at // .generated_at // empty' "$meta_file" 2>/dev/null)
        local text_len=$(jq -r '.text // empty | length' "$meta_file" 2>/dev/null)

        [[ -n "$duration" ]] && echo "duration=$duration"
        [[ -n "$voice" ]] && echo "voice=$voice"
        [[ -n "$model" ]] && echo "model=$model"
        [[ -n "$hash" ]] && echo "hash=$hash"
        [[ -n "$created" ]] && echo "created=$created"
        [[ -n "$text_len" ]] && echo "text_len=$text_len"

        # Extract all top-level fields as labels
        jq -r 'to_entries | .[] | select(.value | type != "object" and type != "array") | "\(.key)=\(.value)"' "$meta_file" 2>/dev/null | \
            grep -v "^duration=" | \
            grep -v "^voice=" | \
            grep -v "^model=" | \
            grep -v "^hash=" | \
            grep -v "^created="
    fi
}

# Get a specific label value from a file
get_label() {
    local file="$1"
    local label_name="$2"

    extract_labels "$file" | grep "^${label_name}=" | cut -d= -f2-
}

# List all available label names across files
list_label_names() {
    local dir="$1"
    local pattern="${2:-*}"

    find "$dir" -name "$pattern" -type f | while read -r file; do
        extract_labels "$file" 2>/dev/null
    done | cut -d= -f1 | sort -u
}

# Show label statistics across files
label_stats() {
    local dir="$1"
    local pattern="${2:-*}"
    local label="$3"

    echo "Label: $label"
    echo "---"

    find "$dir" -name "$pattern" -type f | while read -r file; do
        local value=$(get_label "$file" "$label")
        [[ -n "$value" ]] && echo "$value"
    done | sort | uniq -c | sort -rn
}

# Validate labels against a schema
validate_labels() {
    local file="$1"
    shift
    local required_labels=("$@")

    local all_labels=$(extract_labels "$file")

    for label in "${required_labels[@]}"; do
        if ! echo "$all_labels" | grep -q "^${label}="; then
            echo "ERROR:Missing required label: $label" >&2
            return 1
        fi
    done

    return 0
}

# Main command-line interface
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    case "${1:-}" in
        extract)
            extract_labels "$2"
            ;;
        get)
            get_label "$2" "$3"
            ;;
        list)
            list_label_names "$2" "${3:-*}"
            ;;
        stats)
            label_stats "$2" "${3:-*}" "$4"
            ;;
        validate)
            file="$2"
            shift 2
            validate_labels "$file" "$@"
            ;;
        *)
            cat <<EOF
Usage: tetra_query_labels.sh <command> <args>

Commands:
  extract <file>                    Extract all labels from file
  get <file> <label>                Get specific label value
  list <dir> [pattern]              List all label names in directory
  stats <dir> [pattern] <label>     Show label value statistics
  validate <file> <label>...        Validate file has required labels

Examples:
  tetra_query_labels.sh extract /path/to/1760229927.vox.sally.mp3
  tetra_query_labels.sh get /path/to/file.mp3 duration
  tetra_query_labels.sh list ~/tetra/vox/db "*.mp3"
  tetra_query_labels.sh stats ~/tetra/vox/db "*.mp3" voice
  tetra_query_labels.sh validate file.mp3 ts module voice

Label Types:
  Built-in (from filename):
    ts        - Unix timestamp
    module    - Module name (vox, qa, rag, etc.)
    variant   - Variant/voice name
    ext       - File extension

  Filesystem:
    size      - File size in bytes
    mtime     - Modification time (Unix timestamp)

  Metadata (from .meta JSON):
    duration  - Duration in milliseconds
    voice     - Voice name
    model     - AI model used
    hash      - Content hash
    created   - Creation timestamp
    text_len  - Text length
    [custom]  - Any other top-level JSON field
EOF
            exit 1
            ;;
    esac
fi
