# MELVIN Protocol Design: Module Integration

## Protocol Overview

MELVIN acts as a **universal dimensional analytics broker** for bash-based tools. The protocol defines how modules (like qa, tkm, tsm, deploy) register their data dimensions and integrate with MELVIN's query engine.

## Core Protocol Concepts

### 1. **Module Registration**
Tools register their queryable data with MELVIN using a standard manifest format.

### 2. **Schema Declaration**
Each module declares what dimensions and measures are available for querying.

### 3. **Data Source Mapping**
Modules specify where their data lives and how to access it.

### 4. **Event Logging**
Modules report significant events to MELVIN for indexing and analysis.

## Registration Protocol

### Module Registration Function
```bash
melvin_register() {
    local module_name="$1"
    local manifest_file="$2"

    # Copy manifest to MELVIN registry
    cp "$manifest_file" "$MELVIN_REGISTRY_DIR/$module_name.json"

    # Initialize module data structures
    melvin_init_module "$module_name"

    # Index existing data
    melvin_index_module "$module_name"
}
```

### Registration Example (QA Module)
```bash
# In qa.sh or qa_repl.sh
melvin_register "qa" "$QA_SRC/melvin_manifest.json"
```

### Manifest Format
```json
{
  "module": "qa",
  "version": "1.0",
  "description": "Question & Answer system with AI engines",

  "data_sources": [
    {
      "type": "flat_files",
      "pattern": "$QA_DIR/db/*.answer",
      "id_field": "unix_epoch",
      "refresh_strategy": "watch_directory"
    }
  ],

  "schema": {
    "measures": {
      "tokens": {
        "type": "integer",
        "description": "Token count for query",
        "source": "extract_tokens"
      },
      "cost": {
        "type": "decimal",
        "description": "Dollar cost of query",
        "source": "calculate_cost"
      },
      "response_time": {
        "type": "decimal",
        "description": "Response time in seconds",
        "source": "extract_timing"
      },
      "queries": {
        "type": "count",
        "description": "Number of queries",
        "source": "count_records"
      }
    },

    "dimensions": {
      "timestamp": {
        "type": "datetime",
        "source": "filename_epoch",
        "hierarchy": ["year", "month", "day", "hour", "minute"]
      },
      "engine": {
        "type": "categorical",
        "source": "extract_engine",
        "values": ["gpt-4", "gpt-3.5-turbo", "claude-3"]
      },
      "context": {
        "type": "categorical",
        "source": "extract_context",
        "description": "Query context/domain"
      },
      "tags": {
        "type": "multi_categorical",
        "source": "read_tags_file",
        "description": "User-applied tags"
      },
      "user": {
        "type": "categorical",
        "source": "system_user",
        "description": "System user who made query"
      }
    }
  },

  "extractors": {
    "extract_tokens": "jq -r '.usage.total_tokens // 0' $QA_DIR/db/$ID.response",
    "calculate_cost": "calculate_openai_cost $QA_DIR/db/$ID.response",
    "extract_engine": "jq -r '.model' $QA_DIR/db/$ID.data",
    "extract_context": "head -1 $QA_DIR/db/$ID.prompt | infer_context",
    "read_tags_file": "cat $QA_DIR/db/$ID.tags 2>/dev/null || echo ''"
  },

  "indexes": [
    {
      "name": "by_date",
      "dimensions": ["timestamp"],
      "refresh": "hourly"
    },
    {
      "name": "by_engine_date",
      "dimensions": ["engine", "timestamp"],
      "refresh": "daily"
    }
  ]
}
```

## Event Logging Protocol

### Event Registration
```bash
melvin_log_event() {
    local module="$1"
    local event_type="$2"
    local event_id="$3"
    local metadata="$4"  # JSON string

    local timestamp=$(date +%s)

    # Log to MELVIN's event stream
    echo "$timestamp|$module|$event_type|$event_id|$metadata" >> $MELVIN_DIR/events.log

    # Trigger incremental indexing
    melvin_schedule_index_update "$module" "$event_id"
}
```

### QA Integration Example
```bash
# In q_gpt_query function (qa.sh:163)
echo "$answer" > "$db/$id.answer"
echo "$answer" # Always output the final answer to stdout

# Add MELVIN integration (non-invasive)
if command -v melvin_log_event >/dev/null 2>&1; then
    melvin_log_event "qa" "query_completed" "$id" "{\"tokens\":$total_tokens,\"cost\":$cost}"
fi
```

## Data Source Protocol

### File-Based Data Sources

**Directory Watching:**
```bash
# MELVIN watches for new files
melvin_watch_directory() {
    local module="$1"
    local directory="$2"
    local pattern="$3"

    # Use inotify/fswatch to detect new files
    fswatch "$directory" | while read event; do
        if [[ "$event" =~ $pattern ]]; then
            melvin_index_file "$module" "$event"
        fi
    done
}
```

**Incremental Updates:**
```bash
# Only index new/changed files since last update
melvin_incremental_index() {
    local module="$1"
    local last_update=$(cat $MELVIN_DIR/index/$module.last_update 2>/dev/null || echo 0)

    # Find files newer than last update
    find "$data_dir" -name "*.answer" -newer "$last_update" | while read file; do
        melvin_index_file "$module" "$file"
    done

    # Update timestamp
    date +%s > $MELVIN_DIR/index/$module.last_update
}
```

