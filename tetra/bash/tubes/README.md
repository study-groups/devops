# tubes - Terminal Networks via FIFOs

**Version:** 1.0
**TCS Version:** 3.0
**Status:** Stable

## Overview

The `tubes` module enables ad-hoc terminal networks using named FIFOs, allowing bash terminals to communicate via a simple message router. Designed for macOS Terminal.app and Linux terminals running Bash 5.2+ with `~/tetra/tetra.sh` sourced.

## Key Features

- **Named Endpoints**: Create TES endpoints (`@tube:name`) backed by FIFOs
- **Simple API**: Bash-friendly commands for terminal communication
- **Message Router**: Loose command router (designed to be replaced later)
- **TCS 3.0 Compliant**: Follows all tetra conventions
- **Discovery**: Auto-discover and cleanup stale tubes
- **Session Management**: Track active tubes and connections

## Architecture

```
Terminal 1                Router                Terminal 2
   |                        |                        |
   | tubes create term1     |                        |
   |----------------------->|                        |
   |                        |     tubes create term2 |
   |                        |<-----------------------|
   |                        |                        |
   | tubes send term2 "hi"  |                        |
   |----------------------->|                        |
   |                        | forward message        |
   |                        |----------------------->|
   |                        |                        | tubes receive term2
   |                        |                        | "hi"

FIFO Structure:
$TETRA_DIR/tubes/fifos/
  ├── term1.fifo         # Data channel
  ├── term1.control      # Control channel
  ├── term2.fifo
  ├── term2.control
  └── router-control.fifo
```

## Quick Start

### Basic Usage

```bash
# Terminal 1: Create a tube and listen
tubes create my-term "My terminal"
tubes listen my-term

# Terminal 2: Send a message
tubes send my-term "Hello from terminal 2!"
```

### Using the Router

```bash
# Terminal 1: Start router and create tubes
tubes router start
tubes create term1 "Terminal 1"
tubes listen term1

# Terminal 2: Create tube and route message
tubes create term2 "Terminal 2"
tubes route term1 "Message from term2"
```

## Commands

### Tube Management

```bash
# Create a tube
tubes create <name> [description]

# Destroy a tube
tubes destroy <name>

# List all tubes
tubes list

# Discover and cleanup stale tubes
tubes discover

# Cleanup all tubes
tubes cleanup
```

### Messaging

```bash
# Send message (direct)
tubes send <name> <message>

# Receive message (with timeout)
tubes receive <name> [timeout_seconds]

# Listen continuously
tubes listen <name> [callback_function]

# Route via router
tubes route <target> <message> [source]
```

### Router

```bash
# Start router daemon
tubes router start

# Stop router
tubes router stop

# Check router status
tubes router status
```

## TES Integration

Tubes are first-class TES endpoints:

```bash
# TES Symbol Pattern
@tube:<name>

# Examples
@tube:my-terminal
@tube:repl-main
@tube:worker-1
```

### Progressive Resolution

```
Symbol:     @tube:my-terminal
  ↓
Address:    $TETRA_DIR/tubes/fifos/my-terminal.fifo
  ↓
Channel:    FIFO (anonymous pipe)
  ↓
Connector:  fd (file descriptor)
  ↓
Handle:     Validated FIFO (exists and writable)
  ↓
Locator:    Full path to FIFO
  ↓
Binding:    write(FIFO) or read(FIFO)
  ↓
Plan:       echo "message" > $FIFO
```

## Advanced Usage

### Custom Message Handler

```bash
# Define custom handler
my_handler() {
    local tube_name="$1"
    local message="$2"

    echo "Received on $tube_name: $message"

    # Process message
    if [[ "$message" == "ping" ]]; then
        tubes send "sender" "pong"
    fi
}

# Use custom handler
tubes listen my-term my_handler
```

### Integration with Other Modules

```bash
# Send RAG query results to another terminal
rag query "What is tetra?" | tubes send monitor-term

# Route TSM process status
tsm status my-service | tubes route admin-term

# Broadcast to multiple tubes
for tube in term1 term2 term3; do
    tubes send "$tube" "Broadcast message"
done
```

## Implementation Details

### File Locations

