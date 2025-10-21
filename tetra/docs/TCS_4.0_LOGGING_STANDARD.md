# TCS 4.0 - Tetra Logging Standard

**Version:** 4.0
**Status:** Active
**Supersedes:** TCS 3.0
**Date:** 2025-10-18

## Overview

TCS 4.0 defines the unified logging standard for all Tetra modules. All operational events MUST be logged to a centralized JSONL file with structured metadata, enabling cross-module queries, analytics, and audit trails.

## Core Principles

1. **Single Source of Truth**: All modules log to `$TETRA_DIR/logs/tetra.jsonl`
2. **Structured Data**: JSON format enables programmatic analysis
3. **Log Levels**: DEBUG, INFO, WARN, ERROR for filtering
4. **Console Integration**: Optional colored console output
5. **Backward Compatible**: Existing logs preserved during migration

## Log File Location

```bash
TETRA_LOG_FILE=$TETRA_DIR/logs/tetra.jsonl
```

- **Format**: JSONL (one JSON object per line)
- **Encoding**: UTF-8
- **Permissions**: 644 (readable by user, writable by owner)
- **Rotation**: Automatic at 10MB (configurable)

## Log Entry Structure

### Required Fields

```json
{
  "timestamp": "2025-10-18T12:34:56Z",
  "module": "tsm",
  "verb": "start",
  "subject": "devpages-3000",
  "status": "success",
  "level": "INFO",
  "exec_at": "@local",
  "metadata": {}
}
```

### Field Definitions

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `timestamp` | string | ISO 8601 UTC timestamp | `2025-10-18T12:34:56Z` |
| `module` | string | Module name (lowercase) | `tsm`, `rag`, `qa`, `tmod` |
| `verb` | string | Action being performed | `start`, `stop`, `query`, `add` |
| `subject` | string | Target of the action | `devpages-3000`, `query-abc123` |
| `status` | string | Outcome of action | `try`, `success`, `fail`, `event`, `warn`, `error`, `debug` |
| `level` | string | Log level | `DEBUG`, `INFO`, `WARN`, `ERROR` |
| `exec_at` | string | Execution location | `@local`, `@remote`, hostname |
| `metadata` | object | Additional context (JSON) | `{"pid": 1234, "port": 3000}` |

### Status Values

| Status | Meaning | Level | Usage |
|--------|---------|-------|-------|
| `try` | Operation starting | INFO | Start of operation |
| `success` | Operation succeeded | INFO | Successful completion |
| `fail` | Operation failed | ERROR | Failed operation |
| `event` | Informational event | INFO | Generic event |
| `warn` | Warning condition | WARN | Non-critical issue |
| `error` | Error occurred | ERROR | Error condition |
| `debug` | Debug information | DEBUG | Verbose debugging |

### Log Levels

| Level | Priority | Use Case |
|-------|----------|----------|
| DEBUG | 0 | Detailed debugging information |
| INFO | 1 | Normal operational events |
| WARN | 2 | Warning conditions |
| ERROR | 3 | Error conditions |

**Level Filtering**: Set `TETRA_LOG_LEVEL` to minimum level to log (e.g., `TETRA_LOG_LEVEL=WARN` logs only WARN and ERROR).

## API Functions

### Core Logging Function

```bash
tetra_log_event <module> <verb> <subject> <status> [metadata_json] [level]
```

**Example:**
```bash
tetra_log_event tsm start "devpages-3000" try '{"port":3000}' INFO
tetra_log_event tsm start "devpages-3000" success '{"pid":1234,"port":3000}' INFO
tetra_log_event tsm start "devpages-3000" fail '{"error":"port in use"}' ERROR
```

### Convenience Functions

```bash
# Try/Success/Fail pattern (INFO/ERROR levels)
tetra_log_try <module> <verb> <subject> [metadata]
tetra_log_success <module> <verb> <subject> [metadata]
tetra_log_fail <module> <verb> <subject> [metadata]

# Generic info event
tetra_log_info <module> <verb> <subject> [metadata]

# Log levels
tetra_log_debug <module> <verb> <subject> [metadata]
tetra_log_warn <module> <verb> <subject> [metadata]
tetra_log_error <module> <verb> <subject> [metadata]
```

**Example:**
```bash
tetra_log_try tsm start "devpages-3000"
tetra_log_success tsm start "devpages-3000" '{"pid":1234}'
tetra_log_fail tsm start "devpages-3000" '{"error":"port in use"}'
```

### Query Functions

```bash
# Query by module
tetra_log_query_module <module>

# Query by status
tetra_log_query_status <status>

# Query by level
tetra_log_query_level <level>

# Query by time range (ISO 8601)
tetra_log_query_range <start_time> <end_time>

# Query errors only
tetra_log_query_errors

# Query warnings and errors
tetra_log_query_issues

# Get last N entries
tetra_log_tail [n]

# Show statistics
tetra_log_stats
```

**Example:**
```bash
# All TSM events
tetra_log_query_module tsm

# All failures
tetra_log_query_status fail

# All errors
tetra_log_query_errors

# Events in last hour
start=$(date -u -v-1H +"%Y-%m-%dT%H:%M:%SZ")
end=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
tetra_log_query_range "$start" "$end"
```

