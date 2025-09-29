#!/usr/bin/env bash
# learning_system.sh - ULM learning and adaptation system
set -euo pipefail

ULM_DIR="${BASH_SOURCE[0]%/*}"
LEARNING_STATE_DIR="${TETRA_DIR:-$HOME/.tetra}/rag/state/learning"

# Initialize learning directories
init_learning_system() {
    mkdir -p "$LEARNING_STATE_DIR"/{patterns,feedback,graphs,policies,optimization}

    # Query pattern storage
    if [[ ! -f "$LEARNING_STATE_DIR/patterns/query_success.json" ]]; then
        echo '{}' > "$LEARNING_STATE_DIR/patterns/query_success.json"
    fi

    # User feedback log
    if [[ ! -f "$LEARNING_STATE_DIR/feedback/ratings.log" ]]; then
        echo "timestamp|query|files|user_rating|used_in_final|context_size|agent" > "$LEARNING_STATE_DIR/feedback/ratings.log"
    fi

    # Context optimization log
    if [[ ! -f "$LEARNING_STATE_DIR/optimization/combinations.log" ]]; then
        echo "timestamp|query_type|file_combination|success_rate|avg_rating|sample_size" > "$LEARNING_STATE_DIR/optimization/combinations.log"
    fi
}

# Learn from successful query→file mappings
learn_query_pattern() {
    local query="$1"
    local files="$2"  # comma-separated
    local success_rating="$3"  # 1-5
    local context_size="$4"
    local agent="$5"

    init_learning_system

    # Update query pattern success rates
    local pattern_file="$LEARNING_STATE_DIR/patterns/query_success.json"
    local temp_file=$(mktemp)

    # Use jq to update the JSON (if available), otherwise use simple append
    if command -v jq >/dev/null 2>&1; then
        jq --arg query "$query" \
           --arg files "$files" \
           --arg rating "$success_rating" \
           '.[$query] = (.[$query] // []) + [{"files": $files, "rating": ($rating | tonumber), "timestamp": now}]' \
           "$pattern_file" > "$temp_file" && mv "$temp_file" "$pattern_file"
    else
        # Fallback: simple logging
        echo "$(date '+%Y-%m-%d %H:%M:%S')|$query|$files|$success_rating|$context_size|$agent" >> "$LEARNING_STATE_DIR/patterns/simple_log.txt"
    fi

    echo "Learned pattern: '$query' → [$files] (rating: $success_rating)"
}

# Learn from user feedback
learn_user_feedback() {
    local query="$1"
    local files="$2"
    local user_rating="$3"  # 1-5 scale
    local used_in_final="$4"  # true/false
    local context_size="$5"
    local agent="$6"

    init_learning_system

    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    echo "$timestamp|$query|$files|$user_rating|$used_in_final|$context_size|$agent" >> \
         "$LEARNING_STATE_DIR/feedback/ratings.log"

    # Update running averages
    update_feedback_averages "$query" "$user_rating"

    echo "Recorded feedback: rating=$user_rating, used=$used_in_final"
}

# Update feedback averages for query types
update_feedback_averages() {
    local query="$1"
    local rating="$2"

    local avg_file="$LEARNING_STATE_DIR/feedback/averages.txt"

    # Extract query type (first word)
    local query_type
    query_type=$(echo "$query" | awk '{print $1}' | tr '[:upper:]' '[:lower:]')

    # Simple running average update
    if [[ -f "$avg_file" ]]; then
        # Update existing average
        local current_avg current_count
        if grep -q "^$query_type|" "$avg_file"; then
            local line
            line=$(grep "^$query_type|" "$avg_file")
            current_avg=$(echo "$line" | cut -d'|' -f2)
            current_count=$(echo "$line" | cut -d'|' -f3)

            local new_count=$((current_count + 1))
            local new_avg
            new_avg=$(echo "scale=2; ($current_avg * $current_count + $rating) / $new_count" | bc -l 2>/dev/null || echo "$rating")

            # Update the line (macOS compatible)
            sed -i '' "s/^$query_type|.*/$query_type|$new_avg|$new_count/" "$avg_file"
        else
            # Add new entry
            echo "$query_type|$rating|1" >> "$avg_file"
        fi
    else
        # Create new file
        echo "$query_type|$rating|1" > "$avg_file"
    fi
}