```
$TETRA_SRC/bash/tubes/
├── tubes.sh              # Main entry point
├── tubes_paths.sh        # TCS 3.0 paths
├── tubes_core.sh         # Core FIFO operations
├── tubes_router.sh       # Message router
├── actions.sh            # TUI integration
├── includes.sh           # Module loader
└── profiles/
    └── default.conf      # Default configuration

$TETRA_DIR/tubes/
├── db/                   # Message history (optional)
├── config/
│   ├── registry.json     # Active tubes
│   └── router.pid        # Router process ID
├── fifos/                # FIFO files
├── logs/
│   └── router.log        # Router logs
```

### Registry Format

```json
{
  "tubes": {
    "my-terminal": {
      "name": "my-terminal",
      "description": "Main work terminal",
      "created_at": "1698765432",
      "pid": 12345,
      "tty": "/dev/ttys001",
      "fifo": "/Users/user/tetra/tubes/fifos/my-terminal.fifo",
      "control": "/Users/user/tetra/tubes/fifos/my-terminal.control"
    }
  }
}
```

## Security Considerations

1. **Local Only**: FIFOs are filesystem-based, local to the machine
2. **Permissions**: Respect UNIX file permissions on FIFOs
3. **No Authentication**: Tubes do not authenticate senders (by design)
4. **Trusted Network**: Assumes all terminals are controlled by the user

## Future Enhancements

This is a **simple router** designed to be replaced. Future possibilities:

- **Smart Routing**: Content-based routing, pub/sub patterns
- **Remote Tubes**: SSH tunnel integration for cross-machine communication
- **Message Queue**: Persistent message queues
- **Security**: Authentication and encryption
- **Protocol**: Structured message protocol (JSON, msgpack)
- **Multiplexing**: Multiple readers/writers on same tube

## TES Agent Extension

Tubes could be extended as a **TES Agent** for bash terminals:

```bash
# Bash Terminal as Agent Endpoint
@agent:bash:terminal-1
@agent:bash:terminal-2

# Agent Contract
bash.execute :: (command:string) → Result[stdout]
  where Effect[remote, log, db]

# Example
tubes route term2 "bash.execute:ls -la"
```

See `docs/TES_Bash_Agent_Extension.md` (proposed) for the full specification.

## Examples

### Example 1: Terminal Monitor

```bash
# Terminal 1: Monitor terminal
tubes create monitor "System monitor"
tubes listen monitor

# Terminal 2: Send system stats
while true; do
    uptime | tubes send monitor
    sleep 60
done
```

### Example 2: Build Notifications

```bash
# Terminal 1: Build terminal
tubes create build-status "Build notifications"

# Run build and notify
if npm run build; then
    tubes send build-status "✓ Build succeeded"
else
    tubes send build-status "✗ Build failed"
fi

# Terminal 2: Monitor builds
tubes listen build-status
```

### Example 3: REPL Communication

```bash
# Terminal 1: Main REPL
tubes create repl-main "Main REPL"
tubes router start

# Terminal 2: Helper REPL
tubes create repl-helper "Helper REPL"

# Send commands between REPLs
tubes route repl-helper "eval:result = calculate()"
tubes route repl-main "result=$result"
```

## Troubleshooting

### Tube creation fails

```bash
# Check permissions
ls -la "$TETRA_DIR/tubes/fifos/"

# Cleanup and retry
tubes cleanup
tubes create my-term
```

### Messages not delivered

```bash
# Check if tube exists
tubes list

# Check for readers
fuser "$TETRA_DIR/tubes/fifos/my-term.fifo"

# Try with router
tubes router start
tubes route my-term "test"
```

### Stale FIFOs

```bash
# Discover and cleanup
tubes discover

# Manual cleanup
tubes cleanup
```

## References

- [TES - Tetra Endpoint Specification](../../docs/INSTRUCTIONS_TES.md)
- [TES Agent Extension](../../docs/TES_Agent_Extension.md)
- [TCS 3.0 - Tetra Core Specification](../../docs/INSTRUCTIONS_CORE_SPECIFICATION.md)

## Version History

- **1.0** (2025-10-31) - Initial implementation
  - FIFO-based tube creation
  - Direct send/receive
  - Simple message router
  - Discovery and cleanup
  - TCS 3.0 compliance