### Cross-Module Data Sharing

**Context Propagation:**
```bash
melvin_share_context() {
    local source_module="$1"
    local target_module="$2"
    local context_data="$3"

    # Store cross-module context
    echo "$context_data" > $MELVIN_DIR/shared_context/${source_module}_to_${target_module}.json
}
```

**Reference Tracking:**
```bash
# Track relationships between module data
melvin_add_reference() {
    local source_module="$1"
    local source_id="$2"
    local target_module="$3"
    local target_id="$4"
    local relationship="$5"  # "triggered_by", "related_to", "caused_by"

    echo "$source_module:$source_id -> $target_module:$target_id ($relationship)" >> $MELVIN_DIR/references.log
}
```

## Query Routing Protocol

### Domain Resolution
```bash
melvin_resolve_domain() {
    local query="$1"

    # Check for explicit domain prefix (qa.tokens, git.commits)
    if [[ "$query" =~ ^([^.]+)\. ]]; then
        echo "${BASH_REMATCH[1]}"
    else
        # Use default domain or infer from context
        echo "${MELVIN_DEFAULT_DOMAIN:-qa}"
    fi
}
```

### Query Execution Routing
```bash
melvin_execute_query() {
    local domain="$1"
    local query="$2"

    # Load domain schema
    local schema_file="$MELVIN_REGISTRY_DIR/$domain.json"

    # Generate execution plan
    local execution_plan=$(melvin_plan_query "$schema_file" "$query")

    # Execute query
    melvin_run_plan "$execution_plan"
}
```

## Storage Protocol

### Directory Structure
```
~/.melvin/
├── registry/
│   ├── qa.json              # Module manifests
│   ├── git.json
│   └── deploy.json
├── index/
│   ├── qa/
│   │   ├── by_date.idx      # Pre-built indexes
│   │   ├── by_engine.idx
│   │   └── flat_data.tsv    # Flattened data cache
│   └── git/
├── events.log               # Cross-module event stream
├── references.log           # Cross-module relationships
└── shared_context/          # Context shared between modules
```

### Index Format
```bash
# by_engine.idx format: engine|count|sum_tokens|sum_cost|avg_response_time
gpt-4|150|45000|12.50|2.3
gpt-3.5-turbo|300|60000|8.75|1.8
claude-3|75|22500|15.00|3.1
```

## Module Integration Patterns

### Non-Invasive Integration (Recommended)
```bash
# Existing tool works unchanged
source qa.sh

# Optional MELVIN integration
if [[ -f "$MELVIN_DIR/melvin.sh" ]]; then
    source "$MELVIN_DIR/melvin.sh"
    melvin_register "qa" "$QA_SRC/melvin_manifest.json"
fi
```

### REPL Integration
```bash
# Enhanced REPL with MELVIN capabilities
qa_repl() {
    # Standard QA REPL functionality
    source qa.sh

    # Add MELVIN commands if available
    if command -v melvin >/dev/null; then
        # Add analytics commands to completion
        complete -W "$(qa_commands) $(melvin commands)" qa_repl
    fi

    # REPL loop with dual command dispatch
    while read -r -p "qa> " cmd; do
        if [[ "$cmd" =~ ^(tokens|cost|queries) ]]; then
            melvin qa.$cmd  # Route to MELVIN
        else
            eval "$cmd"     # Standard QA command
        fi
    done
}
```

### Cross-Module Commands
```bash
# Commands that span multiple modules
melvin_cross_module_cmd() {
    case "$1" in
        "context")
            # Set context across all registered modules
            for module in $(melvin list_modules); do
                ${module}_set_context "$2"
            done
            ;;
        "status")
            # Show status across all modules
            for module in $(melvin list_modules); do
                echo "=== $module ==="
                ${module}_status
            done
            ;;
    esac
}
```

## Protocol Benefits

### For Module Developers
- **Standard interface** - One protocol works for all analytical needs
- **Non-invasive** - Existing tools work unchanged
- **Incremental** - Add analytics capabilities gradually
- **Cross-module** - Automatic integration with other MELVIN-enabled tools

### For Users
- **Unified query language** - Same syntax works across all tools
- **Cross-system insights** - Analyze relationships between tools
- **Progressive enhancement** - Analytics get better as more modules integrate
- **Consistency** - Same mental model for all tool analytics

## Implementation Roadmap

### Phase 1: Core Protocol
1. Registry system for module manifests
2. Basic event logging infrastructure
3. Simple flat file indexing

### Phase 2: QA Integration
1. QA module manifest
2. Non-invasive QA logging integration
3. Basic dimensional queries on QA data

### Phase 3: Cross-Module Features
1. Context sharing between modules
2. Cross-module reference tracking
3. Unified analytics dashboard

The protocol design ensures MELVIN can grow from simple single-module analytics to sophisticated cross-system insights while maintaining backward compatibility and ease of integration.

## Next Steps

Understanding the protocol prepares you for:
- **[Storage Architecture](storage-architecture.md)** - How the protocol maps to flat file storage
- **[QA Integration](qa-integration.md)** - Concrete example of protocol implementation
- **[Implementation Notes](implementation-notes.md)** - Technical details and trade-offs