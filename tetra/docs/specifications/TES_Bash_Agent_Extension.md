# TES Bash Agent Extension

**Version:** 1.0
**TCS Version:** 3.0
**Date:** 2025-10-31
**Status:** Proposed Extension

---

## References

- [Tetra Core Specification](Tetra_Core_Specification.md)
- [TES Agent Extension](TES_Agent_Extension.md)
- [TES SSH Extension](TES_SSH_Extension.md)

---

## Abstract

The TES Bash Agent Extension defines Bash terminals as autonomous agents within the Tetra system. This extension enables terminals to be **addressable endpoints** that can execute commands, maintain state, and participate in agent workflows via the `tubes` module.

This builds on the [TES Agent Extension](TES_Agent_Extension.md) by defining Bash-specific agent capabilities, lifecycle management, and integration patterns.

---

## 1. Motivation

### 1.1 Bash as an Agent Platform

Bash terminals are **ideal lightweight agents**:

| Property | Bash Terminal | Traditional Agent |
|----------|---------------|-------------------|
| **Setup** | Already running | Requires installation |
| **State** | Shell environment | Complex state management |
| **Interface** | STDIN/STDOUT/FIFO | Network protocols |
| **Trust** | User's own terminal | External process |
| **Latency** | Local IPC (microseconds) | Network (milliseconds) |

### 1.2 Use Cases

1. **REPL Networks**: Connect multiple REPLs for distributed computation
2. **Build Monitoring**: Terminals monitor build processes and notify
3. **Interactive Workflows**: User-in-the-loop agent workflows
4. **Development Tools**: Terminal-based pair programming, debugging
5. **Orchestration**: Lightweight process coordination without PM2/systemd

---

## 2. Agent Definition

### 2.1 Bash Agent Characteristics

**Definition**: A Bash Agent is a terminal with tetra loaded that can:

```
Bash Agent = Terminal + Tetra + Tubes + State
```

| Property | Description |
|----------|-------------|
| **Identity** | Unique tube name (`@tube:terminal-1`) |
| **Autonomy** | Can execute arbitrary bash commands |
| **State** | Shell environment variables, functions, history |
| **Communication** | FIFOs via `tubes` module |
| **Lifecycle** | Create, connect, execute, disconnect |

### 2.2 Agent vs Terminal

| Aspect | Terminal | Bash Agent |
|--------|----------|------------|
| **Purpose** | Interactive shell | Autonomous endpoint |
| **Identity** | TTY (e.g., `/dev/ttys001`) | Tube name (`@tube:term1`) |
| **Communication** | User input only | User + FIFO messages |
| **State** | Session-local | Shareable via tubes |
| **Discovery** | Not discoverable | Registered in tubes registry |

---

## 3. Agent Structure

### 3.1 TES Symbol Pattern

Bash agents are TES endpoints with this pattern:

```
@tube:<agent-name>

Examples:
@tube:terminal-1          # Generic terminal agent
@tube:repl-main           # Main REPL agent
@tube:build-monitor       # Build monitoring agent
@tube:worker-01           # Worker agent
```

### 3.2 Progressive Resolution

```
Symbol:     @tube:repl-main
  ↓
Address:    $TETRA_DIR/tubes/fifos/repl-main.fifo
  ↓
Channel:    FIFO (named pipe)
  ↓
Connector:  File descriptor (validated FIFO)
  ↓
Handle:     FIFO exists, writable, has reader
  ↓
Locator:    /Users/user/tetra/tubes/fifos/repl-main.fifo
  ↓
Binding:    write(message) to FIFO
  ↓
Plan:       echo "command" > $FIFO
```

---

## 4. Agent Lifecycle

### 4.1 Lifecycle Phases

Bash agents follow the standard TES Agent lifecycle:

