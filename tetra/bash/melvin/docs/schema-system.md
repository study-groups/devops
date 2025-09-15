# Schema System: Defining Queryable Dimensions

## Schema System Overview

The schema system is how modules declare their **queryable dimensions** and **measures** to MELVIN. It defines what analytics are possible and how to extract the necessary data from source files.

## Schema Philosophy

### Declarative Data Description
Instead of writing extraction code, modules **declare** what data they have:
- **Measures**: Numeric values that can be aggregated (tokens, cost, count)
- **Dimensions**: Categorical values used for grouping (engine, date, user)
- **Extractors**: Shell commands that know how to get values from source files

### Self-Documenting
The schema serves multiple purposes:
- **Query validation**: What dimensions/measures exist?
- **Execution planning**: How to extract needed data?
- **Documentation**: What analytics are available?
- **Auto-completion**: What can users type after "by"?

## Schema Structure

### Complete Schema Example
```json
{
  "module": "qa",
  "version": "1.0",
  "description": "Question & Answer system analytics",

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
        "unit": "count",
        "aggregation": ["count", "sum"],
        "extraction": "count_files"
      },
      "tokens": {
        "type": "integer",
        "description": "Token count for queries",
        "unit": "tokens",
        "aggregation": ["sum", "avg", "min", "max"],
        "extraction": "extract_tokens_from_response"
      },
      "cost": {
        "type": "decimal",
        "description": "Dollar cost of queries",
        "unit": "USD",
        "precision": 6,
        "aggregation": ["sum", "avg", "min", "max"],
        "extraction": "calculate_openai_cost"
      },
      "response_time": {
        "type": "decimal",
        "description": "Response time in seconds",
        "unit": "seconds",
        "aggregation": ["avg", "min", "max", "percentile"],
        "extraction": "calculate_response_time"
      }
    },

    "dimensions": {
      "timestamp": {
        "type": "datetime",
        "description": "When query was made",
        "extraction": "filename_to_epoch",
        "hierarchy": ["year", "quarter", "month", "week", "day", "hour", "minute"],
        "time_zone": "local"
      },
      "engine": {
        "type": "categorical",
        "description": "AI engine used",
        "extraction": "extract_engine_from_data",
        "cardinality": "low",
        "example_values": ["gpt-4", "gpt-3.5-turbo", "claude-3"]
      },
      "context": {
        "type": "categorical",
        "description": "Query context/domain",
        "extraction": "infer_context_from_prompt",
        "cardinality": "medium",
        "example_values": ["python", "devops", "debugging", "research"]
      },
      "user": {
        "type": "categorical",
        "description": "User who made query",
        "extraction": "echo $USER",
        "cardinality": "low",
        "privacy": "hash"
      },
      "tags": {
        "type": "multi_categorical",
        "description": "User-applied tags",
        "extraction": "read_tags_file",
        "cardinality": "high",
        "separator": " "
      },
      "success": {
        "type": "boolean",
        "description": "Whether query succeeded",
        "extraction": "check_answer_exists",
        "values": [true, false]
      }
    }
  },

  "extractors": {
    "extract_tokens_from_response": "jq -r '.usage.total_tokens // 0' ${QA_DIR}/db/${ID}.response 2>/dev/null || echo 0",
    "calculate_openai_cost": "jq -r '.usage | (.prompt_tokens * 0.00001) + (.completion_tokens * 0.00002)' ${QA_DIR}/db/${ID}.response 2>/dev/null || echo 0",
    "extract_engine_from_data": "jq -r '.model // \"unknown\"' ${QA_DIR}/db/${ID}.data 2>/dev/null || echo unknown",
    "infer_context_from_prompt": "head -1 ${QA_DIR}/db/${ID}.prompt | ~/src/bash/melvin/lib/classify_context.sh",
    "calculate_response_time": "stat -c %Y ${QA_DIR}/db/${ID}.response 2>/dev/null | awk -v start=${ID} '{print $1 - start}' || echo -1",
    "read_tags_file": "cat ${QA_DIR}/db/${ID}.tags 2>/dev/null || echo ''",
    "check_answer_exists": "test -s ${QA_DIR}/db/${ID}.answer && echo 1 || echo 0"
  },

  "indexes": [
    {
      "name": "by_date",
      "dimensions": ["timestamp"],
      "measures": ["queries", "tokens", "cost"],
      "granularity": "day",
      "refresh": "hourly"
    },
    {
      "name": "by_engine_date",
      "dimensions": ["engine", "timestamp"],
      "measures": ["queries", "tokens", "cost"],
      "granularity": "day",
      "refresh": "hourly"
    },
    {
      "name": "by_context",
      "dimensions": ["context"],
      "measures": ["queries", "tokens", "cost"],
      "refresh": "daily"
    }
  ]
}
```

