#!/usr/bin/env bash
# attention.sh - Advanced attention mechanisms for ULM
# Implements Query, Key, Value attention using Unix tools

# --- Query Processing ---

process_query() {
    local query="$1"
    local output_format="${2:-terms}"

    case "$output_format" in
        "terms")
            # Extract meaningful terms from natural language query
            echo "$query" | \
                tr '[:upper:]' '[:lower:]' | \
                sed 's/[^a-zA-Z0-9 ]/ /g' | \
                grep -oE '\b[a-z_][a-z0-9_]{2,}\b' | \
                grep -vE '^(the|and|or|in|on|at|to|for|of|with|by)$' | \
                sort -u
            ;;
        "patterns")
            # Convert query to regex patterns
            echo "$query" | \
                tr '[:upper:]' '[:lower:]' | \
                sed 's/ /.*|.*/g' | \
                sed 's/^/.*/' | \
                sed 's/$/.*/''
            ;;
        "semantic")
            # Extract semantic intent (function, class, variable, etc.)
            local intent=""
            if echo "$query" | grep -qE "(function|method|procedure)"; then
                intent="function"
            elif echo "$query" | grep -qE "(class|object|type)"; then
                intent="class"
            elif echo "$query" | grep -qE "(variable|field|property)"; then
                intent="variable"
            elif echo "$query" | grep -qE "(import|require|dependency)"; then
                intent="import"
            else
                intent="general"
            fi
            echo "$intent"
            ;;
    esac
}

# --- Key Extraction ---

extract_keys_comprehensive() {
    local file="$1"
    local key_type="${2:-all}"

    case "$key_type" in
        "functions")
            {
                # JavaScript/TypeScript functions
                rg "^\s*function\s+(\w+)" -o --no-filename "$file" | cut -d' ' -f2
                rg "^\s*(\w+)\s*:\s*function" -o --no-filename "$file" | cut -d':' -f1
                rg "^\s*(\w+)\s*=\s*\\(" -o --no-filename "$file" | cut -d'=' -f1 | tr -d ' '
                # Python functions
                rg "^\s*def\s+(\w+)" -o --no-filename "$file" | cut -d' ' -f2
                # Shell functions
                rg "^\s*(\w+)\s*\\(\\s*\\)" -o --no-filename "$file" | cut -d'(' -f1 | tr -d ' '
            } 2>/dev/null | grep -v '^$' | sort -u
            ;;
        "classes")
            {
                # JavaScript/TypeScript classes
                rg "^\s*class\s+(\w+)" -o --no-filename "$file" | cut -d' ' -f2
                rg "^\s*interface\s+(\w+)" -o --no-filename "$file" | cut -d' ' -f2
                # Python classes
                rg "^\s*class\s+(\w+)" -o --no-filename "$file" | cut -d' ' -f2
            } 2>/dev/null | grep -v '^$' | sort -u
            ;;
        "variables")
            {
                # JavaScript/TypeScript variables
                rg "^\s*(const|let|var)\s+(\w+)" -o --no-filename "$file" | cut -d' ' -f2
                # Python variables
                rg "^\s*(\w+)\s*=" -o --no-filename "$file" | cut -d'=' -f1 | tr -d ' '
                # Shell variables
                rg "^\s*(\w+)=" -o --no-filename "$file" | cut -d'=' -f1
            } 2>/dev/null | grep -v '^$' | sort -u
            ;;
        "imports")
            {
                # JavaScript/TypeScript imports
                rg "^import.*from ['\"]([^'\"]+)['\"]" -o --no-filename "$file" | sed "s/.*from ['\"]//;s/['\"].*//"
                rg "^const.*require\\(['\"]([^'\"]+)['\"]\\)" -o --no-filename "$file" | sed "s/.*require(['\"]//;s/['\"]).*//"
                # Python imports
                rg "^from\s+(\w+)" -o --no-filename "$file" | cut -d' ' -f2
                rg "^import\s+(\w+)" -o --no-filename "$file" | cut -d' ' -f2
            } 2>/dev/null | grep -v '^$' | sort -u
            ;;
        "all")
            {
                extract_keys_comprehensive "$file" "functions"
                extract_keys_comprehensive "$file" "classes"
                extract_keys_comprehensive "$file" "variables"
                extract_keys_comprehensive "$file" "imports"
            } | sort -u
            ;;
    esac
}

# --- Advanced Attention Scoring ---

