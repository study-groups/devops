# TSM - Tetra Service Manager

Native process management with PORT-based naming and service definitions.

## Quick Start

```bash
# Source tetra first
source ~/tetra/tetra.sh

# TSM is auto-loaded by tetra, or source manually:
source "$TETRA_SRC/bash/tsm/includes.sh"

# Use TSM
tsm list
tsm start devpages
tsm logs 0
```

## Module Structure

TSM follows the [Tetra Module Convention 2.0](../../docs/Tetra_Module_Convention.md).

### Entry Points

**For users sourcing TSM:**
```bash
# Canonical entry point - ALWAYS use this
source "$TETRA_SRC/bash/tsm/includes.sh"
```

**For TUI integration (demo 014):**
```bash
# TUI automatically discovers actions via:
source "$TETRA_SRC/bash/tsm/actions.sh"
tsm_register_actions
tsm_execute_action "start:service" "devpages"
```

### File Organization

```
bash/tsm/
├── includes.sh              # ✅ MAIN ENTRY POINT - Source this file
├── tsm.sh                   # Main CLI implementation
├── actions.sh               # TUI integration (Tetra Module Convention)
├── index.sh                 # Module metadata & bash completions
├── tsm_log.sh               # TSM-specific logging
├── tsm_logs_query.sh        # Query logs utility
│
├── core/                    # Core functionality
│   ├── include.sh           # Component loader
│   ├── core.sh              # Core functions
│   ├── config.sh            # Configuration
│   ├── environment.sh       # Environment handling
│   ├── start.sh             # Universal start command
│   ├── metadata.sh          # PM2-style JSON metadata
│   └── ...
│
├── process/                 # Process management
│   ├── lifecycle.sh         # Start/stop/restart
│   ├── management.sh        # CLI commands
│   ├── inspection.sh        # Process inspection
│   └── list.sh              # List commands
│
├── system/                  # System utilities
│   ├── doctor.sh            # Diagnostics
│   ├── ports.sh             # Port registry
│   ├── monitor.sh           # Monitoring
│   ├── analytics.sh         # Analytics
│   └── ...
│
├── services/                # Service definitions
│   ├── definitions.sh       # Service management
│   ├── registry.sh          # Service registry
│   └── startup.sh           # Startup logic
│
├── interfaces/              # User interfaces
│   └── repl_v2.sh           # Interactive REPL
│
├── integrations/            # Third-party integrations
│   ├── nginx.sh
│   ├── systemd.sh
│   └── tview.sh
│
├── tests/                   # Test suite
└── archive/                 # Legacy code
```

## Globals

TSM uses strong globals per CLAUDE.md convention:

```bash
MOD_SRC="$TETRA_SRC/bash/tsm"    # Source code location
MOD_DIR="$TETRA_DIR/tsm"          # Runtime data location

# Backward compatibility
TSM_SRC="$MOD_SRC"
TSM_DIR="$MOD_DIR"
```

## Common Commands

```bash
# List services
tsm list                      # Running services (default)
tsm list available            # All available services
tsm list all                  # All services

# Start services
tsm start devpages            # Start service by name
tsm start --env dev server.js # Start with environment file
tsm start --port 4000 --name api node app.js  # Start with custom port/name

# Process management
tsm stop 0                    # Stop by TSM ID
tsm stop devpages             # Stop by name
tsm restart 0                 # Restart by TSM ID
tsm logs 0 -f                 # Follow logs

# Diagnostics
tsm doctor healthcheck        # Validate TSM environment
tsm doctor                    # Full diagnostics
tsm ports overview            # Show port usage
tsm cleanup                   # Remove crashed/dead processes

# Interactive mode
tsm repl                      # Launch interactive REPL
```

## Smart Process Naming

TSM automatically generates descriptive names based on your directory and command:

```bash
# Running from ~/my-api directory
tsm start python -m http.server 8000   # → my-api-http-8000
tsm start python server.py 9000        # → my-api-server-9000
tsm start node app.js 3000             # → my-api-app-3000

# Running from ~/demos/phasefield
tsm start python -m flask 5000         # → phasefield-flask-5000

# Custom naming still available
tsm start --name backend python -m http.server 8000  # → backend-8000
```

## Environment Files

```bash
# Initialize environment template
tetra env init dev

# Edit with real values
edit env/dev.env

# Use with TSM
tsm start --env dev server.js
```

## For Developers

### Adding New Commands

Edit `bash/tsm/tsm.sh` and add to the main `tsm()` function case statement.

### Adding TUI Actions

Edit `bash/tsm/actions.sh` following the Tetra Module Convention 2.0:

```bash
declare_action "my_action" \
    "verb=<verb>" \
    "noun=<noun>" \
    "exec_at=@local" \
    "contexts=Local" \
    "modes=Execute" \
    "tes_operation=local"
```

### Running Tests

```bash
bash bash/tsm/tests/run_all_tests.sh
```

## Architecture

TSM uses dependency-ordered loading:

1. **PHASE 1**: Core foundation (core.sh, config.sh, utils.sh, environment.sh)
2. **PHASE 2**: System modules (ports.sh, doctor.sh, monitor.sh)
3. **PHASE 3**: Service modules (definitions.sh, registry.sh)
4. **PHASE 4**: Process modules (lifecycle.sh, management.sh, list.sh)
5. **PHASE 5**: Interface modules (repl_v2.sh)
6. **PHASE 6**: Integration modules (nginx.sh, systemd.sh)
7. **PHASE 7**: Initialize global state

See `bash/tsm/core/include.sh` for the complete loading sequence.

## Migration Notes

- **REPL**: Modern REPL is `repl_v2.sh` (bash/repl-based). Legacy REPL has been archived.
- **Environment Parsing**: Use `tsm_parse_env_file()` helper instead of grep-based parsing.
- **Globals**: Transitioning to MOD_SRC/MOD_DIR convention (TSM_SRC/TSM_DIR still supported).

## Related Documentation

- **[TSM_REFERENCE.md](./TSM_REFERENCE.md)** - Complete technical reference for TSM internals
- [Tetra Module Convention](../../docs/Tetra_Module_Convention.md) - Module structure
- [Tetra Library Convention](../../docs/Tetra_Library_Convention.md) - Library vs module
- [TES Specifications](../../docs/reference/) - Tetra Extension Specifications