```bash
# Phase 1: Initialize
bash_agent_init <name> [description]
  → Create tube endpoint
  → Register in tubes registry
  → Set up message handler
  → Return: agent_id

# Phase 2: Connect
bash_agent_connect
  → Start listening on FIFO
  → Load agent configuration
  → Initialize state
  → Return: status

# Phase 3: Execute
bash_agent_execute <command>
  → Parse command
  → Validate (safety checks)
  → Execute in subshell
  → Return: result

# Phase 4: Disconnect
bash_agent_disconnect
  → Stop listening
  → Save state
  → Return: status

# Phase 5: Cleanup
bash_agent_cleanup
  → Destroy tube
  → Clear state
  → Return: status
```

### 4.2 Implementation

```bash
# Initialize Bash agent
bash_agent_init() {
    local agent_name="$1"
    local description="${2:-Bash terminal agent}"

    # Create tube endpoint
    tubes create "$agent_name" "$description"

    # Register as agent
    tetra_register_agent "$agent_name" "bash"

    echo "Bash agent initialized: @tube:$agent_name"
}

# Connect and listen
bash_agent_connect() {
    local agent_name="$1"

    # Start listening with command handler
    tubes listen "$agent_name" bash_agent_command_handler &

    echo "Bash agent connected: @tube:$agent_name (PID: $!)"
}

# Command handler
bash_agent_command_handler() {
    local tube_name="$1"
    local message="$2"

    # Log
    echo "[$(date '+%H:%M:%S')] @tube:$tube_name: $message"

    # Parse command
    if [[ "$message" =~ ^bash\.execute:(.+)$ ]]; then
        local command="${BASH_REMATCH[1]}"
        bash_agent_execute "$command"
    elif [[ "$message" =~ ^bash\.eval:(.+)$ ]]; then
        local code="${BASH_REMATCH[1]}"
        bash_agent_eval "$code"
    else
        echo "Unknown command format: $message"
    fi
}
```

---

## 5. Agent Contracts

### 5.1 Core Contracts

All Bash agents MUST implement these contracts:

```bash
# Initialize agent
bash_agent.init :: (name:string, description:string) → AgentID
  where Effect[filesystem, state]

# Execute bash command
bash_agent.execute :: (command:string) → Result[stdout, stderr, exit_code]
  where Effect[process, log]

# Evaluate bash expression
bash_agent.eval :: (expression:string) → Result[value]
  where Effect[state]

# Get agent state
bash_agent.state :: () → State[environment]
  where Effect[read]

# Set agent state
bash_agent.set_state :: (key:string, value:string) → Status
  where Effect[state]

# Disconnect agent
bash_agent.disconnect :: () → Status
  where Effect[state, filesystem]
```

### 5.2 Extended Contracts

Optional capabilities:

```bash
# File operations
bash_agent.read_file :: (path:string) → Result[content]
  where Effect[filesystem]

bash_agent.write_file :: (path:string, content:string) → Status
  where Effect[filesystem]

# Process management
bash_agent.spawn :: (command:string) → Result[pid]
  where Effect[process]

bash_agent.kill :: (pid:int) → Status
  where Effect[process]

# State queries
bash_agent.env :: (var:string) → Result[value]
  where Effect[state]

bash_agent.functions :: () → Result[list[string]]
  where Effect[state]
```

---

## 6. Message Protocol

### 6.1 Command Format

Messages follow this pattern:

```
bash.<verb>:<arguments>

Examples:
bash.execute:ls -la
bash.eval:result=$((2 + 2))
bash.env:PATH
bash.state
bash.disconnect
```

### 6.2 Message Structure

Full message protocol:

```json
{
  "protocol": "bash-agent",
  "version": "1.0",
  "from": "@tube:sender",
  "to": "@tube:receiver",
  "command": {
    "verb": "execute",
    "args": ["ls", "-la"],
    "metadata": {
      "timestamp": "2025-10-31T10:00:00Z",
      "correlation_id": "uuid-1234"
    }
  }
}
```

### 6.3 Response Format

```json
{
  "protocol": "bash-agent",
  "version": "1.0",
  "from": "@tube:receiver",
  "to": "@tube:sender",
  "result": {
    "status": "success",
    "stdout": "total 48\ndrwxr-xr-x  ...",
    "stderr": "",
    "exit_code": 0,
    "metadata": {
      "duration_ms": 23,
      "timestamp": "2025-10-31T10:00:01Z"
    }
  }
}
```

