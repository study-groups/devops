# Tetra Services Manager (TSM)

## Introduction to TSM

The Tetra Services Manager (TSM) is a native process management system that provides lightweight, structured control over background services and applications. Unlike PM2 or systemd, TSM stores comprehensive metadata about each process and maintains detailed logs and environment state.

## TSM Data Architecture

### Directory Structure
```
$TETRA_DIR/tsm/
├── next_id              # Sequential ID counter
├── logs/               # Process output logs
│   ├── process-name.out
│   └── process-name.err
├── pids/               # Process ID files
│   └── process-name.pid
├── processes/          # Process metadata
│   ├── process-name.meta  # Process metadata
│   └── process-name.env   # Environment variables
└── .tsm_history        # TSM command history
```

### Process Metadata Format

Each process stores metadata in `processes/{name}.meta`:
```bash
script='entrypoints/devpages.sh' pid=71282 port=4001 start_time=1758318163 type=cli tsm_id=60 cwd='/Users/mricos/src/devops/devpages'
```

**Fields:**
- `script`: Command or script being executed
- `pid`: Current process ID
- `port`: Service port (if applicable)
- `start_time`: Unix timestamp of process start
- `type`: Process type (cli, service, daemon)
- `tsm_id`: Unique sequential identifier
- `cwd`: Working directory when started

### Environment Snapshot

Each process captures its complete environment in `processes/{name}.env`, including:

- **Tetra Environment**: `TETRA_DIR`, `TETRA_SRC`, module paths
- **Shell State**: All bash functions and variables
- **System Environment**: PATH, system variables, locale
- **Development Context**: Node.js versions, Python environments

This allows processes to be started with the exact environment that was active when TSM launched them.

## Process Lifecycle Management

### Starting Processes
```bash
tsm start script.sh --name myservice --port 3000
```

**TSM performs these steps:**
1. **Generates unique ID** from `next_id` counter
2. **Captures environment** to `{name}.env`
3. **Records metadata** to `{name}.meta`
4. **Starts process** using `setsid` for proper session management
5. **Stores PID** in `{name}.pid`
6. **Redirects output** to `logs/{name}.out` and `logs/{name}.err`

### Process Monitoring
```bash
tsm list           # Show all processes
tsm info <name>    # Show detailed process information
tsm logs <name>    # View process logs
```

### Process Control
```bash
tsm stop <name>    # Graceful shutdown (SIGTERM)
tsm restart <name> # Stop and restart with same environment
tsm delete <name>  # Stop and remove all process files
```

## Example: Managing a Development Server

### Starting a Service
```bash
$ tsm start entrypoints/devpages.sh --name devpages-dev --port 4001
Starting process: devpages-dev
Process started with PID: 71282, TSM ID: 60
```

### TSM Data Created
```bash
# Process metadata
$ cat $TETRA_DIR/tsm/processes/devpages-dev.meta
script='entrypoints/devpages.sh' pid=71282 port=4001 start_time=1758318163 type=cli tsm_id=60 cwd='/Users/mricos/src/devops/devpages'

# Environment snapshot (218+ variables captured)
$ wc -l $TETRA_DIR/tsm/processes/devpages-dev.env
     221 devpages-dev.env

# Log files created
$ ls $TETRA_DIR/tsm/logs/devpages-dev.*
devpages-dev.out
devpages-dev.err
```

### Monitoring the Service
```bash
# Check status
$ tsm info devpages-dev
Process: devpages-dev (ID: 60)
Status: ✓ Running (PID: 71282)
Script: entrypoints/devpages.sh
Port: 4001
Started: 2025-09-20 10:29:23
Working Dir: /Users/mricos/src/devops/devpages

# View recent logs
$ tsm logs devpages-dev --tail 20
[2025-09-20 10:29:24] Server starting on port 4001
[2025-09-20 10:29:24] Environment: development
[2025-09-20 10:29:25] ✅ Ready to accept connections
```

## Key Features

### Environment Fidelity
TSM captures the **complete shell environment** including:
- All loaded Tetra modules and their functions
- Node.js/Python version settings
- Custom PATH modifications
- Environment variables from development tools

### Process Isolation
- Each process runs in its own session via `setsid`
- Clean separation of stdout/stderr streams
- Independent working directories preserved

### Metadata Richness
Unlike simple PID managers, TSM stores:
- **When** processes started (timestamps)
- **Where** they were started (working directory)
- **How** they were configured (ports, arguments)
- **Complete environment context** for reproducible restarts

### Log Management
- **Separate streams**: stdout and stderr logged independently
- **Persistent storage**: logs survive process restarts
- **Easy access**: `tsm logs <name>` for immediate log viewing

## Integration with Tetra

TSM leverages the Tetra module system:
- **Module loading**: `tmod load tsm` enables TSM functionality
- **Environment integration**: Processes inherit loaded modules
- **Status reporting**: Uses Tetra's standardized status formatting
- **Interactive REPL**: `tsm repl` provides full TSM control interface

TSM represents Tetra's approach to native process management - lightweight, metadata-rich, and deeply integrated with the development environment context.