attention_score_tfidf() {
    local query_terms="$1"
    local file="$2"
    local total_files="${3:-100}"  # Corpus size estimate

    local tf=0 df=0 score=0

    # Term Frequency in this file
    while read -r term; do
        local term_count
        term_count=$(grep -oi "$term" "$file" | wc -l)
        tf=$((tf + term_count))
    done <<< "$query_terms"

    # Document Frequency (simplified - how common these terms are)
    local rare_terms=0
    while read -r term; do
        # Heuristic: shorter, more specific terms are rarer
        local term_len=${#term}
        if [[ $term_len -gt 6 ]]; then
            ((rare_terms++))
        fi
    done <<< "$query_terms"

    # TF-IDF approximation
    if [[ $tf -gt 0 && $rare_terms -gt 0 ]]; then
        score=$(echo "scale=4; $tf * l($total_files / ($rare_terms + 1))" | bc -l)
    fi

    echo "$score"
}

attention_score_semantic() {
    local query="$1"
    local file="$2"

    local query_intent
    query_intent=$(process_query "$query" "semantic")

    local file_keys score=0

    case "$query_intent" in
        "function")
            file_keys=$(extract_keys_comprehensive "$file" "functions")
            score=$(echo "$file_keys" | wc -w)
            ;;
        "class")
            file_keys=$(extract_keys_comprehensive "$file" "classes")
            score=$(echo "$file_keys" | wc -w)
            ;;
        "variable")
            file_keys=$(extract_keys_comprehensive "$file" "variables")
            score=$(echo "$file_keys" | wc -w)
            ;;
        "import")
            file_keys=$(extract_keys_comprehensive "$file" "imports")
            score=$(echo "$file_keys" | wc -w)
            ;;
        *)
            file_keys=$(extract_keys_comprehensive "$file" "all")
            score=$(echo "$file_keys" | wc -w)
            ;;
    esac

    # Boost score if query terms match extracted keys
    local query_terms
    query_terms=$(process_query "$query" "terms")
    local matching_keys=0

    while read -r term; do
        if echo "$file_keys" | grep -qi "$term"; then
            ((matching_keys++))
        fi
    done <<< "$query_terms"

    # Final score combines key count with query relevance
    echo $(( score * 2 + matching_keys * 10 ))
}

# --- Value Extraction with Context ---

extract_value_with_context() {
    local file="$1"
    local query="$2"
    local context_lines="${3:-5}"

    # Extract relevant sections with surrounding context
    local query_terms
    query_terms=$(process_query "$query" "terms")

    {
        echo "=== FILE: $file ==="
        echo "=== SIZE: $(wc -l < "$file") lines ==="
        echo "=== MODIFIED: $(stat -c %Y "$file" 2>/dev/null || stat -f %m "$file") ==="
        echo

        # Find lines matching query terms with context
        while read -r term; do
            if grep -qi "$term" "$file"; then
                echo "--- Matches for '$term' ---"
                grep -n -i -C "$context_lines" "$term" "$file" | head -20
                echo
            fi
        done <<< "$query_terms"

        # If no specific matches, show file structure
        if ! echo "$query_terms" | while read -r term; do grep -qi "$term" "$file" && break; done; then
            echo "--- File Structure ---"
            extract_keys_comprehensive "$file" "all" | head -10
            echo
            head -20 "$file"
        fi
    }
}

# --- Multi-Head Attention Coordinator ---

multi_head_attention() {
    local query="$1"
    local file="$2"
    local weights="$3"  # "0.4,0.3,0.2,0.1" format

    # Parse weights
    IFS=',' read -ra weight_array <<< "$weights"
    local func_weight="${weight_array[0]:-0.4}"
    local struct_weight="${weight_array[1]:-0.3}"
    local temp_weight="${weight_array[2]:-0.2}"
    local dep_weight="${weight_array[3]:-0.1}"

    # Calculate individual head scores
    local func_score struct_score temp_score dep_score

    # Functional head - matching functions/methods
    local query_functions
    query_functions=$(extract_keys_comprehensive "$file" "functions")
    func_score=$(echo "$query" | grep -oi "function\|method" | wc -l)
    func_score=$((func_score + $(echo "$query_functions" | grep -c "." || echo 0)))

    # Structural head - classes, interfaces, complexity
    struct_score=$(extract_keys_comprehensive "$file" "classes" | wc -w)
    struct_score=$((struct_score + $(rg "^\s*[{}]" "$file" | wc -l) / 10))

    # Temporal head - file recency
    local file_age current_time
    current_time=$(date +%s)
    file_age=$(stat -c %Y "$file" 2>/dev/null || stat -f %m "$file")
    local days_old=$(( (current_time - file_age) / 86400 ))
    temp_score=$(echo "scale=0; 100 * e(-$days_old / 30)" | bc -l)  # 30-day half-life

    # Dependency head - imports/exports
    dep_score=$(extract_keys_comprehensive "$file" "imports" | wc -w)
    dep_score=$((dep_score + $(rg "^export\|module\.exports" "$file" | wc -l)))

    # Weighted combination
    local final_score
    final_score=$(echo "scale=2; $func_score * $func_weight + $struct_score * $struct_weight + $temp_score * $temp_weight + $dep_score * $dep_weight" | bc)

    echo "$final_score"
}