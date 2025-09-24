#!/usr/bin/env bash

# Cursor operations - Core span system building blocks
# Cursor format: file:path:start:end:note

# Create a cursor object
cursor_create() {
    local file="$1"
    local path="$2"
    local start="$3"
    local end="$4"
    local note="$5"

    echo "${file}:${path}:${start}:${end}:${note}"
}

# Parse cursor components
cursor_parse() {
    local cursor="$1"
    IFS=':' read -r file path start end note <<< "$cursor"
    echo "FILE=$file"
    echo "PATH=$path"
    echo "START=$start"
    echo "END=$end"
    echo "NOTE=$note"
}

# Extract text content from cursor
cursor_extract() {
    local cursor="$1"
    local file path start end note
    eval "$(cursor_parse "$cursor")"

    if [[ ! -f "$path" ]]; then
        echo "Error: File not found: $path" >&2
        return 1
    fi

    sed -n "${start},${end}p" "$path"
}

# Validate cursor (check if file exists and span is valid)
cursor_validate() {
    local cursor="$1"
    local file path start end note
    eval "$(cursor_parse "$cursor")"

    # Check file exists
    if [[ ! -f "$path" ]]; then
        echo "invalid:file_not_found"
        return 1
    fi

    # Check line numbers are valid
    local total_lines=$(wc -l < "$path")
    if (( start < 1 || end > total_lines || start > end )); then
        echo "invalid:line_range"
        return 1
    fi

    echo "valid"
    return 0
}

# Get context around cursor (surrounding lines)
cursor_context() {
    local cursor="$1"
    local radius="${2:-3}"
    local file path start end note
    eval "$(cursor_parse "$cursor")"

    if [[ ! -f "$path" ]]; then
        echo "Error: File not found: $path" >&2
        return 1
    fi

    local context_start=$((start - radius))
    local context_end=$((end + radius))

    # Ensure bounds
    [[ $context_start -lt 1 ]] && context_start=1

    sed -n "${context_start},${context_end}p" "$path" |
    awk -v cs="$context_start" -v s="$start" -v e="$end" '
    {
        line_num = cs + NR - 1
        if (line_num >= s && line_num <= e) {
            printf "→ %3d: %s\n", line_num, $0
        } else {
            printf "  %3d: %s\n", line_num, $0
        }
    }'
}

# Create cursor from search results
cursor_from_grep() {
    local pattern="$1"
    local file="$2"
    local note="$3"

    if [[ ! -f "$file" ]]; then
        echo "Error: File not found: $file" >&2
        return 1
    fi

    grep -n "$pattern" "$file" | while IFS=: read -r line_num content; do
        cursor_create "$(basename "$file")" "$file" "$line_num" "$line_num" "${note:-grep:$pattern}"
    done
}