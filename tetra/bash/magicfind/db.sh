#!/usr/bin/env bash
# magicfind database functions
# Storage: $MAGICFIND_DIR/db/{timestamp}.{type}
# Types: query, cmd, result, meta, vars

# Default similarity threshold (0-100)
MAGICFIND_SIMILARITY_THRESHOLD="${MAGICFIND_SIMILARITY_THRESHOLD:-70}"

# Save a new record, returns timestamp ID
_magicfind_db_new() {
    local query="$1"
    local ts=$(date +%s)
    echo "$query" > "$MAGICFIND_DIR/db/$ts.query"
    echo "$ts"
}

# Save command for a record
_magicfind_db_save_cmd() {
    local ts="$1"
    local cmd="$2"
    echo "$cmd" > "$MAGICFIND_DIR/db/$ts.cmd"
}

# Save result for a record
_magicfind_db_save_result() {
    local ts="$1"
    local exit_code="$2"
    local output="$3"
    {
        echo "exit=$exit_code"
        echo "time=$(date '+%Y-%m-%d %H:%M:%S')"
        echo "---"
        echo "$output" | head -50
    } > "$MAGICFIND_DIR/db/$ts.result"
}

# Save metadata (prev link, status, etc.)
_magicfind_db_save_meta() {
    local ts="$1"
    shift
    # Accept key=value pairs
    printf '%s\n' "$@" > "$MAGICFIND_DIR/db/$ts.meta"
}

# Add to existing meta
_magicfind_db_append_meta() {
    local ts="$1"
    shift
    printf '%s\n' "$@" >> "$MAGICFIND_DIR/db/$ts.meta"
}

# Get meta value
_magicfind_db_get_meta() {
    local ts="$1"
    local key="$2"
    local file="$MAGICFIND_DIR/db/$ts.meta"
    [[ -f "$file" ]] && grep "^$key=" "$file" | cut -d= -f2-
}

# Get a field by timestamp
_magicfind_db_get() {
    local ts="$1"
    local type="${2:-query}"
    local file="$MAGICFIND_DIR/db/$ts.$type"
    [[ -f "$file" ]] && cat "$file"
}

# Check if record exists
_magicfind_db_exists() {
    local ts="$1"
    [[ -f "$MAGICFIND_DIR/db/$ts.query" ]]
}

# Tokenize a query (lowercase, split on non-alphanumeric, unique sorted)
_magicfind_tokenize() {
    local query="${1,,}"  # lowercase
    echo "$query" | tr -cs 'a-z0-9' '\n' | grep -E '^.{2,}$' | sort -u | tr '\n' ' '
}

