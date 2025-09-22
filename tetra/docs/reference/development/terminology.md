# Tetra + Anthropic Terminology Reference

Hybrid terminology guide combining Anthropic API terms with Tetra-specific concepts.

## Anthropic API Terms

### Conversation Model
- **User**: Human developer/operator working with Tetra
- **Assistant**: LLM (Claude) providing development assistance
- **Message**: Individual communication units in conversation
- **Context**: Current conversation state and accumulated knowledge
- **Session**: Continuous interaction period with context retention

### Technical Components
- **System Prompt**: Instructions defining assistant behavior and context
- **Tool Use**: Assistant calls to external functions/APIs (file operations, bash commands)
- **Tool Result**: Response/output from external tool calls
- **Context Window**: Amount of conversation history the model can reference

### Content Types
- **Text Content**: Regular message text and documentation
- **Tool Use Content**: Function/API calls within assistant messages
- **Code Content**: Programming code and scripts

## Tetra System Terms

### Core Architecture
- **Module**: Bash component managed by tmod (lazy-loaded, isolated)
- **tmod**: Module manager and system orchestrator
- **System**: The complete Tetra infrastructure management platform
- **Component**: Individual functional unit within a module

### Service Management
- **Service**: Application process managed by TSM
- **TSM**: Tetra Service Manager (service lifecycle management)
- **Service Definition**: `.tsm.sh` file defining service configuration
- **Named Port**: Registry entry mapping service names to port numbers
- **Port Resolution**: Priority system for determining service ports

### Infrastructure
- **Organization**: Multi-client infrastructure configuration
- **Environment**: Deployment target (dev, staging, prod)
- **Environment Promotion**: Workflow moving configs between environments
- **Template**: Parameterized configuration for services/infrastructure

### Interface
- **TDash**: Modal dashboard interface with dual-axis navigation
- **Modal Interface**: Dual-axis control system (mode × environment)
- **Mode**: Horizontal navigation axis (TOML, TKM, TSM, DEPLOY, ORG)
- **Environment Axis**: Vertical navigation (SYSTEM, LOCAL, DEV, STAGING, PROD)

## Hybrid Usage Patterns

### Development Context
```bash
# User requests assistance with system
"User needs the assistant to implement port scanning in TSM module"

# Assistant describes system behavior
"The system will resolve service ports through named registry"

# Assistant references conversation state
"Based on current context, the module loading requires tmod integration"
```

### Component References
```bash
# Specific module targeting
"tmod will lazy-load the TSM module when tsm command is invoked"

# Service management context
"TSM manages service lifecycle through systemd integration"

# Interface interaction
"TDash modal interface provides dual-axis navigation control"
```

### File and Code Context
```bash
# Path references
"Module implementation in TETRA_SRC/bash/tsm/tsm_core.sh"

# Function references
"Function tsm_resolve_service_port() in tsm_ports.sh:67"

# Tool use context
"Assistant will use Edit tool to modify service definition"
```

## Context Switching

### Session Management
- **Session Start**: Assistant reads docs/changes.md, docs/next.md, docs/index.md
- **Context Retention**: Maintain awareness of implementation state
- **Context Transfer**: Reference previous tool results and decisions

### System State Awareness
- **Current Implementation**: What features are completed
- **Active Development**: What's currently being worked on
- **Pending Tasks**: What remains in the roadmap

## Request Clarity

### Effective Patterns
```bash
# Clear scope and component
"Assistant should implement named port conflict detection in TSM"

# Specific file targeting
"User needs modification to tsm_interface.sh service resolution logic"

# Context-aware requests
"Based on session context, add TDash ORG mode rendering for STAGING"
```

### Terminology Precision
- Use **"module"** for tmod-managed components
- Use **"service"** for TSM-managed processes
- Use **"organization"** for multi-client configs
- Use **"environment"** for deployment targets
- Use **"modal interface"** for TDash navigation

## Communication Flow

### User → Assistant
- Provide system context and specific requirements
- Reference current documentation state
- Use hybrid terminology for clarity

### Assistant → System
- Execute tool use with precise targeting
- Maintain context awareness across operations
- Update documentation to reflect changes

### System → User
- Tool results inform next development steps
- Implementation state guides roadmap priorities
- Testing validates system functionality

---

*See [code-requests.md](code-requests.md) for request structuring*
*See [../../guide.md](../../guide.md) for assistant workflow*