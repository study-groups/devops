# TES Agent Extension

**Version:** 1.0
**TCS Version:** 3.0.1
**Date:** 2025-10-17
**Status:** Draft

---

## References

- [Tetra Core Specification](Tetra_Core_Specification.md)
- [Tetra Module Convention](Tetra_Module_Convention.md)

---

## Abstract

The Tetra Agent Extension (TES-Agent) defines the agent abstraction within the tetra system. An **agent** is an autonomous module that can:

1. **Execute actions** independently or on behalf of other modules
2. **Maintain state** across invocations
3. **Interact with external systems** (browsers, APIs, services)
4. **Be composed** with other agents to form workflows
5. **Follow TCS 3.0 patterns** (database, logging, type contracts)

This specification codifies agent patterns to enable:
- Browser automation (CDP agents)
- LLM orchestration (prompt agents)
- API integration (service agents)
- System automation (SSH agents)
- Future agent types

---

## 1. Agent Definition

### 1.1 What is an Agent?

**Definition**: An agent is a **specialized module** that provides autonomous capabilities through:

```
Agent = Module + Autonomy + State + External Interaction
```

**Key Characteristics**:

| Property | Description |
|----------|-------------|
| **Autonomy** | Can execute complex operations independently |
| **State** | Maintains session state across invocations |
| **External** | Interfaces with systems outside tetra |
| **Composable** | Can be chained with other agents |
| **TCS Compliant** | Follows all TCS 3.0 patterns |

### 1.2 Agent vs Module

| Aspect | Module | Agent |
|--------|--------|-------|
| **Purpose** | Domain logic | Autonomous execution |
| **State** | Stateless or DB-backed | Session state required |
| **External** | Optional | Required |
| **Lifecycle** | Load once | Connect/disconnect pattern |
| **Examples** | RAG, VOX, QA | CDP Browser, LLM, SSH |

**Key Insight**: All agents are modules, but not all modules are agents.

---

## 2. Agent Taxonomy

### 2.1 Agent Classes

Agents are classified by their external interface:

```
Agent Classes:
  ├── Protocol Agents     # Network protocols
  │   ├── CDP            # Chrome DevTools Protocol
  │   ├── SSH            # Secure Shell
  │   ├── HTTP           # REST APIs
  │   └── WebSocket      # Real-time protocols
  │
  ├── LLM Agents         # Language models
  │   ├── OpenAI         # ChatGPT, GPT-4
  │   ├── Anthropic      # Claude
  │   └── Local          # Ollama, LM Studio
  │
  ├── System Agents      # OS interfaces
  │   ├── Process        # Process management
  │   ├── FileSystem     # File operations
  │   └── Network        # Network tools
  │
  └── Service Agents     # Cloud services
      ├── Storage        # S3, Spaces
      ├── Database       # Postgres, Redis
      └── Queue          # RabbitMQ, Kafka
```

### 2.2 Agent Operator (`⊕`)

The agent operator `⊕` denotes agent composition:

```bash
Agent₁ ⊕ Agent₂ → Workflow

# Examples:
CDP ⊕ LLM          # Browser + AI analysis
SSH ⊕ CDP ⊕ LLM    # Remote browser + AI
```

---

## 3. Agent Structure (TCS 3.0)

### 3.1 Directory Structure

Every agent MUST follow this structure:

```
$TETRA_SRC/bash/<agent>/
├── <agent>.sh              # Core agent logic
├── <agent>_paths.sh        # Path functions (TCS 3.0)
├── <agent>_core.sh         # Business logic
├── <agent>_session.sh      # Session management
├── actions.sh              # TUI integration
├── profiles/               # Agent profiles
│   └── default.conf        # Default profile
├── includes.sh             # Module loader
└── README.md               # Documentation

$TETRA_DIR/<agent>/
├── db/                     # Primary key database
│   ├── {timestamp}.session.json
│   ├── {timestamp}.action.json
│   └── {timestamp}.result.*
├── config/                 # Agent configuration
│   ├── profile.active      # Active profile name
│   └── session.state       # Current session state
├── logs/                   # Agent logs
│   └── agent.log
├── cache/                  # Temporary artifacts
└── profiles/               # User profiles (overrides)
```

### 3.2 Required Path Functions

Every agent MUST implement:

