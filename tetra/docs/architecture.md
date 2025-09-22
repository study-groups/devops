# Tetra System Architecture

Technical architecture overview emphasizing the module system and component relationships.

## Module System Architecture

**tmod** (Tetra Module Manager) serves as the system orchestrator, providing:

- **Module Registration**: Components register with tmod for lifecycle management
- **Lazy Loading**: Functions are stubbed until first use, reducing startup time
- **Dependency Management**: Modules load in proper dependency order
- **Environment Isolation**: Each module maintains its own namespace and data

### Startup Sequence

```
~/tetra/tetra.sh
├── Sets TETRA_DIR and TETRA_SRC
└── Sources $TETRA_SRC/bash/bootloader.sh
    ├── boot_core.sh - Module system and arrays
    ├── boot_modules.sh - Module registration and lazy loading
    ├── boot_aliases.sh - Command aliases
    └── boot_prompt.sh - Shell prompt setup
```

### Module Lifecycle

1. **Registration Phase**:
   ```bash
   tetra_register_module "tsm" "$TETRA_SRC/bash/tsm"
   tetra_register_module "rag" "$TETRA_SRC/bash/rag"
   ```

2. **Lazy Loading Phase**:
   ```bash
   # Functions are stubbed until first use
   tsm() { tetra_load_module "tsm" && tsm "$@"; }
   ```

3. **Active Phase**: Module fully loaded and functional

## Component Relationships

```
tmod (Module Manager)
├── TSM (Service Manager)
│   ├── Named Port Registry
│   ├── Service Definitions (.tsm.sh files)
│   └── Service Lifecycle (start/stop/enable/disable)
├── TDash (Modal Dashboard)
│   ├── Mode Navigation (TOML ↔ TKM ↔ TSM ↔ DEPLOY ↔ ORG)
│   ├── Environment Navigation (SYSTEM ↕ LOCAL ↕ DEV ↕ STAGING ↕ PROD)
│   └── Item Navigation (within selected mode+environment)
└── Organization Management
    ├── Multi-client Configuration
    ├── Environment Promotion (dev → staging → prod)
    └── Template System
```

## Directory Structure

```
TETRA_SRC/bash/
├── bootloader.sh           # Main entry point
├── boot/                   # Bootstrap components
│   ├── boot_core.sh       # Module system initialization
│   ├── boot_modules.sh    # Module registration
│   └── boot_aliases.sh    # Command aliases
├── tmod/                   # Module Manager
│   ├── tmod.sh            # Main interface
│   ├── tmod_core.sh       # Core functionality
│   └── tmod_repl.sh       # Interactive interface
├── tsm/                    # Service Manager
│   ├── tsm.sh             # Main interface
│   ├── tsm_core.sh        # Core functionality
│   ├── tsm_ports.sh       # Named port registry
│   └── tsm_interface.sh   # Service definition integration
├── tdash/                  # Modal Dashboard
│   ├── tdash.sh           # Main interface
│   └── tdash_repl.sh      # Modal interface implementation
└── utils/                  # Shared utilities
    ├── module_config.sh   # Persistent module configuration
    └── tetra_utils.sh     # Common functions
```

## Data Architecture

```
TETRA_DIR/
├── config/
│   ├── tetra.toml         # Active organization config (symlink)
│   └── tetra/             # Tetra module storage
├── orgs/                  # Organization management
│   ├── pixeljam/          # Organization-specific configs
│   └── acme/              # Another organization
├── services/              # TSM service definitions
│   ├── enabled/           # Enabled services (symlinks)
│   └── available/         # Available service definitions
├── env/                   # Environment files
│   ├── dev.env
│   ├── staging.env
│   └── prod.env
└── tsm/                   # TSM runtime data
    ├── logs/              # Service logs
    ├── pids/              # Process ID files
    └── processes/         # Process management
```

## Integration Points

### Named Port Registry
- **Standard Assignments**: devpages:4000, tetra:4444, arcade:8400, pbase:2600
- **Resolution Priority**: Explicit port → Environment file → Named registry → Default
- **Integration**: TSM service definitions auto-resolve ports from registry

### Modal Dashboard Interface
- **Dual-Axis Control**: Mode navigation (horizontal) × Environment navigation (vertical)
- **25 Unique Views**: 5 modes × 5 environments
- **Real-time Updates**: Live service status and configuration display

### Environment Promotion
- **Workflow**: dev → staging → prod with validation and rollback
- **Adaptations**: Environment-specific configuration transformations
- **Templates**: Parameterized service and infrastructure templates

### SystemD Integration
- **Production Daemon**: Native systemd service for production deployment
- **Service Discovery**: Automatic detection and management of enabled services
- **Security Hardening**: Production templates include security configurations

## Module Development Patterns

### New Module Creation
1. Create module directory in `TETRA_SRC/bash/`
2. Implement main interface file (`module_name.sh`)
3. Register module in bootloader sequence
4. Add module-specific data directory in `TETRA_DIR/`
5. Implement lazy loading stubs

### Module Integration
- Use `tetra_register_module` for registration
- Follow tmod lifecycle patterns
- Implement proper dependency declarations
- Use shared utilities from `utils/` directory

---

*For assistant guidance, see [guide.md](guide.md)*
*For development patterns, see [reference/development/](reference/development/)*