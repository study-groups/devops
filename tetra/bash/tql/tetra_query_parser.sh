#!/usr/bin/env bash
# tetra_query_parser.sh - Tetra Query Language (TQL) Parser
# Parses collection and filtered queries into structured components

# Load unified logging
if ! type tetra_log_event >/dev/null 2>&1; then
    [[ -n "${TETRA_SRC:-}" ]] && source "${TETRA_SRC}/bash/utils/unified_log.sh" 2>/dev/null || true
fi

# Parse a TQL query and output structured data
# Usage: parse_tql_query "@dev:qa:1760229927"
#        parse_tql_query "@dev.vox.{ts>1760229000}.sally.mp3"
parse_tql_query() {
    local query="$1"

    # Detect query type by presence of colons vs dots
    if [[ $query =~ : ]] && [[ ! $query =~ \{ ]]; then
        parse_collection_query "$query"
    else
        parse_filtered_query "$query"
    fi
}

# Parse collection query: @env:module:id
# Returns all files matching module and id
parse_collection_query() {
    local query="$1"
    local env="" module="" id=""

    # Pattern: [@env]:module:id
    if [[ $query =~ ^@([^:]+):([^:]+):([^:]+)$ ]]; then
        env="${BASH_REMATCH[1]}"
        module="${BASH_REMATCH[2]}"
        id="${BASH_REMATCH[3]}"
    elif [[ $query =~ ^([^:]+):([^:]+)$ ]]; then
        # No @ prefix: module:id (local implied)
        env="local"
        module="${BASH_REMATCH[1]}"
        id="${BASH_REMATCH[2]}"
    else
        # Log parse error
        type tetra_log_error >/dev/null 2>&1 && \
            tetra_log_error query-parser "parse" "collection-query" "{\"query\":\"$query\",\"error\":\"invalid format\"}"
        echo "ERROR:Invalid collection query format: $query" >&2
        return 1
    fi

    # Output structured result
    cat <<EOF
type=collection
env=$env
module=$module
id=$id
pattern=$id.$module.*
EOF
}

# Parse filtered query: @env.module.{filter}.type
# Supports complex filtering with label matchers
parse_filtered_query() {
    local query="$1"
    local env="" module="" filter="" type_pattern=""

    # Remove @ prefix if present
    query="${query#@}"

    # Split by dots, handling {braces} specially
    local parts=()
    local current=""
    local in_braces=0

    for ((i=0; i<${#query}; i++)); do
        local char="${query:$i:1}"

        if [[ $char == "{" ]]; then
            in_braces=1
            current+="$char"
        elif [[ $char == "}" ]]; then
            in_braces=0
            current+="$char"
        elif [[ $char == "." ]] && [[ $in_braces -eq 0 ]]; then
            parts+=("$current")
            current=""
        else
            current+="$char"
        fi
    done
    parts+=("$current")  # Add last part

    # Parse parts based on count
    # Note: type_pattern can have dots (e.g., sally.mp3)
    if [[ ${#parts[@]} -lt 3 ]]; then
        # Log parse error
        type tetra_log_error >/dev/null 2>&1 && \
            tetra_log_error query-parser "parse" "filtered-query" "{\"query\":\"$query\",\"error\":\"too few parts\",\"parts\":${#parts[@]}}"
        echo "ERROR:Invalid filtered query format (too few parts): $query" >&2
        return 1
    fi

    if [[ ${#parts[@]} -eq 3 ]]; then
        # module.filter.type
        env="local"
        module="${parts[0]}"
        filter="${parts[1]}"
        type_pattern="${parts[2]}"
    else
        # env.module.filter.type[.ext...]
        # Last parts might be: sally.mp3 → rejoin with dots
        env="${parts[0]}"
        module="${parts[1]}"
        filter="${parts[2]}"

        # Rejoin remaining parts with dots
        type_pattern=""
        for ((i=3; i<${#parts[@]}; i++)); do
            if [[ $i -gt 3 ]]; then
                type_pattern+="."
            fi
            type_pattern+="${parts[$i]}"
        done
    fi

    # Determine filter type
    local filter_type="pattern"
    if [[ $filter =~ ^\{.*\}$ ]]; then
        filter_type="labels"
    fi

    # Output structured result
    cat <<EOF
type=filtered
env=$env
module=$module
filter=$filter
filter_type=$filter_type
type_pattern=$type_pattern
EOF
}

# Parse label matchers from {label=value,label>value} syntax
parse_label_matchers() {
    local filter="$1"

    # Remove braces
    filter="${filter#\{}"
    filter="${filter%\}}"

    # Split by comma (respecting quotes)
    local matchers=()
    local current=""
    local in_quotes=0

    for ((i=0; i<${#filter}; i++)); do
        local char="${filter:$i:1}"

        if [[ $char == '"' ]]; then
            in_quotes=$((1 - in_quotes))
            current+="$char"
        elif [[ $char == "," ]] && [[ $in_quotes -eq 0 ]]; then
            matchers+=("$current")
            current=""
        else
            current+="$char"
        fi
    done
    matchers+=("$current")  # Add last matcher

    # Parse each matcher
    for matcher in "${matchers[@]}"; do
        parse_label_matcher "$matcher"
    done
}

# Parse a single label matcher: label=value, label>value, label=~"regex"
parse_label_matcher() {
    local matcher="$1"

    # Detect operator
    local label="" op="" value=""

    if [[ $matcher =~ ^([a-z_]+)(=~|!=|!~|>=|<=|>|<|=)(.+)$ ]]; then
        label="${BASH_REMATCH[1]}"
        op="${BASH_REMATCH[2]}"
        value="${BASH_REMATCH[3]}"

        # Remove quotes from value
        value="${value#\"}"
        value="${value%\"}"

        # Output structured matcher
        echo "matcher:$label:$op:$value"
    else
        # Log parse error
        type tetra_log_error >/dev/null 2>&1 && \
            tetra_log_error query-parser "parse" "label-matcher" "{\"matcher\":\"$matcher\",\"error\":\"invalid format\"}"
        echo "ERROR:Invalid label matcher: $matcher" >&2
        return 1
    fi
}

# Extract timestamp from filename: 1760229927.vox.sally.mp3 → 1760229927
extract_timestamp() {
    local filename="$1"
    filename=$(basename "$filename")
    echo "${filename%%.*}"
}

# Extract module from filename: 1760229927.vox.sally.mp3 → vox
extract_module() {
    local filename="$1"
    filename=$(basename "$filename")
    # Remove first component (timestamp)
    local rest="${filename#*.}"
    echo "${rest%%.*}"
}

# Extract variant from filename: 1760229927.vox.sally.mp3 → sally
extract_variant() {
    local filename="$1"
    filename=$(basename "$filename")
    # Remove timestamp.module.
    local rest="${filename#*.*.}"
    echo "${rest%%.*}"
}

# Extract extension from filename: 1760229927.vox.sally.mp3 → mp3
extract_extension() {
    local filename="$1"
    echo "${filename##*.}"
}

# Main command-line interface
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    case "${1:-}" in
        parse)
            parse_tql_query "$2"
            ;;
        matchers)
            parse_label_matchers "$2"
            ;;
        timestamp)
            extract_timestamp "$2"
            ;;
        module)
            extract_module "$2"
            ;;
        variant)
            extract_variant "$2"
            ;;
        *)
            cat <<EOF
Usage: tetra_query_parser.sh <command> <args>

Commands:
  parse <query>      Parse TQL query
  matchers <filter>  Parse label matchers from {filter}
  timestamp <file>   Extract timestamp from filename
  module <file>      Extract module from filename
  variant <file>     Extract variant from filename

Examples:
  tetra_query_parser.sh parse "@dev:qa:1760229927"
  tetra_query_parser.sh parse "@dev.vox.{ts>1760229000}.sally.mp3"
  tetra_query_parser.sh matchers "{ts>1760229000,voice=\"sally\"}"
  tetra_query_parser.sh timestamp "1760229927.vox.sally.mp3"
EOF
            exit 1
            ;;
    esac
fi