```bash
# Agent source (strong global)
: "${AGENT_SRC:=$TETRA_SRC/bash/<agent>}"

# Agent runtime directory
: "${AGENT_DIR:=$TETRA_DIR/<agent>}"

# Database directory
agent_get_db_dir() {
    echo "$AGENT_DIR/db"
}

# Config directory
agent_get_config_dir() {
    echo "$AGENT_DIR/config"
}

# Session state path
agent_get_session_state() {
    echo "$(agent_get_config_dir)/session.state"
}

# Timestamp generation
agent_generate_timestamp() {
    date +%s
}

# Timestamped database path
agent_get_db_path() {
    local timestamp="$1"
    local type="$2"
    local extension="$3"
    echo "$(agent_get_db_dir)/${timestamp}.${type}.${extension}"
}
```

---

## 4. Agent Lifecycle

### 4.1 Session Management

All agents MUST support these lifecycle phases:

```bash
# Phase 1: Initialize
agent_init()
  → Create directories
  → Load configuration
  → Return: status

# Phase 2: Connect
agent_connect([params])
  → Establish external connection
  → Save session state
  → Return: session_id

# Phase 3: Execute
agent_execute(action, params)
  → Perform action
  → Log to unified log
  → Store result in db/
  → Return: result

# Phase 4: Disconnect
agent_disconnect()
  → Close external connection
  → Save final state
  → Return: status

# Phase 5: Cleanup
agent_cleanup()
  → Remove temporary files
  → Clear cache
  → Return: status
```

### 4.2 Session State

Session state MUST be stored in JSON:

```json
{
  "session_id": "uuid-or-timestamp",
  "agent": "cdp",
  "connected": true,
  "connected_at": "2025-10-17T14:23:45Z",
  "external": {
    "websocket_url": "ws://localhost:9222/devtools/...",
    "process_id": 12345
  },
  "metadata": {
    "profile": "default",
    "version": "1.0"
  }
}
```

**Location**: `$AGENT_DIR/config/session.state`

---

## 5. Agent Type Contracts

### 5.1 Contract Syntax

All agent functions MUST declare contracts:

```bash
# Lifecycle contracts
agent.init :: () → Status
  where Effect[filesystem]

agent.connect :: ([params:json]) → SessionID
  where Effect[network, state]

agent.execute :: (action:string, params:*) → Result
  where Effect[external, log, db]

agent.disconnect :: () → Status
  where Effect[network, state]

agent.cleanup :: () → Status
  where Effect[filesystem]
```

### 5.2 CDP Agent Contracts

Example contracts for CDP agent:

```bash
cdp.init :: () → Status
  where Effect[filesystem]

cdp.connect :: ([port:int]) → Session[websocket]
  where Effect[network, state, process]

cdp.navigate :: (url:string) → Event[loadEventFired]
  where Effect[browser, log, db]

cdp.screenshot :: ([timestamp:int]) → @cdp:timestamp.screenshot.png
  where Effect[browser, db]

cdp.execute :: (js:string) → Result[json]
  where Effect[browser, log]

cdp.extract :: (selector:string) → Text[stdout]
  where Effect[browser]

cdp.disconnect :: () → Status
  where Effect[network, state]

cdp.cleanup :: () → Status
  where Effect[filesystem, process]
```

---

## 6. Agent Profiles

### 6.1 Profile Structure

Agents support profiles for different configurations:

```bash
# Profile locations (precedence order):
1. $AGENT_DIR/profiles/<name>.conf      # User profile (highest)
2. $AGENT_SRC/profiles/<name>.conf      # System profile
3. $AGENT_SRC/profiles/default.conf     # Default (fallback)
```

### 6.2 Profile Format

Agent profiles are bash scripts that set variables:

```bash
# CDP Agent Profile Example
# File: $CDP_SRC/profiles/default.conf

AGENT_NAME="cdp"
AGENT_DESCRIPTION="Chrome DevTools Protocol agent for browser automation"
AGENT_VERSION="1.0"

# Connection settings
CDP_PORT=9222
CDP_HEADLESS=true
CDP_TIMEOUT=5000

# Chrome settings
CHROME_USER_DATA_DIR=""  # Auto-create temp dir
CHROME_DISABLE_GPU=true
CHROME_NO_SANDBOX=false

# Capabilities
CDP_CAPABILITIES=(
    "navigate"
    "screenshot"
    "execute_js"
    "extract"
    "click"
    "type"
)

# Features
CDP_ENABLE_NETWORK_INTERCEPT=false
CDP_ENABLE_PERFORMANCE_TRACE=false
CDP_ENABLE_MOBILE_EMULATION=false
```

### 6.3 Profile Management

```bash
# List available profiles
agent list profiles

# Set active profile
agent set profile <name>

# Get active profile
agent get profile

# Validate profile
agent validate profile <name>
```

