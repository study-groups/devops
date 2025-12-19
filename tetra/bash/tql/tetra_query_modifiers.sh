#!/usr/bin/env bash
# tetra_query_modifiers.sh - Sort, Limit, and Select Modifiers for TQL
# Extends TQL with post-filter operations

# Parse a query string containing modifiers
# Returns structured output with filters and modifiers separated
# Usage: tql_parse_modifiers "env=tetra sort:uptime limit:10"
tql_parse_modifiers() {
    local query="$1"
    local filters=()
    local sort_field=""
    local sort_dir="asc"
    local limit=""
    local offset=""
    local select_fields=()

    # Split by whitespace (respecting quotes)
    local parts=()
    local current=""
    local in_quotes=0

    for ((i=0; i<${#query}; i++)); do
        local char="${query:$i:1}"

        if [[ $char == '"' || $char == "'" ]]; then
            in_quotes=$((1 - in_quotes))
            current+="$char"
        elif [[ $char == ' ' && $in_quotes -eq 0 ]]; then
            [[ -n "$current" ]] && parts+=("$current")
            current=""
        else
            current+="$char"
        fi
    done
    [[ -n "$current" ]] && parts+=("$current")

    # Classify each part
    for part in "${parts[@]}"; do
        case "$part" in
            sort:*|order:*)
                # sort:field or sort:field:desc
                local sort_spec="${part#*:}"
                if [[ "$sort_spec" =~ ^([^:]+):(.+)$ ]]; then
                    sort_field="${BASH_REMATCH[1]}"
                    sort_dir="${BASH_REMATCH[2]}"
                else
                    sort_field="$sort_spec"
                    sort_dir="asc"
                fi
                ;;

            limit:*)
                limit="${part#limit:}"
                ;;

            head:*)
                limit="${part#head:}"
                ;;

            tail:*)
                # Negative limit for tail
                limit="-${part#tail:}"
                ;;

            first)
                limit="1"
                ;;

            last)
                limit="-1"
                ;;

            offset:*|skip:*)
                offset="${part#*:}"
                ;;

            select:*)
                # select:field1,field2
                IFS=',' read -ra select_fields <<< "${part#select:}"
                ;;

            hide:*)
                # Stored as negative select (handled by exec)
                select_fields=("-${part#hide:}")
                ;;

            last:*|since:*|before:*|after:*|older:*|newer:*|between:*)
                # Temporal modifiers - pass to temporal parser
                filters+=("temporal:$part")
                ;;

            *)
                # Regular filter expression
                filters+=("$part")
                ;;
        esac
    done

    # Output structured result
    echo "filters=${filters[*]}"
    echo "sort_field=$sort_field"
    echo "sort_dir=$sort_dir"
    echo "limit=$limit"
    echo "offset=$offset"
    echo "select=${select_fields[*]}"
}

# Parse sort expression
# Usage: tql_parse_sort "uptime:desc" → "uptime|desc"
#        tql_parse_sort "name" → "name|asc"
tql_parse_sort() {
    local expr="$1"

    if [[ "$expr" =~ ^([^:]+):(.+)$ ]]; then
        echo "${BASH_REMATCH[1]}|${BASH_REMATCH[2]}"
    else
        echo "$expr|asc"
    fi
}

# Generate sort command arguments from field and direction
# Usage: tql_sort_args "uptime" "desc" 5 → "-k5,5 -n -r"
tql_sort_args() {
    local field="$1"
    local dir="$2"
    local key_num="$3"
    local delimiter="${4:-|}"

    local args="-t'$delimiter' -k${key_num},${key_num}"

    # Numeric fields
    case "$field" in
        id|port|uptime|size|ts|timestamp|pid)
            args+=" -n"
            ;;
    esac

    # Descending
    if [[ "$dir" == "desc" || "$dir" == "d" || "$dir" == "DESC" ]]; then
        args+=" -r"
    fi

    echo "$args"
}

