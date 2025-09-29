# TetraBoard Help Terms Index

## Core Concepts

### ULM Episodes
**Definition:** Training episodes completed by the Unix Language Model
**What it means:** Each episode represents a learning cycle where ULM processes queries and improves its attention mechanisms. Higher numbers indicate more training and potentially better performance.
**Good values:** 10+ episodes show active learning. 0 means no training yet.

### RAG Generations
**Definition:** Total number of context generations by the Retrieval Augmented Generation system
**What it means:** Each generation creates optimized code context for AI models. More generations indicate active system usage.
**Typical range:** 0-1000+ depending on usage patterns.

### Success Rate
**Definition:** Percentage of RAG generations that completed successfully
**What it means:** Measures system reliability. High success rates (80%+) indicate stable operation. Lower rates may suggest configuration issues or resource constraints.
**Target:** Above 75% is good, 90%+ is excellent.

### Popular Agent
**Definition:** Most frequently used AI agent for generations
**What it means:** Shows which AI model (claude-code, openai, etc.) is being used most often. Helps understand usage patterns.
**Common values:** claude-code, openai, anthropic, local-model

### Last Updated
**Definition:** Timestamp of most recent system activity
**What it means:** Shows when TetraBoard last collected data. Recent timestamps indicate active monitoring.
**Freshness:** Should be within minutes for active systems.

## System Components

### ULM Engine
**Definition:** Unix Language Model processing engine
**Status values:**
- ✅ Active: Engine running and processing
- 🟡 Initializing: Starting up or loading models
- ❌ Offline: Not running or misconfigured

### RAG System
**Definition:** Retrieval Augmented Generation pipeline
**Status values:**
- ✅ Active: Processing queries and generating context
- 🟡 Initializing: Loading agent profiles or warming up
- ❌ Offline: Service unavailable

### Data Store
**Definition:** Persistent storage location for system state
**Path info:** Usually ~/.tetra/rag/state/ containing logs and training data
**Status indicators:**
- ✅ Healthy: Read/write access, adequate space
- 🟡 Initializing: Creating directories or migrating data
- ❌ Error: Permission issues or disk space problems

## Performance Metrics

### Context Size
**Definition:** Number of tokens in generated context windows
**What it means:** Larger contexts provide more information but use more resources. Optimal size depends on the query complexity.
**Typical ranges:**
- Small: 1k-10k tokens (simple queries)
- Medium: 10k-50k tokens (moderate complexity)
- Large: 50k+ tokens (complex analysis)

### Attention Heads
**Definition:** Four specialized ranking mechanisms in ULM
**Types:**
- 🎯 Functional: Ranks functions, methods, procedures
- 🏗️ Structural: Analyzes classes, interfaces, architecture
- ⏰ Temporal: Considers recency and modification patterns
- 🔗 Dependency: Maps imports, exports, connections

### Multi-Armed Bandit
**Definition:** Algorithm for selecting optimal agents
**What it means:** System learns which AI agents work best for different types of queries, balancing exploration of new options with exploitation of proven performers.

## File Formats

### MULTICAT
**Definition:** Multi-file concatenation format optimized for AI models
**What it means:** Combines relevant code files with proper headers and context markers for optimal AI comprehension.
**Benefits:** Better than simple concatenation - preserves file structure and relationships.

## Troubleshooting Terms

### Policy Gradient Updates
**Definition:** Machine learning technique for improving ULM performance
**What it means:** System learns from successful and failed generations to improve future ranking decisions.

### Reinforcement Learning
**Definition:** Learning approach where system improves based on feedback
**What it means:** ULM gets better over time by observing which contexts lead to successful AI generations.

### Agent Profiles
**Definition:** Configuration files for different AI models
**Location:** Usually in ../rag/agents/ directory
**Contents:** API endpoints, formatting preferences, token limits, model-specific optimizations.