---

## 7. Agent Discovery

### 7.1 Agent Registration

Agents register with the tetra orchestrator:

```bash
# In agent's includes.sh or _core.sh

# Register agent metadata
tetra_register_agent() {
    local agent_name="$1"
    local agent_class="$2"  # protocol, llm, system, service

    declare -gA TETRA_AGENTS
    TETRA_AGENTS["$agent_name"]="$agent_class"

    # Export agent functions for discovery
    export -f "${agent_name}_init"
    export -f "${agent_name}_connect"
    export -f "${agent_name}_execute"
    export -f "${agent_name}_disconnect"
    export -f "${agent_name}_cleanup"
}

# Example: Register CDP agent
tetra_register_agent "cdp" "protocol"
```

### 7.2 Agent Query

Query agents via tetra orchestrator:

```bash
# List all agents
tetra list agents

# List agents by class
tetra list agents --class=protocol

# Get agent info
tetra agent info cdp

# Check agent status
tetra agent status cdp
```

---

## 8. Agent Composition

### 8.1 Agent Pipelines

Agents can be composed into pipelines:

```bash
# Pattern: agent1 | agent2 | agent3

# Example: Browse + Extract + Analyze
cdp.navigate "https://example.com" \
  | cdp.extract "article" \
  | llm.analyze "Summarize this article"
```

### 8.2 Agent Workflows

Complex workflows using multiple agents:

```bash
# Workflow: Automated research
workflow() {
    local query="$1"

    # 1. LLM generates search URL
    local url=$(llm.execute "Generate search URL for: $query")

    # 2. CDP navigates and extracts
    cdp.connect
    cdp.navigate "$url"
    local content=$(cdp.extract "main")

    # 3. LLM analyzes
    local summary=$(llm.analyze "$content")

    # 4. Store results
    local timestamp=$(date +%s)
    echo "$summary" > "$TETRA_DIR/research/db/$timestamp.summary"

    # 5. Cleanup
    cdp.disconnect

    echo "$summary"
}
```

---

## 9. Unified Logging

### 9.1 Agent Log Format

All agents MUST log to `$TETRA_DIR/logs/tetra.jsonl`:

```json
{
  "timestamp": "2025-10-17T14:23:45Z",
  "module": "cdp",
  "agent_class": "protocol",
  "verb": "navigate",
  "subject": "https://example.com",
  "status": "success",
  "exec_at": "@local",
  "session_id": "1760229927",
  "metadata": {
    "duration_ms": 234,
    "external_calls": 3
  }
}
```

### 9.2 Agent-Specific Logs

Agents MAY also write to agent-specific logs:

```bash
# Agent log location
$AGENT_DIR/logs/agent.log

# Format: Human-readable text
2025-10-17 14:23:45 [INFO] CDP connected to ws://localhost:9222/...
2025-10-17 14:23:47 [INFO] Navigated to https://example.com
2025-10-17 14:23:49 [INFO] Screenshot saved to db/1760229927.screenshot.png
```

---

## 10. Cross-Module Integration

### 10.1 Agent Symbols

Agents use module symbols for resources:

```bash
# Pattern: @agent:timestamp.type.extension

@cdp:1760229927.screenshot.png        # CDP screenshot
@cdp:1760229927.action.json           # CDP action log
@cdp:1760229927.session.json          # CDP session state

@llm:1760229927.prompt.txt            # LLM prompt
@llm:1760229927.response.json         # LLM response
```

### 10.2 Timestamp Preservation

When agents process outputs from other agents/modules:

```bash
# Module generates content
qa.query "question"
# → Creates: $QA_DIR/db/1760229927.answer

# Agent processes with SAME timestamp
cdp.navigate "$(cat $QA_DIR/db/1760229927.answer)"
# → Creates: $CDP_DIR/db/1760229927.action.json

# Another agent analyzes
llm.analyze @cdp:1760229927.action.json
# → Creates: $LLM_DIR/db/1760229927.response.json
```

**Benefit**: Enables correlation across all modules/agents by timestamp.

---

## 11. Agent Configuration

### 11.1 Global Agent Config

Location: `$TETRA_DIR/config/agents.conf`

```bash
# Global agent settings
AGENT_DEFAULT_TIMEOUT=30000
AGENT_MAX_RETRIES=3
AGENT_ENABLE_CACHE=true
AGENT_LOG_LEVEL=info

# Agent-specific settings
CDP_DEFAULT_PORT=9222
LLM_DEFAULT_MODEL=gpt-4
SSH_DEFAULT_PORT=22
```