## Data Types

### Measure Types

#### Numeric Types
```json
{
  "tokens": {
    "type": "integer",
    "min": 0,
    "max": 1000000,
    "aggregation": ["sum", "avg", "count", "min", "max"]
  },
  "cost": {
    "type": "decimal",
    "precision": 6,
    "min": 0.0,
    "aggregation": ["sum", "avg", "min", "max"]
  },
  "response_time": {
    "type": "decimal",
    "precision": 2,
    "unit": "seconds",
    "aggregation": ["avg", "min", "max", "percentile"]
  }
}
```

#### Count Types
```json
{
  "queries": {
    "type": "count",
    "description": "Number of records",
    "aggregation": ["count", "sum"]
  }
}
```

### Dimension Types

#### Categorical Dimensions
```json
{
  "engine": {
    "type": "categorical",
    "cardinality": "low",        // low (<20), medium (<200), high (>200)
    "example_values": ["gpt-4", "gpt-3.5-turbo"],
    "null_handling": "replace_with_unknown"
  }
}
```

#### Multi-Categorical Dimensions
```json
{
  "tags": {
    "type": "multi_categorical",
    "separator": " ",            // How multiple values are separated
    "max_values": 10,           // Maximum tags per record
    "cardinality": "high"
  }
}
```

#### Temporal Dimensions
```json
{
  "timestamp": {
    "type": "datetime",
    "format": "epoch",                    // epoch, iso8601, custom
    "hierarchy": ["year", "month", "day", "hour"],
    "time_zone": "local"
  },
  "date": {
    "type": "date",
    "format": "YYYY-MM-DD",
    "hierarchy": ["year", "quarter", "month", "week", "day"]
  }
}
```

#### Boolean Dimensions
```json
{
  "success": {
    "type": "boolean",
    "true_values": [true, 1, "true", "yes"],
    "false_values": [false, 0, "false", "no"],
    "null_handling": "exclude"
  }
}
```

## Extraction System

### Extractor Definition
Each dimension/measure specifies how to extract its value from source data:

```json
{
  "extractors": {
    "extract_tokens": "jq -r '.usage.total_tokens // 0' ${QA_DIR}/db/${ID}.response",
    "extract_engine": "jq -r '.model' ${QA_DIR}/db/${ID}.data",
    "infer_context": "classify_context < ${QA_DIR}/db/${ID}.prompt"
  }
}
```

### Extractor Variables
Available variables in extractor commands:
- `${ID}`: Record ID (Unix epoch timestamp)
- `${FILE}`: Full path to current file being processed
- `${MODULE}`: Module name
- `${QA_DIR}`, `${GIT_DIR}`, etc.: Module-specific directories

### Error Handling in Extractors
```bash
# Good: Handle missing files gracefully
"extract_tokens": "jq -r '.usage.total_tokens // 0' ${QA_DIR}/db/${ID}.response 2>/dev/null || echo 0"

# Good: Provide fallback values
"extract_engine": "jq -r '.model // \"unknown\"' ${QA_DIR}/db/${ID}.data 2>/dev/null || echo unknown"

# Good: Check file existence
"check_success": "test -s ${QA_DIR}/db/${ID}.answer && echo 1 || echo 0"
```

## Advanced Schema Features

### Calculated Measures
```json
{
  "calculated_measures": {
    "cost_per_token": {
      "formula": "cost / tokens",
      "type": "decimal",
      "precision": 8,
      "description": "Cost efficiency metric"
    },
    "queries_per_hour": {
      "formula": "queries / time_span_hours",
      "type": "decimal",
      "description": "Query rate"
    }
  }
}
```

### Dimension Hierarchies
```json
{
  "timestamp": {
    "type": "datetime",
    "hierarchy": {
      "year": "strftime('%Y', timestamp)",
      "quarter": "strftime('Q%q', timestamp)",
      "month": "strftime('%Y-%m', timestamp)",
      "week": "strftime('%Y-W%V', timestamp)",
      "day": "strftime('%Y-%m-%d', timestamp)",
      "hour": "strftime('%Y-%m-%d %H:00', timestamp)"
    }
  }
}
```

