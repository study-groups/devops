# tubes Quick Start Guide

Get started with terminal networks in under 5 minutes.

## Installation

The `tubes` module is part of tetra. If you have tetra installed, you already have tubes.

## Basic Usage

### 1. Two Terminal Communication

**Terminal 1 - Listener:**
```bash
# Load tetra
source ~/tetra/tetra.sh

# Create a tube and listen
tubes create term1 "Terminal 1"
tubes listen term1
```

**Terminal 2 - Sender:**
```bash
# Load tetra
source ~/tetra/tetra.sh

# Send a message
tubes send term1 "Hello from Terminal 2!"
```

You should see the message appear in Terminal 1.

### 2. Using the Router

The router enables many-to-many communication.

**Terminal 1:**
```bash
source ~/tetra/tetra.sh
tubes router start
tubes create alice "Alice's terminal"
tubes listen alice
```

**Terminal 2:**
```bash
source ~/tetra/tetra.sh
tubes create bob "Bob's terminal"
tubes listen bob
```

**Terminal 3:**
```bash
source ~/tetra/tetra.sh

# See all tubes
tubes list

# Send messages
tubes route alice "Hi Alice, from Terminal 3"
tubes route bob "Hi Bob, from Terminal 3"
```

### 3. Bash Agent Pattern

Run a terminal as an autonomous agent:

**Terminal 1 - Agent:**
```bash
source ~/tetra/tetra.sh
bash/tubes/tests/example_bash_agent.sh my-agent
```

**Terminal 2 - Controller:**
```bash
source ~/tetra/tetra.sh

# Execute commands remotely
tubes send my-agent "bash.execute:date"
tubes send my-agent "bash.execute:ls -la"
tubes send my-agent "bash.eval:\$((2 + 2))"
tubes send my-agent "bash.state"

# Shutdown agent
tubes send my-agent "bash.disconnect"
```

## Common Commands

```bash
# Tube management
tubes create <name> [description]    # Create a tube
tubes destroy <name>                 # Destroy a tube
tubes list                           # List all tubes
tubes cleanup                        # Remove all tubes

# Communication
tubes send <name> <message>          # Send message
tubes receive <name> [timeout]       # Receive message
tubes listen <name>                  # Listen continuously

# Router
tubes router start                   # Start router
tubes router stop                    # Stop router
tubes router status                  # Check status
tubes route <target> <msg>           # Route message
```

## Cleanup

When you're done:

```bash
# Clean up all tubes
tubes cleanup

# Stop router if running
tubes router stop
```

## Next Steps

- Read [bash/tubes/README.md](README.md) for complete documentation
- Try [example_router.sh](tests/example_router.sh) for interactive demo
- See [docs/TES_Bash_Agent_Extension.md](../../docs/TES_Bash_Agent_Extension.md) for agent patterns

## Troubleshooting

**"Tube not found"**
```bash
# Check if tube exists
tubes list

# Create it if needed
tubes create <name>
```

**"Message not delivered"**
```bash
# Ensure there's a listener
# In the target terminal:
tubes listen <name>
```

**"Router not running"**
```bash
# Start the router
tubes router start

# Check status
tubes router status
```

**Cleanup everything**
```bash
tubes cleanup
tubes router stop
rm -rf ~/tetra/tubes
```

## Support

For more help:
- `tubes help` - Built-in help
- `bash/tubes/README.md` - Complete documentation
- `bash/tubes/tests/` - Example scripts