### 11.2 Per-Agent Config

Location: `$AGENT_DIR/config/agent.conf`

```bash
# CDP agent config
CDP_PORT=9222
CDP_HEADLESS=true
CDP_USER_DATA_DIR=""
CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
```

---

## 12. Agent Security

### 12.1 Capabilities

Agents declare capabilities in profiles:

```bash
# In profile:
AGENT_CAPABILITIES=(
    "network.connect"      # Can make network connections
    "filesystem.read"      # Can read files
    "filesystem.write"     # Can write files
    "process.spawn"        # Can spawn processes
    "browser.control"      # Can control browsers
)
```

### 12.2 Sandboxing

Future: Agent execution in sandboxed environments:

```bash
# Sandbox agent execution
tetra agent run cdp --sandbox=strict

# Sandbox levels:
# - none: No restrictions
# - loose: Basic filesystem limits
# - strict: Network + filesystem + process limits
# - isolated: Full container isolation
```

---

## 13. CDP Agent Implementation

### 13.1 CDP as Reference Implementation

The CDP agent serves as the reference implementation for TES-Agent:

```bash
# CDP Agent Structure
$TETRA_SRC/bash/cdp/
├── cdp.sh                  # Core CDP logic
├── cdp_paths.sh            # TCS 3.0 paths
├── cdp_session.sh          # Session management
├── cdp_core.sh             # CDP operations
├── actions.sh              # TUI integration
├── profiles/
│   ├── default.conf        # Default profile
│   ├── headless.conf       # Headless browser
│   └── mobile.conf         # Mobile emulation
├── includes.sh
└── README.md

$TETRA_DIR/cdp/
├── db/
├── config/
│   ├── session.state
│   └── agent.conf
├── logs/
├── cache/
└── profiles/
```

### 13.2 CDP Agent API

```bash
# Lifecycle
cdp_init                    # Initialize
cdp_connect [port]          # Connect to Chrome
cdp_disconnect              # Disconnect
cdp_cleanup                 # Cleanup

# Navigation
cdp_navigate <url>          # Navigate to URL
cdp_back                    # Go back
cdp_forward                 # Go forward
cdp_reload                  # Reload page

# Extraction
cdp_screenshot [timestamp]  # Take screenshot
cdp_get_html [timestamp]    # Get page HTML
cdp_extract <selector>      # Extract by CSS selector

# Interaction
cdp_execute <js>            # Execute JavaScript
cdp_click <selector>        # Click element
cdp_type <selector> <text>  # Type into element

# Profiles
cdp_list_profiles           # List available profiles
cdp_set_profile <name>      # Set active profile
cdp_get_profile             # Get active profile
```

---

## 14. Future Extensions

### 14.1 Planned Agent Types

1. **SSH Agent** (`bash/ssh/`)
   - Remote command execution
   - File transfer
   - Port forwarding

2. **LLM Agent** (`bash/llm/`)
   - Multi-provider support (OpenAI, Anthropic, Local)
   - Streaming responses
   - Token tracking

3. **HTTP Agent** (`bash/http/`)
   - REST API client
   - Request/response logging
   - Authentication handling

4. **Database Agent** (`bash/db/`)
   - Query execution
   - Schema introspection
   - Transaction management

### 14.2 Advanced Features

1. **Agent Monitoring**
   ```bash
   tetra agent monitor cdp
   # Live view of agent activity
   ```

2. **Agent Replay**
   ```bash
   tetra agent replay @cdp:1760229927
   # Replay recorded session
   ```

3. **Agent Metrics**
   ```bash
   tetra agent metrics cdp
   # Performance metrics
   ```

---

## 15. Success Criteria

An agent is TES-Agent 1.0 compliant when:

✅ **Structure**: Follows `$TETRA_DIR/<agent>/` pattern
✅ **Lifecycle**: Implements init/connect/execute/disconnect/cleanup
✅ **Session**: Manages session state in config/session.state
✅ **Contracts**: Declares all functions with `::` operator
✅ **Logging**: Uses unified logging + agent log
✅ **Profiles**: Supports profile-based configuration
✅ **Registration**: Registers with tetra orchestrator
✅ **Documentation**: Has README.md referencing TES-Agent 1.0

---

## 16. Version History

- **1.0** (2025-10-17) - Initial TES-Agent specification
  - Agent definition and taxonomy
  - Lifecycle management
  - Session state
  - Profile system
  - CDP reference implementation
  - Agent composition patterns

---

**End of TES Agent Extension 1.0**
