# Module Logging Integration Guide

**TCS 4.0 Compliant**
**Date:** 2025-10-18

This guide walks you through integrating the unified logging system into a Tetra module.

## Quick Start (5 Minutes)

```bash
# 1. Create your module logging wrapper
cd $TETRA_SRC/bash/mymodule
cp ../utils/module_log_template.sh mymodule_log.sh

# 2. Customize the wrapper (replace MODULE_NAME with mymodule)
sed -i '' 's/MODULE_NAME/mymodule/g' mymodule_log.sh

# 3. Source the wrapper in your module
echo "source \"\$TETRA_SRC/bash/mymodule/mymodule_log.sh\"" >> mymodule.sh

# 4. Add logging calls to your functions
# See examples below

# 5. Test it
mymodule_log_info "test" "integration" '{"status":"ok"}'
tetra_log_tail 1
```

## Step-by-Step Integration

### Step 1: Create Module Logging Wrapper

Copy the template and rename for your module:

```bash
cp bash/utils/module_log_template.sh bash/qa/qa_log.sh
```

### Step 2: Customize the Wrapper

Replace `MODULE_NAME` with your module name (lowercase):

**Find:**
```bash
MODULE_NAME_log() {
    tetra_log_event MODULE_NAME "$@"
}
```

**Replace with:**
```bash
qa_log() {
    tetra_log_event qa "$@"
}
```

**Tip:** Use sed for batch replacement:
```bash
sed -i '' 's/MODULE_NAME/qa/g' bash/qa/qa_log.sh
```

### Step 3: Add Module-Specific Logging Functions

Add domain-specific logging functions to your wrapper:

```bash
# Example: QA-specific logging
qa_log_test_run_try() {
    local test_name="$1"
    local test_count="${2:-0}"

    local metadata=$(jq -n --argjson count "$test_count" '{test_count: $count}')
    qa_log_try "test-run" "$test_name" "$metadata"
}

qa_log_test_run_success() {
    local test_name="$1"
    local passed="${2:-0}"
    local failed="${3:-0}"

    local metadata=$(jq -n \
        --argjson passed "$passed" \
        --argjson failed "$failed" \
        '{passed: $passed, failed: $failed}')

    qa_log_success "test-run" "$test_name" "$metadata"
}

qa_log_test_run_fail() {
    local test_name="$1"
    local error="${2:-unknown error}"

    local metadata=$(jq -n --arg error "$error" '{error: $error}')
    qa_log_fail "test-run" "$test_name" "$metadata"
}
```

### Step 4: Source the Wrapper

Add to your module's main file (e.g., `bash/qa/qa.sh`):

```bash
#!/usr/bin/env bash

# Load QA logging wrapper
QA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$QA_DIR/qa_log.sh"

# Rest of your module code...
```

### Step 5: Add Logging to Functions

#### Pattern 1: Try/Success/Fail Operations

```bash
qa_run_tests() {
    local test_suite="$1"

    # Log attempt
    qa_log_test_run_try "$test_suite" 10

    # Run tests
    local passed=0
    local failed=0

    if run_test_suite "$test_suite"; then
        passed=8
        failed=2
        qa_log_test_run_success "$test_suite" "$passed" "$failed"
        return 0
    else
        qa_log_test_run_fail "$test_suite" "test suite failed to run"
        return 1
    fi
}
```

#### Pattern 2: Info Events

```bash
qa_cache_check() {
    local result_file="$1"

    if [[ -f "$result_file" ]]; then
        qa_log_info "cache-check" "$(basename "$result_file")" '{"cached":true}'
        return 0
    else
        qa_log_info "cache-check" "$(basename "$result_file")" '{"cached":false}'
        return 1
    fi
}
```

#### Pattern 3: Debug Logging

```bash
qa_validate_config() {
    local config_file="$1"

    # Only log in debug mode
    if [[ $TETRA_LOG_LEVEL == "DEBUG" ]]; then
        qa_log_debug "validate" "$config_file" '{"valid":true}'
    fi

    validate_config "$config_file"
}
```

#### Pattern 4: Error Logging

