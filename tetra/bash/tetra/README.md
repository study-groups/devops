# Tetra Orchestrator

Tetra provides three interfaces to module actions: **cmd**, **repl**, and **tui**.

## Quick Start

```bash
source ~/tetra/tetra.sh
tetra help                    # Show help
tetra list modules            # See loaded modules
tetra repl                    # Interactive mode
```

## Interfaces

### Command Mode (cmd)

Execute actions directly from the shell:

```bash
tetra list modules            # Orchestrator meta-action
tetra list actions            # See all available actions
tetra rag list agents         # Module action
tetra help repl               # Get help on a topic
```

### REPL Mode

Interactive shell with persistent context:

```bash
tetra repl                    # Basic mode
tetra repl --rlwrap           # Enhanced with history
```

**Slash Commands:**
```
/help, /h           Show help
/exit, /quit, /q    Exit REPL

Context:
  /org [name]       Get/set organization
  /env [name]       Get/set environment (Local, Dev, Staging, Production)
  /mode [modules]   Get/set module filter
  /context          Show context summary

System:
  /status           Orchestrator status
  /history          Recent commands
  /clear            Clear screen
```

**Actions** (no / prefix):
```
list modules                  List loaded modules
list actions                  List available actions
<module> <action> [args]      Execute module action
```

**Example Session:**
```
tetra repl
[tetra × Local × all] tetra> /org mycompany
[mycompany × Local × all] tetra> /env Production
[mycompany × Production × all] tetra> /mode rag
[mycompany × Production × rag] tetra> rag list agents
[mycompany × Production × rag] tetra> /exit
```

### TUI Mode

Visual terminal interface with keyboard navigation:

```bash
tetra tui
```

**Navigation:**
| Key | Action |
|-----|--------|
| `e` | Cycle environment (Local → Dev → Staging → Production) |
| `m` | Cycle mode (Inspect → Transfer → Execute) |
| `a` | Cycle action |
| `Enter` | Execute action / enter Mode REPL |

**Views & Modes:**
| Key | Action |
|-----|--------|
| `v` | View mode (scroll with arrows, ESC to exit) |
| `:` | Command mode |
| `u` | Unicode explorer |
| `w` | Web dashboard (placeholder) |

**Controls:**
| Key | Action |
|-----|--------|
| `h` | Cycle header size (max → med → min) |
| `o` | Toggle separator animation |
| `c` | Clear content |
| `q` | Quit |

## Context System

Tetra uses a context algebra: **[Org × Env × Mode] → Actions**

- **Org**: Organization/project context
- **Env**: Environment (Local, Dev, Staging, Production)
- **Mode**: Module filter (comma-separated) or "all"

Different Env×Mode combinations provide different modules and actions:

| Environment | Mode | Modules |
|-------------|------|---------|
| Local | Inspect | org, logs, tds |
| Local | Transfer | org, deploy |
| Local | Execute | org, tsm |
| Dev | Inspect | org, tsm, logs |
| Dev | Execute | tsm, deploy |
| Production | Execute | deploy |

## Agent Management

```bash
tetra agent list              # List registered agents
tetra agent info <name>       # Agent details
tetra agent status <name>     # Check connection
tetra agent init <name>       # Initialize
tetra agent connect <name>    # Connect
tetra agent disconnect <name> # Disconnect
```

## Help Topics

```bash
tetra help                    # Main help
tetra help commands           # Command mode
tetra help repl               # REPL mode
tetra help tui                # TUI mode
tetra help agents             # Agent system
tetra help modules            # Module system
tetra help composition        # Piping actions
tetra help context            # Context management
```

## Requirements

- Bash 5.2+
- TETRA_SRC environment variable set

## Module Structure

Modules live in `$TETRA_SRC/bash/<module>/` with:
- `actions.sh` - Action definitions (required for discovery)
- `<module>.sh` - Implementation
- `agents/` - Agent configs (optional)

See `docs/Tetra_Module_Convention.md` for creating modules.
