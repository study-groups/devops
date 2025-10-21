# TSM Reference - Tetra Service Manager

**Version:** 2.0 (PM2-style metadata with universal start)
**Last Updated:** 2025-10-18

This is the authoritative technical reference for TSM internals. For user documentation, see [README.md](./README.md).

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Module Structure](#module-structure)
3. [Naming Conventions](#naming-conventions)
4. [Public API](#public-api)
5. [Data Structures](#data-structures)
6. [Loading Sequence](#loading-sequence)
7. [Process Lifecycle](#process-lifecycle)
8. [Port Management](#port-management)

---

## Architecture Overview

TSM is a native process manager for the Tetra ecosystem, providing PM2-style functionality for bash scripts and Node.js applications.

### Design Principles

1. **Strong Globals** - Uses `TETRA_SRC` and `MOD_SRC` per CLAUDE.md conventions
2. **PM2-style Metadata** - JSON metadata in `$TSM_PROCESSES_DIR/process-name/meta.json`
3. **Port-based Naming** - Processes named as `basename-PORT`
4. **Universal Start** - Single entry point handles all process types
5. **Dependency-ordered Loading** - Modules loaded in 7 phases

### Directory Structure

```
$TETRA_SRC/bash/tsm/          # Source code (MOD_SRC)
├── core/                      # Core functionality (11 files)
├── system/                    # System utilities (7 files)
├── process/                   # Process management (4 files)
├── services/                  # Service definitions (3 files)
├── interfaces/                # User interfaces (1 file)
├── integrations/              # Third-party integrations (3 files)
├── tests/                     # Test suite (9 files)
└── archive/                   # Legacy code

$TETRA_DIR/tsm/               # Runtime data (MOD_DIR)
├── runtime/processes/         # Process directories
│   └── process-name/
│       ├── meta.json          # PM2-style metadata
│       ├── process-name.pid   # PID file
│       ├── current.out        # stdout
│       └── current.err        # stderr
├── logs/                      # Legacy logs (deprecated)
└── config/                    # Configuration files
```

---

## Module Structure

### Core Modules (11 files)

| File | Purpose | Key Functions |
|------|---------|---------------|
| `config.sh` | Global configuration, constants | `TSM_PROCESSES_DIR`, `TSM_LOGS_DIR` |
| `core.sh` | Core initialization | `_tsm_init_global_state()` |
| `environment.sh` | Environment file handling | `_tsm_load_environment()`, `_tsm_parse_env_file()` |
| `helpers.sh` | Utility helpers | `_tsm_validate_script()`, `_tsm_generate_process_name()` |
| `include.sh` | Module loader | Loads all modules in dependency order |
| `metadata.sh` | PM2-style JSON metadata | `tsm_create_metadata()`, `tsm_read_metadata()` |
| `runtime.sh` | Interpreter detection | `tsm_detect_type()`, `tsm_resolve_interpreter()` |
| `setup.sh` | Installation and setup | `tetra_tsm_setup()` |
| `start.sh` | **Universal start command** | `tsm_start_any_command()` |
| `utils.sh` | Utility functions | `tetra_tsm_get_next_id()`, `tetra_tsm_is_running()` |
| `validation.sh` | Validation and detection | `_tsm_auto_detect_env()`, `_tsm_validate_env_file()` |

### System Modules (7 files)

| File | Purpose | Key Functions |
|------|---------|---------------|
| `analytics.sh` | Usage analytics | `tsm_analyze_user_patterns()` |
| `audit.sh` | System auditing | `tsm_audit()`, `tsm_audit_init()` |
| `doctor.sh` | Diagnostics and troubleshooting | `tetra_tsm_doctor()`, `tsm_diagnose_startup_failure()` |
| `formatting.sh` | Output formatting | `_tsm_format_list_normal()`, `_tsm_format_list_compact()` |
| `monitor.sh` | Process monitoring | `tsm_monitor_process()` |
| `patrol.sh` | Cleanup and maintenance | `tsm_patrol()` |
| `ports.sh` | Port registry | `tsm_register_port()`, `tsm_get_port()` |
| `resource_manager.sh` | Resource tracking | Component resource management |
| `session_aggregator.sh` | Session analytics | Session data aggregation |

### Process Modules (4 files)

| File | Purpose | Key Functions |
|------|---------|---------------|
| `inspection.sh` | Process information | `tetra_tsm_info()`, `tetra_tsm_logs()` |
| `lifecycle.sh` | Start/stop/restart | `tetra_tsm_kill()`, `tetra_tsm_restart()` |
| `list.sh` | List processes | `tetra_tsm_list()` |
| `management.sh` | CLI entry points | `tetra_tsm_start()`, `tetra_tsm_stop()` |

### Services Modules (3 files)

| File | Purpose | Key Functions |
|------|---------|---------------|
| `definitions.sh` | Service definitions | `tetra_tsm_get_service()`, service registry |
| `registry.sh` | Service discovery | Service lookup and validation |
| `startup.sh` | Service startup | Service-specific startup logic |

### Interface Modules (1 file)

| File | Purpose | Key Functions |
|------|---------|---------------|
| `repl_v2.sh` | Interactive REPL | `tsm_repl()` - uses bash/repl framework |

### Integration Modules (3 files)

| File | Purpose | Key Functions |
|------|---------|---------------|
| `nginx.sh` | Nginx integration | Nginx configuration helpers |
| `systemd.sh` | Systemd integration | Systemd service generation |
| `tview.sh` | TView integration | TView action providers |

---

## Naming Conventions

TSM uses three function prefixes:

### `tetra_tsm_*` - Public API Functions

**User-facing commands** - These are the main entry points called from the `tsm` CLI.

```bash
tetra_tsm_start()         # Start a process
tetra_tsm_stop()          # Stop a process
tetra_tsm_restart()       # Restart a process
tetra_tsm_list()          # List processes
tetra_tsm_logs()          # View logs
tetra_tsm_info()          # Process information
tetra_tsm_kill()          # Kill a process
tetra_tsm_doctor()        # Run diagnostics
tetra_tsm_setup()         # Install/setup TSM
```

### `tsm_*` - Module-Specific Functions

**Internal module functions** - Specialized logic within modules.

```bash
tsm_start_any_command()   # Universal start (core/start.sh)
tsm_detect_type()         # Type detection (core/runtime.sh)
tsm_discover_port()       # Port discovery (core/start.sh)
tsm_create_metadata()     # Create JSON metadata (core/metadata.sh)
tsm_read_metadata()       # Read JSON metadata (core/metadata.sh)
tsm_register_port()       # Register port (system/ports.sh)
tsm_diagnose_startup_failure()  # Diagnose failures (system/doctor.sh)
tsm_is_pid_alive()        # Check PID (core/utils.sh)
tsm_process_exists()      # Check if process exists (core/start.sh)
```

### `_tsm_*` - Private/Internal Functions

**Helper functions** - Not intended for direct external use.

```bash
_tsm_init_global_state()  # Initialize globals
_tsm_validate_script()    # Validate script file
_tsm_auto_detect_env()    # Auto-detect environment
_tsm_load_environment()   # Load environment file
_tsm_json_escape()        # JSON string escaping
_tsm_format_list_normal() # Format process list
```

---

## Public API

### Core Commands

#### `tetra_tsm_start(process_or_command...)`
Start a process using the universal start system.

**Usage:**
```bash
tsm start devpages              # Start named service
tsm start node server.js        # Start command
tsm start --env local server.sh # Start with env file
```

**Flow:**
1. Parse arguments in `process/management.sh:tetra_tsm_start()`
2. Delegate to `core/start.sh:tsm_start_any_command()`
3. Detect type, resolve interpreter, discover port
4. Start process with `setsid`
5. Create PM2-style metadata
6. Register port in double-entry system

#### `tetra_tsm_stop(process_identifier)`
Stop a process by ID, name, or fuzzy match.

**Usage:**
```bash
tsm stop 0                      # By TSM ID
tsm stop devpages               # By exact name
tsm stop dev                    # Fuzzy match
```

#### `tetra_tsm_list([filter])`
List processes with status.

**Filters:**
- `running` - Running processes only (default)
- `all` - All processes (including stopped)
- `available` - Available service definitions

#### `tetra_tsm_logs(process_identifier, [options])`
View process logs.

**Options:**
- `--lines N` - Show last N lines
- `-f` - Follow logs in real-time
- `--nostream` - Don't stream

### Utility Functions

#### `tetra_tsm_get_next_id()`
Thread-safe ID allocation. Returns next available TSM ID (0, 1, 2...).

**Algorithm:**
1. Acquire exclusive lock on `.id_allocation_lock`
2. Scan `$TSM_PROCESSES_DIR/*/meta.json` for used IDs
3. Find lowest unused ID (handles gaps)
4. Create reservation placeholder
5. Release lock
6. Return ID

#### `tetra_tsm_is_running(process_name)`
Check if a process is running.

**Returns:** 0 if running, 1 if stopped

#### `tetra_tsm_resolve_to_id(input)`
Resolve user input to TSM ID.

**Supports:**
- Numeric ID: `0`, `1`, `2`
- Exact name: `devpages-3000`
- Fuzzy match: `dev` → finds `devpages-3000`

**Returns:** TSM ID or error if ambiguous

---

## Data Structures

### PM2-style Metadata (`meta.json`)

Location: `$TSM_PROCESSES_DIR/process-name/meta.json`

```json
{
  "tsm_id": 0,
  "name": "devpages-http-3000",
  "pid": 12345,
  "command": "/usr/bin/python3 -m http.server 3000",
  "port": 3000,
  "cwd": "/Users/user/devpages",
  "interpreter": "/usr/bin/python3",
  "process_type": "python",
  "env_file": "",
  "prehook": "",
  "start_time": 1729234567,
  "status": "online",
  "restarts": 0,
  "unstable_restarts": 0
}
```

**Field Descriptions:**
- `tsm_id` - Unique TSM process ID (0, 1, 2...)
- `name` - Process name (auto-generated: `{dirname}-{module}-{port}`)
- `pid` - Process ID
- `command` - Full command that was executed with resolved interpreter
- `port` - Port number (integer) or "none"
- `cwd` - Working directory where process was started
- `interpreter` - Resolved interpreter path (node, python3, etc.)
- `process_type` - Type of process (node, python, command, etc.)
- `env_file` - Environment file path (if used, otherwise empty string)
- `prehook` - Pre-execution hook command (if used, otherwise empty string)
- `start_time` - Unix timestamp of process start
- `status` - Process status ("online", "stopped", "crashed")
- `restarts` - Number of restarts (integer)
- `unstable_restarts` - Number of unstable restarts (integer)

**Smart Naming Examples:**
- `python -m http.server 8000` in `~/my-api` → `my-api-http-8000`
- `python server.py 9000` in `~/demos/test` → `test-server-9000`
- `node app.js 3000` in `~/backend` → `backend-app-3000`

### Process Directory Structure

```
$TSM_PROCESSES_DIR/devpages-3000/
├── meta.json              # PM2-style metadata
├── devpages-3000.pid      # PID file
├── current.out            # stdout stream
└── current.err            # stderr stream
```

### Port Registry

Location: `$TSM_PORTS_FILE` (flat file)

```bash
devpages:3000
api:4000
```

---

## Loading Sequence

Defined in `core/include.sh` - 7 phases with dependency ordering:

### Phase 1: Core Foundation
```bash
core/core.sh           # Core functions
core/config.sh         # Configuration
core/utils.sh          # Utility functions
core/validation.sh     # Validation
core/environment.sh    # Environment handling
core/helpers.sh        # Helper functions
core/setup.sh          # Setup utilities
core/metadata.sh       # PM2-style metadata
core/runtime.sh        # Interpreter resolution
core/start.sh          # Universal start
```

### Phase 2: System Modules
```bash
system/ports.sh              # Port registry
system/formatting.sh         # Output formatting
system/doctor.sh             # Diagnostics
system/patrol.sh             # Cleanup
system/analytics.sh          # Analytics
system/audit.sh              # Audit
system/monitor.sh            # Monitoring
system/resource_manager.sh   # Resource management
system/session_aggregator.sh # Session aggregation
```

### Phase 3: Service Modules
```bash
services/definitions.sh  # Service definitions
services/registry.sh     # Service registry
services/startup.sh      # Service startup
```

### Phase 4: Process Modules
```bash
process/inspection.sh    # Process info
process/lifecycle.sh     # Start/stop/restart
process/management.sh    # CLI commands
process/list.sh          # List commands
```

### Phase 5: Interface Modules
```bash
interfaces/repl_v2.sh    # Interactive REPL
```

### Phase 6: Integration Modules
```bash
integrations/nginx.sh    # Nginx integration
integrations/systemd.sh  # Systemd integration
integrations/tview.sh    # TView integration
```

### Phase 7: Initialize Global State
```bash
if declare -f _tsm_init_global_state >/dev/null; then
    _tsm_init_global_state
fi
```

---

## Process Lifecycle

### Start Flow

**Command:** `tsm start --env local node server.js`

**Call Stack:**

1. **`tsm.sh:64-71`** - `tsm()` function, case `start`
   - Calls `tetra_tsm_start "$@"`

2. **`process/management.sh:230-299`** - `tetra_tsm_start()`
   - Parse flags: `--env local`
   - Resolve env file: `local` → `env/local.env`
   - Collect command args: `[node, server.js]`
   - Check if first arg is known service (not in this case)
   - Delegate to `tsm_start_any_command()`

3. **`core/start.sh:54-240`** - `tsm_start_any_command()`
   - **Type Detection:** `tsm_detect_type("node server.js")` → `"command"`
   - **Interpreter Resolution:** `tsm_resolve_interpreter()` → `"node"`
   - **Port Discovery:** `tsm_discover_port()` → `"4444"` (from env/command)
   - **Name Generation:** `tsm_generate_process_name()` → `"node-4444"`
   - **Already Running Check:** `tsm_process_exists()` → false
   - **Get TSM ID:** `tetra_tsm_get_next_id()` → `0`
   - **Start Process:** `setsid bash -c "command" &`
   - **Wait:** `sleep 0.5`
   - **Verify PID:** Check PID file exists
   - **Verify Running:** `tsm_is_pid_alive()`
   - **Port Conflict Check:** If dead, check `lsof` for port conflict
   - **Create Metadata:** `tsm_create_metadata()` → `meta.json`
   - **Register Port:** `tsm_register_port()`

### Port Conflict Handling

If process dies immediately after start (`core/start.sh:195-220`):

1. Check if port diagnostic available: `command -v lsof`
2. Get PID using port: `lsof -ti :$port`
3. If port occupied:
   ```
   🔴 Port $port is already in use!
      Blocking process: PID $existing_pid
      Command: $process_cmd

   Solutions:
      • Stop the process: kill $existing_pid
      • Or use a different port in your config
      • Or use: tsm doctor
   ```
4. If no port conflict, show stderr: `tail -10 current.err`

### Stop Flow

**Command:** `tsm stop 0`

1. **Resolve Input:** `tetra_tsm_resolve_to_id("0")` → TSM ID `0`
2. **Get Name:** `tetra_tsm_id_to_name("0")` → `"devpages-3000"`
3. **Get Metadata:** Read `meta.json` for PID
4. **Kill Process:** `kill $pid`
5. **Wait:** Allow graceful shutdown
6. **Force Kill:** `kill -9 $pid` if still alive
7. **Cleanup:** Remove PID file, update metadata status

---

## Port Management

TSM uses a **double-entry port accounting system** (`core/ports_double.sh`):

### Registration

```bash
tsm_register_port "devpages" "3000"
```

**Creates:**
1. Entry in `$TSM_PORTS_FILE`: `devpages:3000`
2. Metadata in `meta.json`: `"port": "3000"`

### Lookup

```bash
tsm_get_port "devpages"      # Returns: 3000
tsm_get_process_by_port 3000 # Returns: devpages
```

### Port Discovery

Port discovered from (in order):
1. Explicit `--port` flag
2. `PORT` variable in environment file
3. `PORT=` assignment in command/script
4. Default: `"none"`

---

## Error Handling

### Common Error Patterns

**Script not found:**
```bash
tsm: 'script.sh' not found or not executable
```
Fix: `chmod +x script.sh`

**Port conflict:**
```bash
🔴 Port 3000 is already in use!
   Blocking process: PID 12345
```
Fix: `kill 12345` or use different port

**Ambiguous name:**
```bash
tsm: ambiguous name 'test', matches:
  0: test-server-3001
  1: test-client-3002
```
Fix: Use TSM ID or exact name

### Diagnostic Tools

**`tsm doctor`** - Run full diagnostics:
- Check setsid availability
- Verify directory structure
- Check permissions
- Analyze port conflicts

**`tsm doctor healthcheck`** - Quick validation

---

## Testing

Test suite location: `tests/`

**Key tests:**
- `test_id_allocation.sh` - ID allocation threading
- `test_metadata.sh` - PM2-style metadata
- `test_process_lifecycle.sh` - Start/stop/restart
- `test_start_any.sh` - Universal start command
- `test_ports.sh` - Port management
- `test_repl_v2.sh` - REPL functionality

**Run all tests:**
```bash
bash tests/run_all_tests.sh
```

---

## Migration Notes

### Deprecated Systems

- **Legacy REPL** - Replaced by `repl_v2.sh` (uses bash/repl framework)
- **Old Start System** - `tetra_tsm_start_command()` deprecated, use `tsm_start_any_command()`
- **Flat Metadata** - Old `.meta` files replaced by PM2-style JSON
- **Legacy includes** - `include_minimal.sh` deleted, use `core/include.sh`

### Current Migration Status

✅ **Completed:**
- PM2-style metadata migration
- Universal start system
- REPL v2 migration
- Dead code cleanup (archived to `archive/legacy_20251017/`)

🚧 **In Progress:**
- Environment handling consolidation
- Complete removal of old start path (still present in `process/management.sh`)

---

## Development Guidelines

### Adding New Functionality

1. **Identify module** - Core, system, process, service, or integration?
2. **Follow naming convention** - `tetra_tsm_*` for API, `tsm_*` for internal, `_tsm_*` for private
3. **Update include.sh** - Add to correct loading phase
4. **Add tests** - Create test file in `tests/`
5. **Document** - Update this reference

### Code Review Checklist

- [ ] Uses strong globals (TETRA_SRC, MOD_SRC)
- [ ] Follows naming conventions
- [ ] Handles errors with clear messages
- [ ] Includes inline comments for complex logic
- [ ] Tested with test script
- [ ] No duplicate function definitions
- [ ] Exports public functions if needed

---

## References

- **User Guide:** [README.md](./README.md)
- **Tetra Conventions:** `../../docs/Tetra_Module_Convention.md`
- **Tests:** `tests/`
- **Examples:** See service definitions in `services/definitions.sh`

---

**End of Reference**