```bash
qa_load_fixtures() {
    local fixture_dir="$1"

    if [[ ! -d "$fixture_dir" ]]; then
        qa_log_error "load-fixtures" "$fixture_dir" '{"error":"directory not found"}'
        return 1
    fi

    # Load fixtures...
}
```

### Step 6: Test Your Integration

```bash
# Enable verbose logging
export TETRA_LOG_LEVEL=DEBUG
export TETRA_LOG_CONSOLE=2

# Run a function with logging
qa_run_tests "unit-tests"

# Check the log
tetra_log_tail 10

# Query module logs
tetra_log_query_module qa | jq '.'

# Check for errors
qa_log_query_errors
```

## Real-World Examples

### Example 1: TSM Process Management

File: `bash/tsm/tsm_log.sh`

```bash
tsm_log_process_start_try() {
    local name="$1"
    local port="${2:-}"

    local metadata="{}"
    if [[ -n "$port" ]]; then
        metadata=$(jq -n --arg port "$port" '{port: $port}')
    fi

    tsm_log_try "start" "$name" "$metadata"
}

tsm_log_process_start_success() {
    local name="$1"
    local pid="$2"
    local port="${3:-}"

    local metadata
    if [[ -n "$port" ]]; then
        metadata=$(jq -n --arg pid "$pid" --arg port "$port" '{pid: $pid, port: $port}')
    else
        metadata=$(jq -n --arg pid "$pid" '{pid: $pid}')
    fi

    tsm_log_success "start" "$name" "$metadata"
}
```

**Usage in lifecycle.sh:**
```bash
tetra_tsm_start_python() {
    # ... setup code ...

    tsm_log_process_start_try "$name" "$port"

    # ... start process ...

    if tetra_tsm_is_running "$name"; then
        tsm_log_process_start_success "$name" "$pid" "$port"
        echo "tsm: started '$name' (PID: $pid)"
    else
        tsm_log_process_start_fail "$name" "process failed to start"
        return 1
    fi
}
```

### Example 2: RAG Query Logging

File: `bash/rag/rag_log.sh`

```bash
rag_log_query_try() {
    local query_hash="$1"
    local files_count="${2:-0}"
    local context_size="${3:-0}"

    local metadata=$(jq -n \
        --arg query_hash "$query_hash" \
        --argjson files_count "$files_count" \
        --argjson context_size "$context_size" \
        '{query_hash: $query_hash, files_count: $files_count, context_size: $context_size}')

    rag_log_try "query" "$query_hash" "$metadata"
}

rag_log_query_success() {
    local query_hash="$1"
    local agent="${2:-base}"
    local files_count="${3:-0}"
    local context_size="${4:-0}"

    local metadata=$(jq -n \
        --arg query_hash "$query_hash" \
        --arg agent "$agent" \
        --argjson files_count "$files_count" \
        --argjson context_size "$context_size" \
        '{query_hash: $query_hash, agent: $agent, files_count: $files_count, context_size: $context_size}')

    rag_log_success "query" "$query_hash" "$metadata"
}
```

**Usage:**
```bash
rag_submit_query() {
    local query="$1"
    local query_hash=$(echo "$query" | md5sum | cut -c1-8)

    rag_log_query_try "$query_hash" "$file_count" "$context_size"

    if submit_to_api "$query"; then
        rag_log_query_success "$query_hash" "$agent" "$file_count" "$context_size"
    else
        rag_log_query_fail "$query_hash" "API error"
        return 1
    fi
}
```

## Common Patterns

### Pattern: Conditional Logging

Only log in certain conditions:

```bash
myfunction() {
    # Only log if process is user-facing
    if [[ "$interactive" == "true" ]]; then
        mymodule_log_info "action" "item"
    fi
}
```

### Pattern: Silent Mode

Disable console output for background operations:

```bash
background_task() {
    # Save current setting
    local prev_console=$TETRA_LOG_CONSOLE

    # Disable console output
    export TETRA_LOG_CONSOLE=0

    mymodule_log_info "background" "task-123"
    # ... do work ...

    # Restore setting
    export TETRA_LOG_CONSOLE=$prev_console
}
```

