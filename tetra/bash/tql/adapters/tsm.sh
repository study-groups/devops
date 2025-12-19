#!/usr/bin/env bash
# tql/adapters/tsm.sh - TSM Process Adapter for TQL
# Provides field mappings and query execution for TSM process data

# Load TQL components
TQL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$TQL_DIR/tetra_temporal.sh" 2>/dev/null || true
source "$TQL_DIR/tetra_query_modifiers.sh" 2>/dev/null || true

# TSM field definitions
# Maps friendly names to column positions in pipe-delimited data
# Format: tsm_id|name|env|pid|port|type|uptime_sec|uptime_display|cwd
declare -A TQL_TSM_FIELDS=(
    [id]=1
    [tsm_id]=1
    [name]=2
    [env]=3
    [pid]=4
    [port]=5
    [type]=6
    [uptime]=7
    [uptime_sec]=7
    [uptime_display]=8
    [cwd]=9
    [path]=9
)

# Field column map string for sort compilation
TQL_TSM_KEY_MAP="id:1,name:2,env:3,pid:4,port:5,type:6,uptime:7"

# Get column number for a field name
tql_tsm_get_column() {
    local field="$1"
    echo "${TQL_TSM_FIELDS[$field]:-0}"
}

# Filter a single TSM process record
# Usage: tql_tsm_filter_record "1|name|env|pid|port|type|uptime|display|cwd" "env=tetra"
# Returns: 0 if matches, 1 if not
tql_tsm_filter_record() {
    local record="$1"
    local filter="$2"

    # Parse record
    local tsm_id name env pid port type uptime_sec uptime_display cwd
    IFS='|' read -r tsm_id name env pid port type uptime_sec uptime_display cwd <<< "$record"

    # Handle temporal filters
    if [[ "$filter" == temporal:* ]]; then
        local temporal_expr="${filter#temporal:}"
        local constraint
        constraint=$(tql_parse_temporal "$temporal_expr" 2>/dev/null)

        if [[ "$constraint" == error:* ]]; then
            return 1  # Invalid temporal, no match
        fi

        # TSM uptime is in seconds, need start_time for temporal filtering
        # For now, use current time - uptime as start_time approximation
        local now start_time
        now=$(date +%s)
        start_time=$((now - uptime_sec))

        tql_temporal_match "$start_time" "$constraint"
        return $?
    fi

    # Parse field=value or field~value or field>value
    local field op value
    if [[ "$filter" =~ ^([a-z_]+)(=~|!=|!~|>=|<=|>|<|=|~)(.+)$ ]]; then
        field="${BASH_REMATCH[1]}"
        op="${BASH_REMATCH[2]}"
        value="${BASH_REMATCH[3]}"
    else
        return 1  # Invalid filter format
    fi

    # Get field value
    local field_value
    case "$field" in
        id|tsm_id) field_value="$tsm_id" ;;
        name)      field_value="$name" ;;
        env)       field_value="$env" ;;
        pid)       field_value="$pid" ;;
        port)      field_value="$port" ;;
        type)      field_value="$type" ;;
        uptime|uptime_sec) field_value="$uptime_sec" ;;
        cwd|path)  field_value="$cwd" ;;
        *)         return 1 ;;  # Unknown field
    esac

    # Apply operator
    case "$op" in
        "=")
            [[ "$field_value" == "$value" ]]
            ;;
        "!=")
            [[ "$field_value" != "$value" ]]
            ;;
        "~")
            # Contains/fuzzy match (case insensitive)
            [[ "${field_value,,}" == *"${value,,}"* ]]
            ;;
        "=~")
            # Regex match
            [[ "$field_value" =~ $value ]]
            ;;
        "!~")
            # Regex not match
            [[ ! "$field_value" =~ $value ]]
            ;;
        ">")
            [[ "$field_value" -gt "$value" ]] 2>/dev/null
            ;;
        "<")
            [[ "$field_value" -lt "$value" ]] 2>/dev/null
            ;;
        ">=")
            [[ "$field_value" -ge "$value" ]] 2>/dev/null
            ;;
        "<=")
            [[ "$field_value" -le "$value" ]] 2>/dev/null
            ;;
        *)
            return 1
            ;;
    esac
}

# Apply TQL query to TSM process data
# Usage: echo "$processes" | tql_tsm_query "env=tetra sort:uptime limit:5"
# Input: pipe-delimited process records, one per line
# Output: filtered, sorted, limited records
tql_tsm_query() {
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
            if ! tql_tsm_filter_record "$record" "$filter"; then
                matches=false
                break
            fi
        done

        if [[ "$matches" == "true" ]]; then
            filtered+="$record"$'\n'
        fi
    done <<< "$input"

    # Remove trailing newline
    filtered="${filtered%$'\n'}"

    # Apply sort
    local result="$filtered"
    if [[ -n "$sort_field" && -n "$filtered" ]]; then
        local sort_key="${TQL_TSM_FIELDS[$sort_field]:-1}"
        local sort_opts="-t'|' -k${sort_key},${sort_key}"

        # Numeric sort for certain fields
        case "$sort_field" in
            id|tsm_id|pid|port|uptime|uptime_sec)
                sort_opts+=" -n"
                ;;
        esac

        # Descending
        [[ "$sort_dir" == "desc" ]] && sort_opts+=" -r"

        result=$(echo "$filtered" | eval "sort $sort_opts")
    fi

    # Apply limit/offset
    if [[ -n "$limit" || -n "$offset" ]]; then
        result=$(echo "$result" | tql_apply_limit "$limit" "$offset")
    fi

    echo "$result"
}

# Convert TSM process array to TQL input format
# Usage: tql_tsm_from_array "${processes[@]}"
tql_tsm_from_array() {
    local processes=("$@")
    printf '%s\n' "${processes[@]}"
}

# Get human-readable field value
# Handles display formatting for uptime, port, etc.
tql_tsm_format_field() {
    local field="$1"
    local value="$2"

    case "$field" in
        uptime|uptime_sec)
            tql_format_duration "$value"
            ;;
        port)
            [[ "$value" == "none" || "$value" == "0" ]] && echo "-" || echo "$value"
            ;;
        *)
            echo "$value"
            ;;
    esac
}

# Export functions
export -f tql_tsm_get_column
export -f tql_tsm_filter_record
export -f tql_tsm_query
export -f tql_tsm_from_array
export -f tql_tsm_format_field

# CLI interface
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    case "${1:-}" in
        query)
            # Read from stdin, apply query
            tql_tsm_query "$2"
            ;;
        column)
            tql_tsm_get_column "$2"
            ;;
        filter)
            # Test single record against filter
            tql_tsm_filter_record "$2" "$3"
            echo $?
            ;;
        help|*)
            cat <<EOF
Usage: tsm.sh <command> <args>

Commands:
  query <query>           Apply TQL query to stdin process data
  column <field>          Get column number for field name
  filter <record> <expr>  Test if record matches filter

Fields:
  id, tsm_id    TSM process ID
  name          Process name
  env           Environment display
  pid           System PID
  port          Port number
  type          Protocol type (tcp/udp)
  uptime        Uptime in seconds
  cwd, path     Working directory

Examples:
  tsm list --raw | tsm.sh query "env=tetra sort:uptime limit:5"
  tsm.sh column uptime
  tsm.sh filter "1|myapp|tetra|1234|8080|tcp|3600|1h|/home/app" "env=tetra"
EOF
            ;;
    esac
fi
