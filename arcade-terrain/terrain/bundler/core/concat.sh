#!/usr/bin/env bash
# File concatenation utilities for TERRAIN bundler

# Concatenate files with optional separators
# Usage: bundler_concat output_file file1 file2 ...
bundler_concat() {
    local output="$1"
    shift
    local files=("$@")
    local sep=$'\n'

    # Ensure output directory exists
    mkdir -p "$(dirname "$output")"

    # Empty output file
    : > "$output"

    for file in "${files[@]}"; do
        if [[ -f "$file" ]]; then
            echo "// === $file ===" >> "$output"
            cat "$file" >> "$output"
            echo "$sep" >> "$output"
        else
            echo "Warning: File not found: $file" >&2
        fi
    done
}

# Concatenate files with source map comments (for debugging)
# Usage: bundler_concat_debug output_file file1 file2 ...
bundler_concat_debug() {
    local output="$1"
    shift
    local files=("$@")

    mkdir -p "$(dirname "$output")"
    : > "$output"

    local line_offset=0
    for file in "${files[@]}"; do
        if [[ -f "$file" ]]; then
            local basename="${file##*/}"
            echo "// #region $basename (line $((line_offset + 1)))" >> "$output"
            cat "$file" >> "$output"
            echo "" >> "$output"
            echo "// #endregion $basename" >> "$output"
            echo "" >> "$output"
            line_offset=$((line_offset + $(wc -l < "$file") + 4))
        fi
    done
}

# Concatenate CSS files
# Usage: bundler_concat_css output_file file1 file2 ...
bundler_concat_css() {
    local output="$1"
    shift
    local files=("$@")

    mkdir -p "$(dirname "$output")"
    : > "$output"

    for file in "${files[@]}"; do
        if [[ -f "$file" ]]; then
            echo "/* === $file === */" >> "$output"
            cat "$file" >> "$output"
            echo "" >> "$output"
        else
            echo "Warning: CSS file not found: $file" >&2
        fi
    done
}

# Resolve file paths relative to a base directory
# Usage: bundler_resolve_paths base_dir file1 file2 ...
bundler_resolve_paths() {
    local base="$1"
    shift
    local files=("$@")
    local resolved=()

    for file in "${files[@]}"; do
        if [[ "$file" = /* ]]; then
            resolved+=("$file")
        else
            resolved+=("$base/$file")
        fi
    done

    printf '%s\n' "${resolved[@]}"
}
