#!/usr/bin/env bash
# tetra_query_exec.sh - Execute TQL queries and return matching files
# Main query executor that combines parser, compiler, and label extractor

# Source dependencies
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/tetra_query_parser.sh"
source "$SCRIPT_DIR/tetra_filter_compiler.sh"
source "$SCRIPT_DIR/tetra_query_labels.sh"

# Get base directory for a module on an environment
get_module_base_dir() {
    local env="$1"
    local module="$2"

    # Set TETRA_DIR if not set
    : "${TETRA_DIR:=$HOME/tetra}"

    if [[ "$env" == "local" ]] || [[ -z "$env" ]]; then
        echo "$TETRA_DIR/$module/db"
    else
        # For remote environments, would need SSH/connector logic
        # For now, return local path with warning
        echo "WARNING:Remote environment queries not yet implemented: $env" >&2
        echo "$TETRA_DIR/$module/db"
    fi
}

# Execute a TQL query and return matching files
execute_query() {
    local query="$1"
    local limit="${2:-100}"  # Default limit

    # Parse query
    local parse_result
    parse_result=$(parse_tql_query "$query")

    if [[ $? -ne 0 ]]; then
        echo "ERROR:Failed to parse query: $query" >&2
        return 1
    fi

    # Extract query components
    local type env module id pattern filter filter_type type_pattern
    eval "$parse_result"

    case "$type" in
        collection)
            execute_collection_query "$env" "$module" "$id" "$limit"
            ;;
        filtered)
            execute_filtered_query "$env" "$module" "$filter" "$filter_type" "$type_pattern" "$limit"
            ;;
        *)
            echo "ERROR:Unknown query type: $type" >&2
            return 1
            ;;
    esac
}

# Execute collection query: return all types for module:id
execute_collection_query() {
    local env="$1"
    local module="$2"
    local id="$3"
    local limit="$4"

    local base_dir=$(get_module_base_dir "$env" "$module")

    if [[ ! -d "$base_dir" ]]; then
        echo "ERROR:Module database not found: $base_dir" >&2
        return 1
    fi

    # Find all files matching pattern
    find "$base_dir" -name "${id}.${module}.*" -type f 2>/dev/null | head -n "$limit"
}

# Execute filtered query with pattern or labels
execute_filtered_query() {
    local env="$1"
    local module="$2"
    local filter="$3"
    local filter_type="$4"
    local type_pattern="$5"
    local limit="$6"

    local base_dir=$(get_module_base_dir "$env" "$module")

    if [[ ! -d "$base_dir" ]]; then
        echo "ERROR:Module database not found: $base_dir" >&2
        return 1
    fi

    case "$filter_type" in
        pattern)
            execute_pattern_filter "$base_dir" "$module" "$filter" "$type_pattern" "$limit"
            ;;
        labels)
            execute_label_filter "$base_dir" "$module" "$filter" "$type_pattern" "$limit"
            ;;
        *)
            echo "ERROR:Unknown filter type: $filter_type" >&2
            return 1
            ;;
    esac
}

# Execute pattern-based filter (simple wildcards)
execute_pattern_filter() {
    local base_dir="$1"
    local module="$2"
    local pattern="$3"
    local type_pattern="$4"
    local limit="$5"

    # Construct find pattern
    local find_pattern="${pattern}.${module}.${type_pattern}"

    find "$base_dir" -name "$find_pattern" -type f 2>/dev/null | head -n "$limit"
}

# Execute label-based filter (Prometheus-style)
execute_label_filter() {
    local base_dir="$1"
    local module="$2"
    local filter="$3"
    local type_pattern="$4"
    local limit="$5"

    # First, find candidate files by type pattern
    local find_pattern="*.${module}.${type_pattern}"

    # Compile filter to test function
    local test_func
    test_func=$(compile_filter "$filter" "labels")

    if [[ $? -ne 0 ]]; then
        echo "ERROR:Failed to compile filter: $filter" >&2
        return 1
    fi

    # Source the test function
    eval "$test_func"

    # Find files and test against filter
    local count=0
    find "$base_dir" -name "$find_pattern" -type f 2>/dev/null | while read -r file; do
        if [[ $count -ge $limit ]]; then
            break
        fi

        # Test file against compiled filter
        if test_filter "$file" 2>/dev/null; then
            echo "$file"
            ((count++))
        fi
    done
}

# Count results without returning them
count_query() {
    local query="$1"
    execute_query "$query" 999999 | wc -l
}

# Execute query and format output
query_format() {
    local query="$1"
    local format="${2:-path}"  # path, json, table
    local limit="${3:-100}"

    local results
    results=$(execute_query "$query" "$limit")

    case "$format" in
        path)
            echo "$results"
            ;;
        json)
            echo "$results" | while read -r file; do
                echo "{"
                echo "  \"file\": \"$file\","
                extract_labels "$file" 2>/dev/null | sed 's/^/  "/' | sed 's/=/": "/' | sed 's/$/"/' | paste -sd "," -
                echo "}"
            done
            ;;
        table)
            echo "TIMESTAMP    MODULE  VARIANT      SIZE    FILE"
            echo "------------ ------- ------------ ------- ----"
            echo "$results" | while read -r file; do
                local ts=$(extract_timestamp "$file")
                local module=$(extract_module "$file")
                local variant=$(extract_variant "$file")
                local size=$(get_label "$file" "size")
                printf "%-12s %-7s %-12s %-7s %s\n" "$ts" "$module" "$variant" "$size" "$(basename "$file")"
            done
            ;;
        *)
            echo "ERROR:Unknown format: $format" >&2
            return 1
            ;;
    esac
}

# Main command-line interface
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    case "${1:-}" in
        query|q)
            execute_query "$2" "${3:-100}"
            ;;
        count|c)
            count_query "$2"
            ;;
        format|f)
            query_format "$2" "${3:-path}" "${4:-100}"
            ;;
        *)
            cat <<EOF
Usage: tetra_query_exec.sh <command> <args>

Commands:
  query|q <query> [limit]         Execute query and return file paths
  count|c <query>                 Count matching files
  format|f <query> [format] [limit]  Execute and format output

Query Syntax:
  Collection:  @env:module:id                   (e.g., @dev:qa:1760229927)
  Filtered:    @env.module.{filter}.type        (e.g., @dev.vox.{ts>1760229000}.sally.mp3)
  Simple:      module.pattern.type              (e.g., vox.176022*.sally)

Filter Operators:
  =       Exact match
  !=      Not equal
  =~      Regex match
  !~      Regex not match
  >       Greater than
  <       Less than
  >=      Greater or equal
  <=      Less or equal

Format Types:
  path    - File paths (default)
  json    - JSON with labels
  table   - Formatted table

Examples:
  # Collection query: all QA files for timestamp
  tetra_query_exec.sh query "@dev:qa:1760229927"

  # Pattern query: sally audio from October 13
  tetra_query_exec.sh query "vox.176022*.sally"

  # Label filter: timestamp range
  tetra_query_exec.sh query "@dev.qa.{ts>1760229000,ts<1760230000}.answer"

  # Count results
  tetra_query_exec.sh count "vox.*.sally.mp3"

  # Format as table
  tetra_query_exec.sh format "vox.176022*.sally" table
EOF
            exit 1
            ;;
    esac
fi
