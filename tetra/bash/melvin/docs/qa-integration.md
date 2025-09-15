# QA Integration: Preserving Simplicity While Adding Analytics

## Integration Philosophy

The QA system integration demonstrates MELVIN's **non-invasive** approach: the existing `qa.sh` remains completely unchanged while gaining powerful dimensional analytics capabilities.

## Current QA System Analysis

### Existing Structure (`qa.sh`)
The QA system is elegantly simple:

**File Storage Pattern:**
```bash
$QA_DIR/db/
├── 1757806329.prompt    # User query
├── 1757806329.data      # JSON request to OpenAI
├── 1757806329.response  # Raw API response
├── 1757806329.answer    # Extracted answer text
├── 1757806330.prompt
├── 1757806330.data
└── ...
```

**Key Functions:**
- `qa_query()` / `qq()` - Submit query to LLM
- `a()` - Retrieve recent answers by index
- `q()` - Retrieve recent queries by index
- Configuration via files: `$QA_DIR/engine`, `$QA_DIR/api_key`

**Strengths to Preserve:**
- **Simplicity** - No complex dependencies
- **Transparency** - All data stored in readable files
- **Reliability** - Minimal failure modes
- **Unix Philosophy** - Composable with other tools

## MELVIN Integration Strategy

### 1. **Zero Modification Principle**

`qa.sh` remains exactly as-is. MELVIN integration happens through:
- **Optional sourcing** - Only when MELVIN is available
- **Event hooks** - Non-blocking event logging
- **Parallel enrichment** - Add metadata files alongside existing ones

### 2. **Progressive Enhancement**

Users get benefits incrementally:
```bash
# Level 0: Pure QA (unchanged)
source qa.sh
qq "What is the fastest sorting algorithm?"
a

# Level 1: Add MELVIN registration
source melvin.sh
melvin_register_qa  # One-time setup

# Level 2: Use MELVIN analytics
melvin tokens by engine
melvin cost by day where date > -7d

# Level 3: Enhanced REPL
qa_repl  # Gets both QA and MELVIN commands
```

## Integration Implementation

### 1. **QA Module Manifest**

Create `/Users/mricos/src/bash/qa/melvin_manifest.json`:
```json
{
  "module": "qa",
  "version": "1.0",
  "description": "Question & Answer system with LLM analytics",

  "data_sources": [
    {
      "type": "file_pattern",
      "pattern": "$QA_DIR/db/*.answer",
      "id_extraction": "basename ${file} .answer",
      "watch_directory": "$QA_DIR/db",
      "refresh_strategy": "inotify"
    }
  ],

  "schema": {
    "measures": {
      "queries": {
        "type": "count",
        "description": "Number of queries",
        "extraction": "count_files"
      },
      "tokens": {
        "type": "integer",
        "description": "Total tokens used",
        "extraction": "extract_tokens_from_response"
      },
      "cost": {
        "type": "decimal",
        "description": "Dollar cost of queries",
        "extraction": "calculate_openai_cost"
      },
      "response_time": {
        "type": "decimal",
        "description": "Response time in seconds",
        "extraction": "calculate_response_time"
      }
    },

    "dimensions": {
      "timestamp": {
        "type": "datetime",
        "extraction": "filename_to_epoch",
        "hierarchy": ["year", "month", "day", "hour"]
      },
      "engine": {
        "type": "categorical",
        "extraction": "jq -r '.model' ${QA_DIR}/db/${ID}.data 2>/dev/null || echo 'unknown'"
      },
      "context": {
        "type": "categorical",
        "extraction": "infer_context_from_prompt ${QA_DIR}/db/${ID}.prompt",
        "description": "Inferred query context"
      },
      "user": {
        "type": "categorical",
        "extraction": "echo $USER"
      },
      "tags": {
        "type": "multi_categorical",
        "extraction": "cat ${QA_DIR}/db/${ID}.tags 2>/dev/null || echo ''",
        "description": "User-applied tags"
      },
      "success": {
        "type": "boolean",
        "extraction": "test -s ${QA_DIR}/db/${ID}.answer && echo 1 || echo 0"
      }
    }
  },

  "extractors": {
    "extract_tokens_from_response": "jq -r '.usage.total_tokens // 0' ${QA_DIR}/db/${ID}.response 2>/dev/null || echo 0",
    "calculate_openai_cost": "jq -r '.usage | (.prompt_tokens * 0.00001) + (.completion_tokens * 0.00002)' ${QA_DIR}/db/${ID}.response 2>/dev/null || echo 0",
    "infer_context_from_prompt": "head -1 $1 | classify_context",
    "calculate_response_time": "stat -c %Y ${QA_DIR}/db/${ID}.response | awk -v start=$(basename ${ID}) '{print $1 - start}'"
  }
}
```