### Pattern: Batch Operations

Log batch operations efficiently:

```bash
process_batch() {
    local items=("$@")

    mymodule_log_try "batch-process" "batch-$(date +%s)" \
        "{\"count\":${#items[@]}}"

    local success=0
    local failed=0

    for item in "${items[@]}"; do
        if process_item "$item"; then
            ((success++))
        else
            ((failed++))
            mymodule_log_error "process-item" "$item" '{"error":"failed"}'
        fi
    done

    mymodule_log_success "batch-process" "batch-$(date +%s)" \
        "{\"success\":$success,\"failed\":$failed}"
}
```

### Pattern: Timed Operations

Log operation duration:

```bash
slow_operation() {
    local start_time=$(date +%s)

    mymodule_log_try "slow-op" "operation-1"

    # ... do work ...

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    mymodule_log_success "slow-op" "operation-1" \
        "{\"duration_seconds\":$duration}"
}
```

## Metadata Best Practices

### Good Metadata

✅ **Structured and queryable:**
```bash
metadata='{"pid":1234,"port":3000,"retries":2}'
```

✅ **Relevant context:**
```bash
metadata='{"file_count":42,"total_size":1048576}'
```

✅ **Error details:**
```bash
metadata='{"error":"connection refused","host":"localhost","port":5432}'
```

### Bad Metadata

❌ **Unstructured strings:**
```bash
metadata='pid 1234 port 3000'  # Not JSON!
```

❌ **Too verbose:**
```bash
metadata='{"entire_config":{...1000 lines...}}'  # Bloats log
```

❌ **Sensitive data:**
```bash
metadata='{"password":"secret123"}'  # Security risk!
```

### Building Metadata Dynamically

Use `jq -n` to build JSON safely:

```bash
# Simple
metadata=$(jq -n --arg error "$error_msg" '{error: $error}')

# Multiple fields
metadata=$(jq -n \
    --arg file "$filename" \
    --argjson size "$file_size" \
    --argjson lines "$line_count" \
    '{file: $file, size: $size, lines: $lines}')

# Conditional fields
if [[ -n "$optional_field" ]]; then
    metadata=$(jq -n \
        --arg required "$required_val" \
        --arg optional "$optional_field" \
        '{required: $required, optional: $optional}')
else
    metadata=$(jq -n --arg required "$required_val" '{required: $required}')
fi
```

## Querying Your Module Logs

### Basic Queries

```bash
# All events for your module
mymodule_log_query

# Errors only
mymodule_log_query_errors

# Specific verb
mymodule_log_query_verb "process"

# Recent activity
mymodule_log_query | tail -20

# Count events
mymodule_log_query | wc -l
```

### Advanced Queries

```bash
# Success rate
total=$(mymodule_log_query | wc -l)
success=$(mymodule_log_query | jq -c 'select(.status=="success")' | wc -l)
echo "Success rate: $(($success * 100 / $total))%"

# Average metadata value
mymodule_log_query | jq '.metadata.duration_seconds' | \
    awk '{sum+=$1; count++} END {print sum/count}'

# Group by status
mymodule_log_query | jq -r '.status' | sort | uniq -c

# Find errors with specific metadata
mymodule_log_query_errors | jq 'select(.metadata.error | contains("timeout"))'
```

## Testing Your Integration

### Unit Tests

Create a test file: `bash/mymodule/tests/test_logging.sh`

```bash
#!/usr/bin/env bash

source "$TETRA_SRC/bash/mymodule/mymodule_log.sh"

test_logging_integration() {
    # Clear log
    rm -f "$TETRA_LOG_FILE"
    mkdir -p "$(dirname "$TETRA_LOG_FILE")"

    # Test basic logging
    mymodule_log_info "test" "item-1" '{"test":true}'

    # Verify log entry
    local entry=$(tetra_log_tail 1)
    echo "$entry" | jq -e '.module == "mymodule"' || {
        echo "FAIL: Module not set correctly"
        return 1
    }

    echo "PASS: Logging integration test"
}

test_logging_integration
```

### Integration Tests

