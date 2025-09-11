# TSM - Tetra Service Manager

A native service manager for the tetra ecosystem that provides pm2-style functionality with enhanced service identification and management capabilities.

## Features

- **Sequential Process IDs**: Each process gets a unique incremental ID (0, 1, 2, etc.)
- **Flexible Process Resolution**: Reference processes by ID, exact name, or fuzzy matching
- **Cross-platform Support**: Works on macOS and Linux with proper daemonization
- **PM2-compatible Interface**: Familiar commands and log management
- **Port-based Naming**: Follows pb's convention: `basename-PORT`
- **Interactive REPL**: Built-in command interface with slash commands

## Installation & Setup

```bash
# Setup TSM environment (auto-runs on macOS when needed)
tsm setup

# Source TSM functions (add to your shell profile)
source "$TETRA_SRC/bash/tsm/tsm.sh"
```

## Basic Usage

### Starting Processes

```bash
# Start a shell script
tsm start server.sh                    # → server-3000 (if PORT=3000 in script)

# Start with custom name
tsm start server.sh myapp             # → myapp-3000

# Start with environment file
tsm start --env .env server.sh

# Start from ecosystem config
tsm start ecosystem.config.cjs
```

### Process Management

```bash
# List all processes with TSM IDs
tsm list
┌──────┬────────────────────┬─────────┬────────┬─────────┬──────────────────────┐
│ id   │ name               │ status  │ pid    │ port    │ uptime               │
├──────┼────────────────────┼─────────┼────────┼─────────┼──────────────────────┤
│ 0    │ server-3000        │ online  │ 12345  │ 3000    │ 5m                   │
│ 1    │ api-4000           │ online  │ 12346  │ 4000    │ 2m                   │
└──────┴────────────────────┴─────────┴────────┴─────────┴──────────────────────┘

# Stop processes
tsm stop 0                    # Stop by TSM ID
tsm stop server-3000          # Stop by exact name
tsm stop server               # Stop by fuzzy match
tsm stop "*"                  # Stop all processes

# Restart processes
tsm restart 1                 # Restart by TSM ID
tsm restart api               # Restart by fuzzy match

# Delete processes (stop + cleanup)
tsm delete 0                  # Delete by TSM ID
tsm delete "*"                # Delete all processes
```

### Flexible Process Resolution

TSM supports three ways to reference processes:

1. **TSM ID** (numeric): `tsm logs 0`
2. **Exact name**: `tsm logs server-3000`
3. **Fuzzy matching**: `tsm logs server` (matches server-3000)

When multiple processes match a fuzzy pattern:
```bash
$ tsm stop test
tsm: ambiguous name 'test', matches:
  0: test_server-3001
  1: test_client-3002
```

### Log Management

```bash
# View logs by ID, name, or fuzzy match
tsm logs 0                           # By TSM ID
tsm logs server-3000                 # By exact name
tsm logs server                      # By fuzzy match

# PM2-style log options
tsm logs 0 --lines 50 --nostream     # Show last 50 lines, no streaming
tsm logs server --lines 100          # Show last 100 lines with context
tsm logs api -f                      # Follow logs in real-time

# View all process logs
tsm logs "*"
```

### Port Management

```bash
# Show port mappings
tsm ports
Process: server, Port: 3000
Process: api, Port: 4000
```

## Interactive REPL

Start an interactive session with enhanced commands:

```bash
tsm repl
```

### REPL Commands

```bash
# Built-in commands
/help, /?         Show help
/exit, /quit      Exit REPL
/list             List all processes  
/kill <process>   Kill/delete process
/last [n]         Show last command output
/ps               Show system processes
/disk             Show disk usage
/mem              Show memory usage
/env              Show environment variables

# TSM commands (without prefix)
start [--env env.sh] <script> [name]
stop <process|id|*>
restart <process|id|*>
list, ls
logs <process|id> [--lines N]

# Bash commands
!<command>        Execute bash command (e.g. !ls, !ps)

# Special
<empty>           Show process list
```

## File Structure

```
$TETRA_DIR/tsm/
├── logs/           # Process log files
│   ├── server-3000.out
│   ├── server-3000.err
│   └── api-4000.out
├── pids/           # Process ID files
│   ├── server-3000.pid
│   └── api-4000.pid
├── processes/      # Process metadata
│   ├── server-3000.meta
│   └── api-4000.meta
├── next_id         # TSM ID counter
└── repl_history.log # REPL command history
```

## Process Metadata

