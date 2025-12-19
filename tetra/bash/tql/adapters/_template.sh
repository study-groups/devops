#!/usr/bin/env bash
# TQL Adapter Template
# Copy this file to create adapters for new data sources
#
# ADAPTER CONTRACT:
# 1. Define field mappings (TQL_<MODULE>_FIELDS)
# 2. Define key map string (TQL_<MODULE>_KEY_MAP)
# 3. Implement tql_<module>_filter_record()
# 4. Implement tql_<module>_query()
# 5. Optional: tql_<module>_format_field() for display

# === CONFIGURATION ===

# Module name (used for function prefixes)
TQL_ADAPTER_MODULE="example"

# Load TQL components (required)
TQL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$TQL_DIR/tetra_temporal.sh" 2>/dev/null || true
source "$TQL_DIR/tetra_query_modifiers.sh" 2>/dev/null || true

# === FIELD DEFINITIONS ===
# Maps friendly field names to column positions in pipe-delimited data
# Your data format: field1|field2|field3|...
#
# Example data row: "1|myfile.txt|1024|2025-01-15"
# Columns:           1  2          3     4

declare -A TQL_EXAMPLE_FIELDS=(
    # Core fields - adjust to your data format
    [id]=1          # Primary identifier
    [name]=2        # Display name
    [size]=3        # Numeric field example
    [date]=4        # Date field example

    # Aliases (optional, for user convenience)
    [file]=2        # Alias for name
    [bytes]=3       # Alias for size
)

# Key map for sort compilation (field:column pairs)
TQL_EXAMPLE_KEY_MAP="id:1,name:2,size:3,date:4"

# === REQUIRED FUNCTIONS ===

# Get column number for a field name
# Usage: tql_example_get_column "name" → 2
tql_example_get_column() {
    local field="$1"
    echo "${TQL_EXAMPLE_FIELDS[$field]:-0}"
}

# Filter a single record against a filter expression
# This is the core matching logic - customize for your data
#
# Usage: tql_example_filter_record "1|file.txt|1024|2025-01-15" "size>500"
# Returns: 0 if matches, 1 if not
tql_example_filter_record() {
    local record="$1"
    local filter="$2"

    # Parse record into fields
    # CUSTOMIZE: adjust field names to match your data
    local id name size date
    IFS='|' read -r id name size date <<< "$record"

    # Handle temporal filters (if your data has timestamps)
    if [[ "$filter" == temporal:* ]]; then
        local temporal_expr="${filter#temporal:}"
        local constraint
        constraint=$(tql_parse_temporal "$temporal_expr" 2>/dev/null)

        [[ "$constraint" == error:* ]] && return 1

        # CUSTOMIZE: extract timestamp from your data
        # Example: parse date field to Unix timestamp
        local ts
        ts=$(date -d "$date" +%s 2>/dev/null || echo 0)

        tql_temporal_match "$ts" "$constraint"
        return $?
    fi

    # Parse filter expression: field{op}value
    local field op value
    if [[ "$filter" =~ ^([a-z_]+)(=~|!=|!~|>=|<=|>|<|=|~)(.+)$ ]]; then
        field="${BASH_REMATCH[1]}"
        op="${BASH_REMATCH[2]}"
        value="${BASH_REMATCH[3]}"
    else
        return 1  # Invalid filter format
    fi

    # Get field value
    # CUSTOMIZE: add your field mappings
    local field_value
    case "$field" in
        id)         field_value="$id" ;;
        name|file)  field_value="$name" ;;
        size|bytes) field_value="$size" ;;
        date)       field_value="$date" ;;
        *)          return 1 ;;  # Unknown field
    esac

    # Apply operator (standard TQL operators)
    case "$op" in
        "=")  [[ "$field_value" == "$value" ]] ;;
        "!=") [[ "$field_value" != "$value" ]] ;;
        "~")  [[ "${field_value,,}" == *"${value,,}"* ]] ;;  # Contains
        "=~") [[ "$field_value" =~ $value ]] ;;              # Regex
        "!~") [[ ! "$field_value" =~ $value ]] ;;            # Not regex
        ">")  [[ "$field_value" -gt "$value" ]] 2>/dev/null ;;
        "<")  [[ "$field_value" -lt "$value" ]] 2>/dev/null ;;
        ">=") [[ "$field_value" -ge "$value" ]] 2>/dev/null ;;
        "<=") [[ "$field_value" -le "$value" ]] 2>/dev/null ;;
        *)    return 1 ;;
    esac
}

