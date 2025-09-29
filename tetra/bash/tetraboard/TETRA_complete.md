# TETRA: Complete System Documentation

*Generated: 2025-09-24 20:52:26*

This document contains the complete TETRA system documentation,
combining all module documentation into a single, terminal-friendly guide.

---

# TETRA: Transformer-Enhanced Terminal Research Architecture

*Master Documentation - Complete System Overview*

## Table of Contents
- [1. System Overview](#1-system-overview)
- [2. ULM: Unix Language Model](#2-ulm-unix-language-model)
- [3. RAG: Retrieval Augmented Generation](#3-rag-retrieval-augmented-generation)
- [4. TetraBoard: Monitoring & Experiments](#4-tetraboard-monitoring--experiments)
- [5. Core Concepts](#5-core-concepts)
- [6. Integration Architecture](#6-integration-architecture)
- [7. Experimental Framework](#7-experimental-framework)
- [8. Getting Started](#8-getting-started)
- [9. Advanced Usage](#9-advanced-usage)
- [10. Reference](#10-reference)

---

## 1. System Overview

TETRA implements transformer-style attention mechanisms using pure Unix tools,
creating an intelligent code understanding and generation pipeline that learns
and adapts without neural networks.

### 1.1 What is TETRA?

TETRA is a **Unix-native machine learning system** that:
- **Understands code** using transformer attention metaphors
- **Ranks files** by relevance to natural language queries
- **Generates context** optimized for different AI models
- **Learns from feedback** through reinforcement learning
- **Tracks performance** and experimental results

### 1.2 The Unix Philosophy Applied to ML

```
Traditional ML:    Neural networks, GPUs, complex training
TETRA Approach:    Shell scripts, Unix tools, simple logic

Traditional:       Embeddings, vectors, similarity search
TETRA:             grep, rg, awk patterns, file metadata

Traditional:       Backpropagation, gradient descent
TETRA:             Policy gradients, multi-armed bandits, user feedback
```

### 1.3 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      TETRA SYSTEM                           │
├─────────────────┬─────────────────┬─────────────────────────┤
│      ULM        │      RAG        │     TetraBoard          │
│ (Understanding) │ (Generation)    │ (Monitoring)            │
│                 │                 │                         │
│ • Attention     │ • MULTICAT      │ • Experiments           │
│ • Multi-Head    │ • Agents        │ • Dashboards            │
│ • Learning      │ • Context Opt   │ • Documentation         │
│ • Policy Mgmt   │ • ULM Integration│ • Cross-Module         │
└─────────────────┴─────────────────┴─────────────────────────┘
```

### 1.4 Key Innovations

**1. Unix Tools as Neural Network Layers:**
- grep/rg = pattern matching layers
- awk/sed = transformation layers
- wc/stat = feature extraction layers
- sort = attention ranking layers

**2. Transformer Attention Without Matrices:**
- Query (Q) = user's search terms
- Key (K) = file metadata and contents
- Value (V) = actual file content
- Attention = Unix tool similarity scoring

**3. Learning Without Backprop:**
- Policy gradients using user feedback
- Multi-armed bandit algorithm selection
- Reinforcement learning with Unix rewards

**4. Terminal-Native ML:**
- All tools designed for command-line use
- Human-readable intermediate outputs
- Standard Unix pipeline integration

## 2. ULM: Unix Language Model

*For complete ULM documentation, see [ULM README](../ulm/docs/README.md)*

### 2.1 Overview

ULM implements transformer attention using Unix tools to rank code files
by relevance to natural language queries.

### 2.2 Core Components

**Multi-Head Attention:**
- **Functional Head (40%):** Functions, methods, classes
- **Structural Head (30%):** Code organization, complexity
- **Temporal Head (20%):** File recency, modifications
- **Dependency Head (10%):** Imports, exports, connections

**Learning System:**
- Policy gradient updates from user feedback
- Multi-armed bandit algorithm selection
- Pattern learning from successful queries
- Adaptive attention weight optimization

### 2.3 Quick ULM Usage

```bash
# Basic file ranking
./ulm.sh rank "authentication functions" ./src --top 5

# Show current policy
./ulm.sh policy --show

# Learn from user feedback
./learning_system.sh learn-feedback "auth query" "file1,file2" 5 true 32000 claude
```

## 3. RAG: Retrieval Augmented Generation

*For complete RAG documentation, see [RAG README](../rag/docs/README.md)*

### 3.1 Overview

RAG transforms ULM-ranked files into LLM-optimized context using the
MULTICAT format and agent-specific instructions.

### 3.2 Core Components

**MULTICAT Format:**
- Standard multi-file concatenation format
- LLM-friendly structure with metadata headers
- Support for full files and diff patches

**Agent System:**
- Customized instructions for different LLMs
- OpenAI, Claude, and custom agent profiles
- Context size and format optimization

**ULM Integration:**
- Query-driven intelligent file selection
- Relevance-based context assembly
- Automatic context size optimization

### 3.3 Quick RAG Usage

```bash
# Generate LLM-ready context
./multicat.sh --agent claude-code --ulm-rank "user login" src/ > context.mc

# Extract LLM-generated files
./multisplit.sh -y llm_response.mc

# Show agent-specific examples
./multicat.sh --example openai
```

## 4. TetraBoard: Monitoring & Experiments

### 4.1 Overview

TetraBoard provides monitoring, experimentation, and documentation for the
entire TETRA system, tracking performance and facilitating learning.

### 4.2 Core Components

**Live Dashboards:**
- System status and performance metrics
- ULM training progress and policy evolution
- RAG generation success rates and patterns
- Cross-module integration health

**Experimental Framework:**
- Structured experiment design and execution
- A/B testing of different policies and agents
- Statistical analysis of performance improvements
- Automated result documentation

**Documentation Hub:**
- Cross-module documentation aggregation
- Concept linking and cross-referencing
- API for reading/writing module docs
- Unified navigation and search

### 4.3 Quick TetraBoard Usage

```bash
# Generate dashboard
./tetraboard.sh generate

# Run experiments
./experiment.sh run learning_test

# View documentation
./tetraboard.sh docs --module ulm
./tetraboard.sh docs --concept attention
```

## 5. Core Concepts

### 5.1 The Transformer Metaphor

TETRA maps transformer concepts to Unix operations:

```
Transformer Component → Unix Implementation
────────────────────────────────────────────
Embedding Layer      → grep/rg pattern extraction
Multi-Head Attention → parallel Unix pipelines
Query Matrix         → user search terms
Key Matrix           → file metadata extraction
Value Matrix         → file content
Attention Weights    → scoring algorithms
Layer Norm           → score normalization
Feed Forward         → context assembly
Residual Connection  → preserving original content
```

### 5.2 The ExM vs A Framework

TETRA optimizes along two fundamental dimensions:

**ExM (Exploration × Modification):** The "doing" dimension
- Low: Passive consumption, no exploration
- Medium: Balanced exploration with thoughtful changes
- High: Aggressive exploration and heavy modification

**A (Analysis):** The "understanding" dimension
- Low: Surface-level, minimal analysis
- Medium: Sufficient analysis to guide action
- High: Deep analysis, potential over-analysis

**Optimal Point (2,2):** Perfect balance of analysis driving informed action

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
```

### 5.3 Learning and Adaptation

TETRA learns through:

**User Feedback:**
- 1-5 star ratings on query results
- Binary feedback on generated code usage
- Implicit feedback from continued usage patterns

**Performance Metrics:**
- Generation success/failure rates
- Context relevance scores
- Token efficiency measurements
- Cross-module integration health

**Policy Updates:**
- Gradient-free optimization using user rewards
- Multi-armed bandit algorithm selection
- Attention weight adaptation per query type
- Cross-module parameter sharing

### 5.4 The Ideal Error Surface

TETRA's learning algorithms target an ideal optimization landscape:
- **Single global optimum** at center (balanced parameters)
- **Monotonic decrease** moving away from optimal point
- **Non-zero boundaries** to prevent algorithm trapping
- **Smooth gradients** everywhere for reliable convergence

This creates a **learnable surface** where any improvement leads toward
the global optimum.

## 6. Integration Architecture

### 6.1 Data Flow

```
User Query → ULM Attention → Ranked Files → RAG Formatting → LLM Context
     ↓             ↓              ↓              ↓             ↓
  Feedback ← Performance ← Usage Stats ← Generation ← AI Output
     ↓             ↓              ↓         Results      ↓
  Learning → Policy Update → Context Opt → Success → TetraBoard
```

### 6.2 State Management

**ULM State:**
- Current attention policies in `ulm/training/`
- Learning history in `ulm/logs/`
- Performance metrics in `$TETRA_DIR/rag/state/learning/`

**RAG State:**
- Generation logs in `$TETRA_DIR/rag/state/generations.log`
- Agent usage patterns in `$TETRA_DIR/rag/state/agent_usage.log`
- Token usage tracking in `$TETRA_DIR/rag/state/token_usage.log`

**TetraBoard State:**
- Experiment results in `tetraboard/experiments/`
- Dashboard cache in `tetraboard/data/`
- Cross-module documentation index

### 6.3 Module Communication

**ULM → RAG:**
```bash
# ULM provides ranked file list
ulm_files=$(ulm rank "$query" "$path" --top 5)

# RAG uses ULM ranking for context assembly
multicat.sh --ulm-rank "$query" --ulm-top 5 "$path"
```

**RAG → TetraBoard:**
```bash
# RAG logs generation events
state_manager.sh log-generation "$agent" "$file_count" "$context_size" "$status"

# TetraBoard aggregates for dashboard
tetraboard.sh generate
```

**TetraBoard → ULM:**
```bash
# TetraBoard triggers learning from experiments
learning_system.sh learn-feedback "$query" "$files" "$rating" "$used" "$context" "$agent"
```

## 7. Experimental Framework

### 7.1 Experiment Design

**Hypothesis-Driven Testing:**
1. Formulate specific learning hypothesis
2. Design controlled experiment to test it
3. Execute experiment with proper controls
4. Analyze results statistically
5. Update system based on findings

**Example Experiments:**
- Do authentication queries benefit from higher functional attention?
- Which context window sizes optimize generation quality vs. cost?
- How quickly can ULM adapt to new domains?

### 7.2 A/B Testing Framework

```bash
# Run A/B test comparing attention policies
experiment.sh run attention_ab_test \
  --group-a "functional=0.6,structural=0.2,temporal=0.1,dependency=0.1" \
  --group-b "functional=0.4,structural=0.3,temporal=0.2,dependency=0.1" \
  --queries queries.txt \
  --duration 7days
```

### 7.3 Performance Metrics

**Quantitative:**
- Query response accuracy (1-5 scale)
- Context relevance scores (0-1)
- Generation success rates (%)
- Token efficiency (useful_tokens / total_tokens)
- Learning speed (episodes to convergence)

**Qualitative:**
- User satisfaction surveys
- Code quality assessments
- Integration pain points
- Feature request analysis

## 8. Getting Started

### 8.1 Installation

```bash
# Clone TETRA system
git clone <tetra-repo>
cd tetra/bash

# Verify dependencies
which rg grep awk find stat bc  # Should find all tools

# Initialize state directories
ulm/learning_system.sh init
rag/state_manager.sh init
tetraboard/tetraboard.sh generate
```

### 8.2 Five-Minute Quick Start

**1. Rank some files:**
```bash
cd ulm
./ulm.sh rank "authentication functions" ../rag --top 3
```

**2. Generate LLM context:**
```bash
cd ../rag/core/multicat
./multicat.sh --agent claude-code --ulm-rank "auth setup" ../../.. --ulm-top 2
```

**3. View system status:**
```bash
cd ../../../tetraboard
./tetraboard.sh summary
```

**4. Learn from feedback:**
```bash
cd ../ulm
./learning_system.sh learn-feedback "auth functions" "auth/login.js" 5 true 32000 claude
```

**5. View updated dashboard:**
```bash
cd ../tetraboard
./tetraboard.sh generate && cat tetraboard.md
```

### 8.3 First Real Experiment

```bash
# Run the authentication vs database experiment
cd tetraboard
./experiment.sh run auth_vs_db_test

# View results
cat experiments/auth_vs_db_test/results/dashboard.md
```

## 9. Advanced Usage

### 9.1 Custom Agent Creation

```bash
# Create custom agent profile
cat > $TETRA_DIR/rag/agents/my-agent.conf <<EOF
AGENT_NAME="my-agent"
AGENT_DESCRIPTION="Custom agent for specific use case"

AGENT_INSTRUCTION_TEMPLATE="
Your custom instructions here...
Focus on clean, maintainable code.
Always include error handling.
"

MAX_SUGGESTED_FILES="10"
CONTEXT_WINDOW_SIZE="50000"
PREFER_CONCISE_OUTPUT="true"
EOF

# Use custom agent
rag/core/multicat/multicat.sh --agent my-agent src/
```

### 9.2 Advanced ULM Training

```bash
# Train ULM with specific dataset and feedback
cd ulm/training
./rl_trainer.sh train 50 "authentication functions" /path/to/code bandit auth_ground_truth.txt

# Adapt weights for specific query types
cd ..
./learning_system.sh adapt-weights "database"
./learning_system.sh adapt-weights "validation"
./learning_system.sh adapt-weights "authentication"
```

### 9.3 Complex Experiments

```bash
# Multi-variable experiment design
tetraboard/experiment.sh run complex_experiment \
  --variables "attention_weights,context_sizes,agent_types" \
  --levels "3,4,2" \
  --queries queries.txt \
  --metrics "accuracy,efficiency,satisfaction" \
  --duration 14days
```

### 9.4 Documentation Integration

```bash
# Generate unified documentation
tetraboard/tetraboard.sh docs --export-unified > TETRA_complete.md

# Update cross-references
tetraboard/tetraboard.sh docs --cross-reference

# Search across all modules
tetraboard/tetraboard.sh docs --search "attention mechanism"
```

## 10. Reference

### 10.1 Command Quick Reference

**ULM Commands:**
```bash
ulm.sh rank <query> <path> [--top N] [--algorithm X]
ulm.sh policy --show|--save|--load <file>
learning_system.sh learn-feedback <query> <files> <rating> <used> <context> <agent>
learning_system.sh recommend <query>
learning_system.sh status
```

**RAG Commands:**
```bash
multicat.sh [--agent X] [--ulm-rank <query>] [--ulm-top N] <path>
multicat.sh --example [agent]
multisplit.sh [-y|-Y] <file.mc>
state_manager.sh log-generation <agent> <files> <context> <status> [query]
```

**TetraBoard Commands:**
```bash
tetraboard.sh generate|watch|summary
experiment.sh run [experiment_name]
tetraboard.sh docs --list|--search <term>|--module <name>
```

### 10.2 Configuration Files

**ULM Configuration:**
- `ulm/training/current_policy.conf` - Current attention weights
- `$TETRA_DIR/rag/state/learning/` - Learning state and history

**RAG Configuration:**
- `$TETRA_SRC/bash/rag/agents/` - System agent profiles
- `$TETRA_DIR/rag/agents/` - User agent profiles
- `$TETRA_DIR/rag/state/` - Generation and usage logs

**TetraBoard Configuration:**
- `tetraboard/experiments/` - Experiment results
- `tetraboard/data/` - Dashboard cache and snapshots

### 10.3 File Formats

**MULTICAT Format:**
```
#MULTICAT_START
# dir: ./path
# file: filename.ext
# mode: full|diff
# note: description
#MULTICAT_END
[file content or diff]
```

**Policy Format:**
```bash
ULM_ATTENTION_WEIGHTS[functional]=0.4
ULM_ATTENTION_WEIGHTS[structural]=0.3
ULM_ATTENTION_WEIGHTS[temporal]=0.2
ULM_ATTENTION_WEIGHTS[dependency]=0.1
```

### 10.4 Environment Variables

- `TETRA_SRC` - TETRA source directory (bash/)
- `TETRA_DIR` - User data directory (~/.tetra)
- `TETRA_EXPERIMENT_DIR` - Current experiment directory

---

## Appendix: Design Philosophy

### Unix Philosophy Applied to ML

**1. Do One Thing Well:**
- ULM: Understand and rank code
- RAG: Format and optimize context
- TetraBoard: Monitor and experiment

**2. Compose Through Pipes:**
```bash
ulm rank "query" src/ | head -5 | xargs multicat.sh --agent claude
```

**3. Human-Readable Intermediate:**
All intermediate outputs can be inspected, modified, and understood by humans.

**4. Fail Loudly:**
When something goes wrong, the system provides clear, actionable error messages.

**5. Configuration as Code:**
All system behavior is controlled through readable configuration files.

### Why This Approach Works

**1. Transparency:** Every decision is explainable and debuggable
**2. Composability:** Components work together but can be used independently
**3. Adaptability:** System learns and improves from real usage
**4. Accessibility:** No specialized hardware or complex dependencies
**5. Reliability:** Built on battle-tested Unix tools and principles

---

## See Also

**Module Documentation:**
- [ULM Documentation](../ulm/docs/README.md) - Complete ULM guide
- [RAG Documentation](../rag/docs/README.md) - Complete RAG guide

**Concept Deep Dives:**
- [Attention Mechanism](./concepts/attention-metaphor.md) - Q, K, V implementation
- [ExM vs A Framework](./concepts/exm-vs-a-framework.md) - Optimization theory
- [Learning System](./concepts/learning-cycle.md) - How TETRA learns

**Practical Guides:**
- [Quick Start](./guides/quick-start.md) - Get running in 5 minutes
- [Experiments](./guides/experiments.md) - Design and run experiments
- [Custom Agents](./guides/agents.md) - Create specialized agents

---

*TETRA System Documentation v1.0*
*Complete documentation system implementing Unix philosophy for ML*
---

# Appendix A: ULM Documentation

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
---

# Appendix B: RAG Documentation

# RAG: Retrieval Augmented Generation

*Chapter 3 of the TETRA Documentation System*

## Table of Contents
- [3.1 Overview](#31-overview)
- [3.2 Core Concepts](#32-core-concepts)
- [3.3 MULTICAT Format](#33-multicat-format)
- [3.4 Agent System](#34-agent-system)
- [3.5 ULM Integration](#35-ulm-integration)
- [3.6 Context Engineering](#36-context-engineering)
- [3.7 Quick Start](#37-quick-start)
- [3.8 CLI Reference](#38-cli-reference)
- [3.9 Examples](#39-examples)

---

## 3.1 Overview

The RAG (Retrieval Augmented Generation) system transforms raw code files
into LLM-optimized context using intelligent file selection and agent-specific
formatting. It bridges the gap between code understanding (ULM) and AI
generation.

### What RAG Does
- **Formats code** for optimal LLM consumption using MULTICAT format
- **Optimizes context** using ULM intelligent ranking
- **Customizes output** for different AI agents (OpenAI, Claude, etc.)
- **Tracks performance** and learns from generation success

### The RAG Pipeline
```
Code Files → ULM Ranking → Agent Formatting → LLM Generation
    ↓              ↓              ↓              ↓
Raw Source   Relevance      MULTICAT       AI Output
Directory    Scoring        Format         (Code/Docs)
```

## 3.2 Core Concepts

### 3.2.1 Retrieval Augmented Generation Philosophy

Traditional RAG systems use vector embeddings and semantic search. TETRA's
RAG system uses ULM's attention mechanism for more precise, context-aware
code retrieval:

```bash
# Traditional RAG
query → embeddings → vector_search → similar_chunks → format → LLM

# TETRA RAG
query → ulm_attention → ranked_files → agent_format → LLM
```

### 3.2.2 Context Engineering Principles

**1. Relevance First:** ULM ensures only relevant files enter context
**2. Agent Optimization:** Each LLM gets customized instruction templates
**3. Format Consistency:** MULTICAT provides standard, parseable output
**4. Feedback Learning:** System improves based on generation success

### 3.2.3 The Agent Abstraction

Different LLMs have different strengths and preferences:

```bash
# OpenAI models prefer:
- Concise instructions
- Direct commands
- Minimal examples
- Clear structure

# Claude models prefer:
- Detailed context
- Examples and explanations
- Structured reasoning
- Edge case consideration
```

RAG's agent system handles these differences automatically.

## 3.3 MULTICAT Format

### 3.3.1 Format Specification

MULTICAT (Multiple File Concatenation) provides a standard way to bundle
multiple files into a single, LLM-friendly format:

```
#MULTICAT_START
# dir: ./src/auth
# file: login.js
# mode: full
# note: User authentication and login logic
#MULTICAT_END
import bcrypt from 'bcrypt';

export class AuthService {
    async validateUser(email, password) {
        // Implementation here
    }
}

#MULTICAT_START
# dir: ./src/auth
# file: middleware.js
# mode: full
# note: Authentication middleware for Express routes
#MULTICAT_END
export function requireAuth(req, res, next) {
    // Implementation here
}
```

### 3.3.2 Header Fields

**Required Fields:**
- `dir`: Directory path (relative preferred)
- `file`: Filename
- `mode`: Content mode (`full` or `diff`)

**Optional Fields:**
- `note`: Brief description of file purpose
- `requires`: Whether file uses disk context for diffs
- `lang`: Programming language hint

### 3.3.3 Mode Types

**Full Mode (default):**
```
# mode: full
[complete file content]
```

**Diff Mode:**
```
# mode: diff
# requires: true
--- a/src/auth/login.js
+++ b/src/auth/login.js
@@ -10,7 +10,7 @@
-    const hash = await bcrypt.hash(password, 10);
+    const hash = await bcrypt.hash(password, 12);
```

## 3.4 Agent System

### 3.4.1 Agent Profiles

Agent profiles customize RAG output for specific LLMs:

```bash
# Agent profile structure
$TETRA_SRC/bash/rag/agents/
├── base.conf           # Universal baseline
├── openai.conf         # OpenAI GPT models
├── claude-code.conf    # Claude Code optimized
└── custom.conf         # User-defined agents

# User overrides
$TETRA_DIR/rag/agents/
├── my-custom.conf      # Project-specific agents
└── openai.conf         # User customizations
```

### 3.4.2 Agent Configuration

Example agent profile (`openai.conf`):

```bash
AGENT_NAME="openai"
AGENT_DESCRIPTION="Optimized for OpenAI GPT models"

# Instruction template for LLM
AGENT_INSTRUCTION_TEMPLATE="Generate code in MULTICAT format.

CRITICAL: Never use markdown code blocks around MULTICAT output.
CRITICAL: Start immediately with #MULTICAT_START
CRITICAL: Use relative paths like ./src/file.js

Format:
#MULTICAT_START
# dir: ./src
# file: filename.ext
# note: brief description
#MULTICAT_END
[raw file content]

Requirements:
- No explanations or introductions
- Raw MULTICAT format only
- Production-ready code
"

# Agent preferences
PREFER_CONCISE_OUTPUT="true"
INCLUDE_CONTEXT_HINTS="false"
MAX_SUGGESTED_FILES="30"
CONTEXT_WINDOW_SIZE="150000"
```

### 3.4.3 Agent Selection Logic

```bash
load_agent_profile() {
    local agent="$1"

    # Try user directory first
    local user_profile="$TETRA_DIR/rag/agents/$agent.conf"
    local system_profile="$TETRA_SRC/bash/rag/agents/$agent.conf"

    if [[ -f "$user_profile" ]]; then
        source "$user_profile"
    elif [[ -f "$system_profile" ]]; then
        source "$system_profile"
    else
        # Fall back to base profile
        source "$TETRA_SRC/bash/rag/agents/base.conf"
    fi
}
```

## 3.5 ULM Integration

### 3.5.1 Intelligent File Selection

RAG integrates with ULM for smart file ranking:

```bash
# Traditional file selection
multicat.sh -r src/ > context.mc

# ULM-enhanced selection
multicat.sh --ulm-rank "authentication setup" --ulm-top 5 src/ > context.mc
```

### 3.5.2 Query-Driven Context

The ULM integration allows query-driven context assembly:

```bash
ulm_rank_files() {
    local query="$1" path="$2"

    # Use ULM to get relevance-ranked files
    "$ULM_SCRIPT" rank "$query" "$path" --algorithm multi_head --top "$ulm_top" | \
    while read -r score file; do
        echo "$file"
    done
}
```

### 3.5.3 Context Size Optimization

RAG automatically optimizes context size based on:
- Agent preferences (`MAX_SUGGESTED_FILES`)
- ULM relevance scores
- File sizes and complexity
- Token budget constraints

```bash
optimize_context() {
    local agent="$1" query="$2" files="$3"
    local max_files="${MAX_SUGGESTED_FILES:-20}"
    local context_budget="${CONTEXT_WINDOW_SIZE:-100000}"

    # Select top files within constraints
    select_optimal_context "$files" "$max_files" "$context_budget"
}
```

## 3.6 Context Engineering

### 3.6.1 Context Assembly Strategies

**Relevance-First:**
```bash
# Start with highest ULM-scored files
# Add files until context budget exhausted
for file in $(ulm_rank_files "$query" "$path"); do
    if within_budget "$file" "$current_context_size"; then
        add_to_context "$file"
    fi
done
```

**Dependency-Aware:**
```bash
# Include related files even if lower ULM score
# Ensures complete understanding of interconnected code
add_dependency_context "$selected_files"
```

**Template-Driven:**
```bash
# Add agent-specific instructions and examples
prepend_agent_template "$agent_name" "$context"
```

### 3.6.2 Context Validation

RAG validates generated context for:
- **Format compliance** - proper MULTICAT structure
- **Size constraints** - within agent token limits
- **Completeness** - all referenced files included
- **Relevance** - ULM scores above threshold

```bash
validate_context() {
    local context_file="$1" agent="$2"

    check_multicat_format "$context_file" &&
    check_size_constraints "$context_file" "$agent" &&
    check_completeness "$context_file" &&
    check_relevance_threshold "$context_file"
}
```

## 3.7 Quick Start

### Installation
RAG is part of the TETRA system. Requires:
- ULM module for intelligent ranking
- Standard Unix tools (grep, awk, find)
- Agent profiles (provided or custom)

### Basic Usage

**1. Simple file concatenation:**
```bash
./multicat.sh -r src/ > output.mc
```

**2. Agent-specific formatting:**
```bash
./multicat.sh --agent openai -r src/ > output.mc
```

**3. ULM-enhanced context:**
```bash
./multicat.sh --agent claude-code --ulm-rank "user authentication" --ulm-top 5 src/ > output.mc
```

**4. Generate agent examples:**
```bash
./multicat.sh --example openai
./multicat.sh --example claude-code
```

### Example Output

```bash
$ ./multicat.sh --agent openai --ulm-rank "auth functions" src/ --ulm-top 2

Generate code in MULTICAT format following these exact rules:

CRITICAL: Never wrap output in markdown code blocks like ```
CRITICAL: Start your response immediately with #MULTICAT_START
CRITICAL: Use only relative paths (./src/file.js not /absolute/paths)

#MULTICAT_START
# dir: ./src/auth
# file: login.js
# note: Authentication utilities for user login
#MULTICAT_END
import bcrypt from 'bcrypt';

export class AuthService {
    async validateUser(email, password) {
        const user = await User.findByEmail(email);
        if (!user) return null;

        const isValid = await bcrypt.compare(password, user.passwordHash);
        return isValid ? user : null;
    }
}

#MULTICAT_START
# dir: ./src/auth
# file: middleware.js
# note: Express middleware for route protection
#MULTICAT_END
export function requireAuth(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    // Token validation logic...
    next();
}
```

## 3.8 CLI Reference

### multicat.sh Commands

**Basic Options:**
- `-r` - Recurse into directories
- `-x <file>` - Exclude patterns file
- `-d <a>=<b>` - Remap paths in headers
- `--dryrun` - Show files without generating output

**Agent Integration:**
- `--agent <name>` - Use specific agent profile
- `--example [agent]` - Generate agent-specific examples

**ULM Integration:**
- `--ulm-rank <query>` - Use ULM intelligent ranking
- `--ulm-top N` - Number of top ULM results (default: 20)

**Advanced Options:**
- `-m <manifest>` - Use canonical file list
- `-C <dir>` - Root directory for path relativization
- `--tree-only` - Generate only FILETREE section

### multisplit.sh Commands

**Extraction:**
- `multisplit.sh <file.mc>` - Extract files with prompts
- `multisplit.sh -y <file.mc>` - Extract with overwrite prompts
- `multisplit.sh -Y <file.mc>` - Force extract all files

### state_manager.sh Commands

**Tracking:**
- `log-generation <agent> <files> <context> <status> [query]` - Log generation
- `log-tokens <agent> <input> <output> [cost]` - Log token usage
- `export {json|csv} [file]` - Export usage data

## 3.9 Examples

### Example 1: Basic RAG Workflow

```bash
# Step 1: Generate context with RAG
$ ./multicat.sh --agent claude-code --ulm-rank "database connection" src/ > db_context.mc

# Step 2: Send to LLM (copy/paste db_context.mc)
# Step 3: Receive LLM response in MULTICAT format
# Step 4: Extract generated files

$ ./multisplit.sh -y llm_response.mc

Extracting: ./src/db/connection.js
Extracting: ./src/db/pool.js
Extraction complete: 2 files created
```

### Example 2: Agent Customization

```bash
# Create custom agent profile
$ cat > $TETRA_DIR/rag/agents/my-agent.conf <<EOF
AGENT_NAME="my-agent"
AGENT_INSTRUCTION_TEMPLATE="Custom instructions here..."
MAX_SUGGESTED_FILES="15"
CONTEXT_WINDOW_SIZE="80000"
EOF

# Use custom agent
$ ./multicat.sh --agent my-agent src/
```

### Example 3: Performance Tracking

```bash
# Log a successful generation
$ ./state_manager.sh log-generation "claude-code" 3 45000 "success" "auth_implementation"

# Check performance metrics
$ ./state_manager.sh success-rate
92%

$ ./state_manager.sh token-stats claude-code 7
total_input=125000
total_output=15000
avg_tokens_per_request=46667
request_count=3
```

### Example 4: Integration with TetraBoard

```bash
# Generate context and track in TetraBoard
$ ./multicat.sh --agent openai --ulm-rank "validation utilities" src/ > context.mc

# (After LLM processing and successful implementation)
$ ./learning_system.sh learn-feedback "validation utilities" "utils/validate.js,utils/sanitize.js" 5 true 32000 openai

# View results in TetraBoard
$ ../tetraboard/tetraboard.sh generate
$ cat ../tetraboard/tetraboard.md
```

---

## See Also

- [ULM Integration](../ulm/docs/README.md) - Intelligent file ranking
- [TetraBoard Tracking](../tetraboard/docs/README.md) - Performance monitoring
- [MULTICAT Format](./concepts/multicat-format.md) - Deep dive on format
- [Agent Profiles](./concepts/agent-profiles.md) - Creating custom agents
- [Context Engineering](./concepts/context-optimization.md) - Advanced context assembly

---

*RAG Documentation - Part of TETRA System*
*For complete system overview, see [TetraBoard Docs](../tetraboard/docs/README.md)*
---

# Appendix C: Key Concepts

## C.1 ExM vs A Framework

*Understanding TETRA's fundamental learning dimensions*

## Overview

The ExM vs A framework provides the theoretical foundation for TETRA's
learning system. It maps any learning problem onto two fundamental axes:
**ExM (Exploration × Modification)** and **A (Analysis)**, creating an
optimization landscape that guides system adaptation.

## The Two Dimensions

### ExM (Exploration × Modification)
**The "Doing" Dimension - Verbs**

ExM represents the active, transformative aspects of learning:
- **Exploration**: Seeking new information, patterns, code
- **Modification**: Changing, updating, refactoring, creating
- **Action**: Taking steps that alter the current state

```
Low ExM (0-1):    Passive consumption, minimal exploration
                  Reading code without experimenting

Medium ExM (2):   Balanced exploration with thoughtful changes
                  Testing hypotheses, making informed modifications

High ExM (3-4):   Aggressive exploration and heavy modification
                  Extensive experimentation, major refactoring
```

### A (Analysis)
**The "Understanding" Dimension - Nouns**

A represents the comprehension and reasoning aspects:
- **Analysis**: Breaking down problems, understanding structure
- **Comprehension**: Grasping concepts, patterns, relationships
- **Knowledge**: Accumulating and organizing information

```
Low A (0-1):      Surface-level understanding, minimal analysis
                  Quick pattern matching without deeper insight

Medium A (2):     Sufficient analysis to guide effective action
                  Understanding key relationships and implications

High A (3-4):     Deep analysis, comprehensive understanding
                  Extensive investigation, potential over-analysis
```

## The Optimization Surface

### The Ideal 5x5 Grid

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
```

### Why This Surface is Optimal

**1. Single Global Maximum (2,2):**
The optimal balance point where sufficient analysis guides effective action.

**2. Monotonic Decrease:**
Moving away from the center in any direction decreases performance.

**3. Non-Zero Boundaries:**
Even extreme combinations provide some value, preventing algorithmic trapping.

**4. Smooth Gradients:**
Clear directional information for optimization algorithms.

## Corner Analysis

### The Four Extremes

**(0,0) - Stagnation:**
- No analysis, no action
- Pure consumption without learning or change
- Example: Reading code without understanding or applying it

**(4,4) - Chaos:**
- Over-analysis combined with reckless action
- Analysis paralysis meeting destructive experimentation
- Example: Endless research while making random, large changes

**(0,4) - Reckless Destruction:**
- No analysis, heavy modification
- Uninformed experimentation and change
- Example: Aggressive refactoring without understanding the code

**(4,0) - Analysis Paralysis:**
- Over-analysis, no action
- Perfect understanding that never leads to improvement
- Example: Comprehensive code analysis with no implementation

## Application to ULM Learning

### Mapping ULM Parameters

The ExM vs A framework maps directly to ULM's attention mechanism:

**ExM Dimension (Code Action):**
- **Low ExM**: Focus on existing, stable code patterns
- **Medium ExM**: Balance between established and experimental code
- **High ExM**: Emphasize recent changes, new implementations

**A Dimension (Code Understanding):**
- **Low A**: Simple pattern matching, keyword relevance
- **Medium A**: Structural analysis, dependency understanding
- **High A**: Deep semantic analysis, complex relationship mapping

### ULM Policy Optimization

ULM's attention weights represent a point in ExM-A space:

```bash
# Conservative policy (Low ExM, Medium A)
ULM_ATTENTION_WEIGHTS[functional]=0.2   # Less emphasis on new functions
ULM_ATTENTION_WEIGHTS[structural]=0.5   # High structural analysis
ULM_ATTENTION_WEIGHTS[temporal]=0.1     # Ignore recent changes
ULM_ATTENTION_WEIGHTS[dependency]=0.2   # Moderate dependency analysis

# Balanced policy (Medium ExM, Medium A) - OPTIMAL
ULM_ATTENTION_WEIGHTS[functional]=0.4   # Balanced function focus
ULM_ATTENTION_WEIGHTS[structural]=0.3   # Adequate structural analysis
ULM_ATTENTION_WEIGHTS[temporal]=0.2     # Consider recency
ULM_ATTENTION_WEIGHTS[dependency]=0.1   # Light dependency focus

# Aggressive policy (High ExM, Low A)
ULM_ATTENTION_WEIGHTS[functional]=0.6   # Heavy function emphasis
ULM_ATTENTION_WEIGHTS[structural]=0.1   # Minimal structure analysis
ULM_ATTENTION_WEIGHTS[temporal]=0.3     # Focus on recent changes
ULM_ATTENTION_WEIGHTS[dependency]=0.0   # Ignore dependencies
```

## Learning Dynamics

### Gradient Descent in ExM-A Space

The optimization surface enables gradient-based learning:

```bash
calculate_exm_a_position() {
    local functional_weight="$1" structural_weight="$2"
    local temporal_weight="$3" dependency_weight="$4"

    # ExM increases with functional and temporal emphasis
    local exm
    exm=$(echo "scale=2; ($functional_weight + $temporal_weight) * 2" | bc)

    # A increases with structural and dependency emphasis
    local a
    a=$(echo "scale=2; ($structural_weight + $dependency_weight) * 2.5" | bc)

    echo "$exm $a"
}

update_toward_optimal() {
    local current_exm="$1" current_a="$2"
    local optimal_exm=2.0 optimal_a=2.0
    local learning_rate=0.1

    # Calculate gradients toward optimal point
    local exm_gradient
    exm_gradient=$(echo "scale=2; ($optimal_exm - $current_exm) * $learning_rate" | bc)

    local a_gradient
    a_gradient=$(echo "scale=2; ($optimal_a - $current_a) * $learning_rate" | bc)

    echo "$exm_gradient $a_gradient"
}
```

### Reward Signal Interpretation

User feedback maps to surface position quality:

```bash
calculate_surface_score() {
    local exm="$1" a="$2"

    # Distance from optimal point (2,2)
    local exm_dist a_dist
    exm_dist=$(echo "scale=2; $exm - 2.0" | bc | tr -d '-')
    a_dist=$(echo "scale=2; $a - 2.0" | bc | tr -d '-')

    # Maximum distance (from optimal to corner)
    local max_dist=2.0

    # Score decreases with distance from optimal
    local distance_penalty
    distance_penalty=$(echo "scale=2; ($exm_dist + $a_dist) / (2 * $max_dist)" | bc)

    # Base score with exponential decay
    local score
    score=$(echo "scale=2; 0.9 * e(-2 * $distance_penalty) + 0.1" | bc -l)

    echo "$score"
}
```

## Experimental Validation

### Testing the Framework

The ExM vs A framework can be experimentally validated:

**1. Corner Performance:**
Test policies at extreme corners and confirm poor performance.

**2. Gradient Direction:**
Verify that moves toward center (2,2) improve user satisfaction.

**3. Learning Speed:**
Confirm that the smooth gradient enables faster convergence.

**4. Stability:**
Show that the optimal point remains stable across different domains.

### Experimental Design

```bash
# Test corner policies
test_corner_policy() {
    local exm="$1" a="$2"

    # Convert ExM-A coordinates to ULM weights
    local weights
    weights=$(exm_a_to_ulm_weights "$exm" "$a")

    # Run queries with this policy
    run_query_batch "$weights" test_queries.txt

    # Measure user satisfaction
    collect_user_feedback "$weights"
}

# Validate surface predictions
for exm in 0 1 2 3 4; do
    for a in 0 1 2 3 4; do
        predicted_score=$(calculate_surface_score "$exm" "$a")
        actual_score=$(test_corner_policy "$exm" "$a")

        echo "Position ($exm,$a): Predicted=$predicted_score, Actual=$actual_score"
    done
done
```

## Broader Applications

### Beyond ULM

The ExM vs A framework applies to any learning system:

**Software Development:**
- ExM: Code changes, refactoring, new features
- A: Code review, testing, documentation analysis

**Research:**
- ExM: Experiments, hypothesis testing, data collection
- A: Literature review, theoretical analysis, data analysis

**Business:**
- ExM: Product changes, market experiments, strategy shifts
- A: Market research, competitive analysis, data analysis

### Universal Learning Principle

The framework captures a fundamental tension in all learning:
- **Too much action without understanding** → Chaos, waste, poor outcomes
- **Too much understanding without action** → Paralysis, no progress
- **Balanced understanding driving informed action** → Optimal learning

## Implementation Guide

### Converting to ULM Parameters

```bash
exm_a_to_ulm_weights() {
    local exm="$1" a="$2"

    # ExM influences functional and temporal weights
    local functional_base=0.2 temporal_base=0.05
    local functional_weight
    functional_weight=$(echo "scale=2; $functional_base + $exm * 0.1" | bc)
    local temporal_weight
    temporal_weight=$(echo "scale=2; $temporal_base + $exm * 0.05" | bc)

    # A influences structural and dependency weights
    local structural_base=0.1 dependency_base=0.02
    local structural_weight
    structural_weight=$(echo "scale=2; $structural_base + $a * 0.08" | bc)
    local dependency_weight
    dependency_weight=$(echo "scale=2; $dependency_base + $a * 0.03" | bc)

    # Normalize to sum to 1.0
    local total
    total=$(echo "$functional_weight + $structural_weight + $temporal_weight + $dependency_weight" | bc)

    functional_weight=$(echo "scale=4; $functional_weight / $total" | bc)
    structural_weight=$(echo "scale=4; $structural_weight / $total" | bc)
    temporal_weight=$(echo "scale=4; $temporal_weight / $total" | bc)
    dependency_weight=$(echo "scale=4; $dependency_weight / $total" | bc)

    echo "$functional_weight $structural_weight $temporal_weight $dependency_weight"
}
```

### Monitoring Position in ExM-A Space

```bash
monitor_exm_a_position() {
    # Extract current ULM weights
    local weights
    weights=$(ulm.sh policy --show | parse_weights)

    # Convert to ExM-A coordinates
    local position
    position=$(ulm_weights_to_exm_a $weights)

    # Calculate distance from optimal
    local distance_from_optimal
    distance_from_optimal=$(calculate_distance_from_optimal $position)

    echo "Current ExM-A position: $position"
    echo "Distance from optimal: $distance_from_optimal"
    echo "Surface score: $(calculate_surface_score $position)"
}
```

---

## See Also

- [ULM Learning](../../ulm/docs/concepts/learning-system.md) - How ULM implements this framework
- [TetraBoard Experiments](../guides/experiments.md) - Testing ExM-A predictions
- [Attention Mechanism](./attention-metaphor.md) - Technical implementation details
- [Optimization Theory](./learning-cycle.md) - Mathematical foundations

---

*ExM vs A Framework - Core concept in TETRA learning system*
---

*Complete TETRA Documentation - Generated Wed Sep 24 20:52:26 PDT 2025*
