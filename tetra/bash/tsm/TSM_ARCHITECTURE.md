# TSM Architecture

TSM (Tetra Service Manager) is a process manager for local development, providing service lifecycle management, port allocation, and system monitoring.

## Directory Structure

```
tsm/
├── tsm.sh                  # Main entry point and command router
├── tsm_repl.sh            # Interactive REPL (bash/repl-based)
│
├── core/                   # Core functionality (no external dependencies)
│   ├── config.sh          # Configuration and global state
│   ├── core.sh            # Module registry and discovery interface
│   ├── environment.sh     # Environment file handling
│   ├── helpers.sh         # Helper utilities
│   ├── hooks.sh           # Pre-execution hook system
│   ├── include.sh         # Module loader (orchestrates all loading)
│   ├── metadata.sh        # PM2-style JSON metadata management
│   ├── patterns.sh        # Start pattern management
│   ├── port_resolution.sh # 6-step port resolution ladder
│   ├── runtime.sh         # Runtime interpreter resolution
│   ├── setup.sh           # System setup and initialization
│   ├── start.sh           # Universal start command
│   ├── utils.sh           # Utility functions
│   ├── validation.sh      # Input validation and helpers
│   └── help.sh            # Contextual help system
│
├── system/                 # System-level operations
│   ├── analytics.sh       # Click timing and user journey analytics
│   ├── audit.sh           # System audit functions
│   ├── doctor.sh          # Health checks and diagnostics
│   ├── formatting.sh      # Output formatting utilities
│   ├── monitor.sh         # Process monitoring and dashboards
│   ├── patrol.sh          # Background patrol system
│   ├── ports.sh           # Named port registry
│   ├── resource_manager.sh # Resource management
│   ├── session_aggregator.sh # Session tracking and aggregation
│   └── socket.sh          # Unix domain socket management
│
├── process/                # Process lifecycle management
│   ├── inspection.sh      # Process information and inspection
│   ├── lifecycle.sh       # Start/stop/restart operations
│   ├── list.sh            # Process listing (running/available)
│   └── management.sh      # CLI command handlers
│
├── services/               # Service definition management
│   ├── definitions.sh     # Service CRUD operations
│   ├── registry.sh        # Service registry
│   └── startup.sh         # Startup service management
│
├── integrations/          # External system adapters
│   ├── nginx.sh          # Nginx config generation
│   ├── systemd.sh        # Systemd service integration
│   └── tview.sh          # TView framework integration
│
└── tests/                 # Test suite
    ├── test_repl_v2.sh
    ├── test_repl_takeover_mode.sh
    └── test_migration_complete.sh
```

## Architecture Philosophy

### 1. Strong Globals Pattern

TSM follows tetra's **strong globals** pattern:
- `TETRA_SRC` - Source directory (must be set, enforced)
- `TETRA_DIR` - Runtime directory for state/logs/data
- `TSM_SRC` - TSM module source directory
- All module paths derived from `TETRA_SRC`, never hardcoded

```bash
# Good
source "$TETRA_SRC/bash/tsm/core/config.sh"

# Bad (never do this)
source ~/tetra/bash/tsm/core/config.sh
```

### 2. Module Organization

