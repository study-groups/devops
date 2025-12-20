# TSM Architecture

## Module Layers

TSM follows a layered architecture with strict dependency rules.

```
┌─────────────────────────────────────────────────────────────┐
│                         CLI Layer                            │
│  tsm.sh, index.sh, actions.sh                               │
├─────────────────────────────────────────────────────────────┤
│                      Services Layer                          │
│  services/start.sh, services/definitions.sh                 │
├─────────────────────────────────────────────────────────────┤
│                      Process Layer                           │
│  process/lifecycle.sh, process/management.sh                │
│  process/inspection.sh, process/list.sh                     │
├─────────────────────────────────────────────────────────────┤
│                       Core Layer                             │
│  core/config.sh, core/runtime.sh, core/utils.sh             │
│  core/port_resolution.sh, core/platform.sh                  │
├─────────────────────────────────────────────────────────────┤
│                      System Layer                            │
│  system/doctor/, system/ports.sh, system/analytics.sh       │
└─────────────────────────────────────────────────────────────┘
```

**Dependency Rule:** Each layer can only depend on layers below it.

## Directory Structure

```
tsm/
├── tsm.sh              # Main entry point, CLI router
├── index.sh            # Module metadata, tab completion
├── includes.sh         # Standard tetra module entry point
├── actions.sh          # Action registry integration
│
├── core/               # Foundation layer (no cross-deps)
│   ├── include.sh          # Loads all core modules
│   ├── platform.sh         # Platform detection (macOS/Linux)
│   ├── config.sh           # Configuration loading
│   ├── runtime.sh          # Runtime directories
│   ├── utils.sh            # Utility functions
│   ├── port_resolution.sh  # Port allocation
│   ├── patterns.sh         # Command pattern matching
│   ├── validation.sh       # Input validation
│   ├── environment.sh      # Environment file handling
│   ├── hooks.sh            # Lifecycle hooks
│   ├── metadata.sh         # Process metadata
│   ├── start.sh            # Low-level start logic
│   ├── setup.sh            # First-run setup
│   ├── colors.sh           # Color token resolution
│   ├── help.sh             # Help text rendering
│   ├── discovery.sh        # Auto-discovery
│   ├── service_paths.sh    # Service path resolution
│   └── child.sh            # Child process management
│
├── process/            # Process management layer
│   ├── lifecycle.sh        # Start/stop/kill primitives
│   ├── management.sh       # High-level process ops
│   ├── inspection.sh       # Process status queries
│   └── list.sh             # Process listing/display
│
├── services/           # Service abstraction layer
│   ├── start.sh            # Service start logic
│   └── definitions.sh      # Service lookup/resolution
│
├── system/             # System diagnostics
│   ├── ports.sh            # Port scanning
│   ├── socket.sh           # Socket inspection
│   ├── formatting.sh       # Output formatting
│   ├── analytics.sh        # Usage analytics
│   ├── patrol.sh           # Background monitoring
│   └── doctor/             # Health check subsystem
│       ├── index.sh            # Doctor entry point
│       ├── ports.sh            # Port diagnostics
│       └── processes.sh        # Process diagnostics
│
├── services-available/ # Service definitions (.tsm files)
│   ├── http.tsm
│   ├── node.tsm
│   └── python.tsm
│
├── tools/              # Development tools
│   └── depgraph.sh         # Dependency graph generator
│
└── tests/              # Test suites
    ├── run_all.sh          # Test runner
    ├── unit/               # Unit tests
    └── integration/        # Integration tests
```

## Module Responsibilities

### Core Layer