### Data Quality Rules
```json
{
  "quality_rules": {
    "tokens": {
      "min": 1,
      "max": 100000,
      "required": true
    },
    "cost": {
      "min": 0.0,
      "max": 1000.0,
      "correlation": {
        "with": "tokens",
        "min_r": 0.5,
        "description": "Cost should correlate with token usage"
      }
    }
  }
}
```

## Schema Validation

### Validation Rules
```bash
melvin_validate_schema() {
    local schema_file="$1"

    # Required fields
    jq -e '.module' "$schema_file" >/dev/null || error "Missing module name"
    jq -e '.schema.measures' "$schema_file" >/dev/null || error "No measures defined"
    jq -e '.schema.dimensions' "$schema_file" >/dev/null || error "No dimensions defined"

    # Valid extractor commands
    jq -r '.extractors | keys[]' "$schema_file" | while read extractor; do
        validate_extractor_syntax "$extractor" || error "Invalid extractor: $extractor"
    done

    # Dimension/measure references
    validate_references "$schema_file" || error "Invalid dimension/measure references"
}
```

### Schema Testing
```bash
melvin_test_schema() {
    local schema_file="$1"

    # Test extractors with sample data
    local test_id="1757806329"
    jq -r '.extractors | to_entries[] | "\(.key): \(.value)"' "$schema_file" | while IFS=': ' read name command; do
        echo "Testing $name..."
        result=$(eval "ID=$test_id; $command")
        echo "  Result: $result"
    done
}
```

## Schema Evolution

### Versioning Strategy
```json
{
  "module": "qa",
  "version": "1.1",
  "backward_compatible": true,
  "migration": {
    "from": "1.0",
    "changes": [
      "Added 'context' dimension",
      "Added 'cost_per_token' calculated measure"
    ],
    "migration_script": "migrate_qa_v1_0_to_v1_1.sh"
  }
}
```

### Schema Updates
```bash
melvin_update_schema() {
    local module="$1"
    local new_schema="$2"

    # Validate new schema
    melvin_validate_schema "$new_schema" || return 1

    # Check backward compatibility
    if ! check_backward_compatible "$module" "$new_schema"; then
        echo "Breaking changes detected. Manual migration required."
        return 1
    fi

    # Update schema
    cp "$new_schema" "$MELVIN_REGISTRY_DIR/$module.json"

    # Rebuild indexes with new schema
    melvin_rebuild_indexes "$module"
}
```

## Schema Best Practices

### 1. **Start Simple, Extend Gradually**
```json
// Version 1.0: Basic dimensions
{
  "dimensions": {
    "timestamp": {"type": "datetime"},
    "engine": {"type": "categorical"}
  }
}

// Version 1.1: Add context
{
  "dimensions": {
    "timestamp": {"type": "datetime"},
    "engine": {"type": "categorical"},
    "context": {"type": "categorical"}  // New dimension
  }
}
```

### 2. **Provide Rich Metadata**
```json
{
  "cost": {
    "type": "decimal",
    "description": "Dollar cost of OpenAI API calls",
    "unit": "USD",
    "precision": 6,
    "example": "0.003450"
  }
}
```

### 3. **Handle Missing Data Gracefully**
```json
{
  "extractors": {
    "safe_extraction": "jq -r '.field // \"unknown\"' file 2>/dev/null || echo unknown"
  }
}
```

### 4. **Consider Query Patterns**
```json
// Common query: tokens by engine by day
{
  "indexes": [
    {
      "name": "engine_day",
      "dimensions": ["engine", "timestamp"],
      "granularity": "day"
    }
  ]
}
```

### 5. **Document Extractors**
```json
{
  "extractors": {
    "extract_tokens": {
      "command": "jq -r '.usage.total_tokens // 0' ${QA_DIR}/db/${ID}.response 2>/dev/null || echo 0",
      "description": "Extract token count from OpenAI API response, default to 0 if missing",
      "depends_on": ["${ID}.response file exists"],
      "returns": "Integer token count or 0"
    }
  }
}
```

The schema system provides the foundation for MELVIN's dimensional analytics by declaratively specifying what data is available and how to access it. This enables automatic query validation, execution planning, and documentation generation.

## Next Steps

Understanding schemas prepares you for:
- **[Protocol Design](protocol-design.md)** - How schemas integrate with the module registration protocol
- **[Implementation Notes](implementation-notes.md)** - Technical details of schema processing
- **[Examples](examples.md)** - Real-world schema usage examples