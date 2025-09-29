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