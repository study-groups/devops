# TPM - Tetra Process Manager

TPM is a lightweight, native process manager for the tetra ecosystem that provides an alternative to pm2. It preserves the essential PORT-based naming convention from pb while offering native bash process management without external dependencies.

## Overview

TPM manages long-running processes with automatic PORT detection and creates process names in the format `basename-PORT`. It provides cross-platform compatibility (macOS/Ubuntu) and integrates seamlessly with the tetra ecosystem.

## Installation

TPM is automatically available when tetra is sourced via bootstrap.sh. The module is located at `tetra/bash/tpm/tpm.sh`.

## Commands

### Basic Usage

```bash
# Show help
tpm
tpm help

# Start a process
tpm start <script.sh> [custom_name]

# List all processes  
tpm list
tpm ls

# Stop processes
tpm stop <process_name|*>

# Restart processes
tpm restart <process_name|*>

# View logs
tpm logs <process_name|*> [--lines N]

# Delete processes (stop + cleanup)
tpm delete <process_name|*>
tpm del <process_name|*>

# Show PORT mappings
tpm ports
```

## PORT Detection

TPM automatically detects PORT values in the following priority order:

1. **Environment variable**: `PORT=3000`
2. **Script file**: Lines containing `PORT=3000` or `export PORT=3000`

### Example Script

```bash
#!/usr/bin/env bash
# server.sh
export PORT=3000

echo "Starting server on port $PORT"
while true; do
  echo "Server heartbeat at $(date)"
  sleep 5
done
```

## Process Naming

Processes are automatically named using the pattern: `basename-PORT`

- `tpm start server.sh` → process name: `server-3000` (if PORT=3000)
- `tpm start api/web.sh webapp` → process name: `webapp-8080` (if PORT=8080)

## Examples

### Starting Processes

```bash
# Start with auto-detected PORT from script
tpm start server.sh
# → Creates process: server-3000

# Start with custom name
tpm start api/backend.sh api
# → Creates process: api-8080

# Start with environment PORT
PORT=9000 tpm start worker.sh
# → Creates process: worker-9000
```

### Managing Processes

```bash
# List all processes
tpm list
┌────────────────────┬─────────┬────────┬─────────┬──────────────────────┐
│ name               │ status  │ pid    │ port    │ uptime               │
├────────────────────┼─────────┼────────┼─────────┼──────────────────────┤
│ server-3000        │ online  │ 12345  │ 3000    │ 2h                   │
│ worker-9000        │ online  │ 12346  │ 9000    │ 1h                   │
└────────────────────┴─────────┴────────┴─────────┴──────────────────────┘

# Stop specific process
tpm stop server-3000

# Stop all processes
tpm stop "*"

# Restart specific process
tpm restart server-3000

# Restart all processes  
tpm restart "*"
```

### Viewing Logs

```bash
# Show recent logs (default 50 lines)
tpm logs server-3000

# Show specific number of lines
tpm logs server-3000 --lines 100

# Show logs for all processes
tpm logs "*"

# Follow logs in real-time
tpm logs server-3000 -f
```

### PORT Mappings

```bash
# Show all PORT mappings
tpm ports
Process: server, Port: 3000
Process: worker, Port: 9000
Process: api, Port: 8080
```

### Cleanup

```bash
# Delete specific process (stop + remove all traces)
tpm delete server-3000

# Delete all processes
tpm delete "*"
```

## Data Storage

TPM stores process data in `$TETRA_DIR/tpm/`:

```
$TETRA_DIR/tpm/
├── processes/     # Process metadata (.meta files)
├── logs/          # Process logs (.out/.err files)  
└── pids/          # Process PID files (.pid files)
```

### Process Metadata

Each process has a metadata file at `$TETRA_DIR/tpm/processes/name.meta`:

```bash
script=/path/to/server.sh pid=12345 port=3000 start_time=1694123456
```

### Log Files

- `$TETRA_DIR/tpm/logs/name.out` - Process stdout
- `$TETRA_DIR/tpm/logs/name.err` - Process stderr

## Cross-Platform Compatibility

TPM works on both macOS and Ubuntu:

- **macOS**: Uses `ps -p` for process detection
- **Linux**: Uses `/proc/<pid>` for process detection
- **Both**: Standard Unix signals (TERM/KILL) for process control

## Process Management Features

### Daemonization

TPM uses proper Unix daemonization:
- Double fork pattern with `setsid`
- Detachment from controlling terminal
- Background execution with log redirection

### Signal Handling

- **Graceful stop**: Sends TERM signal, waits 3 seconds
- **Force stop**: Sends KILL signal if process doesn't respond
- **Automatic cleanup**: Removes PID files and metadata

### Process Monitoring

- PID-based process tracking
- Cross-platform process existence checking
- Automatic detection of dead processes
- Uptime calculation and display

## Comparison with pb/pm2

| Feature | TPM | pb | pm2 |
|---------|-----|----|----|
| PORT naming | ✅ | ✅ | ❌ |
| Dependencies | None | pm2 | Node.js |
| Native tetra | ✅ | ❌ | ❌ |
| Cross-platform | ✅ | ✅ | ✅ |
| Process monitoring | Basic | Full | Full |
| Web UI | ❌ | ❌ | ✅ |
| Clustering | ❌ | ✅ | ✅ |

## Error Codes

- `64` - Invalid usage/arguments
- `65` - PORT detection failed
- `66` - Script not found or not executable
- `1` - General process management error

## Future Enhancements

TPM is designed to integrate with the future `tetra-4444` service for:
- Centralized process monitoring
- Web-based management interface
- Advanced restart policies
- Process clustering
- Integration with other tetra services

## Troubleshooting

### Common Issues

**PORT not detected:**
```bash
# Ensure script has PORT definition
grep -E "^(export )?PORT=" script.sh

# Or set environment variable
PORT=3000 tpm start script.sh
```

**Process won't start:**
```bash
# Check script permissions
chmod +x script.sh

# Check logs for errors
tpm logs process-name
```

**Process shows as stopped:**
```bash
# Check if process actually died
tpm list

# View logs for crash information
tpm logs process-name

# Delete and restart
tpm delete process-name
tpm start script.sh
```

## Integration with Tetra Ecosystem

TPM integrates with other tetra modules:
- Uses `$TETRA_DIR` for data storage
- Follows tetra naming conventions (`tetra_tpm_*` functions)
- Loads via tetra bootstrap system
- Compatible with tetra environment management