# Apply limit to data stream
# Usage: echo "$data" | tql_apply_limit 10
#        echo "$data" | tql_apply_limit -5  (last 5)
tql_apply_limit() {
    local limit="$1"
    local offset="${2:-0}"

    if [[ -z "$limit" || "$limit" == "0" ]]; then
        cat
        return
    fi

    if [[ "$limit" =~ ^- ]]; then
        # Negative = tail
        local n="${limit#-}"
        if [[ "$offset" -gt 0 ]]; then
            head -n "-$offset" | tail -n "$n"
        else
            tail -n "$n"
        fi
    else
        # Positive = head
        if [[ "$offset" -gt 0 ]]; then
            tail -n "+$((offset + 1))" | head -n "$limit"
        else
            head -n "$limit"
        fi
    fi
}

# Compile modifiers to executable form
# Returns shell code that can be applied to piped data
tql_compile_modifiers() {
    local sort_field="$1"
    local sort_dir="$2"
    local limit="$3"
    local offset="$4"
    local key_map="$5"  # Field→column mappings as "field:col,field:col"

    local pipeline=""

    # Build sort if specified
    if [[ -n "$sort_field" ]]; then
        local sort_key=""

        # Parse key map to find column number
        IFS=',' read -ra mappings <<< "$key_map"
        for mapping in "${mappings[@]}"; do
            IFS=':' read -r field col <<< "$mapping"
            if [[ "$field" == "$sort_field" ]]; then
                sort_key="$col"
                break
            fi
        done

        if [[ -n "$sort_key" ]]; then
            local sort_opts=""
            case "$sort_field" in
                id|port|uptime|size|ts|timestamp|pid)
                    sort_opts="-n"
                    ;;
            esac
            [[ "$sort_dir" == "desc" ]] && sort_opts+=" -r"

            pipeline+="sort -t'|' -k${sort_key},${sort_key} $sort_opts"
        fi
    fi

    # Add limit
    if [[ -n "$limit" && "$limit" != "0" ]]; then
        [[ -n "$pipeline" ]] && pipeline+=" | "

        if [[ "$limit" =~ ^- ]]; then
            local n="${limit#-}"
            if [[ "$offset" -gt 0 ]]; then
                pipeline+="head -n \"-$offset\" | tail -n $n"
            else
                pipeline+="tail -n $n"
            fi
        else
            if [[ "$offset" -gt 0 ]]; then
                pipeline+="tail -n +$((offset + 1)) | head -n $limit"
            else
                pipeline+="head -n $limit"
            fi
        fi
    elif [[ "$offset" -gt 0 ]]; then
        [[ -n "$pipeline" ]] && pipeline+=" | "
        pipeline+="tail -n +$((offset + 1))"
    fi

    echo "$pipeline"
}

# Export functions
export -f tql_parse_modifiers
export -f tql_parse_sort
export -f tql_sort_args
export -f tql_apply_limit
export -f tql_compile_modifiers

# CLI interface
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    case "${1:-}" in
        parse)
            tql_parse_modifiers "$2"
            ;;
        sort)
            tql_parse_sort "$2"
            ;;
        compile)
            tql_compile_modifiers "$2" "${3:-asc}" "$4" "$5" "$6"
            ;;
        help|*)
            cat <<EOF
Usage: tetra_query_modifiers.sh <command> <args>

Commands:
  parse <query>         Parse query string into filters and modifiers
  sort <expr>           Parse sort expression
  compile <field> <dir> <limit> <offset> <key_map>
                        Compile modifiers to shell pipeline

Query Syntax:
  Filters (passed to TQL filter compiler):
    env=tetra           Exact match
    name~midi           Contains/fuzzy
    port>8000           Numeric comparison
    type!=udp           Not equal

  Sort:
    sort:field          Sort ascending by field
    sort:field:desc     Sort descending
    order:field         Alias for sort

  Limit:
    limit:10            First 10 items
    head:5              First 5 items
    tail:3              Last 3 items
    first               First item only
    last                Last item only
    offset:5            Skip first 5

  Select (projection):
    select:name,port    Only show these fields
    hide:pid            Show all except pid

  Temporal (integrated with tetra_temporal.sh):
    last:7d             Items from last 7 days
    since:monday        Items since Monday
    before:2025-01      Items before January 2025
    older:1h            Items older than 1 hour

Examples:
  tetra_query_modifiers.sh parse "env=tetra sort:uptime limit:10"
  tetra_query_modifiers.sh parse "last:7d sort:size:desc head:5"
EOF
            ;;
    esac
fi
