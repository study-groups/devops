# TSM - Tetra Service Manager

Native process management for bash, Python, and Node.js applications with PM2-style functionality.

## Quick Start

```bash
# Source tetra first
source ~/tetra/tetra.sh

# TSM is auto-loaded, or load manually
source "$TETRA_SRC/bash/tsm/includes.sh"

# Start processes - ports auto-allocated!
tsm start python -m http.server       # Auto-allocates port (tries 8000)
tsm start python server.py            # Auto-allocates port
tsm start node server.js              # Auto-allocates port (tries 3000)
tsm start bash worker.sh              # No port needed, uses socket

# Manage processes
tsm list                              # Show running processes with types
tsm logs 0                            # View logs (by TSM ID)
tsm stop devpages                     # Stop by name
tsm restart 0                         # Restart by ID
tsm delete devpages                   # Remove process tracking

# Diagnostics
tsm doctor                            # Port diagnostics
tsm doctor healthcheck                # Environment validation
tsm_list_port_allocations             # Show allocated ports
tsm_ipc_list_channels                 # Show IPC channels
```

## Table of Contents

- [Commands](#commands)
- [Starting Processes](#starting-processes)
- [Process Naming](#process-naming)
- [Environment Files](#environment-files)
- [Service Definitions](#service-definitions)
- [Diagnostics](#diagnostics)
- [Interactive Mode](#interactive-mode)
- [Configuration](#configuration)
- [For Developers](#for-developers)

---

## Commands

### Process Management

```bash
# List processes
tsm list                      # Running processes (default)
tsm list available            # All available services
tsm list all                  # All processes

# Start processes
tsm start <service-name>      # Start predefined service
tsm start <command>           # Start any command
tsm start --env dev server.js # Start with environment file
tsm start --port 4000 app.py  # Start with custom port
tsm start --name api node app # Start with custom name

# Stop/restart/delete
tsm stop <name|id>            # Stop process
tsm restart <name|id>         # Restart process
tsm delete <name|id>          # Remove process tracking
tsm kill <port|name|id|pid>   # Force kill process

# View logs
tsm logs <name|id>            # View logs
tsm logs <name|id> -f         # Follow logs (tail -f)
tsm logs <name|id> --lines 50 # Show last 50 lines

# Process information
tsm info <name|id>            # Show process details
tsm ports                     # Show port usage
tsm env                       # Show environment
```

### Diagnostics

```bash
# Health checks
tsm doctor healthcheck        # Validate TSM environment
tsm doctor                    # Scan ports for conflicts
tsm doctor port 4000          # Check specific port
tsm doctor orphans            # Find orphaned processes

# Cleanup
tsm cleanup                   # Remove dead processes
tsm doctor clean              # Clean stale tracking files
tsm doctor kill 4000          # Kill process using port
```

### Service Management

```bash
# Predefined services
tsm list available            # Show available services
tsm enable <service>          # Enable service for startup
tsm disable <service>         # Disable service
tsm show <service>            # Show service definition
```

---

## Smart Service Management

TSM intelligently classifies services and automatically handles port allocation and IPC setup:

### Automatic Port Allocation

When you start a service without specifying a port, TSM will:

1. **Check known patterns** - Matches command against registry of common services
2. **Use default port** - If available (e.g., `python -m http.server` → 8000)
3. **Allocate dynamically** - If default is busy, finds free port in range 8000-8999

```bash
# These all work without explicit ports:
tsm start python -m http.server     # Auto-allocates (tries 8000 first)
tsm start python server.py          # Auto-allocates from range
tsm start node server.js            # Auto-allocates (tries 3000 first)
```

### Service Classification

TSM automatically classifies services into types:

- **port** - Network services (HTTP servers, APIs)
- **socket** - Unix domain socket services (workers, daemons)
- **pid** - Simple process tracking (no network or socket)

Classification is based on:
1. Known patterns in `patterns.txt`
2. Port 0 in pattern = socket-based service

### Sockets for Non-Port Services

For services that don't use network ports, TSM provides Unix domain sockets:

```bash
# Start a worker - TSM creates socket automatically
tsm start bash worker.sh

# Check status via socket
tsm_socket_status "worker"

# Health check
tsm_socket_health "worker"
```

Socket protocol supports:
- STATUS - Query service state
- HEALTH - Health check ping/pong
- RELOAD - Reload configuration
- STOP - Graceful shutdown

## Starting Processes

TSM can start any process type automatically:

### Python Applications

```bash
# HTTP server
tsm start python -m http.server 8000

# Python app (auto-allocates port)
tsm start python run.py

# Python script with environment
tsm start --env prod python app.py
```

### Node.js Applications

```bash
# Node script
tsm start node server.js

# With port
tsm start --port 3000 node app.js

# npm/yarn
tsm start npm start
tsm start yarn dev
```

### Bash Scripts

```bash
# Any executable
tsm start ./my-script.sh

# With environment
tsm start --env dev ./server.sh
```

### Generic Commands

```bash
# Any command
tsm start "ruby server.rb -p 4000"
tsm start "go run main.go"
tsm start "php -S localhost:8080"
```

---

## Process Naming

TSM automatically generates descriptive names based on your directory and command:

```bash
# Running from ~/my-api directory
$ tsm start python -m http.server 8000
→ Process name: my-api-http-8000

$ tsm start python server.py 9000
→ Process name: my-api-server-9000

$ tsm start node app.js
→ Process name: my-api-app-3000

# Running from ~/projects/phasefield
$ tsm start python server.py
→ Process name: phasefield-server-5000

# Custom naming
$ tsm start --name backend python server.py
→ Process name: backend-8000
```

**Name resolution**: TSM accepts names, IDs, PIDs, or ports:

```bash
tsm stop my-api-http-8000     # By name
tsm stop 0                    # By TSM ID
tsm stop 12345                # By PID
tsm kill 8000                 # By port
```

---

## Environment Files

TSM supports environment file loading for configuration:

### Create Environment File

```bash
# Initialize template
tetra env init dev

# Edit with real values
edit env/dev.env
```

### Example Environment File

```bash
# env/dev.env
export PORT=4000
export NODE_ENV=development
export DB_HOST=localhost
export API_KEY=your-key-here
```

### Use with TSM

```bash
# Load environment before starting
tsm start --env dev server.js

# TSM will:
# 1. Source env/dev.env
# 2. Export all variables
# 3. Start process with environment loaded
```

### Environment File Discovery

TSM automatically looks for environment files in:
- `env/local.env`
- `env/dev.env`
- `env/production.env`
- `.env`

Use `--env <name>` to specify which one to load.

---

## Service Definitions

Define reusable services similar to Docker Compose:

### Create Service Definition

```bash
# File: $TETRA_DIR/tsm/services-available/myapp.tsm
SERVICE_NAME="myapp"
SERVICE_TYPE="python"
SERVICE_COMMAND="python run.py"
SERVICE_PORT="8000"
SERVICE_ENV="env/dev.env"
SERVICE_DIR="/path/to/app"
SERVICE_DESCRIPTION="My application server"
```

### Use Service

```bash
# Enable service
tsm enable myapp

# Start service by name
tsm start myapp

# List available services
tsm list available
```

---

## Diagnostics

### Port Conflicts

```bash
# Scan all development ports
$ tsm doctor
PORT   STATUS   TSM   PID      COMMAND
8000   USED     -     12345    python server.py
8999   USED     TSM   67890    python -m http.server

# Check specific port
$ tsm doctor port 8000
Port 8000 is in use
  PID:     12345
  Process: python
  Command: python server.py

This is NOT a TSM-managed process
  Use: tsm doctor kill 8000

# Kill process using port
$ tsm doctor kill 8000
```

### Orphaned Processes

```bash
# Find processes TSM lost track of
$ tsm doctor orphans
PID      TYPE       PORTS    COMMAND
12345    python     8000     python server.py
67890    node       3000     node server.js

These processes might be orphaned TSM processes
Actions:
  tsm doctor kill 8000    # Kill by port
  kill 12345              # Kill by PID
```

### Health Check

```bash
# Comprehensive environment validation
$ tsm doctor healthcheck
TSM Health Check
===================

Core Environment:
  [OK] TETRA_SRC=/Users/user/src/devops/tetra
  [OK] TETRA_DIR=/Users/user/tetra

TSM Runtime Variables:
  [OK] TSM_PROCESSES_DIR=/Users/user/tetra/tsm/runtime/processes
  [OK] TSM_LOGS_DIR=/Users/user/tetra/tsm/logs

Dependencies:
  [OK] lsof: installed
  [OK] jq: installed

Process Tracking:
  Tracked processes: 2
  [OK] No stale process files

Summary:
  All checks passed
```

### Cleanup

```bash
# Remove dead process tracking
tsm cleanup

# Clean stale tracking files
tsm doctor clean

# Aggressive cleanup (verifies ports match PIDs)
tsm doctor clean --aggressive
```

### Port Allocation Diagnostics

```bash
# List all port allocations
tsm_list_port_allocations

# Cleanup stale allocations
tsm_cleanup_port_allocations

# View port allocation range
tsm_get_port_range
# Output: 8000 8999
```

### IPC Diagnostics

```bash
# List all IPC channels
tsm_ipc_list_channels

# Test IPC channel
tsm_ipc_test_channel "myservice-worker"

# Cleanup stale IPC channels
tsm_ipc_cleanup_stale

# Manually send IPC command
tsm_ipc_send "myservice-worker" "STATUS"
```

### Service Classification

```bash
# Classify a command
tsm_get_service_info "python -m http.server"
# Output:
# Service Classification:
#   Type: port-based
#   Port Required: true
#   IPC Enabled: false
#   Default Port: 8000

# Validate classification
tsm_validate_classification "bash worker.sh"
```

---

## Interactive Mode

TSM includes an interactive REPL:

```bash
# Launch REPL
$ tsm repl

tsm> list
ID  Name                 Env        PID   Port  Status
0   devpages-http-8999   -          1234  8999  online

tsm> start python server.py
Started: myapp-server-8000 (TSM ID: 1, PID: 5678)

tsm> logs 1 -f
# Follows logs...

tsm> help
# Shows REPL commands

tsm> /history
# Shows command history
```

---

## Service Patterns Registry

TSM maintains a registry of known service patterns in `patterns.txt`:

### Built-in Patterns

Common services are pre-configured:
- Python: http.server
- Node: node
- Go: go run
- Bash: bash scripts

### Custom Patterns

Add to `$TETRA_DIR/tsm/patterns.txt`:

```txt
# name|match|port|template
myapp-server|./myapp server|9000|{cmd} --listen {port}
myapp-worker|./myapp worker|0|{cmd}
```

### Pattern Fields

- `name` - Pattern identifier
- `match` - Command pattern to match
- `port` - Default port (0 = socket-based)
- `template` - Command template ({cmd} = command, {port} = port)

---

## Configuration

### Global Configuration

TSM uses strong globals following CLAUDE.md conventions:

```bash
# Set by tetra.sh
TETRA_SRC="/Users/user/src/devops/tetra"  # Source code
TETRA_DIR="/Users/user/tetra"              # Runtime data

# TSM-specific
TSM_PROCESSES_DIR="$TETRA_DIR/tsm/runtime/processes"
TSM_LOGS_DIR="$TETRA_DIR/tsm/logs"
TSM_PIDS_DIR="$TETRA_DIR/tsm/pids"
```

### Module Conventions

```bash
MOD_SRC="$TETRA_SRC/bash/tsm"    # Module source
MOD_DIR="$TETRA_DIR/tsm"          # Module runtime

# Backward compatibility
TSM_SRC="$MOD_SRC"
TSM_DIR="$MOD_DIR"
```

---

## For Developers

### Function Naming Conventions

TSM uses a three-tier naming convention:

#### Public API Functions (`tetra_tsm_*`)
User-facing commands exposed through the `tsm` CLI:

```bash
tetra_tsm_start()        # CLI: tsm start
tetra_tsm_stop()         # CLI: tsm stop
tetra_tsm_list()         # CLI: tsm list
tetra_tsm_delete()       # CLI: tsm delete
tetra_tsm_doctor()       # CLI: tsm doctor
```

**Pattern**: `tetra_tsm_<command>`
**Exported**: Always (`export -f`)
**Use for**: Any function called directly by users via CLI

#### Utility Functions (`tsm_*`)
Internal helpers and shared utilities:

```bash
tsm_is_pid_alive()       # Check if PID is running
tsm_get_port_pid()       # Get PID using a port
tsm_json_success()       # Format JSON response
tsm_create_metadata()    # Create process metadata
tsm_discover_port()      # Auto-detect port from output
```

**Pattern**: `tsm_<description>`
**Exported**: Selectively (only if needed by other modules)
**Use for**: Shared utilities, helpers, data operations

#### Private Functions (`_tsm_*`)
Internal implementation details:

```bash
_tsm_start_process()         # Internal process spawning
_tsm_kill_by_port()          # Internal kill implementation
_tsm_json_escape()           # Internal JSON formatting
_tsm_init_global_state()     # Internal initialization
```

**Pattern**: `_tsm_<description>`
**Exported**: Never (module-local only)
**Use for**: Implementation details, private helpers

### Adding New Commands

1. Edit `bash/tsm/tsm.sh`
2. Add case to main `tsm()` function
3. Implement as `tetra_tsm_<command>()`

### Adding Service Definitions

1. Create file in `$TETRA_DIR/tsm/services-available/`
2. Define service variables (NAME, TYPE, COMMAND, PORT, etc.)
3. Enable with `tsm enable <service>`

### Running Tests

```bash
# Run all tests
bash bash/tsm/tests/run_all_tests.sh

# Run specific test
bash bash/tsm/tests/test_process_lifecycle.sh
```

### Documentation

- **[TSM_SPECIFICATION.md](./TSM_SPECIFICATION.md)** - Complete technical specification
- **[docs/reference/tsm/daemon-setup.md](../../docs/reference/tsm/daemon-setup.md)** - Systemd integration
- **[docs/reference/tsm/architecture-review.md](../../docs/reference/tsm/architecture-review.md)** - Architecture decisions
- **[docs/reference/tsm/testing.md](../../docs/reference/tsm/testing.md)** - Testing guide

---

## Module Structure

TSM follows [Tetra Module Convention 2.0](../../docs/Tetra_Module_Convention.md):

```bash
bash/tsm/
├── includes.sh              # Main entry point
├── tsm.sh                   # CLI implementation
├── actions.sh               # TUI integration
├── core/                    # Core functionality
├── process/                 # Process management
├── system/                  # Diagnostics & utilities
├── services/                # Service definitions
├── interfaces/              # REPL interface
├── integrations/            # External integrations
└── tests/                   # Test suite
```

---

## Troubleshooting

### Process Won't Start

```bash
# Check port conflicts
tsm doctor port 8000

# Validate environment file
tsm doctor env env/dev.env

# Check dependencies
tsm doctor healthcheck

# View startup logs
tsm logs <name> --lines 100
```

### Process Crashes Immediately

```bash
# Check logs for errors
tsm logs <name>

# Try running command manually
python run.py  # Does it work outside TSM?

# Check environment
tsm env  # Are variables set correctly?
```

### Port Already in Use

```bash
# Find what's using the port
tsm doctor port 8000

# Kill process using port
tsm doctor kill 8000

# Or use a different port
tsm start --port 8001 python server.py
```

### Orphaned Processes

```bash
# Find orphaned processes
tsm doctor orphans

# Kill specific orphan
tsm doctor kill 8000

# Clean up stale tracking
tsm doctor clean
```

---

## Integrations

- **[Caddy](docs/CADDY.md)** - Reverse proxy for `*.localhost` routing (`tsm caddy`)
- **systemd** - Linux service manager (`tsm daemon`)
- **nginx** - Web server integration

## Related Projects

- **PM2** - Node.js process manager (inspiration)
- **systemd** - Linux service manager (integration supported)
- **Caddy** - Fast, extensible reverse proxy
- **Tetra** - Parent project providing the ecosystem

---

## License

Part of the Tetra project. See main repository for license information.