## Module Integration

### Step 1: Create Module Logging Wrapper

Copy template from `bash/utils/module_log_template.sh` to `bash/<module>/<module>_log.sh` and customize:

```bash
cp bash/utils/module_log_template.sh bash/mymodule/mymodule_log.sh
# Replace MODULE_NAME with mymodule throughout file
```

### Step 2: Source Wrapper in Module

Add to module's main file:

```bash
# Load unified logging
source "${TETRA_SRC}/bash/mymodule/mymodule_log.sh"
```

### Step 3: Add Logging Calls

```bash
myfunction() {
    local item="$1"

    mymodule_log_try "process" "$item"

    if process_item "$item"; then
        mymodule_log_success "process" "$item" '{"result":"ok"}'
    else
        mymodule_log_fail "process" "$item" '{"error":"processing failed"}'
        return 1
    fi
}
```

### Module-Specific Functions

Create domain-specific logging functions in your module wrapper:

```bash
# Example: TSM process start
tsm_log_process_start_try() {
    local name="$1"
    local port="${2:-}"

    local metadata="{}"
    [[ -n "$port" ]] && metadata=$(jq -n --arg port "$port" '{port: $port}')

    tsm_log_try "start" "$name" "$metadata"
}
```

## Configuration

### Environment Variables

```bash
# Log file location (default: $TETRA_DIR/logs/tetra.jsonl)
export TETRA_LOG_FILE=/path/to/tetra.jsonl

# Minimum log level (default: INFO)
export TETRA_LOG_LEVEL=DEBUG  # DEBUG, INFO, WARN, ERROR

# Console output (default: 1)
export TETRA_LOG_CONSOLE=0  # 0=silent, 1=normal, 2=verbose

# Console colors (default: 1)
export TETRA_LOG_CONSOLE_COLOR=1  # 0=no color, 1=color

# Execution location (default: @local)
export TETRA_LOG_EXEC_AT=@remote  # or hostname
```

### Examples

```bash
# Enable debug logging
export TETRA_LOG_LEVEL=DEBUG

# Silent mode (file only, no console)
export TETRA_LOG_CONSOLE=0

# Verbose console mode (show status and metadata)
export TETRA_LOG_CONSOLE=2

# Disable color (for scripts/CI)
export TETRA_LOG_CONSOLE_COLOR=0
```

## Console Output Integration

### Color Mapping

Console output uses the color module (`bash/color/color.sh`):

| Status | Color | Function |
|--------|-------|----------|
| success, active, running | Green | `tetra_console_success` |
| fail, failed, error | Red | `tetra_console_error` |
| warn, warning | Yellow | `tetra_console_warn` |
| try, pending | Cyan | `tetra_console_info` |
| debug | Gray | `tetra_console_debug` |
| default | Blue | `tetra_console_log` |

### Console Format

**Normal mode** (`TETRA_LOG_CONSOLE=1`):
```
[12:34:56] tsm:start devpages-3000
```

**Verbose mode** (`TETRA_LOG_CONSOLE=2`):
```
[12:34:56] tsm:start devpages-3000 (success)
  metadata: {"pid":1234,"port":3000}
```

## Log Rotation

### Automatic Rotation

Logs automatically rotate when exceeding size threshold:

```bash
tetra_log_rotate [max_size_bytes]  # Default: 10485760 (10MB)
```

**Rotation process:**
1. Check if log file exceeds threshold
2. Move to timestamped archive: `tetra.jsonl.20251018_123456`
3. Compress archive: `tetra.jsonl.20251018_123456.gz`
4. Create new empty log file

### Manual Rotation

```bash
# Rotate if > 10MB
tetra_log_rotate

# Rotate if > 50MB
tetra_log_rotate 52428800
```

### Cleanup

```bash
# Remove archives older than 90 days
find "$TETRA_DIR/logs" -name "tetra.jsonl.*.gz" -mtime +90 -delete
```

## Best Practices

### DO

✅ **Log all operational events** (start, stop, create, delete, query, etc.)
✅ **Use try/success/fail pattern** for operations with success/failure outcomes
✅ **Include relevant metadata** (PIDs, ports, file paths, counts, etc.)
✅ **Use module wrappers** for consistent logging
✅ **Log to both file and console** for user-facing commands
✅ **Use appropriate log levels** (DEBUG for verbose, ERROR for failures)
✅ **Query logs for analytics** (success rates, performance, error tracking)

### DON'T

❌ **Don't use echo/printf** for operational logging
❌ **Don't mix log formats** in same module
❌ **Don't hard-code log paths** (use `$TETRA_DIR`)
❌ **Don't log sensitive data** (passwords, keys, tokens)
❌ **Don't create duplicate logging** (use unified system)
❌ **Don't ignore log levels** (respect `TETRA_LOG_LEVEL`)

### Logging Patterns

#### Pattern 1: Try/Success/Fail

```bash
myfunction() {
    local item="$1"

    mymodule_log_try "process" "$item"

    if do_something "$item"; then
        mymodule_log_success "process" "$item"
        return 0
    else
        mymodule_log_fail "process" "$item" '{"error":"failed"}'
        return 1
    fi
}
```

