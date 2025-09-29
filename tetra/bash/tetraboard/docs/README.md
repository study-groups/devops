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