---

## 7. Agent Composition

### 7.1 Agent Pipelines

Compose bash agents into workflows:

```bash
# Pattern: agent1 → agent2 → agent3

# Example: Distributed calculation
tubes send repl-1 "bash.eval:a=10"
tubes send repl-2 "bash.eval:b=20"
tubes send repl-3 "bash.eval:c=\$((a + b))"  # Fetches a, b from repl-1, repl-2
```

### 7.2 Multi-Agent Workflows

```bash
# Workflow: Parallel test execution
workflow_parallel_tests() {
    local test_files=("test1.sh" "test2.sh" "test3.sh")

    # Start worker agents
    for i in {1..3}; do
        bash_agent_init "worker-$i" "Test worker $i"
        bash_agent_connect "worker-$i"
    done

    # Distribute work
    for i in "${!test_files[@]}"; do
        local worker=$((i % 3 + 1))
        tubes send "worker-$worker" "bash.execute:bash ${test_files[$i]}"
    done

    # Collect results
    for i in {1..3}; do
        tubes receive "worker-$i" > "results-$i.txt"
    done
}
```

---

## 8. Security Model

### 8.1 Trust Boundaries

```
User's Bash Terminals (Trusted Zone)
  ├── Terminal 1: @tube:term1 [TRUSTED]
  ├── Terminal 2: @tube:term2 [TRUSTED]
  └── Terminal 3: @tube:term3 [TRUSTED]

External Processes (Untrusted)
  └── Not allowed to write to FIFOs
```

### 8.2 Safety Mechanisms

1. **Filesystem Permissions**: FIFOs inherit user's umask
2. **No Remote Access**: FIFOs are local-only (by design)
3. **Explicit Commands**: No automatic command execution
4. **User Approval**: Optional confirmation for sensitive commands
5. **Command Whitelisting**: Optional allowed command patterns

### 8.3 Sandboxing (Optional)

```bash
# Execute in restricted environment
bash_agent_execute_sandboxed() {
    local command="$1"

    # Run in subshell with restricted environment
    (
        unset TETRA_DIR TETRA_SRC
        export PATH="/usr/bin:/bin"
        ulimit -t 10  # 10 second CPU limit

        eval "$command"
    )
}
```

---

## 9. Integration Examples

### 9.1 REPL Network

```bash
# Terminal 1: Main REPL
bash_agent_init "repl-main" "Main REPL"
bash_agent_connect "repl-main"

# Terminal 2: Helper REPL
bash_agent_init "repl-helper" "Helper REPL"
bash_agent_connect "repl-helper"

# Send computation to helper
tubes send repl-helper "bash.eval:fib_20=\$(fibonacci 20)"

# Get result
tubes send repl-main "bash.eval:echo \$fib_20"
```

### 9.2 Build Monitor

```bash
# Terminal 1: Monitor
bash_agent_init "build-monitor" "Build status monitor"
tubes listen build-monitor bash_build_notifier &

bash_build_notifier() {
    local tube="$1"
    local message="$2"

    if [[ "$message" == *"success"* ]]; then
        osascript -e 'display notification "Build succeeded" with title "Tetra Build"'
    else
        osascript -e 'display notification "Build failed" with title "Tetra Build"'
    fi
}

# Terminal 2: Build runner
if npm run build; then
    tubes send build-monitor "bash.event:build_success"
else
    tubes send build-monitor "bash.event:build_failed"
fi
```

### 9.3 Distributed Grep

```bash
# Coordinator terminal
bash_distributed_grep() {
    local pattern="$1"
    shift
    local files=("$@")

    # Start workers
    for i in {1..4}; do
        bash_agent_init "grep-worker-$i" "Grep worker $i"
        bash_agent_connect "grep-worker-$i"
    done

    # Distribute work
    local worker=1
    for file in "${files[@]}"; do
        tubes send "grep-worker-$worker" "bash.execute:grep -n '$pattern' '$file'"
        worker=$(( (worker % 4) + 1 ))
    done

    # Collect results
    for i in {1..4}; do
        tubes receive "grep-worker-$i" 10
    done

    # Cleanup
    for i in {1..4}; do
        tubes destroy "grep-worker-$i"
    done
}
```