| Module | Responsibility |
|--------|---------------|
| `platform.sh` | Detect OS, check for required tools (lsof, flock, setsid) |
| `config.sh` | Load/save TSM configuration |
| `runtime.sh` | Manage runtime directories (processes/, logs/) |
| `utils.sh` | ID allocation, path utilities, common helpers |
| `port_resolution.sh` | Port availability check, allocation from range |
| `patterns.sh` | Match commands to known service patterns |
| `validation.sh` | Validate service names, ports, paths |
| `environment.sh` | Load/merge environment files |
| `hooks.sh` | Execute pre/post lifecycle hooks |
| `metadata.sh` | Read/write process metadata files |
| `start.sh` | Low-level process spawning with setsid |

### Process Layer

| Module | Responsibility |
|--------|---------------|
| `lifecycle.sh` | Start, stop, restart, kill operations |
| `management.sh` | High-level: `tetra_tsm_start`, `tetra_tsm_stop` |
| `inspection.sh` | Query process status, PID, port, uptime |
| `list.sh` | Format and display process lists |

### Services Layer

| Module | Responsibility |
|--------|---------------|
| `start.sh` | `tetra_tsm_start_service`, `tetra_tsm_start_local` |
| `definitions.sh` | `_tsm_find_service`, `_tsm_get_orgs` |

### System Layer

| Module | Responsibility |
|--------|---------------|
| `doctor/` | Health diagnostics (port conflicts, orphans) |
| `ports.sh` | Port scanning, port registry |
| `socket.sh` | Unix socket inspection |
| `analytics.sh` | Process metrics, usage stats |
| `patrol.sh` | Background health monitoring |

## Data Flow

### Service Start Flow

```
User: tsm start http
         │
         ▼
    ┌─────────┐
    │ tsm.sh  │  CLI router
    └────┬────┘
         │
         ▼
    ┌─────────────────┐
    │ management.sh   │  tetra_tsm_start()
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │ definitions.sh  │  _tsm_find_service()
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │ services/start  │  tetra_tsm_start_service()
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │ port_resolution │  tsm_allocate_port_from()
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │ core/start.sh   │  tsm_start_any_command()
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │ lifecycle.sh    │  Process spawning
    └─────────────────┘
```

### Process State

```
$TSM_DIR/
├── runtime/
│   └── processes/
│       ├── 0/             # TSM ID directory
│       │   ├── metadata   # PID, port, start time
│       │   ├── pid        # PID file
│       │   └── env        # Environment snapshot
│       └── 1/
│           └── ...
├── logs/
│   ├── my-service-8000.log
│   └── my-service-8000.err
└── config/
    └── tsm.conf
```

## Adding New Features

### New Core Utility

1. Add to `core/yourfile.sh`
2. Add source line to `core/include.sh`
3. Export functions with `export -f`
4. Add tests to `tests/unit/`

### New Service Type

1. Create `services-available/yourservice.tsm`
2. Define required variables: `TSM_NAME`, `TSM_COMMAND`, `TSM_PORT`
3. Optionally define: `TSM_CWD`, `TSM_ENV`, `TSM_PRE_COMMAND`

### New Doctor Check

1. Add to `system/doctor/yourcheck.sh`
2. Source from `system/doctor/index.sh`
3. Follow pattern: detect issue → report → suggest fix

## Conventions

### Function Naming

- Public API: `tetra_tsm_*` or `tsm_*`
- Internal helpers: `_tsm_*`
- Module-specific: `tsm_<module>_*`

### Error Handling

```bash
# Return codes
# 0 = success
# 1 = general error
# 2 = invalid input
# 3 = resource not found

# Error output
echo "Error: description" >&2
return 1
```

### State Management

- Process state in `$TSM_DIR/runtime/processes/<id>/`
- Configuration in `$TSM_DIR/config/`
- Logs in `$TSM_DIR/logs/`
- Never use global variables for mutable state

## Dependency Graph

Generate current dependencies:

```bash
bash tools/depgraph.sh                    # Text format
bash tools/depgraph.sh -f dot             # Graphviz
bash tools/depgraph.sh -f mermaid         # Mermaid
bash tools/depgraph.sh -t functions       # Function definitions
```