**core/** - Core functionality, no external system dependencies
- Pure bash logic
- Reusable across different TSM deployment contexts
- Loaded first in dependency order

**system/** - System-level operations
- Interacts with OS (ports, sockets, processes)
- Depends on core/ modules
- Provides primitives for higher-level operations

**process/** - Process lifecycle
- Start/stop/restart logic
- Process inspection and management
- Depends on core/ and system/

**services/** - Service definitions
- Saved service management (.tsm files)
- Service registry and startup
- Depends on process/

**integrations/** - External system adapters
- nginx, systemd, tview
- **Not "interfaces"** - that's a deprecated naming pattern
- Loaded last, optional dependencies

### 3. REPL Architecture

TSM's REPL follows the standard tetra pattern:

**Location**: `tsm/tsm_repl.sh` (module root, not in a subdirectory)

**Pattern**: Uses `bash/repl/repl.sh` library
- Override `repl_build_prompt()` for custom prompts
- Override `repl_process_input()` for command routing
- Register slash commands via `repl_register_slash_command()`

**Example**:
```bash
source "$TETRA_SRC/bash/repl/repl.sh"

tsm_repl_main() {
    # Set up custom prompt builder
    repl_build_prompt() { _tsm_repl_build_prompt "$@"; }

    # Set up custom input processor
    repl_process_input() { _tsm_repl_process_input "$@"; }

    # Run REPL
    repl_run
}
```

### 4. Module Registry Interface

TSM implements the tetra module discovery interface:

```bash
# In core/core.sh

tsm_module_actions() {
    echo "start stop restart delete list services logs ports doctor..."
}

tsm_module_properties() {
    echo "processes services logs ports status config environment..."
}

tsm_module_info() {
    echo "TSM - Tetra Service Manager"
    echo "Purpose: Local development process and service management"
    # ... status information
}

tsm_module_init() {
    _tsm_init_global_state
    # ... initialization logic
}
```

## Loading Order

The `core/include.sh` file orchestrates loading in dependency order:

```
Phase 1: Core Foundation (no dependencies)
  ↓
Phase 2: System Modules (depend on core)
  ↓
Phase 3: Service Modules (depend on core + system)
  ↓
Phase 4: Process Modules (depend on services)
  ↓
Phase 5: REPL Module (depends on everything above)
  ↓
Phase 6: Integration Modules (optional, external systems)
```

## Key Patterns

### Port Resolution Ladder (6 Steps)

From `core/port_resolution.sh`:

1. **--port flag** (explicit, highest priority)
2. **PORT from env file** (IRON FIST priority)
3. **Service template** (from patterns registry)
4. **Named port registry** (service-specific mappings)
5. **Command scan** (extract from command string)
6. **Default port** (3000, fallback)

### Process Metadata (PM2-style)

TSM uses JSON metadata stored in `$TETRA_DIR/tsm/runtime/processes/`:

```
processes/
├── devpages-4000/
│   └── meta.json       # Process metadata
├── api-5000/
│   └── meta.json
└── .reserved-0/        # ID reservation
```

Each `meta.json` contains:
- tsm_id (unique numeric ID)
- name (process name)
- pid (system process ID)
- command (original command)
- port (allocated port)
- status (online/stopped/errored)
- timestamps (start_time, etc.)

### Environment Handling

Environment files are sourced ONCE and parsed for:
- PORT or TETRA_PORT
- NAME or TETRA_NAME

```bash
eval "$(tsm_parse_env_file "$env_file")"
# Sets: ENV_PORT, ENV_NAME
```

## Naming Conventions

### Functions

- **Public API**: `tsm_command` or `tetra_tsm_command`
  - Example: `tsm_start_any_command`, `tetra_tsm_start`

- **Internal helpers**: `_tsm_helper`
  - Example: `_tsm_validate_script`, `_tsm_kill_process`

- **Module registry**: `tsm_module_*`
  - Example: `tsm_module_info`, `tsm_module_actions`

### Directories

- **integrations/** - External system adapters (nginx, systemd, tview)
- **system/** - System-level operations (ports, monitoring, audit)
- **core/** - Core functionality (no external dependencies)
- **process/** - Process lifecycle (start/stop/restart)
- **services/** - Service definitions (.tsm files)

**DO NOT use "interfaces/"** - this was a deprecated naming pattern from the old REPL implementation. External system adapters belong in `integrations/`.

## Integration Points

### With bash/repl

TSM's REPL integrates with the shared `bash/repl` library:
- Source `$TETRA_SRC/bash/repl/repl.sh`
- Override `repl_build_prompt()` and `repl_process_input()`
- Uses standard history management

### With TView

TSM provides tview integration commands:
- `tsm_tview_commands()` - Available commands
- `tsm_tview_dispatch()` - Command router
- `tsm_tview_status()` - Status display

### With Systemd

TSM can generate and manage systemd services:
- `tsm daemon install` - Install systemd service
- `tsm daemon enable` - Enable at boot
- `tsm daemon start/stop/status` - Service management

### With Nginx

TSM can generate nginx configurations:
- `tsm nginx generate <service>` - Create nginx config
- Integrates with named port registry

## Error Handling

TSM uses consistent exit codes:
- `0` - Success
- `1` - General error
- `64` - Usage error (missing arguments)
- `65` - Data format error (invalid env file, etc.)
- `66` - Cannot open input (file not found)

All error messages go to stderr (`>&2`) and are prefixed with `tsm:`.

## Best Practices

1. **Always validate `TETRA_SRC`** before loading modules
2. **Use strong globals** - derive paths from `TETRA_SRC`, never hardcode
3. **Follow loading order** - respect dependencies in `core/include.sh`
4. **Export functions** - use `export -f` for functions used by subprocesses
5. **Consistent naming** - public API uses `tsm_*`, internal uses `_tsm_*`
6. **Error to stderr** - all errors to `>&2` with `tsm:` prefix
7. **Document dependencies** - comment phase/dependencies in include.sh

## Future Enhancements

- [ ] Comprehensive architecture docs (this file)
- [ ] Module registry documentation
- [ ] Port allocation strategy guide
- [ ] Integration guide for new external systems
- [ ] Testing framework expansion