---

## 10. Comparison with Other Agents

### 10.1 Agent Type Comparison

| Aspect | Bash Agent | CDP Agent | SSH Agent | LLM Agent |
|--------|------------|-----------|-----------|-----------|
| **Interface** | FIFO | WebSocket | SSH Protocol | HTTP API |
| **Latency** | µs | ms | ms | seconds |
| **Setup** | Instant | Launch Chrome | SSH key | API key |
| **State** | Shell env | Browser session | Remote shell | Conversation |
| **Trust** | Full | Sandboxed | Key-based | API-limited |

### 10.2 When to Use Bash Agents

**Use Bash Agents when:**
- ✅ All terminals on same machine
- ✅ Low latency required (<1ms)
- ✅ User-in-the-loop workflows
- ✅ Lightweight orchestration
- ✅ No complex state management

**Use Other Agents when:**
- ❌ Remote execution required → SSH Agent
- ❌ Browser automation needed → CDP Agent
- ❌ Complex reasoning required → LLM Agent
- ❌ Production deployments → Service agents

---

## 11. Future Extensions

### 11.1 Remote Bash Agents

Extend to remote terminals via SSH tunnels:

```bash
# Create remote bash agent
bash_agent_create_remote() {
    local remote="$1"   # @dev, @staging, @prod
    local name="$2"

    # Resolve SSH connector
    local connector=$(tes_resolve "$remote" "connector")

    # Create tube on remote
    ssh "$connector" "
        source ~/tetra/tetra.sh
        tubes create $name 'Remote bash agent'
        tubes listen $name &
    "

    # Create local proxy
    tubes create "proxy-$name" "Proxy to remote $name"

    # Forward messages
    bash_agent_proxy "$name" "$remote"
}
```

### 11.2 Agent Discovery

Automatic discovery of bash agents:

```bash
# Discover all bash agents on network
bash_agent_discover() {
    # Local tubes
    tubes list

    # Remote tubes (via TES)
    for endpoint in "@dev" "@staging" "@prod"; do
        ssh "$endpoint" "tubes list" 2>/dev/null
    done
}
```

### 11.3 Agent Protocols

Standardized command protocols:

```bash
# File transfer protocol
bash.transfer:file <source> <target>

# Synchronization protocol
bash.sync:env <var1> <var2> ...

# State sharing protocol
bash.share:function <function_name>
```

---

## 12. Implementation Checklist

A Bash agent is TES-compliant when:

✅ **Identity**: Has unique tube name (`@tube:name`)
✅ **Discovery**: Registered in tubes registry
✅ **Lifecycle**: Implements init/connect/execute/disconnect
✅ **Contracts**: Declares all functions with `::` operator
✅ **Logging**: Uses unified logging (`tetra_log_*`)
✅ **State**: Manages shell environment state
✅ **Communication**: Uses tubes for messaging
✅ **Documentation**: References TES Bash Agent Extension

---

## 13. Success Criteria

### 13.1 Functional Requirements

✅ Terminals can be addressed as `@tube:name`
✅ Commands execute in target terminal
✅ Results return to sender
✅ State persists across commands
✅ Multiple agents can communicate

### 13.2 Performance Requirements

✅ Message latency <1ms (local)
✅ No message loss (FIFO guarantees)
✅ Support 10+ concurrent agents
✅ Graceful degradation on failure

### 13.3 Usability Requirements

✅ Simple API (`tubes send`, `tubes receive`)
✅ Clear error messages
✅ Self-documenting (`tubes help`)
✅ Easy cleanup (`tubes cleanup`)

---

## 14. Version History

- **1.0** (2025-10-31) - Initial specification
  - Bash terminals as TES agents
  - FIFO-based communication
  - Agent lifecycle and contracts
  - Integration with tubes module
  - Security model

---

**End of TES Bash Agent Extension 1.0**