# Apply TQL query to data stream
# Usage: echo "$data" | tql_example_query "name~test sort:size limit:10"
tql_example_query() {
    local query="$1"
    local input
    input=$(cat)

    # Parse query into filters and modifiers
    local parsed
    parsed=$(tql_parse_modifiers "$query")

    # Extract components
    local filters="" sort_field="" sort_dir="" limit="" offset=""
    while IFS='=' read -r key value; do
        case "$key" in
            filters)    filters="$value" ;;
            sort_field) sort_field="$value" ;;
            sort_dir)   sort_dir="$value" ;;
            limit)      limit="$value" ;;
            offset)     offset="$value" ;;
        esac
    done <<< "$parsed"

    # Apply filters
    local filtered=""
    while IFS= read -r record; do
        [[ -z "$record" ]] && continue

        local matches=true
        for filter in $filters; do
            if ! tql_example_filter_record "$record" "$filter"; then
                matches=false
                break
            fi
        done

        [[ "$matches" == "true" ]] && filtered+="$record"$'\n'
    done <<< "$input"

    filtered="${filtered%$'\n'}"

    # Apply sort
    local result="$filtered"
    if [[ -n "$sort_field" && -n "$filtered" ]]; then
        local sort_key="${TQL_EXAMPLE_FIELDS[$sort_field]:-1}"
        local sort_opts="-t'|' -k${sort_key},${sort_key}"

        # CUSTOMIZE: list your numeric fields
        case "$sort_field" in
            id|size)
                sort_opts+=" -n"
                ;;
        esac

        [[ "$sort_dir" == "desc" ]] && sort_opts+=" -r"
        result=$(echo "$filtered" | eval "sort $sort_opts")
    fi

    # Apply limit/offset
    if [[ -n "$limit" || -n "$offset" ]]; then
        result=$(echo "$result" | tql_apply_limit "$limit" "$offset")
    fi

    echo "$result"
}

# === OPTIONAL FUNCTIONS ===

# Format field value for display
# CUSTOMIZE: add special formatting for your fields
tql_example_format_field() {
    local field="$1"
    local value="$2"

    case "$field" in
        size|bytes)
            # Human-readable bytes
            if [[ "$value" -ge 1073741824 ]]; then
                echo "$(( value / 1073741824 ))G"
            elif [[ "$value" -ge 1048576 ]]; then
                echo "$(( value / 1048576 ))M"
            elif [[ "$value" -ge 1024 ]]; then
                echo "$(( value / 1024 ))K"
            else
                echo "${value}B"
            fi
            ;;
        *)
            echo "$value"
            ;;
    esac
}

# === EXPORTS ===
# Export functions for use by other scripts
export -f tql_example_get_column
export -f tql_example_filter_record
export -f tql_example_query
export -f tql_example_format_field

# === CLI INTERFACE ===
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    case "${1:-}" in
        query)
            tql_example_query "$2"
            ;;
        column)
            tql_example_get_column "$2"
            ;;
        filter)
            tql_example_filter_record "$2" "$3"
            echo $?
            ;;
        help|*)
            cat <<EOF
TQL Adapter: example

Usage: example.sh <command> <args>

Commands:
  query <query>           Apply TQL query to stdin
  column <field>          Get column number for field
  filter <record> <expr>  Test if record matches filter

Fields: id, name, size, date

Query Examples:
  echo "\$data" | example.sh query "name~test sort:size limit:5"
  example.sh column size
EOF
            ;;
    esac
fi
