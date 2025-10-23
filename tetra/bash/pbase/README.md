# pbase - PData Service Management Module

TETRA module for managing pdata (Plan 9-inspired multi-tenant file management) services with an interactive REPL and action-based CLI.

## Overview

`pbase` is a TETRA module that provides service management and administration for **pdata** - the underlying data layer. It follows TETRA conventions with:

- **verb:noun actions** - Structured command format
- **Interactive REPL** - Context-aware interface with Tab navigation
- **Service management** - Start, stop, monitor pdata services
- **User admin** - Manage pdata users and roles
- **File operations** - Browse and manage pdata filesystem
- **Audit logs** - View and monitor pdata activity

## Architecture

```
tetra/bash/pbase/
├── service.sh        # pdata service lifecycle (start/stop/status)
├── admin.sh          # User, file, audit management
├── actions.sh        # verb:noun action definitions and routing
├── pbase_repl.sh     # Interactive REPL with contexts
└── includes.sh       # Module loader and main pbase() function
```

**Data layer:** pdata (canonical location: `~/src/devops/devpages/pdata`)
**Module location:** `$TETRA_SRC/bash/pbase/`
**Data directory:** `$PBASE_DIR` (typically `$TETRA_DIR/pbase`)

## Installation

```bash
# 1. Source TETRA
source ~/tetra/tetra.sh

# 2. Set environment variables
export PBASE_SRC=$DEVOPS_SRC/pbase        # pbase repo (has init.sh)
export PBASE_DIR=$TETRA_DIR/pbase         # pbase data directory
export PDATA_SRC=$HOME/src/devops/devpages/pdata  # pdata source (optional, has default)
export PD_DIR=$PBASE_DIR/pdata            # pdata instance (optional, has default)

# 3. Source pbase init (loads the TETRA module)
source $PBASE_SRC/init.sh
```

## Usage

### Interactive REPL (Recommended)

```bash
pbase repl
```

**Navigation:**
- **Tab** - Cycle context (service → users → files → audit)
- **Ctrl+N** - Cycle mode (inspect → execute)
- **Ctrl+Space** - Cycle action within context:mode
- **Enter** - Execute highlighted action

**Status indicator:**
- **● green** - pdata service running
- **○ gray** - pdata service stopped

### Actions (verb:noun format)

#### Service Actions

```bash
# Inspect
pbase check:env          # Validate environment
pbase show:status        # Show service status
pbase show:info          # Show configuration

# Execute
pbase start:service      # Start pdata
pbase stop:service       # Stop pdata
pbase restart:service    # Restart pdata
pbase run:tests          # Run pdata tests
```

#### User Actions

```bash
# Inspect
pbase list:users         # List all users

# Execute
pbase add:user alice secret123 admin
pbase delete:user alice
```

#### File Actions

```bash
# Inspect
pbase list:files         # List files
pbase list:files /uploads
pbase tree:files         # Show file tree
```

#### Audit Actions

```bash
# Inspect
pbase tail:log 50        # Show last 50 audit entries
pbase watch:log          # Live tail audit log
```

### Legacy Commands (backward compatible)

```bash
# Service
pbase start [port]
pbase stop
pbase restart
pbase status
pbase check

# Admin
pbase user list
pbase user add alice secret123
pbase file tree /uploads
pbase audit tail 50
```

## Environment Variables

### Required
- `TETRA_DIR` - TETRA data directory
- `TETRA_SRC` - TETRA source directory
- `PBASE_SRC` - pbase repository (contains init.sh)
- `PBASE_DIR` - pbase data directory

### Optional (have defaults)
- `PDATA_SRC` - pdata source location (default: `~/src/devops/devpages/pdata`)
- `PD_DIR` - pdata instance directory (default: `$PBASE_DIR/pdata`)
- `PDATA_PORT` - pdata service port (default: `3000`)

## REPL Contexts & Modes

The REPL organizes actions into **contexts** and **modes**:

| Context | Mode    | Actions |
|---------|---------|---------|
| service | inspect | check:env, show:status, show:info |
| service | execute | start:service, stop:service, restart:service, run:tests |
| users   | inspect | list:users, show:status |
| users   | execute | add:user, delete:user |
| files   | inspect | list:files, tree:files, show:status |
| files   | execute | clean:temp |
| audit   | inspect | tail:log, watch:log, show:status |

## Integration with pdata

`pbase` wraps [pdata](https://github.com/study-groups/devops/tree/main/devpages/pdata) - a Plan 9-inspired multi-tenant file management system.

**pdata features:**
- Capability-based security
- Virtual filesystem namespaces
- CSV-based user/role storage
- Comprehensive audit logging
- RESTful API via Express

**pbase provides:**
- Service lifecycle management
- CLI and REPL interfaces
- TETRA integration
- Structured action system

## Examples

### Start pdata and manage users

```bash
# Start REPL
pbase repl

# In REPL:
# - Tab to "service" context
# - Ctrl+N to "execute" mode
# - Ctrl+Space to "start:service"
# - Enter (starts on default port 3000)

# - Tab to "users" context
# - Ctrl+N to "execute" mode
# - Ctrl+Space to "add:user"
# - Type: add:user alice secret123 admin
```

### Direct CLI usage

```bash
# Check environment
pbase check:env

# Start service
pbase start:service 8080

# Add user
pbase add:user bob password user

# List files
pbase tree:files

# Watch audit log
pbase watch:log
```

## Development

### Adding new actions

1. Add action to `pbase_get_actions()` in `actions.sh`
2. Add handler in `pbase_action()` dispatcher
3. Implement function in `service.sh` or `admin.sh`

Example:

```bash
# In actions.sh
"service:execute")
    actions="... backup:data"
    ;;

# In pbase_action() dispatcher
backup:data)
    source "$TETRA_SRC/bash/pbase/service.sh"
    pdata_backup "$@"
    ;;

# In service.sh
pdata_backup() {
    # implementation
}
```

## Files in pbase repo (devops/pbase)

The main pbase repo is now minimal:

```
pbase/
├── init.sh              # Environment setup, sources TETRA module
├── start.sh             # Quick start script
├── pdata -> ~/src/devops/devpages/pdata/  # Symlink to pdata
├── legacy/              # Old nginx/go/node examples
└── archive/             # Old frontend experiments
```

All logic is in the TETRA module: `$TETRA_SRC/bash/pbase/`

## Related

- [pdata](https://github.com/study-groups/devops/tree/main/devpages/pdata) - Plan 9-inspired file management
- [org module](../org/) - Similar TETRA module with actions pattern
- [tsm module](../tsm/) - TETRA service manager

## License

ISC