### 2. **Non-Invasive Event Logging**

Add optional MELVIN hooks to `qa.sh` without changing core functionality:

```bash
# At the end of q_gpt_query function (after line 163)
echo "$answer" > "$db/$id.answer"
echo "$answer" # Always output the final answer to stdout

# Add MELVIN integration (optional, non-blocking)
if command -v melvin_log_event >/dev/null 2>&1; then
    {
        # Extract metrics for MELVIN (background, non-blocking)
        local tokens=$(jq -r '.usage.total_tokens // 0' "$db/$id.response" 2>/dev/null || echo 0)
        local cost=$(jq -r '.usage | (.prompt_tokens * 0.00001) + (.completion_tokens * 0.00002)' "$db/$id.response" 2>/dev/null || echo 0)

        # Log event to MELVIN (fire-and-forget)
        melvin_log_event "qa" "query_completed" "$id" "{\"tokens\":$tokens,\"cost\":$cost}" &
    } || true  # Never fail if MELVIN unavailable
fi
```

### 3. **Enhanced File Structure**

MELVIN adds optional metadata files alongside existing ones:
```bash
$QA_DIR/db/
├── 1757806329.prompt    # Original QA files (unchanged)
├── 1757806329.data
├── 1757806329.response
├── 1757806329.answer
├── 1757806329.tags      # Optional: User-added tags
├── 1757806329.context   # Optional: Inferred context
├── 1757806330.prompt
└── ...
```

**Tag Management Functions:**
```bash
qa_tag() {
    local id="$1"
    shift
    local tags="$*"

    # Add tags to specific query
    echo "$tags" > "$QA_DIR/db/$id.tags"

    # Update MELVIN index if available
    command -v melvin_reindex_record >/dev/null && melvin_reindex_record "qa" "$id" || true
}

qa_context() {
    local id="$1"
    local context="$2"

    # Set context for specific query
    echo "$context" > "$QA_DIR/db/$id.context"

    # Update MELVIN index if available
    command -v melvin_reindex_record >/dev/null && melvin_reindex_record "qa" "$id" || true
}
```

### 4. **QA Registration Helper**

Create `~/src/bash/qa/melvin_integration.sh`:
```bash
#!/usr/bin/env bash

# QA-MELVIN Integration Helper
# Source this after qa.sh to enable MELVIN features

melvin_register_qa() {
    if ! command -v melvin >/dev/null; then
        echo "MELVIN not available. QA system works normally."
        return 1
    fi

    # Register QA module with MELVIN
    melvin register qa "$QA_SRC/melvin_manifest.json"

    echo "QA system registered with MELVIN."
    echo "Try: melvin tokens by engine"
}

# Add QA-specific MELVIN convenience commands
alias qa_stats="melvin qa.queries by day | tail -7"
alias qa_costs="melvin qa.cost by engine | sort desc"
alias qa_usage="melvin qa.tokens by day where date > -30d | chart"

# Enhanced QA functions that work with MELVIN
qq_with_context() {
    local context="$1"
    shift
    local query="$*"

    # Set context before query
    export QA_CURRENT_CONTEXT="$context"
    qq "$query"

    # Tag the most recent query with context
    if command -v qa_tag >/dev/null; then
        local last_id=$(ls -1t $QA_DIR/db/*.prompt | head -1 | xargs basename -s .prompt)
        qa_context "$last_id" "$context"
    fi
}

# Export functions
export -f melvin_register_qa qq_with_context
```

## Usage Examples

### Basic QA (Unchanged)
```bash
source qa.sh
qq "Explain quicksort algorithm"
a  # Shows the answer
```

### QA with MELVIN Analytics
```bash
source qa.sh
source melvin.sh
melvin_register_qa

# Use QA normally
qq "Explain quicksort algorithm"
a

# Get analytics
melvin tokens by engine
melvin cost by day where date > -7d
melvin queries by hour | chart
```