# Calculate Jaccard similarity between two token strings
# Returns similarity as percentage (0-100)
_magicfind_similarity() {
    local tokens1="$1"
    local tokens2="$2"

    local -a arr1 arr2
    read -ra arr1 <<< "$tokens1"
    read -ra arr2 <<< "$tokens2"

    [[ ${#arr1[@]} -eq 0 || ${#arr2[@]} -eq 0 ]] && { echo 0; return; }

    local -A set1 set2 union_set
    local t

    for t in "${arr1[@]}"; do
        set1[$t]=1
        union_set[$t]=1
    done
    for t in "${arr2[@]}"; do
        set2[$t]=1
        union_set[$t]=1
    done

    local intersection=0
    for t in "${!set1[@]}"; do
        [[ -v "set2[$t]" ]] && ((intersection++))
    done

    local union=${#union_set[@]}
    ((union > 0)) && echo $((intersection * 100 / union)) || echo 0
}

# Find similar query using Jaccard similarity
# Returns timestamp of best match above threshold
_magicfind_db_find_similar() {
    local query="$1"
    local threshold="${2:-$MAGICFIND_SIMILARITY_THRESHOLD}"
    local query_tokens=$(_magicfind_tokenize "$query")

    local best_ts=""
    local best_score=0

    for f in "$MAGICFIND_DIR/db"/*.query; do
        [[ -f "$f" ]] || continue

        local ts="${f##*/}"
        ts="${ts%.query}"

        # Only consider successful queries
        local status=$(_magicfind_db_get_meta "$ts" "status")
        [[ "$status" != "success" ]] && continue

        local stored=$(<"$f")
        local stored_tokens=$(_magicfind_tokenize "$stored")
        local score=$(_magicfind_similarity "$query_tokens" "$stored_tokens")

        if ((score > best_score)); then
            best_score=$score
            best_ts="$ts"
        fi
    done

    if ((best_score >= threshold)); then
        echo "$best_ts"
        return 0
    fi

    return 1
}

# Find template match with variable extraction
# Query: "find all .sh files" matches template "find all {{ext}} files"
_magicfind_db_find_template() {
    local query="$1"
    local normalized=$(echo "$query" | tr '[:upper:]' '[:lower:]')

    for f in "$MAGICFIND_DIR/db"/*.query; do
        [[ -f "$f" ]] || continue
        local stored=$(<"$f")

        # Check if stored query has {{var}} patterns
        if [[ "$stored" =~ \{\{([a-zA-Z_]+)\}\} ]]; then
            # Convert template to regex: {{ext}} -> (.+)
            local pattern=$(echo "$stored" | sed 's/{{[a-zA-Z_]*}}/(.+)/g' | tr '[:upper:]' '[:lower:]')

            if [[ "$normalized" =~ $pattern ]]; then
                local ts="${f##*/}"
                ts="${ts%.query}"
                local status=$(_magicfind_db_get_meta "$ts" "status")
                if [[ "$status" == "success" ]]; then
                    # Extract variable values
                    echo "$ts"
                    # TODO: return extracted vars
                    return 0
                fi
            fi
        fi
    done
    return 1
}

# List recent records
_magicfind_db_list() {
    local limit="${1:-20}"

    ls -1 "$MAGICFIND_DIR/db"/*.query 2>/dev/null |
    while read -r f; do
        local ts="${f##*/}"
        ts="${ts%.query}"
        echo "$ts"
    done | sort -rn | head -n "$limit" |
    while read -r ts; do
        local query=$(<"$MAGICFIND_DIR/db/$ts.query")
        local status=$(_magicfind_db_get_meta "$ts" "status")
        local time=$(date -r "$ts" '+%m-%d %H:%M' 2>/dev/null || echo "???")

        local indicator="○"
        [[ "$status" == "success" ]] && indicator="●"
        [[ "$status" == "fail" ]] && indicator="✗"

        printf "%s %s %s  %s\n" "$indicator" "$ts" "$time" "${query:0:50}"
    done
}

# Show record details
_magicfind_db_show() {
    local ts="$1"

    if [[ ! -f "$MAGICFIND_DIR/db/$ts.query" ]]; then
        echo "Not found: $ts" >&2
        return 1
    fi

    echo "=== Query ($ts) ==="
    cat "$MAGICFIND_DIR/db/$ts.query"
    echo ""

    if [[ -f "$MAGICFIND_DIR/db/$ts.cmd" ]]; then
        echo "=== Command ==="
        cat "$MAGICFIND_DIR/db/$ts.cmd"
        echo ""
    fi

    if [[ -f "$MAGICFIND_DIR/db/$ts.meta" ]]; then
        echo "=== Meta ==="
        cat "$MAGICFIND_DIR/db/$ts.meta"
        echo ""
    fi

    if [[ -f "$MAGICFIND_DIR/db/$ts.result" ]]; then
        echo "=== Result ==="
        cat "$MAGICFIND_DIR/db/$ts.result"
    fi
}

# Replay a command
_magicfind_db_replay() {
    local ts="$1"
    shift
    local vars=("$@")  # var=value pairs for substitution

    local cmd=$(_magicfind_db_get "$ts" "cmd")
    if [[ -z "$cmd" ]]; then
        echo "No command found: $ts" >&2
        return 1
    fi

    # Apply variable substitutions
    for var in "${vars[@]}"; do
        local name="${var%%=*}"
        local value="${var#*=}"
        cmd="${cmd//\{\{$name\}\}/$value}"
    done

    echo "$ $cmd" >&2
    bash -c "$cmd"
}

# Search queries (grep pattern)
_magicfind_db_search() {
    local pattern="$1"
    grep -l "$pattern" "$MAGICFIND_DIR/db"/*.query 2>/dev/null |
    while read -r f; do
        local ts="${f##*/}"
        ts="${ts%.query}"
        local query=$(<"$f")
        printf "%s  %s\n" "$ts" "${query:0:60}"
    done
}

# Search by similarity (ranked)
_magicfind_db_similar() {
    local query="$1"
    local min_score="${2:-30}"
    local query_tokens=$(_magicfind_tokenize "$query")

    local -a results

    for f in "$MAGICFIND_DIR/db"/*.query; do
        [[ -f "$f" ]] || continue

        local ts="${f##*/}"
        ts="${ts%.query}"

        local stored=$(<"$f")
        local stored_tokens=$(_magicfind_tokenize "$stored")
        local score=$(_magicfind_similarity "$query_tokens" "$stored_tokens")

        ((score >= min_score)) && results+=("$score:$ts:$stored")
    done

    # Sort by score descending
    printf '%s\n' "${results[@]}" | sort -t: -k1 -rn |
    while IFS=: read -r score ts query; do
        local status=$(_magicfind_db_get_meta "$ts" "status")
        local indicator="○"
        [[ "$status" == "success" ]] && indicator="●"
        [[ "$status" == "fail" ]] && indicator="✗"
        printf "%3d%% %s %s  %s\n" "$score" "$indicator" "$ts" "${query:0:50}"
    done
}

# Stats
_magicfind_db_stats() {
    local total=$(ls "$MAGICFIND_DIR/db"/*.query 2>/dev/null | wc -l | tr -d ' ')
    local success=$(grep -l "status=success" "$MAGICFIND_DIR/db"/*.meta 2>/dev/null | wc -l | tr -d ' ')
    local cached=$(grep -l "cached=true" "$MAGICFIND_DIR/db"/*.meta 2>/dev/null | wc -l | tr -d ' ')

    echo "Records: $total"
    echo "Success: $success"
    echo "Cached:  $cached"
    echo "Path:    $MAGICFIND_DIR/db"
}

# Clean old entries
_magicfind_db_clean() {
    local days="${1:-30}"
    local cutoff=$(($(date +%s) - days * 86400))
    local count=0

    for f in "$MAGICFIND_DIR/db"/*.query; do
        [[ -f "$f" ]] || continue
        local ts="${f##*/}"
        ts="${ts%.query}"

        if [[ "$ts" -lt "$cutoff" ]]; then
            rm -f "$MAGICFIND_DIR/db/$ts".*
            ((count++))
        fi
    done

    echo "Cleaned $count records older than $days days"
}