# Learn optimal file combinations
learn_context_optimization() {
    local query_type="$1"
    local file_combination="$2"  # "file1.js,file2.js"
    local success_rate="$3"      # 0.0-1.0
    local avg_rating="$4"        # 1.0-5.0
    local sample_size="$5"       # number of observations

    init_learning_system

    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    echo "$timestamp|$query_type|$file_combination|$success_rate|$avg_rating|$sample_size" >> \
         "$LEARNING_STATE_DIR/optimization/combinations.log"

    echo "Learned combination: $query_type → [$file_combination] (success: ${success_rate}, rating: ${avg_rating})"
}

# Adapt attention weights based on learned patterns
adapt_attention_weights() {
    local query_type="$1"
    local feedback_data="$2"  # path to feedback data

    init_learning_system

    echo "Adapting attention weights for query type: $query_type"

    # Analyze successful patterns for this query type
    local functional_success=0 structural_success=0 temporal_success=0 dependency_success=0
    local total_samples=0

    # Simple heuristic adaptation based on file types in successful queries
    while IFS='|' read -r timestamp query files rating used context agent; do
        if [[ "$rating" -ge 4 && "$used" == "true" ]]; then
            # Count file types in successful combinations
            if echo "$files" | grep -qi "auth\|login\|password"; then
                ((functional_success++))
            fi
            if echo "$files" | grep -qi "class\|interface\|config"; then
                ((structural_success++))
            fi
            if stat -c %Y "$files" &>/dev/null && [[ $(( ($(date +%s) - $(stat -c %Y "$files")) / 86400 )) -lt 7 ]]; then
                ((temporal_success++))
            fi
            if echo "$files" | grep -qi "import\|export\|require"; then
                ((dependency_success++))
            fi
            ((total_samples++))
        fi
    done < <(grep "|$query_type" "$LEARNING_STATE_DIR/feedback/ratings.log" 2>/dev/null || echo "")

    if [[ $total_samples -gt 5 ]]; then
        # Calculate new weights based on success patterns
        local func_weight struct_weight temp_weight dep_weight
        func_weight=$(echo "scale=2; $functional_success / $total_samples" | bc -l)
        struct_weight=$(echo "scale=2; $structural_success / $total_samples" | bc -l)
        temp_weight=$(echo "scale=2; $temporal_success / $total_samples" | bc -l)
        dep_weight=$(echo "scale=2; $dependency_success / $total_samples" | bc -l)

        # Normalize to sum to 1.0
        local total_weight
        total_weight=$(echo "scale=4; $func_weight + $struct_weight + $temp_weight + $dep_weight" | bc -l)

        if [[ $(echo "$total_weight > 0" | bc -l) == 1 ]]; then
            func_weight=$(echo "scale=4; $func_weight / $total_weight" | bc -l)
            struct_weight=$(echo "scale=4; $struct_weight / $total_weight" | bc -l)
            temp_weight=$(echo "scale=4; $temp_weight / $total_weight" | bc -l)
            dep_weight=$(echo "scale=4; $dep_weight / $total_weight" | bc -l)

            # Save learned policy
            local policy_file="$LEARNING_STATE_DIR/policies/${query_type}_learned.policy"
            {
                echo "# Learned policy for query type: $query_type"
                echo "# Based on $total_samples successful samples"
                echo "# Generated: $(date)"
                echo "ULM_ATTENTION_WEIGHTS[functional]=$func_weight"
                echo "ULM_ATTENTION_WEIGHTS[structural]=$struct_weight"
                echo "ULM_ATTENTION_WEIGHTS[temporal]=$temp_weight"
                echo "ULM_ATTENTION_WEIGHTS[dependency]=$dep_weight"
            } > "$policy_file"

            echo "Learned policy saved: $policy_file"
            echo "  Functional: $func_weight"
            echo "  Structural: $struct_weight"
            echo "  Temporal: $temp_weight"
            echo "  Dependency: $dep_weight"
        fi
    else
        echo "Need more samples (have: $total_samples, need: 6+) to adapt weights"
    fi
}