### Enhanced QA with Context
```bash
source qa.sh
source melvin_integration.sh
melvin_register_qa

# Ask with context
qq_with_context "algorithms" "Explain quicksort"
qq_with_context "python" "How to implement quicksort in Python?"

# Analyze by context
melvin tokens by context
melvin cost by context where date > -7d
```

### Tag-Based Analysis
```bash
# Retroactively tag queries
qa_tag 1757806329 algorithm sorting computer-science
qa_tag 1757806330 python implementation

# Analyze by tags
melvin tokens by tag
melvin cost by tag where tag contains algorithm
```

## qa_repl.sh Implementation

Enhanced REPL that provides both QA and MELVIN functionality:

```bash
#!/usr/bin/env bash
# QA REPL with MELVIN integration

source qa.sh

# Optional MELVIN integration
MELVIN_ENABLED=false
if command -v melvin >/dev/null && melvin ping >/dev/null 2>&1; then
    source melvin_integration.sh
    melvin_register_qa >/dev/null 2>&1
    MELVIN_ENABLED=true
fi

qa_repl_help() {
    echo "QA REPL Commands:"
    echo "  qq <query>     - Ask question"
    echo "  a [n]          - Show nth most recent answer (default: 0)"
    echo "  q [n]          - Show nth most recent question"
    echo "  tag <id> <tags>- Add tags to query ID"
    echo "  help           - Show this help"
    echo "  status         - Show system status"
    echo "  exit           - Exit REPL"

    if [[ "$MELVIN_ENABLED" == "true" ]]; then
        echo ""
        echo "MELVIN Analytics Commands:"
        echo "  tokens by <dimension>  - Token usage analysis"
        echo "  cost by <dimension>    - Cost analysis"
        echo "  queries by <dimension> - Query count analysis"
        echo "  Available dimensions: engine, day, hour, context, tag, user"
    fi
}

qa_repl() {
    echo "QA REPL - Type 'help' for commands"
    [[ "$MELVIN_ENABLED" == "true" ]] && echo "MELVIN analytics enabled"

    while true; do
        read -r -p "qa> " -e cmd args

        case "$cmd" in
            qq|query)
                qq "$args"
                ;;
            a|answer)
                a ${args:-0}
                ;;
            q|question)
                q ${args:-0}
                ;;
            tag)
                qa_tag $args
                ;;
            help)
                qa_repl_help
                ;;
            status)
                qa_status
                [[ "$MELVIN_ENABLED" == "true" ]] && melvin status qa
                ;;
            tokens|cost|queries)
                if [[ "$MELVIN_ENABLED" == "true" ]]; then
                    melvin qa.$cmd $args
                else
                    echo "MELVIN not available. Try 'qq' to ask questions."
                fi
                ;;
            exit|quit)
                break
                ;;
            "")
                # Empty input, continue
                ;;
            *)
                echo "Unknown command: $cmd. Type 'help' for available commands."
                ;;
        esac
    done
}

# Start REPL if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    qa_repl
fi
```

## Benefits of This Integration

### For QA Users
- **Zero disruption** - Existing workflows continue unchanged
- **Optional enhancement** - Analytics available when needed
- **Progressive adoption** - Can gradually use more MELVIN features
- **Unified interface** - Same REPL for queries and analytics

### For MELVIN System
- **Real-world validation** - QA provides concrete use case
- **Incremental development** - Build features as QA needs them
- **Non-invasive pattern** - Demonstrates how to integrate other tools
- **Cross-module potential** - QA data can relate to git, deploy, etc.

## Migration Path

### Phase 1: Current State (No Changes)
- QA system works exactly as before
- Users see no difference

### Phase 2: MELVIN Available (Optional)
- `source melvin_integration.sh` adds analytics
- QA core functionality unchanged
- Analytics available for interested users

### Phase 3: Enhanced REPL (Optional)
- `qa_repl.sh` provides unified interface
- Supports both QA commands and MELVIN analytics
- Tab completion for both command sets

### Phase 4: Cross-Module Integration
- QA data participates in cross-module analytics
- Context sharing with other tetra tools
- Unified dashboard across all tools

The integration preserves QA's elegant simplicity while demonstrating MELVIN's ability to add sophisticated analytics capabilities without disruption.

## Next Steps

Understanding QA integration prepares you for:
- **[Implementation Notes](implementation-notes.md)** - Technical implementation details
- **[Examples](examples.md)** - Real-world usage examples with QA data
- **[Schema System](schema-system.md)** - How to define queryable dimensions for other tools