# TSM Migration Plan: TCS 3.0 → PM2-Style Runtime System

## Overview
Migrate from dual-system (TCS 3.0 db/ + legacy runtime/) to unified PM2-inspired runtime/ system.

## Changes

### ✅ Keep (Legacy Runtime)
- `runtime/processes/` - Process metadata (upgrade to JSON)
- `runtime/pids/` - PID files
- `runtime/logs/` - Per-process log directories

### ❌ Remove (TCS 3.0)
- `active/` - Symlink index (unnecessary complexity)
- `db/*.tsm.meta` - Live process metadata in db/
- `tsm_paths.sh` TCS 3.0 functions
- `tsm_metadata.sh` JSON metadata management for live processes

### 🔄 Repurpose
- `db/` - Historical/analytics data only
  - `db/events/` - Process lifecycle events (start, stop, crash)
  - `db/metrics/` - Performance snapshots (CPU, memory)
  - `db/history/` - Long-term process history

## Migration Steps

### Phase 1: Update Process Metadata Format
```bash
# Old: runtime/processes/NAME.meta (key=value)
pid=12345
start_time=1697234567
port=4000

# New: runtime/processes/NAME.json
{
  "tsm_id": 1,
  "name": "devpages-4000",
  "pid": 12345,
  "start_time": 1697234567,
  "port": 4000,
  "status": "online",
  "restarts": 0,
  "logs": {
    "out": "/path/to/logs/devpages-4000/current.out",
    "err": "/path/to/logs/devpages-4000/current.err"
  }
}
```

### Phase 2: Implement Log Management
- Create per-process log directories
- Implement log rotation (size + time based)
- Add log streaming commands

### Phase 3: Clean Up TCS 3.0 Code
- Remove `active/` symlink management
- Remove `tsm_metadata.sh` (live tracking)
- Remove `tsm_activate()`/`tsm_deactivate()`
- Simplify `patrol.sh` (single system only)

### Phase 4: Add PM2-Style Features
- `tsm save/resurrect` - Process persistence
- `tsm logs` - Log streaming
- `tsm monit` - Live monitoring

## File Changes

### Delete
- `bash/tsm/tsm_metadata.sh` - TCS 3.0 metadata management
- `bash/tsm/tsm_paths.sh` - TCS 3.0 path functions (merge useful parts into config.sh)

### Modify
- `bash/tsm/core/start.sh` - Write JSON metadata instead of calling tsm_metadata_create
- `bash/tsm/process/list.sh` - Read JSON directly (no jq overhead)
- `bash/tsm/system/patrol.sh` - Remove TCS 3.0 cleanup logic

### Create
- `bash/tsm/logs/rotation.sh` - Log rotation logic
- `bash/tsm/logs/stream.sh` - Log streaming (tsm logs)
- `bash/tsm/persist/save.sh` - Process persistence (tsm save/resurrect)
- `bash/tsm/monitor/live.sh` - Live monitoring (tsm monit)

## Backwards Compatibility

### Automatic Migration
On first run after update, auto-migrate existing processes:

```bash
tsm_auto_migrate() {
    for meta in "$TSM_PROCESSES_DIR"/*.meta; do
        [[ -f "$meta" ]] || continue

        # Parse old format
        local name=$(basename "$meta" .meta)
        source "$meta"

        # Convert to JSON
        local json_file="${meta%.meta}.json"
        jq -n \
            --arg name "$name" \
            --arg pid "$pid" \
            --arg port "$port" \
            --arg start "$start_time" \
            '{
                tsm_id: ($pid | tonumber),
                name: $name,
                pid: ($pid | tonumber),
                port: ($port | tonumber),
                start_time: ($start | tonumber),
                status: "online",
                restarts: 0
            }' > "$json_file"

        # Remove old format
        rm "$meta"
    done
}
```

## Testing

1. Unit tests for JSON metadata read/write
2. Integration tests for log rotation
3. End-to-end tests for save/resurrect
4. Performance tests for `tsm ls` with 100+ processes

## Timeline

- **Week 1**: Implement JSON metadata + log rotation
- **Week 2**: Add PM2-style commands (logs, save, monit)
- **Week 3**: Clean up TCS 3.0 code, testing
- **Week 4**: Documentation, migration guide
