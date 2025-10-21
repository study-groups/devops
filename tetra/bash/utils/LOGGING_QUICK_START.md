# Unified Logging - Quick Start Guide

## For Module Developers

### 1. Create Module Logger (One-time Setup)

```bash
bash/utils/generate_module_log.sh mymodule
```

This creates `bash/mymodule/mymodule_log.sh` with all standard functions.

### 2. Source Logger in Your Module

In `bash/mymodule/mymodule.sh`:

```bash
# At top of file, after setting module paths
source "${MODULE_DIR}/mymodule_log.sh" 2>/dev/null || true
```

### 3. Use in Your Code

```bash
# Log operation attempts
mymodule_log_try "start" "service-name"

# Log successes with metadata
mymodule_log_success "start" "service-name" '{"pid":1234}'

# Log failures with error info
mymodule_log_fail "start" "service-name" '{"error":"port in use"}'

# Log informational events
mymodule_log_info "config-reload" "app-config" '{}'

# Log debug information (respects TETRA_LOG_LEVEL)
mymodule_log_debug "cache-hit" "query-123" '{"cached":true}'

# Log warnings
mymodule_log_warn "slow-operation" "database-query" '{"duration_ms":5000}'

# Log errors
mymodule_log_error "connection-failed" "database" '{"host":"localhost"}'
```

## Function Signatures

All module logger functions follow the same pattern:

```bash
module_log_<level>(verb, subject, metadata_json)
```

- **verb**: Action being performed (start, stop, load, parse, etc.)
- **subject**: Target of the action (service name, file path, etc.)
- **metadata_json**: JSON string with additional context (optional, defaults to `{}`)

## Log Levels

```bash
DEBUG   # Detailed debugging info (lowest priority)
INFO    # General informational events (default)
WARN    # Warning conditions
ERROR   # Error conditions (highest priority)
```

Set log level via environment:
```bash
export TETRA_LOG_LEVEL=DEBUG  # Show everything
export TETRA_LOG_LEVEL=INFO   # Default (skip DEBUG)
export TETRA_LOG_LEVEL=ERROR  # Only errors
```

## Console Output Control

```bash
# Console modes
export TETRA_LOG_CONSOLE=0  # Silent (file only)
export TETRA_LOG_CONSOLE=1  # Normal console (default)
export TETRA_LOG_CONSOLE=2  # Verbose console (shows metadata)

# Color control
export TETRA_LOG_CONSOLE_COLOR=1  # Colored (default)
export TETRA_LOG_CONSOLE_COLOR=0  # Plain text
```

## Querying Logs

### Module-specific queries (in module logger)

```bash
# All logs for your module
mymodule_log_query

# Only errors for your module
mymodule_log_query_errors

# Specific verb for your module
mymodule_log_query_verb "start"
```

### Global queries (in unified_log.sh)

```bash
# Any module
tetra_log_query_module tsm
tetra_log_query_module rag

# By status
tetra_log_query_status "fail"
tetra_log_query_status "success"

# By level
tetra_log_query_level "ERROR"
tetra_log_query_level "DEBUG"

# Last N entries
tetra_log_tail 50

# All errors
tetra_log_query_errors

# All warnings and errors
tetra_log_query_issues

# Time range (ISO 8601)
tetra_log_query_range "2025-10-18T00:00:00Z" "2025-10-18T23:59:59Z"

# Statistics
tetra_log_stats
```

## Log File Location

```bash
$TETRA_DIR/logs/tetra.jsonl
```

## Log Entry Format (JSONL)

Each log entry is a JSON object:

```json
{
  "timestamp": "2025-10-18T12:34:56Z",
  "module": "tsm",
  "verb": "start",
  "subject": "service-4444",
  "status": "success",
  "level": "INFO",
  "exec_at": "@local",
  "metadata": {
    "pid": 1234,
    "port": 4444
  }
}
```

## Best Practices

### 1. Always Include Metadata

Bad:
```bash
tsm_log_success "start" "service-4444"  # No context!
```

Good:
```bash
tsm_log_success "start" "service-4444" '{"pid":1234,"port":4444}'
```

### 2. Use Descriptive Verbs