Each process stores metadata in `.meta` files:

```bash
script=/path/to/server.sh pid=12345 port=3000 start_time=1757566677 type=cli tpm_id=0
```

## Script Requirements

Scripts must define a PORT variable:

```bash
#!/usr/bin/env bash
export PORT=3000  # Required for TSM naming

echo "Server starting on port $PORT"
# ... your application code
```

## Ecosystem Config

TSM supports PM2-style ecosystem configs:

```javascript
// ecosystem.config.cjs
module.exports = {
  apps: [{
    name: 'myapp',
    script: 'server.js',
    cwd: '/path/to/app',
    env: {
      PORT: 3000,
      NODE_ENV: 'production'
    },
    out_file: './logs/out.log',
    error_file: './logs/error.log'
  }]
}
```

## Testing

Run the test suites:

```bash
# Test TSM ID functionality
./tetra/bash/tsm/tests/test_tsm_id.sh

# Test log rotation
./tetra/bash/tsm/tests/test_log_rotate.sh
```

## Comparison with PM2

| Feature | TSM | PM2 |
|---------|-----|-----|
| Process IDs | ✅ Sequential (0,1,2...) | ✅ Sequential |
| Fuzzy matching | ✅ Built-in | ❌ Name only |
| Native shell scripts | ✅ First-class | ⚠️ Via ecosystem |
| Cross-platform | ✅ macOS/Linux | ✅ All platforms |
| Log management | ✅ Built-in rotation | ✅ Advanced |
| Memory usage | ✅ Lightweight | ⚠️ Node.js overhead |
| Tetra integration | ✅ Native | ❌ External |

## Advanced Usage

### Environment Variables

```bash
# TSM uses these environment variables
TETRA_DIR="/Users/user/tetra"        # TSM data directory
TETRA_SRC="/Users/user/src/tetra"    # TSM source directory
```

### macOS Setup

TSM automatically handles macOS-specific requirements:

```bash
# Installs util-linux for setsid support
brew install util-linux

# TSM automatically adds to PATH when needed
```

### Process Naming Convention

TSM follows the pattern: `{basename}-{PORT}`

- `server.sh` with `PORT=3000` → `server-3000`
- `api.sh` with `PORT=4000` → `api-4000`
- Custom name: `tsm start server.sh myapp` → `myapp-3000`

## Error Handling

TSM provides detailed error messages:

```bash
$ tsm start nonexistent.sh
tsm: 'nonexistent.sh' not found or not executable

$ tsm stop 99
tsm: process '99' not found

$ tsm start script_without_port.sh
tsm: PORT not set; no valid PORT= in script
```

## Log Rotation

Logs can be managed manually:

```bash
# Rotate logs by moving them
mv $TETRA_DIR/tsm/logs/server-3000.out $TETRA_DIR/tsm/logs/server-3000.out.$(date +%Y%m%d)

# Process will continue logging to new file automatically
```

## Integration Examples

### In Shell Scripts

```bash
#!/usr/bin/env bash
# deploy.sh

# Start application with TSM
tsm start app.sh production

# Wait for startup
sleep 2

# Check status
if tsm list | grep -q "production.*online"; then
    echo "Deployment successful"
else
    echo "Deployment failed"
    exit 1
fi
```

### In Makefiles

```makefile
start:
	tsm start server.sh

stop:
	tsm stop server

restart:
	tsm restart server

logs:
	tsm logs server --lines 100

status:
	tsm list
```

## Troubleshooting

### Common Issues

1. **setsid not found (macOS)**
   ```bash
   brew install util-linux
   tsm setup
   ```

2. **Process won't start**
   - Check script has execute permissions: `chmod +x script.sh`
   - Verify PORT is defined in script
   - Check logs: `tsm logs process-name`

3. **Fuzzy matching conflicts**
   - Use exact names or TSM IDs
   - Check available processes: `tsm list`

### Debug Mode

```bash
# View detailed process information
cat $TETRA_DIR/tsm/processes/process-name.meta

# Check process PID
cat $TETRA_DIR/tsm/pids/process-name.pid

# View raw logs
tail -f $TETRA_DIR/tsm/logs/process-name.out
```

## Contributing

TSM is part of the tetra ecosystem. Submit issues and PRs to the main tetra repository.

### Development

```bash
# Run tests
./tetra/bash/tsm/tests/test_tsm_id.sh
./tetra/bash/tsm/tests/test_log_rotate.sh

# Source for development
source tetra/bash/tpm/tpm.sh
```