# Get learned recommendations for a query
get_learned_recommendations() {
    local query="$1"
    local top_n="${2:-5}"

    init_learning_system

    echo "Getting learned recommendations for: '$query'"

    # Check query patterns
    if [[ -f "$LEARNING_STATE_DIR/patterns/simple_log.txt" ]]; then
        echo
        echo "Historical successful patterns:"
        grep -i "$query" "$LEARNING_STATE_DIR/patterns/simple_log.txt" | \
        sort -t'|' -k4 -nr | head -3 | \
        while IFS='|' read -r timestamp q files rating context agent; do
            echo "  $files (rating: $rating, agent: $agent)"
        done
    fi

    # Check if we have a learned policy for this query type
    local query_type
    query_type=$(echo "$query" | awk '{print $1}' | tr '[:upper:]' '[:lower:]')

    local policy_file="$LEARNING_STATE_DIR/policies/${query_type}_learned.policy"
    if [[ -f "$policy_file" ]]; then
        echo
        echo "Found learned policy: $policy_file"
        echo "Attention weights optimized for '$query_type' queries:"
        grep "ULM_ATTENTION_WEIGHTS" "$policy_file" | while IFS='=' read -r param value; do
            local head_name
            head_name=$(echo "$param" | sed 's/.*\[\(.*\)\].*/\1/')
            printf "  %-12s: %s\n" "$head_name" "$value"
        done
    fi

    # Get context optimization recommendations
    if [[ -f "$LEARNING_STATE_DIR/optimization/combinations.log" ]]; then
        echo
        echo "Top file combinations for similar queries:"
        grep "|$query_type|" "$LEARNING_STATE_DIR/optimization/combinations.log" | \
        sort -t'|' -k4 -nr | head -3 | \
        while IFS='|' read -r ts qt combo success_rate avg_rating samples; do
            echo "  $combo (success: ${success_rate}, avg rating: ${avg_rating})"
        done
    fi
}

# CLI interface
case "${1:-}" in
    "init")
        init_learning_system
        echo "Learning system initialized"
        ;;
    "learn-pattern")
        learn_query_pattern "$2" "$3" "$4" "$5" "$6"
        ;;
    "learn-feedback")
        learn_user_feedback "$2" "$3" "$4" "$5" "$6" "$7"
        ;;
    "learn-combo")
        learn_context_optimization "$2" "$3" "$4" "$5" "$6"
        ;;
    "adapt-weights")
        adapt_attention_weights "$2" "${3:-$LEARNING_STATE_DIR/feedback/ratings.log}"
        ;;
    "recommend")
        get_learned_recommendations "$2" "${3:-5}"
        ;;
    "status")
        init_learning_system
        echo "Learning System Status:"
        echo "  Pattern samples: $(wc -l < "$LEARNING_STATE_DIR/patterns/simple_log.txt" 2>/dev/null || echo 0)"
        echo "  Feedback samples: $(tail -n +2 "$LEARNING_STATE_DIR/feedback/ratings.log" 2>/dev/null | wc -l || echo 0)"
        echo "  Learned policies: $(ls "$LEARNING_STATE_DIR/policies/" 2>/dev/null | wc -l || echo 0)"
        if [[ -f "$LEARNING_STATE_DIR/feedback/averages.txt" ]]; then
            echo "  Query type averages:"
            while IFS='|' read -r qtype avg count; do
                printf "    %-15s: %.1f (n=%s)\n" "$qtype" "$avg" "$count"
            done < "$LEARNING_STATE_DIR/feedback/averages.txt"
        fi
        ;;
    *)
        echo "Usage: learning_system.sh {init|learn-pattern|learn-feedback|adapt-weights|recommend|status}"
        echo
        echo "Examples:"
        echo "  learning_system.sh learn-pattern 'auth functions' 'auth/login.js,auth/middleware.js' 5 45000 claude-code"
        echo "  learning_system.sh learn-feedback 'validation utils' 'utils/validate.js' 4 true 12000 openai"
        echo "  learning_system.sh adapt-weights 'auth'"
        echo "  learning_system.sh recommend 'authentication setup'"
        ;;
esac