```bash
test_end_to_end() {
    # Enable debug logging
    export TETRA_LOG_LEVEL=DEBUG
    export TETRA_LOG_CONSOLE=0  # Silent

    # Clear log
    rm -f "$TETRA_LOG_FILE"

    # Run your module function
    mymodule_process_items "item1" "item2" "item3"

    # Verify expected events
    local event_count=$(mymodule_log_query | wc -l)
    [[ $event_count -eq 4 ]] || {  # try + 3 successes
        echo "FAIL: Expected 4 events, got $event_count"
        return 1
    }

    # Verify no errors
    local error_count=$(mymodule_log_query_errors | wc -l)
    [[ $error_count -eq 0 ]] || {
        echo "FAIL: Unexpected errors: $error_count"
        return 1
    }

    echo "PASS: End-to-end logging test"
}
```

## Troubleshooting

### Logs Not Appearing

**Problem:** No entries in `tetra.jsonl`

**Solutions:**
1. Check log level: `echo $TETRA_LOG_LEVEL`
2. Verify log file path: `echo $TETRA_LOG_FILE`
3. Check permissions: `ls -la "$TETRA_LOG_FILE"`
4. Test manually: `tetra_log_info test test test '{}'`
5. Check wrapper is sourced: `type mymodule_log_info`

### Invalid JSON Errors

**Problem:** `jq` errors when querying logs

**Solutions:**
1. Validate metadata: `echo '{"test":true}' | jq -e .`
2. Escape special characters in metadata
3. Use `jq -n` to build metadata, don't construct strings
4. Check for trailing commas in metadata

### Console Output Not Colored

**Problem:** Console output is plain text

**Solutions:**
1. Check color enabled: `echo $TETRA_LOG_CONSOLE_COLOR`
2. Verify color module loaded: `type tetra_console_success`
3. Source color module: `source "$TETRA_SRC/bash/color/color.sh"`
4. Test manually: `tetra_console_success "test"`

### Log File Growing Too Large

**Problem:** `tetra.jsonl` is many GB

**Solutions:**
1. Enable rotation: `tetra_log_rotate`
2. Add rotation to cron: `0 * * * * tetra_log_rotate`
3. Lower log level: `export TETRA_LOG_LEVEL=INFO`
4. Archive old logs: `gzip tetra.jsonl.* `
5. Clean up: `find logs/ -name "*.gz" -mtime +90 -delete`

## Migration Checklist

Use this checklist when migrating an existing module:

- [ ] Create `<module>_log.sh` wrapper from template
- [ ] Customize wrapper (replace MODULE_NAME)
- [ ] Add module-specific logging functions
- [ ] Source wrapper in module main file
- [ ] Identify all operational events to log
- [ ] Replace echo statements with log calls
- [ ] Add try/success/fail pattern to operations
- [ ] Build metadata with `jq -n` (not string concatenation)
- [ ] Test logging with DEBUG level
- [ ] Verify logs appear in `tetra.jsonl`
- [ ] Test query functions
- [ ] Update module documentation
- [ ] Remove old logging code
- [ ] Update tests to use new logging

## Next Steps

After integration:

1. **Monitor logs**: Use `tetra_log_tail` to watch events
2. **Analyze patterns**: Query logs for success rates, errors
3. **Create dashboards**: Build monitoring scripts
4. **Set up alerts**: Watch for error patterns
5. **Document usage**: Update module README with logging examples
6. **Share queries**: Create module-specific query helpers

## Additional Resources

- **TCS 4.0 Standard**: `docs/TCS_4.0_LOGGING_STANDARD.md`
- **Unified Log API**: `bash/utils/unified_log.sh`
- **Module Template**: `bash/utils/module_log_template.sh`
- **TSM Example**: `bash/tsm/tsm_log.sh`
- **RAG Example**: `bash/rag/rag_log.sh`
- **Query Example**: `bash/tsm/tsm_logs_query.sh`

## Support

Questions? Check:
1. This guide
2. TCS 4.0 standard document
3. Example implementations (TSM, RAG)
4. Test with verbose mode: `TETRA_LOG_CONSOLE=2`

---

**Happy Logging! 📝**
