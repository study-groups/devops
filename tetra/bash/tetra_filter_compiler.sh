#!/usr/bin/env bash
# tetra_filter_compiler.sh - Compile TQL filters to bash test functions
# Converts label matchers into executable bash conditions

# Source the parser
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/tetra_query_parser.sh"

# Compile a filter expression into a bash test function
# Returns a function that tests a file against the filter
compile_filter() {
    local filter="$1"
    local filter_type="$2"  # "pattern" or "labels"

    case "$filter_type" in
        pattern)
            compile_pattern_filter "$filter"
            ;;
        labels)
            compile_label_filter "$filter"
            ;;
        *)
            echo "ERROR:Unknown filter type: $filter_type" >&2
            return 1
            ;;
    esac
}

# Compile a simple pattern filter (wildcards)
compile_pattern_filter() {
    local pattern="$1"

    cat <<'EOF'
test_filter() {
    local file="$1"
    local ts=$(extract_timestamp "$file")

    # Test timestamp pattern
EOF

    # Generate pattern test
    if [[ $pattern == "*" ]]; then
        echo '    return 0  # Match all'
    else
        echo "    [[ \$ts == $pattern ]]"
    fi

    echo '}'
}

# Compile label matchers into bash test function
compile_label_filter() {
    local filter="$1"

    # Parse matchers
    local matchers
    matchers=$(parse_label_matchers "$filter")

    # Start function
    cat <<'EOF'
test_filter() {
    local file="$1"

    # Extract built-in labels from filename
    local ts=$(extract_timestamp "$file")
    local module=$(extract_module "$file")
    local variant=$(extract_variant "$file")
    local ext=$(extract_extension "$file")

    # Extract metadata labels if .meta file exists
    local meta_file="${file%.mp3}.meta"
    local size=0
    local duration=0
    local voice=""
    local model=""

    if [[ -f "$file" ]]; then
        size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo 0)
    fi

    if [[ -f "$meta_file" ]]; then
        # Extract from JSON metadata
        if command -v jq >/dev/null 2>&1; then
            duration=$(jq -r '.duration_ms // 0' "$meta_file" 2>/dev/null || echo 0)
            voice=$(jq -r '.voice // ""' "$meta_file" 2>/dev/null || echo "")
            model=$(jq -r '.model // ""' "$meta_file" 2>/dev/null || echo "")
        fi
    fi

    # Test all matchers (AND logic)
EOF

    # Generate test for each matcher
    while IFS= read -r matcher_line; do
        if [[ $matcher_line == matcher:* ]]; then
            IFS=':' read -r _ label op value <<< "$matcher_line"
            compile_matcher_test "$label" "$op" "$value"
        fi
    done <<< "$matchers"

    # End function
    cat <<'EOF'

    # All matchers passed
    return 0
}
EOF
}

# Compile a single matcher into bash test
compile_matcher_test() {
    local label="$1"
    local op="$2"
    local value="$3"

    # Map label to bash variable
    local var="\$$label"

    case "$op" in
        "=")
            # Exact match
            echo "    [[ $var == \"$value\" ]] || return 1"
            ;;
        "!=")
            # Not equal
            echo "    [[ $var != \"$value\" ]] || return 1"
            ;;
        "=~")
            # Regex match
            echo "    [[ $var =~ $value ]] || return 1"
            ;;
        "!~")
            # Regex not match
            echo "    [[ ! $var =~ $value ]] || return 1"
            ;;
        ">")
            # Greater than (numeric)
            echo "    [[ \$(($var)) -gt $value ]] || return 1"
            ;;
        "<")
            # Less than (numeric)
            echo "    [[ \$(($var)) -lt $value ]] || return 1"
            ;;
        ">=")
            # Greater than or equal (numeric)
            echo "    [[ \$(($var)) -ge $value ]] || return 1"
            ;;
        "<=")
            # Less than or equal (numeric)
            echo "    [[ \$(($var)) -le $value ]] || return 1"
            ;;
        *)
            echo "    # ERROR: Unknown operator: $op" >&2
            return 1
            ;;
    esac
}

# Main command-line interface
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    case "${1:-}" in
        compile)
            compile_filter "$2" "${3:-labels}"
            ;;
        pattern)
            compile_pattern_filter "$2"
            ;;
        labels)
            compile_label_filter "$2"
            ;;
        test)
            # Compile and test a filter against a file
            filter="$2"
            filter_type="${3:-labels}"
            test_file="$4"

            # Compile filter
            filter_func=$(compile_filter "$filter" "$filter_type")

            # Source it
            eval "$filter_func"

            # Test file
            if test_filter "$test_file"; then
                echo "MATCH: $test_file"
            else
                echo "NO MATCH: $test_file"
            fi
            ;;
        *)
            cat <<EOF
Usage: tetra_filter_compiler.sh <command> <args>

Commands:
  compile <filter> <type>        Compile filter to bash function
  pattern <pattern>              Compile pattern filter
  labels <filter>                Compile label filter
  test <filter> <type> <file>    Compile and test filter against file

Examples:
  tetra_filter_compiler.sh compile "{ts>1760229000}" labels
  tetra_filter_compiler.sh pattern "176022*"
  tetra_filter_compiler.sh test "{ts>1760229000,voice=\"sally\"}" labels /path/to/file.mp3
EOF
            exit 1
            ;;
    esac
fi
