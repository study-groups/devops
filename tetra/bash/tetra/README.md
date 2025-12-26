# Tetra Orchestrator

Minimal module orchestrator. Loads modules, provides discovery, delegates work.

## Quick Start

```bash
source ~/tetra/tetra.sh
tetra                    # Show status
tetra help               # Show help
tetra repl               # Interactive mode
```

## Commands

```bash
tetra status             # Show loaded modules and paths
tetra modules            # Alias for module list
tetra module list        # List loaded modules
tetra module info <name> # Show module details
tetra module stats       # File statistics
tetra doctor             # Health check
tetra repl               # Interactive REPL
tetra help               # Show help
```

## REPL

Interactive shell with tab completion:

```bash
tetra repl
```

**Commands:**
```
status              Show tetra status
modules             List modules (Tab for names)
modules <name>      Run module command
doctor              Health check
help                Show help
exit, quit, q       Exit

# Direct module commands
org status          Organization status
tsm list            List running services
deploy push <t> <e> Deploy to environment
```

**Tab Completion:**
```
modules <Tab>       Show available modules
org <Tab>           Show org subcommands
tsm <Tab>           Show tsm subcommands
```

## Module Commands

Modules are invoked directly:

```bash
org status              # Organization status
org switch mycompany    # Switch organization
tsm list                # List running services
tsm start ./server.js   # Start a service
deploy push app prod    # Deploy app to prod
tls ~/projects          # List files
```

## Requirements

- Bash 5.2+
- `TETRA_SRC` set (automatically detected from tetra.sh location)

## Structure

```
bash/tetra/
  tetra.sh              # Main orchestrator (~300 lines)
  interfaces/
    repl.sh             # Interactive REPL (~220 lines)
```

## Module Discovery

Modules in `$TETRA_SRC/bash/<name>/` are loaded if they have:
- `actions.sh` - Action definitions
- `<name>.sh` or `includes.sh` - Entry point

## Architecture

Tetra is a thin orchestrator following the noun-verb CLI pattern like `org`, `tsm`, `deploy`:

1. **Bootstrap** - Validate bash 5.2+, set TETRA_SRC/TETRA_DIR
2. **Load modules** - Scan bash/ for modules with actions.sh
3. **Dispatch** - Route commands to tetra functions or eval as shell

No complex context system. No action registry. Modules handle their own dispatch.
