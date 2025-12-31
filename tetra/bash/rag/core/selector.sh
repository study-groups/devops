#!/usr/bin/env bash
# selector.sh - Evidence selector parsing utilities
#
# Selector format: file[::range][#tags]
#   file              - Path to source file
#   range             - Optional line/byte range
#   tags              - Optional comma-separated tags
#
# Range formats:
#   100,200           - Lines 100-200
#   100               - Line 100 to EOF
#   100c,500c         - Bytes 100-500 (character mode)
#   100c              - Byte 100 to EOF
#
# Examples:
#   core/flow.sh
#   core/flow.sh::100,200
#   core/flow.sh::100
#   core/flow.sh::100c,500c
#   core/flow.sh#flow,manager
#   core/flow.sh::100,200#important

# Prevent double-sourcing
[[ -n "${RAG_SELECTOR_LOADED:-}" ]] && return 0
RAG_SELECTOR_LOADED=1

# =============================================================================
# SELECTOR PARSING
# =============================================================================

# Parse an evidence selector into components
# Usage: parse_selector "file::range#tags"
# Sets global variables: SELECTOR_FILE, SELECTOR_RANGE, SELECTOR_TAGS
#                       SELECTOR_START, SELECTOR_END, SELECTOR_CHAR_MODE
# Returns: 0 on success, 1 on parse error
parse_selector() {
    local selector="$1"

    # Reset globals
    SELECTOR_FILE=""
    SELECTOR_RANGE=""
    SELECTOR_TAGS=""
    SELECTOR_START=""
    SELECTOR_END=""
    SELECTOR_CHAR_MODE=false
    SELECTOR_SPAN_INFO="full"

    if [[ -z "$selector" ]]; then
        echo "Error: Empty selector" >&2
        return 1
    fi

    local working="$selector"

    # Extract tags (anything after #)
    if [[ "$working" =~ ^([^#]+)#(.+)$ ]]; then
        working="${BASH_REMATCH[1]}"
        SELECTOR_TAGS="${BASH_REMATCH[2]}"
    fi

    # Extract range (anything after ::)
    if [[ "$working" =~ ^([^:]+)::(.+)$ ]]; then
        SELECTOR_FILE="${BASH_REMATCH[1]}"
        SELECTOR_RANGE="${BASH_REMATCH[2]}"
    else
        SELECTOR_FILE="$working"
    fi

    # Parse range if present
    if [[ -n "$SELECTOR_RANGE" ]]; then
        if ! _parse_range "$SELECTOR_RANGE"; then
            return 1
        fi
    fi

    return 0
}

# Internal: Parse range component
_parse_range() {
    local range="$1"

    # Check for character mode (c suffix)
    if [[ "$range" =~ c ]]; then
        SELECTOR_CHAR_MODE=true
    fi

    # Parse start,end or just start
    if [[ "$range" =~ ^([0-9]+)c?,?([0-9]*)c?$ ]]; then
        SELECTOR_START="${BASH_REMATCH[1]}"
        SELECTOR_END="${BASH_REMATCH[2]}"

        # Build span info
        if [[ "$SELECTOR_CHAR_MODE" == true ]]; then
            if [[ -n "$SELECTOR_END" ]]; then
                SELECTOR_SPAN_INFO="bytes=${SELECTOR_START}:${SELECTOR_END}"
            else
                SELECTOR_SPAN_INFO="bytes=${SELECTOR_START}:EOF"
            fi
        else
            if [[ -n "$SELECTOR_END" ]]; then
                SELECTOR_SPAN_INFO="lines=${SELECTOR_START}:${SELECTOR_END}"
            else
                SELECTOR_SPAN_INFO="lines=${SELECTOR_START}:EOF"
            fi
        fi
        return 0
    else
        echo "Error: Invalid range format: $range" >&2
        echo "Expected: start[,end] or startc[,endc]" >&2
        return 1
    fi
}

# =============================================================================
# CONTENT EXTRACTION
# =============================================================================

# Extract content from file based on parsed selector
# Usage: selector_extract_content
# Requires: parse_selector called first, SELECTOR_* variables set
# Returns: Extracted content on stdout
selector_extract_content() {
    local file="$SELECTOR_FILE"

    if [[ ! -f "$file" ]]; then
        echo "Error: File not found: $file" >&2
        return 1
    fi

    if [[ -z "$SELECTOR_RANGE" ]]; then
        # Whole file
        cat "$file"
        return 0
    fi

    if [[ "$SELECTOR_CHAR_MODE" == true ]]; then
        # Byte/character mode
        if [[ -n "$SELECTOR_END" ]]; then
            local length=$((SELECTOR_END - SELECTOR_START))
            dd if="$file" bs=1 skip="$SELECTOR_START" count="$length" 2>/dev/null
        else
            dd if="$file" bs=1 skip="$SELECTOR_START" 2>/dev/null
        fi
    else
        # Line mode
        if [[ -n "$SELECTOR_END" ]]; then
            sed -n "${SELECTOR_START},${SELECTOR_END}p" "$file"
        else
            sed -n "${SELECTOR_START},\$p" "$file"
        fi
    fi
}

# =============================================================================
# VALIDATION
# =============================================================================

# Validate a selector without parsing
# Returns: 0 if valid, 1 if invalid
validate_selector() {
    local selector="$1"

    # Basic format check
    if [[ -z "$selector" ]]; then
        return 1
    fi

    # Must have at least a file component
    local file="${selector%%::*}"
    file="${file%%#*}"

    if [[ -z "$file" ]]; then
        return 1
    fi

    # Range format check if present
    if [[ "$selector" =~ :: ]]; then
        local range="${selector#*::}"
        range="${range%%#*}"
        if [[ ! "$range" =~ ^[0-9]+c?(,[0-9]+c?)?$ ]]; then
            return 1
        fi
    fi

    return 0
}

# =============================================================================
# DISPLAY HELPERS
# =============================================================================

# Format selector for display
# Usage: format_selector "file::range#tags"
format_selector() {
    local selector="$1"

    parse_selector "$selector" || return 1

    local display="$SELECTOR_FILE"

    if [[ -n "$SELECTOR_RANGE" ]]; then
        display+=" [$SELECTOR_SPAN_INFO]"
    fi

    if [[ -n "$SELECTOR_TAGS" ]]; then
        display+=" #${SELECTOR_TAGS}"
    fi

    echo "$display"
}

# Generate evidence filename from selector
# Usage: selector_to_filename "file::range#tags" [rank]
selector_to_filename() {
    local selector="$1"
    local rank="${2:-100}"

    parse_selector "$selector" || return 1

    local basename=$(basename "$SELECTOR_FILE")
    local kind=$(echo "$basename" | tr '.' '_' | tr '[:upper:]' '[:lower:]' | sed 's/__*/_/g')

    echo "${rank}_${kind}.evidence.md"
}

# =============================================================================
# ASSOCIATIVE ARRAY OUTPUT
# =============================================================================

# Parse selector into associative array (bash 4+)
# Usage: declare -A result; selector_to_array "file::range#tags" result
selector_to_array() {
    local selector="$1"
    local -n arr="$2"  # nameref

    parse_selector "$selector" || return 1

    arr[file]="$SELECTOR_FILE"
    arr[range]="$SELECTOR_RANGE"
    arr[tags]="$SELECTOR_TAGS"
    arr[start]="$SELECTOR_START"
    arr[end]="$SELECTOR_END"
    arr[char_mode]="$SELECTOR_CHAR_MODE"
    arr[span_info]="$SELECTOR_SPAN_INFO"
}

# =============================================================================
# EXPORTS
# =============================================================================

export RAG_SELECTOR_LOADED
export -f parse_selector
export -f selector_extract_content
export -f validate_selector
export -f format_selector
export -f selector_to_filename
export -f selector_to_array
