#!/usr/bin/env bash
# ulm.sh - Unix Language Model for code understanding and ranking
set -euo pipefail

# --- Global Config ---
ULM_DIR="${BASH_SOURCE[0]%/*}"
ULM_MODELS_DIR="$ULM_DIR/models"
ULM_TRAINING_DIR="$ULM_DIR/training"
ULM_LOGS_DIR="$ULM_DIR/logs"
ULM_METRICS_DIR="$ULM_DIR/metrics"

# Current policy defaults
declare -gA ULM_ATTENTION_WEIGHTS=(
    ["functional"]=0.4
    ["structural"]=0.3
    ["temporal"]=0.2
    ["dependency"]=0.1
)
ULM_COMPLEXITY_THRESHOLD=5
ULM_RECENCY_DECAY=0.9
ULM_DEPENDENCY_BOOST=1.2

# Training state
ULM_BASELINE_REWARD=0.5
ULM_LEARNING_RATE=0.1
ULM_EXPLORATION_RATE=0.1

# Don't execute main logic if script is being sourced
[[ "${BASH_SOURCE[0]}" != "${0}" ]] && return 0

usage() {
    cat <<'EOF'
Usage: ulm.sh <command> [OPTIONS]

COMMANDS:
  rank <query> <path>        Rank code spans by relevance to query
  train --episodes N <path>  Train ranking policy using reinforcement learning
  eval --run <name> <path>   Evaluate trained model performance
  policy --show             Show current policy parameters
  policy --load <file>      Load policy from file
  policy --save <file>      Save current policy to file

RANK OPTIONS:
  --algorithm <name>        Ranking algorithm: tfidf, complexity, multi_head
  --top N                   Return top N results (default: 20)
  --format json|text        Output format (default: text)

TRAIN OPTIONS:
  --episodes N              Number of training episodes (default: 100)
  --method bandit|policy    Training method (default: policy)
  --target-reward N         Target reward threshold (default: 0.8)
  --save-checkpoints        Save policy checkpoints during training

EXAMPLES:
  ulm rank "authentication functions" src/
  ulm train --episodes 50 --target-reward 0.85 src/
  ulm eval --run auth-v1 test_queries.txt
  ulm policy --show
EOF
    exit 1
}

# --- Core Functions ---

