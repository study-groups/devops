#!/usr/bin/env bash
# rag_selector.sh - Selector data structure for marking code spans
# Selectors are like SpaCy spans - they mark regions of code in files

# Format: file:start-end[:type[:label]]
# Examples:
#   auth.sh:42-58
#   auth.sh:42-58:function
#   auth.sh:42-58:function:authenticate
#   user.sh:10-25:class:User

# Global selectors array (in-memory storage)
declare -ga SELECTORS=()

# Parse a selector string into components
# Usage: selector_parse <selector_string>
# Returns: Prints "file start end type label" (one per line)
selector_parse() {
    local selector="$1"

    if [[ -z "$selector" ]]; then
        echo "Error: selector_parse requires a selector string" >&2
        return 1
    fi

    # Regex: file:start-end[:type[:label]]
    if [[ "$selector" =~ ^([^:]+):([0-9]+)-([0-9]+)(:([^:]+)(:(.+))?)?$ ]]; then
        local file="${BASH_REMATCH[1]}"
        local start="${BASH_REMATCH[2]}"
        local end="${BASH_REMATCH[3]}"
        local type="${BASH_REMATCH[5]:-}"
        local label="${BASH_REMATCH[7]:-}"

        echo "$file"
        echo "$start"
        echo "$end"
        echo "$type"
        echo "$label"
        return 0
    else
        echo "Error: Invalid selector format: $selector" >&2
        echo "Expected: file:start-end[:type[:label]]" >&2
        return 1
    fi
}

# Extract code span from file using selector
# Usage: selector_extract <selector_string>
selector_extract() {
    local selector="$1"

    local -a parts
    mapfile -t parts < <(selector_parse "$selector")

    if [[ $? -ne 0 ]]; then
        return 1
    fi

    local file="${parts[0]}"
    local start="${parts[1]}"
    local end="${parts[2]}"

    if [[ ! -f "$file" ]]; then
        echo "Error: File not found: $file" >&2
        return 1
    fi

    if [[ $start -lt 1 || $end -lt $start ]]; then
        echo "Error: Invalid line range: $start-$end" >&2
        return 1
    fi

    # Extract lines using sed
    sed -n "${start},${end}p" "$file"
}

# Load selectors from file into SELECTORS array
# Usage: selectors_load <file>
selectors_load() {
    local file="$1"

    if [[ -z "$file" ]]; then
        echo "Error: selectors_load requires a file path" >&2
        return 1
    fi

    if [[ ! -f "$file" ]]; then
        echo "Error: File not found: $file" >&2
        return 1
    fi

    # Clear existing selectors
    SELECTORS=()

    # Load file, skipping comments and empty lines
    while IFS= read -r line; do
        # Skip comments and empty lines
        [[ "$line" =~ ^#.*$ || -z "$line" ]] && continue
        SELECTORS+=("$line")
    done < "$file"

    echo "Loaded ${#SELECTORS[@]} selectors from $file" >&2
}

# Save SELECTORS array to file
# Usage: selectors_save <file>
selectors_save() {
    local file="$1"

    if [[ -z "$file" ]]; then
        echo "Error: selectors_save requires a file path" >&2
        return 1
    fi

    if [[ ${#SELECTORS[@]} -eq 0 ]]; then
        echo "Warning: No selectors to save" >&2
        return 0
    fi

    # Write selectors to file
    printf "%s\n" "${SELECTORS[@]}" > "$file"
    echo "Saved ${#SELECTORS[@]} selectors to $file" >&2
}

# Add a selector to SELECTORS array
# Usage: selectors_add <selector_string>
selectors_add() {
    local selector="$1"

    if [[ -z "$selector" ]]; then
        echo "Error: selectors_add requires a selector string" >&2
        return 1
    fi

    # Validate selector format
    if ! selector_parse "$selector" >/dev/null 2>&1; then
        return 1
    fi

    SELECTORS+=("$selector")
    echo "Added selector: $selector (total: ${#SELECTORS[@]})" >&2
}

# Clear all selectors
# Usage: selectors_clear
selectors_clear() {
    SELECTORS=()
    echo "Cleared all selectors" >&2
}

# List all selectors
# Usage: selectors_list
selectors_list() {
    if [[ ${#SELECTORS[@]} -eq 0 ]]; then
        echo "No selectors" >&2
        return 0
    fi

    local i=0
    for selector in "${SELECTORS[@]}"; do
        printf "[%d] %s\n" "$i" "$selector"
        ((i++))
    done
}

# Get selector count
# Usage: selectors_count
selectors_count() {
    echo "${#SELECTORS[@]}"
}

# Get selector by index
# Usage: selectors_get <index>
selectors_get() {
    local idx="$1"

    if [[ -z "$idx" ]]; then
        echo "Error: selectors_get requires an index" >&2
        return 1
    fi

    if [[ $idx -lt 0 || $idx -ge ${#SELECTORS[@]} ]]; then
        echo "Error: Index out of range: $idx (max: $((${#SELECTORS[@]} - 1)))" >&2
        return 1
    fi

    echo "${SELECTORS[$idx]}"
}

# Convert selectors to MULTICAT format
# Usage: selectors_to_multicat [output_file]
selectors_to_multicat() {
    local output_file="${1:-}"

    if [[ ${#SELECTORS[@]} -eq 0 ]]; then
        echo "Error: No selectors to convert" >&2
        return 1
    fi

    local output=""

    for selector in "${SELECTORS[@]}"; do
        local -a parts
        mapfile -t parts < <(selector_parse "$selector")

        if [[ $? -ne 0 ]]; then
            echo "Warning: Skipping invalid selector: $selector" >&2
            continue
        fi

        local file="${parts[0]}"
        local start="${parts[1]}"
        local end="${parts[2]}"
        local type="${parts[3]}"
        local label="${parts[4]}"

        # Get directory and filename
        local dir="$(dirname "$file")"
        local filename="$(basename "$file")"

        # Build MULTICAT block
        output+="#MULTICAT_START"$'\n'
        output+="# dir: $dir"$'\n'
        output+="# file: $filename"$'\n'

        # Add optional fields
        [[ -n "$type" ]] && output+="# mode: $type"$'\n'
        [[ -n "$label" ]] && output+="# selector: $label"$'\n'

        output+="#MULTICAT_END"$'\n'

        # Extract and append content
        if content=$(selector_extract "$selector" 2>/dev/null); then
            output+="$content"$'\n\n'
        else
            echo "Warning: Failed to extract content for: $selector" >&2
        fi
    done

    # Output to file or stdout
    if [[ -n "$output_file" ]]; then
        echo "$output" > "$output_file"
        echo "Wrote MULTICAT to $output_file" >&2
    else
        echo "$output"
    fi
}

# Export functions for use in other scripts
export -f selector_parse
export -f selector_extract
export -f selectors_load
export -f selectors_save
export -f selectors_add
export -f selectors_clear
export -f selectors_list
export -f selectors_count
export -f selectors_get
export -f selectors_to_multicat