#### Pattern 2: Informational Events

```bash
myfunction() {
    mymodule_log_info "cache-check" "item-123" '{"cached":true}'
}
```

#### Pattern 3: Debug Logging

```bash
myfunction() {
    [[ $TETRA_LOG_LEVEL == "DEBUG" ]] && \
        mymodule_log_debug "validate" "config" '{"valid":true}'
}
```

#### Pattern 4: Error Logging

```bash
myfunction() {
    if [[ ! -f "$file" ]]; then
        mymodule_log_error "load" "$file" '{"error":"file not found"}'
        return 1
    fi
}
```

## Process-Specific Logging (TSM)

TSM has dual logging:

1. **Event Log** (unified): Lifecycle events in `tetra.jsonl`
2. **Process Output**: stdout/stderr in `$TSM_LOGS_DIR/<name>.{out,err}`

### Event Log (tetra.jsonl)

```json
{"timestamp":"2025-10-18T12:34:56Z","module":"tsm","verb":"start","subject":"devpages-3000","status":"try","level":"INFO","metadata":{"port":3000}}
{"timestamp":"2025-10-18T12:34:57Z","module":"tsm","verb":"start","subject":"devpages-3000","status":"success","level":"INFO","metadata":{"pid":1234,"port":3000}}
```

### Process Output (devpages-3000.out)

```
Server started on port 3000
Listening for connections...
```

### Query Combined Logs

```bash
# Event log only
tsm logs events

# Process output only
tsm logs devpages-3000

# Combined view
tsm logs combined devpages-3000
```

## Migration Guide

### Migrating Existing Modules

1. **Create logging wrapper**: Copy template to `<module>/<module>_log.sh`
2. **Source wrapper**: Add `source` line to module main file
3. **Replace echo statements**: Convert to `<module>_log_*` calls
4. **Add try/success/fail**: Wrap operations with logging
5. **Test logging**: Verify events appear in `tetra.jsonl`
6. **Update queries**: Use unified query functions

### Example Migration

**Before:**
```bash
echo "Starting server on port $port"
start_server "$port"
echo "Server started with PID $pid"
```

**After:**
```bash
mymodule_log_try "start" "server-$port" '{"port":'$port'}'
if start_server "$port"; then
    mymodule_log_success "start" "server-$port" '{"pid":'$pid',"port":'$port'}'
else
    mymodule_log_fail "start" "server-$port" '{"error":"startup failed"}'
fi
```

## Analytics and Monitoring

### Query Examples

```bash
# Success rate for TSM starts
total=$(tetra_log_query_module tsm | jq -c 'select(.verb=="start")' | wc -l)
success=$(tetra_log_query_module tsm | jq -c 'select(.verb=="start" and .status=="success")' | wc -l)
rate=$(echo "scale=2; $success * 100 / $total" | bc)
echo "TSM start success rate: $rate%"

# Find all port conflicts
tetra_log_query_errors | jq -c 'select(.metadata.error | contains("port"))'

# Process restart frequency
tetra_log_query_module tsm | jq -c 'select(.verb=="restart")' | \
    jq -r .subject | sort | uniq -c | sort -rn

# Average events per module
tetra_log_stats
```

### Monitoring Scripts

```bash
# Alert on errors
watch -n 60 'tetra_log_query_errors | tail -5'

# TSM health check
tsm logs stats | grep "Total Errors"

# Real-time event stream
tail -f "$TETRA_LOG_FILE" | jq -r '[.timestamp, .module, .verb, .subject, .status] | @tsv'
```

## Compliance Checklist

All modules MUST:

- [ ] Use unified logging (`tetra_log_event` or wrappers)
- [ ] Log to `$TETRA_DIR/logs/tetra.jsonl`
- [ ] Use structured JSON metadata
- [ ] Include required fields (timestamp, module, verb, subject, status, level)
- [ ] Use ISO 8601 UTC timestamps
- [ ] Respect `TETRA_LOG_LEVEL` filtering
- [ ] Provide module-specific wrapper (`<module>_log.sh`)
- [ ] Document logging in module README

## References

- **Unified Log**: `bash/utils/unified_log.sh`
- **Module Template**: `bash/utils/module_log_template.sh`
- **TSM Example**: `bash/tsm/tsm_log.sh`
- **RAG Example**: `bash/rag/rag_log.sh`
- **Color Module**: `bash/color/color.sh`
- **Query Interface**: `bash/tsm/tsm_logs_query.sh` (example)

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 4.0 | 2025-10-18 | Added log levels, console integration, query functions |
| 3.0 | 2025-10-15 | Initial unified logging (JSONL format) |

## Support

For questions or issues with logging:

1. Check this document for standards
2. Review example implementations (TSM, RAG)
3. Test with `TETRA_LOG_LEVEL=DEBUG` and `TETRA_LOG_CONSOLE=2`
4. Query logs with `tetra_log_query_*` functions
5. Report bugs with log evidence

---

**Effective Date:** 2025-10-18
**Maintained By:** Tetra Core Team
