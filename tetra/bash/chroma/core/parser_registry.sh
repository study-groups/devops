#!/usr/bin/env bash

# Chroma Parser Registry
# Enables pluggable format parsers with self-registration

#==============================================================================
# REGISTRY DATA STRUCTURES
#==============================================================================

declare -gA CHROMA_PARSERS=()           # name -> render_function
declare -gA CHROMA_PARSER_META=()       # name -> description
declare -gA CHROMA_EXT_MAP=()           # extension -> parser_name
declare -ga CHROMA_PARSER_ORDER=()      # load order for listing

#==============================================================================
# REGISTRATION API
#==============================================================================

# Register a parser
# Args: name render_fn extensions [description]
# Example: chroma_register_parser "toml" "_chroma_parse_toml" "toml" "TOML files"
chroma_register_parser() {
    local name="$1"
    local render_fn="$2"
    local extensions="$3"
    local description="${4:-No description}"

    if [[ -z "$name" || -z "$render_fn" ]]; then
        echo "Error: chroma_register_parser requires name and render_fn" >&2
        return 1
    fi

    # Validate render function exists
    if ! declare -F "$render_fn" &>/dev/null; then
        echo "Warning: Parser '$name' function '$render_fn' not found" >&2
        return 1
    fi

    CHROMA_PARSERS["$name"]="$render_fn"
    CHROMA_PARSER_META["$name"]="$description"

    # Track load order (avoid duplicates)
    local found=0
    for existing in "${CHROMA_PARSER_ORDER[@]}"; do
        [[ "$existing" == "$name" ]] && found=1 && break
    done
    (( found )) || CHROMA_PARSER_ORDER+=("$name")

    # Map extensions to parser
    for ext in $extensions; do
        CHROMA_EXT_MAP["$ext"]="$name"
    done

    return 0
}

#==============================================================================
# LOOKUP API
#==============================================================================

# Get render function for a parser
# Args: name
# Returns: function name or empty
chroma_get_parser() {
    local name="$1"
    echo "${CHROMA_PARSERS[$name]:-}"
}

# Check if parser exists
# Args: name
chroma_parser_exists() {
    [[ -v "CHROMA_PARSERS[$1]" ]]
}

# Get parser for file extension
# Args: extension (without dot)
# Returns: parser name or empty
chroma_parser_for_ext() {
    local ext="$1"
    echo "${CHROMA_EXT_MAP[$ext]:-}"
}

#==============================================================================
# FORMAT DETECTION
#==============================================================================

# Detect format from file or content
# Args: file [first_line_hint]
# Returns: parser name (defaults to "markdown")
chroma_detect_format() {
    local file="$1"
    local hint="${2:-}"

    # 1. Extension-based detection
    if [[ -n "$file" && "$file" != "-" ]]; then
        local ext="${file##*.}"
        ext="${ext,,}"  # lowercase
        local parser="${CHROMA_EXT_MAP[$ext]:-}"
        [[ -n "$parser" ]] && { echo "$parser"; return 0; }
    fi

    # 2. Content-based detection (for stdin or unknown extension)
    if [[ -n "$hint" ]]; then
        # TOML: starts with [section] or key = value
        [[ "$hint" =~ ^\[.*\]$ ]] && { echo "toml"; return 0; }
        [[ "$hint" =~ ^[a-zA-Z_][a-zA-Z0-9_]*[[:space:]]*= ]] && { echo "toml"; return 0; }

        # JSON: starts with { or [
        [[ "$hint" =~ ^[[:space:]]*\{ ]] && { echo "json"; return 0; }
        [[ "$hint" =~ ^[[:space:]]*\[ ]] && { echo "json"; return 0; }
    fi

    # 3. Default to markdown
    echo "markdown"
}

#==============================================================================
# LISTING
#==============================================================================

# List all registered parsers
chroma_list_parsers() {
    echo "Registered Parsers:"
    echo

    if [[ ${#CHROMA_PARSER_ORDER[@]} -eq 0 ]]; then
        echo "  (none)"
        return
    fi

    for name in "${CHROMA_PARSER_ORDER[@]}"; do
        local fn="${CHROMA_PARSERS[$name]}"
        local desc="${CHROMA_PARSER_META[$name]}"

        printf "  \033[1m%-12s\033[0m  %s\n" "$name" "$desc"

        # Show mapped extensions
        local exts=""
        for ext in "${!CHROMA_EXT_MAP[@]}"; do
            [[ "${CHROMA_EXT_MAP[$ext]}" == "$name" ]] && exts+=".$ext "
        done
        [[ -n "$exts" ]] && printf "               Extensions: %s\n" "$exts"
    done
}

# Get parser info
# Args: name
chroma_parser_info() {
    local name="$1"

    if ! chroma_parser_exists "$name"; then
        echo "Error: Unknown parser '$name'" >&2
        return 1
    fi

    local fn="${CHROMA_PARSERS[$name]}"
    local desc="${CHROMA_PARSER_META[$name]}"
    local validate_fn="${fn}_validate"
    local info_fn="${fn}_info"

    echo "Parser: $name"
    echo "Description: $desc"
    echo "Render function: $fn"

    # Extensions
    printf "Extensions:"
    for ext in "${!CHROMA_EXT_MAP[@]}"; do
        [[ "${CHROMA_EXT_MAP[$ext]}" == "$name" ]] && printf " .%s" "$ext"
    done
    echo

    # Validation status
    if declare -F "$validate_fn" &>/dev/null; then
        if "$validate_fn" 2>/dev/null; then
            echo "Status: healthy"
        else
            echo "Status: validation failed"
        fi
    else
        echo "Status: no validator"
    fi

    # Custom info
    if declare -F "$info_fn" &>/dev/null; then
        echo
        "$info_fn"
    fi
}

export -f chroma_register_parser chroma_get_parser chroma_parser_exists
export -f chroma_parser_for_ext chroma_detect_format
export -f chroma_list_parsers chroma_parser_info