source_models() {
    for model in "$ULM_MODELS_DIR"/*.sh; do
        [[ -f "$model" ]] && source "$model"
    done
}

log_event() {
    local event="$1" data="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "$timestamp|$event|$data" >> "$ULM_LOGS_DIR/ulm.log"
}

# --- Query, Key, Value Implementation ---

extract_query_features() {
    local query="$1"
    # Q: Parse user intent into search terms
    echo "$query" | tr '[:upper:]' '[:lower:]' | grep -oE '\b[a-z_][a-z0-9_]*\b' | sort -u
}

extract_code_keys() {
    local file="$1"
    # K: Extract what this code can tell us about itself
    {
        # Function names
        rg "function\s+(\w+)|def\s+(\w+)|fn\s+(\w+)" -o --no-filename "$file" || true
        # Class names
        rg "class\s+(\w+)|interface\s+(\w+)" -o --no-filename "$file" || true
        # Exported symbols
        rg "export\s+.*?(\w+)" -o --no-filename "$file" || true
        # Important variables
        rg "const\s+(\w+)|let\s+(\w+)|var\s+(\w+)" -o --no-filename "$file" || true
    } | grep -oE '\b[a-zA-Z_][a-zA-Z0-9_]*\b' | sort -u
}

extract_code_values() {
    local file="$1"
    # V: Return the actual content (with metadata)
    {
        echo "# file: $file"
        echo "# size: $(wc -l < "$file")"
        echo "# modified: $(stat -c %Y "$file" 2>/dev/null || stat -f %m "$file")"
        cat "$file"
    }
}

# --- Multi-Head Attention ---

attention_functional() {
    local query_terms="$1" file="$2"
    local keys score=0
    keys=$(extract_code_keys "$file")

    while read -r term; do
        if echo "$keys" | grep -q "$term"; then
            ((score++))
        fi
    done <<< "$query_terms"

    echo "$score"
}

attention_structural() {
    local query_terms="$1" file="$2"
    local complexity_score
    # AST-based structural complexity
    complexity_score=$(rg "^[[:space:]]*[{}]" "$file" | wc -l)

    # Structural words in query boost score
    if echo "$query_terms" | grep -qE "(class|interface|module|component)"; then
        complexity_score=$((complexity_score * 2))
    fi

    echo "$complexity_score"
}

attention_temporal() {
    local query_terms="$1" file="$2"
    local file_age current_time
    current_time=$(date +%s)
    file_age=$(stat -c %Y "$file" 2>/dev/null || stat -f %m "$file")

    # Recency score with exponential decay
    local age_days=$(( (current_time - file_age) / 86400 ))
    local recency_score

    # Simple exponential decay approximation without bc
    if [[ $age_days -le 1 ]]; then
        recency_score=90
    elif [[ $age_days -le 7 ]]; then
        recency_score=70
    elif [[ $age_days -le 30 ]]; then
        recency_score=40
    elif [[ $age_days -le 90 ]]; then
        recency_score=20
    else
        recency_score=5
    fi

    echo "$recency_score"
}

attention_dependency() {
    local query_terms="$1" file="$2"
    local import_count export_count
    import_count=$(rg "^[[:space:]]*(import|require|include)" "$file" | wc -l)
    export_count=$(rg "^[[:space:]]*(export|module\.exports)" "$file" | wc -l)

    # Simple dependency score without floating point
    echo $(( (import_count + export_count) * 12 / 10 ))
}

# --- Main Commands ---

cmd_rank() {
    local query="$1" path="$2"
    local algorithm="multi_head" top=20 format="text"

    # Parse options
    shift 2
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --algorithm) algorithm="$2"; shift 2 ;;
            --top) top="$2"; shift 2 ;;
            --format) format="$2"; shift 2 ;;
            *) echo "Unknown option: $1" >&2; exit 1 ;;
        esac
    done

    local query_terms
    query_terms=$(extract_query_features "$query")

    log_event "rank_start" "query=$query|algorithm=$algorithm|path=$path"

    # Find all code files
    local files
    mapfile -t files < <(find "$path" -type f -name "*.js" -o -name "*.py" -o -name "*.sh" -o -name "*.ts" -o -name "*.java" | head -100)

    # Score each file
    declare -a scored_files=()

    for file in "${files[@]}"; do
        local score=0

        case "$algorithm" in
            "multi_head")
                local func_score struct_score temp_score dep_score
                func_score=$(attention_functional "$query_terms" "$file")
                struct_score=$(attention_structural "$query_terms" "$file")
                temp_score=$(attention_temporal "$query_terms" "$file")
                dep_score=$(attention_dependency "$query_terms" "$file")

                # Weighted combination (avoid bc for compatibility)
                score=$(awk "BEGIN {printf \"%.2f\", $func_score * ${ULM_ATTENTION_WEIGHTS[functional]} + $struct_score * ${ULM_ATTENTION_WEIGHTS[structural]} + $temp_score * ${ULM_ATTENTION_WEIGHTS[temporal]} + $dep_score * ${ULM_ATTENTION_WEIGHTS[dependency]}}")
                ;;
            "tfidf")
                # Simple TF-IDF approximation
                score=$(grep -c "$query" "$file" 2>/dev/null || echo 0)
                ;;
            "complexity")
                score=$(rg "^[[:space:]]*[{}]" "$file" | wc -l)
                ;;
        esac

        scored_files+=("$score:$file")
    done

    # Sort by score and return top N
    if [[ "$format" == "json" ]]; then
        echo "{"
        echo "  \"query\": \"$query\","
        echo "  \"algorithm\": \"$algorithm\","
        echo "  \"results\": ["
        printf "%s\n" "${scored_files[@]}" | sort -rn | head -"$top" | while IFS=: read -r score file; do
            echo "    {\"score\": $score, \"file\": \"$file\"},"
        done | sed '$ s/,$//'
        echo "  ]"
        echo "}"
    else
        printf "%s\n" "${scored_files[@]}" | sort -rn | head -"$top" | while IFS=: read -r score file; do
            printf "%6.2f %s\n" "$score" "$file"
        done
    fi

    log_event "rank_complete" "results_count=$top"
}

cmd_policy() {
    local action="$1"

    case "$action" in
        "--show")
            echo "ULM Policy Configuration:"
            echo "  Attention Weights:"
            for head in "${!ULM_ATTENTION_WEIGHTS[@]}"; do
                printf "    %-12s: %.2f\n" "$head" "${ULM_ATTENTION_WEIGHTS[$head]}"
            done
            echo "  Complexity Threshold: $ULM_COMPLEXITY_THRESHOLD"
            echo "  Recency Decay: $ULM_RECENCY_DECAY"
            echo "  Dependency Boost: $ULM_DEPENDENCY_BOOST"
            ;;
        "--save")
            local file="$2"
            {
                echo "# ULM Policy Configuration"
                echo "# Generated: $(date)"
                for head in "${!ULM_ATTENTION_WEIGHTS[@]}"; do
                    echo "ULM_ATTENTION_WEIGHTS[$head]=${ULM_ATTENTION_WEIGHTS[$head]}"
                done
                echo "ULM_COMPLEXITY_THRESHOLD=$ULM_COMPLEXITY_THRESHOLD"
                echo "ULM_RECENCY_DECAY=$ULM_RECENCY_DECAY"
                echo "ULM_DEPENDENCY_BOOST=$ULM_DEPENDENCY_BOOST"
            } > "$file"
            echo "Policy saved to $file"
            ;;
        "--load")
            local file="$2"
            if [[ -f "$file" ]]; then
                source "$file"
                echo "Policy loaded from $file"
            else
                echo "Policy file not found: $file" >&2
                exit 1
            fi
            ;;
    esac
}

# --- Parse Commands ---

[[ $# -eq 0 ]] && usage

case "$1" in
    "rank")
        shift
        [[ $# -lt 2 ]] && { echo "Usage: ulm rank <query> <path>" >&2; exit 1; }
        cmd_rank "$@"
        ;;
    "policy")
        shift
        [[ $# -lt 1 ]] && { echo "Usage: ulm policy --show|--save|--load" >&2; exit 1; }
        cmd_policy "$@"
        ;;
    "train"|"eval")
        echo "Training and evaluation coming in next iteration!" >&2
        exit 1
        ;;
    "-h"|"--help"|"help")
        usage
        ;;
    *)
        echo "Unknown command: $1" >&2
        usage
        ;;
esac