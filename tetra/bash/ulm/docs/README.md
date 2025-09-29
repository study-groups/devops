# ULM: Unix Language Model

*Chapter 2 of the TETRA Documentation System*

## Table of Contents
- [2.1 Overview](#21-overview)
- [2.2 Core Concepts](#22-core-concepts)
- [2.3 Attention Mechanism](#23-attention-mechanism)
- [2.4 Multi-Head Architecture](#24-multi-head-architecture)
- [2.5 Learning System](#25-learning-system)
- [2.6 Quick Start](#26-quick-start)
- [2.7 CLI Reference](#27-cli-reference)
- [2.8 Examples](#28-examples)

---

## 2.1 Overview

ULM (Unix Language Model) implements transformer-style attention mechanisms
using pure Unix tools. No neural networks required - just bash, grep, rg,
awk, and the Unix philosophy.

### What ULM Does
- **Ranks code files** by relevance to natural language queries
- **Learns from feedback** through reinforcement learning
- **Adapts attention weights** based on successful patterns
- **Integrates with RAG** for intelligent context generation

### The Transformer Metaphor
```
Traditional ML:    Neural networks, GPU training, complex math
ULM Approach:      Unix tools, shell scripting, simple logic

Query (Q):         What are you looking for?
Key (K):           What can each file tell you?
Value (V):         The actual file content
Attention Score:   grep -c + rg patterns + file metadata
```

## 2.2 Core Concepts

### 2.2.1 Query, Key, Value (Q, K, V)

**Query Processing:**
```bash
# Extract meaningful terms from user query
echo "authentication functions" | \
  grep -oE '\b[a-z_][a-z0-9_]{2,}\b' | \
  grep -vE '^(the|and|or)$'
# Output: authentication, functions
```

**Key Extraction:**
```bash
# What can this file tell us about itself?
rg "function|class|export" auth/login.js
# Output: function validatePassword, class AuthService, export default
```

**Value Retrieval:**
```bash
# If attention score is high, include file content
if [[ $attention_score -gt threshold ]]; then
    cat "$file"  # This is the "Value"
fi
```

### 2.2.2 Attention Scoring

ULM calculates relevance scores using Unix tools:

```bash
attention_score() {
    local query_terms="$1" file="$2"

    # Count query term matches in file
    local matches=0
    while read -r term; do
        matches=$((matches + $(grep -ci "$term" "$file")))
    done <<< "$query_terms"

    # Add file metadata scoring
    local recency_score complexity_score dependency_score
    recency_score=$(get_file_age_score "$file")
    complexity_score=$(count_code_blocks "$file")
    dependency_score=$(count_imports_exports "$file")

    # Weighted combination
    echo $((matches * 40 + recency_score * 20 + complexity_score * 30 + dependency_score * 10))
}
```

### 2.2.3 The ExM vs A Framework

ULM optimizes along two key dimensions:
- **ExM (Exploration × Modification)**: Active learning and change
- **A (Analysis)**: Understanding and comprehension

```
     A (Analysis)
     0   1   2   3   4
   ┌─────────────────────┐
0  │ 0.1 0.2 0.3 0.2 0.1 │  No Action
1  │ 0.2 0.4 0.6 0.4 0.2 │  Light Action    ExM
2  │ 0.3 0.6 1.0 0.6 0.3 │  Balanced       (Exploration
3  │ 0.2 0.4 0.6 0.4 0.2 │  Heavy Action    ×
4  │ 0.1 0.2 0.3 0.2 0.1 │  Reckless       Modification)
   └─────────────────────┘

Optimal Point (2,2): Perfect balance of analysis and action
```

## 2.3 Attention Mechanism

### 2.3.1 Single-Head Attention

Basic attention implementation:

```bash
ulm_attention() {
    local query="$1" file="$2"

    # Step 1: Process query into searchable terms
    local query_terms
    query_terms=$(process_query "$query")

    # Step 2: Extract keys from file
    local file_keys
    file_keys=$(extract_keys "$file")

    # Step 3: Calculate attention score
    local score=0
    while read -r term; do
        if echo "$file_keys" | grep -qi "$term"; then
            ((score++))
        fi
    done <<< "$query_terms"

    echo "$score"
}
```

### 2.3.2 Attention Weights

ULM uses learnable attention weights:

```bash
# Default policy
declare -A ULM_ATTENTION_WEIGHTS=(
    ["functional"]=0.4    # Functions, methods, procedures
    ["structural"]=0.3    # Classes, complexity, architecture
    ["temporal"]=0.2      # File recency and modifications
    ["dependency"]=0.1    # Imports, exports, connections
)
```

These weights adapt based on user feedback and successful patterns.

## 2.4 Multi-Head Architecture

ULM uses four attention heads, each focusing on different aspects of code:

### 2.4.1 Functional Head (Weight: 0.4)
Focuses on executable code elements:
```bash
attention_functional() {
    local query="$1" file="$2"
    local functions classes methods

    functions=$(rg "function|def|fn" "$file" | wc -l)
    classes=$(rg "class|interface" "$file" | wc -l)
    methods=$(rg "^\s*\w+\s*\(" "$file" | wc -l)

    echo $((functions + classes + methods))
}
```

### 2.4.2 Structural Head (Weight: 0.3)
Analyzes code organization and complexity:
```bash
attention_structural() {
    local query="$1" file="$2"
    local complexity imports exports

    complexity=$(rg "^\s*[{}]" "$file" | wc -l)
    imports=$(rg "^import|^require" "$file" | wc -l)
    exports=$(rg "^export|module\.exports" "$file" | wc -l)

    echo $(((complexity / 10) + imports + exports))
}
```

### 2.4.3 Temporal Head (Weight: 0.2)
Considers file recency and modification patterns:
```bash
attention_temporal() {
    local query="$1" file="$2"
    local file_age current_time age_days

    current_time=$(date +%s)
    file_age=$(stat -c %Y "$file" 2>/dev/null || stat -f %m "$file")
    age_days=$(((current_time - file_age) / 86400))

    # Exponential decay: newer files score higher
    if [[ $age_days -le 1 ]]; then echo 90
    elif [[ $age_days -le 7 ]]; then echo 70
    elif [[ $age_days -le 30 ]]; then echo 40
    else echo 10; fi
}
```

### 2.4.4 Dependency Head (Weight: 0.1)
Maps relationships between files:
```bash
attention_dependency() {
    local query="$1" file="$2"
    local import_count export_count

    import_count=$(rg "^[[:space:]]*(import|require)" "$file" | wc -l)
    export_count=$(rg "^[[:space:]]*(export|module\.exports)" "$file" | wc -l)

    echo $(((import_count + export_count) * 12 / 10))
}
```

### 2.4.5 Multi-Head Combination

```bash
multi_head_attention() {
    local query="$1" file="$2"

    local func_score struct_score temp_score dep_score
    func_score=$(attention_functional "$query" "$file")
    struct_score=$(attention_structural "$query" "$file")
    temp_score=$(attention_temporal "$query" "$file")
    dep_score=$(attention_dependency "$query" "$file")

    # Weighted combination using current policy
    local final_score
    final_score=$(awk "BEGIN {
        printf \"%.2f\",
        $func_score * ${ULM_ATTENTION_WEIGHTS[functional]} +
        $struct_score * ${ULM_ATTENTION_WEIGHTS[structural]} +
        $temp_score * ${ULM_ATTENTION_WEIGHTS[temporal]} +
        $dep_score * ${ULM_ATTENTION_WEIGHTS[dependency]}
    }")

    echo "$final_score"
}
```

## 2.5 Learning System

### 2.5.1 Reinforcement Learning Approach

ULM learns through user feedback and successful patterns:

```bash
# After each query → rank → user feedback cycle
learn_from_feedback() {
    local query="$1" ranked_files="$2" user_rating="$3"

    if [[ $user_rating -ge 4 ]]; then
        # Positive feedback: reinforce current weights
        reinforce_policy "$query" "$ranked_files" "$user_rating"
    else
        # Negative feedback: explore alternative weights
        explore_policy_space "$query" "$ranked_files" "$user_rating"
    fi
}
```

### 2.5.2 Policy Gradient Updates

```bash
update_policy_gradient() {
    local reward="$1" baseline="${2:-$ULM_BASELINE_REWARD}"
    local reward_delta
    reward_delta=$(echo "$reward - $baseline" | bc -l)

    # Update weights based on reward signal
    for head in functional structural temporal dependency; do
        local current_weight="${ULM_ATTENTION_WEIGHTS[$head]}"
        local gradient learning_rate=0.1

        if (( $(echo "$reward_delta > 0" | bc -l) )); then
            gradient=$(echo "$learning_rate * $reward_delta" | bc -l)
        else
            gradient=$(echo "$learning_rate * $reward_delta * 0.1" | bc -l)
        fi

        ULM_ATTENTION_WEIGHTS[$head]=$(echo "$current_weight + $gradient" | bc -l)
    done

    normalize_attention_weights
}
```

### 2.5.3 Multi-Armed Bandit Algorithm Selection

ULM can learn which ranking algorithms work best:

```bash
declare -A ALGORITHM_REWARDS=()
declare -A ALGORITHM_COUNTS=()

select_algorithm() {
    local exploration_rate=0.1

    if (( $(echo "($RANDOM % 10000) / 10000 < $exploration_rate" | bc -l) )); then
        # Explore: try random algorithm
        echo "${ALGORITHMS[$((RANDOM % ${#ALGORITHMS[@]}))]}"
    else
        # Exploit: use best performing algorithm
        get_best_algorithm
    fi
}
```

## 2.6 Quick Start

### Installation
ULM is part of the TETRA system. Ensure you have:
- bash 4.0+
- ripgrep (rg)
- standard Unix tools (grep, awk, find, stat)

### Basic Usage

**1. Simple ranking:**
```bash
./ulm.sh rank "authentication functions" ./src --top 5
```

**2. Show current policy:**
```bash
./ulm.sh policy --show
```

**3. Save/load policies:**
```bash
./ulm.sh policy --save my_policy.conf
./ulm.sh policy --load my_policy.conf
```

**4. Learning from feedback:**
```bash
./learning_system.sh learn-feedback "auth query" "file1,file2" 5 true 32000 claude
```

## 2.7 CLI Reference

### ulm.sh Commands

**Ranking:**
- `ulm.sh rank <query> <path> [options]` - Rank files by relevance
  - `--algorithm {multi_head|tfidf|complexity}` - Ranking algorithm
  - `--top N` - Return top N results (default: 20)
  - `--format {text|json}` - Output format

**Policy Management:**
- `ulm.sh policy --show` - Display current attention weights
- `ulm.sh policy --save <file>` - Save current policy
- `ulm.sh policy --load <file>` - Load policy from file

### learning_system.sh Commands

**Learning:**
- `learn-feedback <query> <files> <rating> <used> <context> <agent>` - Record feedback
- `learn-pattern <query> <files> <rating> <context> <agent>` - Learn pattern
- `adapt-weights <query_type>` - Adapt weights for query type
- `recommend <query>` - Get learned recommendations
- `status` - Show learning system status

## 2.8 Examples

### Example 1: Basic File Ranking

```bash
$ ./ulm.sh rank "user authentication" ./src --top 3

24.50 ./src/auth/login.js
22.30 ./src/auth/middleware.js
18.90 ./src/utils/validation.js
```

### Example 2: Learning from Feedback

```bash
# User tries authentication query
$ ./ulm.sh rank "login system" ./src --top 2

21.40 ./src/auth/login.js
19.20 ./src/auth/routes.js

# User rates the results highly
$ ./learning_system.sh learn-feedback "login system" "auth/login.js,auth/routes.js" 5 true 28000 claude-code

Recorded feedback: rating=5, used=true

# Check what was learned
$ ./learning_system.sh status

Learning System Status:
  Pattern samples: 1
  Feedback samples: 1
  Query type averages:
    login          : 5.0 (n=1)
```

### Example 3: Policy Adaptation

```bash
# Show current weights
$ ./ulm.sh policy --show

ULM Policy Configuration:
  Attention Weights:
    functional  : 0.40
    structural  : 0.30
    temporal    : 0.20
    dependency  : 0.10

# After learning from authentication queries
$ ./learning_system.sh adapt-weights "authentication"

Adapting attention weights for query type: authentication
Learned policy saved: authentication_learned.policy
  Functional: 0.65    # Increased - auth queries care about functions
  Structural: 0.20    # Decreased
  Temporal: 0.10      # Decreased
  Dependency: 0.05    # Decreased
```

---

## See Also

- [RAG Integration](../rag/docs/README.md) - How ULM works with RAG
- [TetraBoard Experiments](../tetraboard/docs/README.md) - Running ULM experiments
- [Attention Concepts](./concepts/attention-mechanism.md) - Deep dive on attention
- [Learning Guide](./guides/training.md) - Training ULM policies
- [CLI Reference](./reference/cli-commands.md) - Complete command reference

---

*ULM Documentation - Part of TETRA System*
*For complete system overview, see [TetraBoard Docs](../tetraboard/docs/README.md)*