Good verbs: `start`, `stop`, `load`, `parse`, `validate`, `connect`, `query`
Bad verbs: `do`, `run`, `execute` (too generic)

### 3. Use Specific Subjects

Bad:
```bash
module_log_try "process" "data"  # What data?
```

Good:
```bash
module_log_try "process" "user-upload-file.csv"
```

### 4. Log Try-Success-Fail Pairs

```bash
# Always log the attempt
tsm_log_try "start" "service-4444" '{"config":"production.toml"}'

if start_service; then
    # Log success with result data
    tsm_log_success "start" "service-4444" '{"pid":1234,"port":4444}'
else
    # Log failure with error details
    tsm_log_fail "start" "service-4444" '{"error":"port already in use"}'
fi
```

### 5. Use JSON for Metadata

Always use proper JSON strings:

Good:
```bash
# Use jq to build complex JSON
metadata=$(jq -n \
    --arg pid "$pid" \
    --arg port "$port" \
    '{pid: $pid, port: $port}')
module_log_success "start" "service" "$metadata"
```

Bad:
```bash
module_log_success "start" "service" "pid=$pid,port=$port"  # Not JSON!
```

## Common Patterns

### Pattern 1: Operation Lifecycle

```bash
operation_id="query-${RANDOM}"
rag_log_try "query" "$operation_id" '{"agent":"qa"}'

if result=$(execute_query); then
    rag_log_success "query" "$operation_id" \
        "{\"result_count\":$(echo "$result" | wc -l)}"
else
    rag_log_fail "query" "$operation_id" '{"error":"timeout"}'
fi
```

### Pattern 2: Configuration Loading

```bash
config_file="$TETRA_DIR/config/app.toml"
module_log_try "load-config" "$(basename "$config_file")"

if [[ -f "$config_file" ]]; then
    module_log_success "load-config" "$(basename "$config_file")" \
        "{\"path\":\"$config_file\"}"
else
    module_log_fail "load-config" "$(basename "$config_file")" \
        "{\"error\":\"file not found\",\"path\":\"$config_file\"}"
fi
```

### Pattern 3: Debug Logging with Conditionals

```bash
# This respects TETRA_LOG_LEVEL automatically
module_log_debug "cache-check" "item-$id" \
    "{\"cached\":$is_cached,\"ttl\":$ttl}"

# Only written if TETRA_LOG_LEVEL=DEBUG
```

## Troubleshooting

### Logs not appearing?

Check:
```bash
echo $TETRA_LOG_LEVEL      # Should be INFO or DEBUG
echo $TETRA_LOG_CONSOLE    # Should be 1 or 2
echo $TETRA_LOG_FILE       # Should point to valid path
ls -la "$TETRA_DIR/logs"   # Directory should exist
```

### Not seeing colors?

```bash
echo $TETRA_LOG_CONSOLE_COLOR  # Should be 1
type tetra_console_success     # Color module should be loaded
```

### Module logger not found?

```bash
# Did you generate it?
ls bash/mymodule/mymodule_log.sh

# Did you source it?
type mymodule_log_try  # Should show function definition
```

## Examples from Real Modules

### TSM (Service Manager)

```bash
source "${TSM_DIR}/tsm_log.sh"

# Process lifecycle
tsm_log_process_start_try "$name" "$port"
if pid=$(start_process); then
    tsm_log_process_start_success "$name" "$pid" "$port"
else
    tsm_log_process_start_fail "$name" "setsid not available"
fi
```

### RAG (Question-Answer)

```bash
source "${RAG_DIR}/rag_log.sh"

# Query tracking
rag_log_query_try "$query_hash" "$files_count" "$context_size"
if answer=$(run_query); then
    rag_log_query_success "$query_hash" "$agent" "$files_count" "$context_size"
else
    rag_log_query_fail "$query_hash" "API timeout"
fi
```

## Need Help?

- See full documentation: `docs/LOGGING_REFACTOR_SUMMARY.md`
- See TCS 4.0 spec: `docs/TCS_4.0_LOGGING_STANDARD.md`
- View unified_log code: `bash/utils/unified_log.sh`
- Generate new logger: `bash/utils/generate_module_log.sh <name>`
