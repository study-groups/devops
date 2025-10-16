# TSM Refactor: Clean PM2-Inspired Design

## Current Problems

1. **Huge .env files** (58KB) - Full environment snapshots wasteful
2. **Flat log structure** - All logs mixed together in one directory
3. **TCS 3.0 confusion** - Good JSON format in wrong place (db/)
4. **No metadata** - Can't track restarts, status, uptime without parsing

## PM2-Inspired Solution

### Core Principle
**One process = One directory with everything related**

```
runtime/
└── processes/
    └── devpages-4000/           # One directory per process
        ├── meta.json            # Process metadata (small, essential info)
        ├── devpages-4000.pid    # PID file (symlink to runtime/pids/)
        ├── current.out          # Active stdout log
        ├── current.err          # Active stderr log
        ├── 2024-10-13-00.out    # Rotated logs
        └── env                  # Optional: env vars (if needed)
```

### Metadata Format (meta.json)

```json
{
  "tsm_id": 1,
  "name": "devpages-4000",
  "pid": 12345,
  "command": "node server.js",
  "cwd": "/home/user/devpages",
  "interpreter": "node",
  "port": 4000,

  "status": "online",
  "start_time": 1697234567,
  "restarts": 2,
  "unstable_restarts": 0,

  "env_file": "/path/to/local.env"
}
```

**Key points:**
- Small (< 500 bytes vs 58KB env dumps)
- Essential info only
- Easy to parse (jq)
- PM2-compatible structure

### Benefits

1. **Organization**: Everything for one process in one place
2. **Performance**: Small JSON files (not 58KB env dumps)
3. **PM2-like**: Familiar structure for users
4. **Log rotation**: Built-in with per-process directories
5. **Simple cleanup**: Delete one directory = remove process

### Migration Path

```bash
# Old structure
runtime/processes/python-8000.env    # 58KB
runtime/pids/python-8000.pid
runtime/logs/python-8000.out

# New structure
runtime/processes/python-8000/
├── meta.json           # ~400 bytes
├── python-8000.pid     # symlink → ../../pids/python-8000.pid
├── current.out
└── current.err
```

## Implementation Plan

### Phase 1: Core Structure (Day 1)
- Create `runtime/processes/NAME/` directories
- Generate `meta.json` on process start
- Update `tsm_start_any_command()` to write JSON
- Update `tsm ls` to read from process directories

### Phase 2: Log Organization (Day 2)
- Move logs into process directories
- Implement log rotation (size + time based)
- Add `tsm logs NAME` command

### Phase 3: Cleanup (Day 3)
- Update patrol to work with new structure
- Remove TCS 3.0 code (tsm_metadata.sh, tsm_paths.sh)
- Migrate existing processes automatically

### Phase 4: PM2 Features (Week 2)
- `tsm save/resurrect` - Process persistence
- `tsm monit` - Live monitoring
- `tsm describe NAME` - Detailed info

## File Changes

### New Files
```bash
bash/tsm/core/
  metadata.sh              # Simple JSON read/write (not TCS 3.0)

bash/tsm/logs/
  rotation.sh              # Log rotation logic
  stream.sh                # Log streaming (tail -f)

bash/tsm/persist/
  save.sh                  # Save process list
  resurrect.sh             # Restore processes
```

### Modified Files
```bash
bash/tsm/core/start.sh
  - Write meta.json on start (not TCS 3.0)
  - Create process directory
  - Redirect logs to process directory

bash/tsm/process/list.sh
  - Read from runtime/processes/NAME/meta.json
  - One jq call per process (not 5)

bash/tsm/system/patrol.sh
  - Clean process directories (not dual systems)
  - Check meta.json for stale processes
```

### Deleted Files
```bash
bash/tsm/tsm_metadata.sh     # TCS 3.0 complexity
bash/tsm/tsm_paths.sh        # TCS 3.0 path management
```

## Example Usage

```bash
# Start a process
$ tsm start "node server.js" --name myapp --port 3000

# Creates:
runtime/processes/myapp-3000/
├── meta.json
├── myapp-3000.pid → ../../pids/myapp-3000.pid
├── current.out
└── current.err

# List processes
$ tsm ls
ID  Name         PID    Port  Status   Uptime  Restarts
--  ------------ ------ ----- -------- ------- --------
1   myapp-3000   12345  3000  online   2h      0

# View logs
$ tsm logs myapp-3000
[streaming logs from current.out and current.err]

# Stop process
$ tsm stop myapp-3000
# Removes: runtime/processes/myapp-3000/
# Keeps: db/history/myapp-3000.jsonl (analytics)
```

## db/ for Analytics Only

```
db/
├── events/
│   └── 2024-10-13.jsonl    # {"time": 1697234567, "event": "start", "name": "myapp"}
├── metrics/
│   └── 2024-10-13.jsonl    # {"time": 1697234567, "name": "myapp", "cpu": 2.5, "mem": 450000}
└── history/
    └── myapp-3000.jsonl    # Full lifecycle: start, restarts, crashes, stop
```

**Purpose**: Query historical data, generate reports, analytics

## Code Simplification

### Before (Dual System)
```bash
# patrol.sh - 200+ lines handling TCS 3.0 + legacy
# list.sh - Separate implementations for each system
# 15 files referencing TSM_PROCESSES_DIR
```

### After (Unified)
```bash
# patrol.sh - 50 lines, single system
# list.sh - One implementation
# Centralized in runtime/processes/
```

**Reduction**: ~180 lines of duplicate code removed
