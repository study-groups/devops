#!/usr/bin/env bash

# Chroma Input Handling
# Simple stdin/file input management

#==============================================================================
# INPUT CAPTURE
#==============================================================================

# Capture stdin to temp file if piped
# Returns: filepath (temp or empty string)
chroma_capture_stdin() {
    if [[ ! -t 0 ]]; then
        local tmp
        tmp=$(mktemp "${TMPDIR:-/tmp}/chroma.XXXXXX")
        cat > "$tmp"
        echo "$tmp"
    fi
}

# Get input file - either argument or captured stdin
# Args: [file_arg]
# Sets: CHROMA_INPUT_FILE, CHROMA_INPUT_IS_TEMP
chroma_resolve_input() {
    local file_arg="$1"

    CHROMA_INPUT_FILE=""
    CHROMA_INPUT_IS_TEMP=0

    if [[ -n "$file_arg" && "$file_arg" != "-" ]]; then
        # Explicit file argument
        if [[ ! -f "$file_arg" ]]; then
            echo "Error: File not found: $file_arg" >&2
            return 1
        fi
        CHROMA_INPUT_FILE="$file_arg"
    else
        # Try stdin
        local captured
        captured=$(chroma_capture_stdin)
        if [[ -n "$captured" ]]; then
            CHROMA_INPUT_FILE="$captured"
            CHROMA_INPUT_IS_TEMP=1
        fi
    fi

    if [[ -z "$CHROMA_INPUT_FILE" ]]; then
        echo "Error: No input. Provide a file or pipe content." >&2
        return 1
    fi

    return 0
}

# Cleanup temp input file if needed
chroma_cleanup_input() {
    if (( CHROMA_INPUT_IS_TEMP )) && [[ -f "$CHROMA_INPUT_FILE" ]]; then
        rm -f "$CHROMA_INPUT_FILE"
    fi
    CHROMA_INPUT_FILE=""
    CHROMA_INPUT_IS_TEMP=0
}

#==============================================================================
# FORMAT DETECTION
#==============================================================================

# Detect format from file
# Args: file [explicit_format]
# Returns: format name
chroma_detect_format() {
    local file="$1"
    local explicit="${2:-}"

    # Explicit format takes priority
    [[ -n "$explicit" ]] && { echo "$explicit"; return 0; }

    # Extension-based
    if [[ -n "$file" ]]; then
        local ext="${file##*.}"
        ext="${ext,,}"
        case "$ext" in
            md|markdown) echo "markdown"; return 0 ;;
            toml)        echo "toml"; return 0 ;;
            json)        echo "json"; return 0 ;;
        esac
    fi

    # Content-based (first line)
    if [[ -f "$file" ]]; then
        local first_line
        first_line=$(head -1 "$file" 2>/dev/null)

        # TOML: [section] or key = value
        [[ "$first_line" =~ ^\[.*\]$ ]] && { echo "toml"; return 0; }
        [[ "$first_line" =~ ^[a-zA-Z_][a-zA-Z0-9_]*[[:space:]]*= ]] && { echo "toml"; return 0; }

        # JSON: starts with { or [
        [[ "$first_line" =~ ^[[:space:]]*\{ ]] && { echo "json"; return 0; }
        [[ "$first_line" =~ ^[[:space:]]*\[ ]] && { echo "json"; return 0; }
    fi

    # Default
    echo "markdown"
}
